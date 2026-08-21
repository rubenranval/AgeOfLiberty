using AgeOfLiberty.Models;
using AgeOfLiberty.Services;

namespace AgeOfLiberty.Services;

public class EconomyEngine : IDisposable
{
    private readonly GameState _state;
    private readonly GameConfigStore _config;
    private readonly ScenarioEngine _scenarios;
    private readonly Random _rng = new();

    private Timer? _incomeTicker;
    private Timer? _popGrowthTicker;
    private Timer? _jitterTicker;
    private Timer? _turnTicker;

    private bool _running;

    // ── Cascade tuning ──────────────────────────────────────────────────────
    // How much of a price shock carries to atoms that depend on the shocked good.
    // wood ×1.5 → hut ×1.28 → stable ×1.16 ... (mult^0.6 per hop)
    private const double CascadeDamping = 0.5;
    private const int CascadeHopDelayMs = 700;
    private const int CascadeMaxHops = 2;

    public EconomyEngine(GameState state, GameConfigStore config, ScenarioEngine scenarios)
    {
        _state = state;
        _config = config;
        _scenarios = scenarios;
    }

    public void Start()
    {
        if (_running || !_config.IsLoaded) return;
        _running = true;

        var cfg = _config.Config;
        _incomeTicker = new Timer(_ => TickIncome(), null, 0, cfg.TickIntervalMs);
        _popGrowthTicker = new Timer(_ => TickPopGrowth(), null, cfg.PopGrowthIntervalMs, cfg.PopGrowthIntervalMs);
        _jitterTicker = new Timer(_ => TickJitter(), null, 0, cfg.JitterIntervalMs);
        _turnTicker = new Timer(_ => TickTurn(), null, 1000, 1000);
    }

    public void Stop()
    {
        _running = false;
        _incomeTicker?.Dispose(); _incomeTicker = null;
        _popGrowthTicker?.Dispose(); _popGrowthTicker = null;
        _jitterTicker?.Dispose(); _jitterTicker = null;
        _turnTicker?.Dispose(); _turnTicker = null;
    }

    public void Dispose() => Stop();

    private void TickIncome()
    {
        if (_state.Phase != GamePhase.Play || _state.ActiveScenario != null) return;

        var cfg = _config.Config;
        var atomIncome = AtomIncome();

        var incomePerTick = (cfg.BaseIncome
            + Math.Floor(_state.Population * cfg.PopIncomeMultiplier)
            + atomIncome) * 0.15;

        _state.Gold += Math.Max(1, (long)Math.Round(incomePerTick));
        _state.NotifyStateChanged();
    }

    private void TickPopGrowth()
    {
        if (_state.Phase != GamePhase.Play || _state.ActiveScenario != null) return;

        var housingWeight = _config.Atoms
            .Where(a => a.HousingWeight > 0)
            .Sum(a => _state.GetBuiltCount(a.Id) * a.HousingWeight);

        if (housingWeight <= 0) return;

        var growth = _config.Config.PopGrowthRate * housingWeight;
        _state.PopGrowthFraction += growth;

        while (_state.PopGrowthFraction >= 1)
        {
            _state.PopGrowthFraction -= 1;
            _state.Population++;
            CheckEraUnlock();
        }

        _state.NotifyStateChanged();
    }

    private void TickJitter()
    {
        if (_state.Phase != GamePhase.Play) return;

        var cfg = _config.Config;
        var eraIndex = _config.GetEraIndex(_state.Population);
        var available = _config.GetAvailableAtoms(eraIndex);

        foreach (var atom in available)
        {
            _state.PriceJitter[atom.Id] = cfg.JitterMin + _rng.NextDouble() * (cfg.JitterMax - cfg.JitterMin);
        }

        _state.NotifyStateChanged();
    }

