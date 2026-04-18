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
        var marketCount = _state.GetBuiltCount(_config.Atoms.FirstOrDefault(a => a.Name == "Market")?.Id ?? -1);
        var farmCount = _state.GetBuiltCount(_config.Atoms.FirstOrDefault(a => a.Name == "Farm")?.Id ?? -1);

        var incomePerTick = (cfg.BaseIncome
            + Math.Floor(_state.Population * cfg.PopIncomeMultiplier)
            + marketCount * cfg.MarketIncomeBonus
            + farmCount * cfg.FarmIncomeBonus) * 0.15;

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

        // enregistrer événements
        var prices = new Dictionary<int, int>();
        foreach (var atom in _config.Atoms)
            prices[atom.Id] = _state.GetCleanPrice(atom);

        _state.PriceHistory.Add(new PriceSnapshot { Turn = _state.Turn, Prices = prices });
        _state.PopHistory.Add(new PopSnapshot { Turn = _state.Turn, Pop = _state.Population, Gold = _state.Gold });

     
        if (_state.PriceHistory.Count > 100) _state.PriceHistory.RemoveAt(0);
        if (_state.PopHistory.Count > 100) _state.PopHistory.RemoveAt(0);

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
            _state.FeedbackText = effect.Feedback;
            _state.DelayedEffects.Remove(effect);

            Task.Delay(4000).ContinueWith(_ =>
            {
                if (_state.FeedbackText == effect.Feedback)
                {
                    _state.FeedbackText = null;
                    _state.NotifyStateChanged();
                }
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

    // ── Cascade ─────────────────────────────────────────────────────────────

    public void ApplyEffects(Dictionary<int, double> effects)
    {
        var keys = effects.Keys.ToList();
        for (int i = 0; i < keys.Count; i++)
        {
            var atomId = keys[i];
            var delay = i * 700;
            var mult = effects[atomId];

            Task.Delay(delay).ContinueWith(_ =>
            {
                _state.Cascading[atomId] = true;
                var old = _state.PriceMultipliers.GetValueOrDefault(atomId, 1.0);
                _state.PriceMultipliers[atomId] = Math.Round(old * mult * 100) / 100;
                _state.NotifyStateChanged();

                Task.Delay(2500).ContinueWith(_ =>
                {
                    _state.Cascading[atomId] = false;
                    _state.NotifyStateChanged();
                });
            });
        }
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
        var marketCount = _state.GetBuiltCount(_config.Atoms.FirstOrDefault(a => a.Name == "Market")?.Id ?? -1);
        var farmCount = _state.GetBuiltCount(_config.Atoms.FirstOrDefault(a => a.Name == "Farm")?.Id ?? -1);
        return (int)(cfg.BaseIncome + Math.Floor(_state.Population * cfg.PopIncomeMultiplier) + marketCount * cfg.MarketIncomeBonus + farmCount * cfg.FarmIncomeBonus);
    }
}