    private void TickTurn()
    {
        if (_state.Phase != GamePhase.Play) return;

        _state.TickCount++;
        if (_state.TickCount % _config.Config.TurnTicks != 0) return;

        _state.Turn++;

        // Record snapshots — GetCleanPrice MUST include PriceMultipliers
        // (base × multipliers, no jitter), or charts will never move.
        var prices = new Dictionary<int, int>();
        foreach (var atom in _config.Atoms)
            prices[atom.Id] = _state.GetCleanPrice(atom);

        _state.PriceHistory.Add(new PriceSnapshot { Turn = _state.Turn, Prices = prices });
        _state.PopHistory.Add(new PopSnapshot { Turn = _state.Turn, Pop = _state.Population, Gold = _state.Gold });

        // Keep enough history for long sessions — chart math assumes
        // index == turn-1, so trimming would desynchronize markers and
        // the ghost line. 600 turns ≈ 2.5h of play.
        if (_state.PriceHistory.Count > 600) _state.PriceHistory.RemoveAt(0);
        if (_state.PopHistory.Count > 600) _state.PopHistory.RemoveAt(0);

        ProcessDelayedEffects();

        _scenarios.CheckTriggers();

        _state.NotifyStateChanged();
    }

    private void ProcessDelayedEffects()
    {
        var ready = _state.DelayedEffects.Where(e => e.TriggerTurn <= _state.Turn).ToList();
        foreach (var effect in ready)
        {
            ApplyEffects(effect.Effects);
            _state.AddLog(effect.Feedback);
            _state.DelayedEffects.Remove(effect);
            // Let the cascade play out before the modal explains it
            var fb = effect.Feedback;
            Task.Delay(3500).ContinueWith(_ =>
            {
                _state.FeedbackText = fb;
                _state.NotifyStateChanged();
            });
        }
    }

    public bool TryBuild(int atomId)
    {
        if (!_config.AtomsById.TryGetValue(atomId, out var atom)) return false;
        var cost = _state.GetBuildCost(atom, _config);
        if (_state.Gold < cost) return false;

        _state.Gold -= cost;
        _state.Built[atomId] = _state.GetBuiltCount(atomId) + 1;

        if (atom.PopGain > 0)
        {
            _state.Population += atom.PopGain;
            CheckEraUnlock();
        }

        _state.AddLog($"Built {atom.Icon} {atom.Name} for ${FormatNumber(cost)}");
        _state.SelectedAtomId = null;
        _state.DrawerOpen = false;
        _state.NotifyStateChanged();
        return true;
    }

    /// <summary>Bulk build: N units, ONE state notification, ONE log line.
    /// The per-unit path fires a full UI re-render each call — buying 500
    /// water mills that way melts low-end phones. This does the same
    /// arithmetic in a tight loop and tells the UI once at the end.</summary>
    public (int built, long spent) TryBuildBulk(int atomId, int count)
    {
        if (!_config.AtomsById.TryGetValue(atomId, out var atom)) return (0, 0);
        int built = 0;
        long spent = 0;
        bool popChanged = false;
        for (int i = 0; i < count; i++)
        {
            var cost = _state.GetBuildCost(atom, _config);
            if (_state.Gold < cost) break;
            _state.Gold -= cost;
            _state.Built[atomId] = _state.GetBuiltCount(atomId) + 1;
            built++;
            spent += cost;
            if (atom.PopGain > 0) { _state.Population += atom.PopGain; popChanged = true; }
        }
        if (built > 0)
        {
            if (popChanged) CheckEraUnlock();
            _state.AddLog($"Built {atom.Icon} {atom.Name} ×{built} for ${FormatNumber(spent)}");
            _state.SelectedAtomId = null;
            _state.DrawerOpen = false;
            _state.NotifyStateChanged();
        }
        return (built, spent);
    }

    // ── Cascade: shocks travel the dependency graph ─────────────────────────
    //
    // A choice shocks its target atoms directly. Then the shock PROPAGATES:
    // every atom that requires a shocked good inherits a damped version of
    // the shock (mult^damping per hop), breadth-first, up to CascadeMaxHops.
    // Each hop lands CascadeHopDelayMs after the previous — matching the
    // traveling-pulse animation on the map.

    public void ApplyEffects(Dictionary<int, double> effects)
    {
        // Shocks only touch the economy that exists: locked (future-era)
        // atoms are excluded from both direct hits and propagation.
        // NOTE: uses the GATED era (pop threshold AND issues answered), which
        // is what the map actually renders — population alone runs ahead of it.
        var availableIds = _config
            .GetAvailableAtoms(GatedEraIndex())
            .Select(a => a.Id).ToHashSet();

        // hop 0: the direct shocks
        var wave = effects.Where(kv => availableIds.Contains(kv.Key))
                          .ToDictionary(kv => kv.Key, kv => kv.Value);
        var visited = new HashSet<int>(wave.Keys);

        for (int hop = 0; hop <= CascadeMaxHops && wave.Count > 0; hop++)
        {
            // One scheduled task per HOP, not per atom: a 10-atom wave used to
            // trigger ~20 full UI re-renders; now the whole cascade costs ≤6.
            ScheduleHop(new Dictionary<int, double>(wave), hop * CascadeHopDelayMs, hop == 0 ? 2500 : 1400);

            // Build the next wave: dependents of everything in this wave
            var next = new Dictionary<int, double>();
            foreach (var (atomId, mult) in wave)
            {
                // Skip negligible ripples
                var carried = Math.Pow(mult, CascadeDamping);
                if (Math.Abs(carried - 1.0) < 0.05) continue;

                foreach (var dep in _config.Dependencies.Where(d => d.RequiresAtomId == atomId))
                {
                    if (visited.Contains(dep.AtomId) || !availableIds.Contains(dep.AtomId)) continue;
                    // If two inputs of the same atom are shocked, compound them
                    next[dep.AtomId] = next.GetValueOrDefault(dep.AtomId, 1.0) * carried;
                }
            }
            foreach (var k in next.Keys) visited.Add(k);
            wave = next;
        }
    }

    private void ScheduleHop(Dictionary<int, double> hopWave, int delayMs, int visualMs)
    {
        Task.Delay(delayMs).ContinueWith(_ =>
        {
            foreach (var (atomId, mult) in hopWave)
            {
                _state.Cascading[atomId] = true;
                var old = _state.PriceMultipliers.GetValueOrDefault(atomId, 1.0);
                _state.PriceMultipliers[atomId] = Math.Round(old * mult * 100) / 100;
            }
            _state.NotifyStateChanged();

            Task.Delay(visualMs).ContinueWith(_ =>
            {
                foreach (var atomId in hopWave.Keys) _state.Cascading[atomId] = false;
                _state.NotifyStateChanged();
            });
        });
    }

    // Mirror of the GamePage gate: era N is live only when pop crossed AND
    // every issue of eras 0..N-1 has been answered (read from Preferences).
    private int GatedEraIndex()
    {
        int allowed = 0;
        int popIdx = _config.GetEraIndex(_state.Population);
        while (allowed < popIdx)
        {
            var era = _config.Eras[allowed];
            int total = _config.Scenarios.Count(sc => sc.EraId == era.Id);
            if (IssueProgress.Done(era.Id) >= total) allowed++;
            else break;
        }
        return allowed;
    }

    // ── Era detection ───────────────────────────────────────────────────────

    private int _lastEraIndex = 0;

    private void CheckEraUnlock()
    {
        var newIndex = _config.GetEraIndex(_state.Population);
        if (newIndex > _lastEraIndex)
        {
            _lastEraIndex = newIndex;
            _state.EraUnlockAnimIndex = newIndex;
            _state.AddLog($"Welcome to the {_config.Eras[newIndex].Name} era!");
            _state.NotifyStateChanged();
            // No auto-dismiss — player taps to continue
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    public static string FormatNumber(long n)
    {
        if (n >= 1_000_000_000) return $"{n / 1_000_000_000.0:0.#}B";
        if (n >= 1_000_000) return $"{n / 1_000_000.0:0.#}M";
        if (n >= 10_000) return $"{n / 1_000.0:0.#}K";
        if (n >= 1_000) return $"{n / 1_000.0:0.##}K";
        return n.ToString();
    }

    public int GetIncomeRate()
    {
        var cfg = _config.Config;
        return (int)(cfg.BaseIncome + Math.Floor(_state.Population * cfg.PopIncomeMultiplier) + AtomIncome());
    }

    /// <summary>v2: income comes from atoms' IncomeBonus (commerce lineage:
    /// Water Mill → Telegraph → Radio → Internet → Quantum → Space Datacenter).
    /// Replaces the old hardcoded Market/Farm lookup.</summary>
    private long AtomIncome()
    {
        long total = 0;
        foreach (var a in _config.Atoms)
        {
            if (a.IncomeBonus <= 0) continue;
            var built = _state.GetBuiltCount(a.Id);
            if (built > 0) total += (long)built * a.IncomeBonus;
        }
        return total;
    }
}