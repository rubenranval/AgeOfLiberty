using AgeOfLiberty.Models;

namespace AgeOfLiberty.Services;

/// <summary>
/// Turns the existing build-and-price economy into a legible city pressure
/// loop. Citizens consume categories rather than inventory items: capacity is
/// derived from what the player built, while scarcity moves prices gradually.
/// </summary>
public class CityPressureEngine
{
    private readonly GameState _state;
    private readonly GameConfigStore _config;

    private static readonly HashSet<string> FoodSlugs = new(StringComparer.OrdinalIgnoreCase)
    { "grain", "farm", "cattle", "fish", "bread", "lab_grown_meat" };

    private static readonly HashSet<string> EnergySlugs = new(StringComparer.OrdinalIgnoreCase)
    { "wood", "timber", "fire", "water_mill", "coal", "oil", "shale_gas", "turbine", "solar", "nuclear_power", "fusion_reactor", "lithium_battery", "antimatter" };

    public CityPressureEngine(GameState state, GameConfigStore config)
    {
        _state = state;
        _config = config;
    }

    public IReadOnlyList<CityNeedItem> GetBasket(int? requestedEraIndex = null)
    {
        if (!_config.IsLoaded || _config.Eras.Count == 0) return Array.Empty<CityNeedItem>();

        var eraIndex = Math.Clamp(requestedEraIndex ?? ActiveEraIndex, 0, _config.Eras.Count - 1);
        var available = _config.GetAvailableAtoms(eraIndex).Where(a => a.IsBuildable).ToList();
        var groups = new[]
        {
            (Category: "food", Label: "Food", Icon: "🌾", Weight: .35),
            (Category: "housing", Label: "Housing", Icon: "🏠", Weight: .25),
            (Category: "energy", Label: "Energy", Icon: "⚡", Weight: .25),
            (Category: "essentials", Label: "Essentials", Icon: "◆", Weight: .15),
        };

        var result = new List<CityNeedItem>();
        foreach (var group in groups)
        {
            var candidates = available.Where(a => CategoryOf(a) == group.Category).ToList();
            if (candidates.Count == 0 && group.Category == "essentials")
            {
                candidates = available.Where(a => CategoryOf(a) == null)
                    .OrderByDescending(a => EraIndexOf(a.EraId)).ThenByDescending(a => a.BasePrice).Take(3).ToList();
            }

            var representative = candidates
                .OrderByDescending(a => EraIndexOf(a.EraId))
                .ThenByDescending(a => _state.GetBuiltCount(a.Id) > 0)
                .ThenBy(a => _state.GetCleanPrice(a))
                .FirstOrDefault();

            var civicBaseline = Math.Max(8, _config.Eras[eraIndex].MinPop * 1.12);
            var capacity = civicBaseline + candidates.Sum(a => _state.GetBuiltCount(a.Id) * CapacityOf(a, eraIndex));
            var coverage = Math.Clamp(capacity / Math.Max(1, _state.Population), 0, 1.35);

            result.Add(new CityNeedItem
            {
                Category = group.Category,
                Label = representative?.Name ?? group.Label,
                Icon = string.IsNullOrWhiteSpace(representative?.Icon) ? group.Icon : representative.Icon,
                AtomId = representative?.Id,
                Weight = group.Weight,
                Coverage = coverage,
                UnitPrice = representative == null ? 1 : _state.GetCleanPrice(representative),
            });
        }
        return result;
    }

    public void AdvanceTurn(long incomeRate)
    {
        if (!_config.IsLoaded || _config.Eras.Count == 0) return;

        _state.HighestEraIndex = Math.Max(_state.HighestEraIndex, _config.GetEraIndex(_state.Population));
        var eraIndex = ActiveEraIndex;
        if (_state.PressureStartedTurn <= 0) _state.PressureStartedTurn = _state.Turn;

        var basket = GetBasket(eraIndex);
        var demandedAtomIds = new HashSet<int>();
        foreach (var need in basket)
        {
            if (need.AtomId is not int atomId) continue;
            demandedAtomIds.Add(atomId);
            var target = Math.Clamp(1 + .72 * (1 - need.Coverage), .78, 1.85);
            var old = _state.GetDemandMultiplier(atomId);
            _state.DemandMultipliers[atomId] = Math.Round((old + (target - old) * .22) * 1000) / 1000;
        }
        foreach (var atomId in _state.DemandMultipliers.Keys.Where(id => !demandedAtomIds.Contains(id)).ToList())
        {
            var old = _state.DemandMultipliers[atomId];
            var relaxed = old + (1 - old) * .08;
            if (Math.Abs(relaxed - 1) < .005) _state.DemandMultipliers.Remove(atomId);
            else _state.DemandMultipliers[atomId] = Math.Round(relaxed * 1000) / 1000;
        }

        double currentBasket = 0, baseBasket = 0, coverage = 0, minimumCoverage = 1.35;
        foreach (var need in GetBasket(eraIndex))
        {
            var atom = need.AtomId is int id ? _config.AtomsById.GetValueOrDefault(id) : null;
            currentBasket += need.Weight * Math.Max(1, need.UnitPrice);
            baseBasket += need.Weight * Math.Max(1, atom?.BasePrice ?? 1);
            coverage += need.Weight * need.Coverage;
            minimumCoverage = Math.Min(minimumCoverage, need.Coverage);
        }

        var incomePerCitizen = incomeRate / (double)Math.Max(1, _state.Population);
        var eraIncomeBaseline = .20 + eraIndex * .025;
        var incomeIndex = Math.Clamp(incomePerCitizen / eraIncomeBaseline, .35, 2.25);
        var priceIndex = currentBasket / Math.Max(1, baseBasket);
        var coveragePenalty = .55 + .45 * Math.Clamp(coverage, 0, 1);
        var affordabilityTarget = Math.Clamp(incomeIndex / Math.Max(.35, priceIndex) * coveragePenalty, .25, 1.75);
        _state.Affordability += (affordabilityTarget - _state.Affordability) * .24;

        var indicators = CivicIndicators.ComputeAll(_state, _config, incomeRate);
        var civicMood = indicators[CivicIndicators.CivicMood];
        var approvalTarget = Math.Clamp(
            52 + 35 * (_state.Affordability - 1) + 22 * (coverage - 1) + .18 * (civicMood - 50), 5, 95);
        _state.Approval += (approvalTarget - _state.Approval) * .14;

        var growthTarget = .0015
            + .010 * (_state.Affordability - 1)
            + .006 * ((_state.Approval - 50) / 50)
            + .010 * (minimumCoverage - 1);
        growthTarget = Math.Clamp(growthTarget, -.018, .012);
        _state.NetGrowthRate += (growthTarget - _state.NetGrowthRate) * .25;

        for (var goalEra = 0; goalEra <= eraIndex; goalEra++)
            UpdateGoals(goalEra, indicators[CivicIndicators.Education]);
        AdvanceChallenge();
        UpdateOusterPressure();
    }

    public int ActiveEraIndex
    {
        get
        {
            int unlocked = Math.Clamp(_state.HighestEraIndex, 0, Math.Max(0, _config.Eras.Count - 1));
            int allowed = 0;
            while (allowed < unlocked)
            {
                var era = _config.Eras[allowed];
                if (!IssueProgress.EraComplete(era.Id, _config.Scenarios.Count(s => s.EraId == era.Id))) break;
                allowed++;
            }
            return allowed;
        }
    }

    public bool StartNextChallenge()
    {
        if (_state.Phase != GamePhase.Play || !_config.IsLoaded
            || _state.ActiveChallenge?.Status == ChallengeStatus.Active) return false;
        var rules = ChallengeCatalog.Get(_state.NextChallengeIndex);
        if (rules == null) return false;
        var basket = GetBasket();
        // Never offer a deadline the player has no accessible supply action for.
        if (rules.Categories.Any(c => !basket.Any(n => n.Category == c && n.AtomId != null))) return false;
        _state.ActiveChallenge = ChallengeRules.Start(rules, _state.Turn, _state.Population);
        _state.ActiveChallenge.Coverage = ChallengeCoverage(_state.ActiveChallenge);
        _state.NotifyStateChanged();
        return true;
    }

    public Dictionary<string, double> ChallengeCoverage(CityChallenge round) => GetBasket()
        .ToDictionary(n => n.Category, n => n.Coverage * Math.Max(1, _state.Population)
            / (Math.Max(1.0, _state.Population) + round.ExpectedCitizens));

    private void AdvanceChallenge()
    {
        var round = _state.ActiveChallenge;
        if (round == null || !ChallengeRules.Advance(round, _state.Turn, ChallengeCoverage(round))) return;
        bool won = round.Status == ChallengeStatus.Won;
        int arrivals = won ? round.SuccessArrivals : round.FailureArrivals;
        _state.Population += arrivals;
        _state.NextChallengeIndex++;
        var measurements = string.Join(" · ", round.Rules.Categories.Select(c =>
            $"{c}: {round.Coverage.GetValueOrDefault(c):P0}"));
        round.Result = won
            ? $"{arrivals} citizens arrived. They now contribute to city income and need supplies."
            : $"Only {arrivals} citizens arrived; {round.SuccessArrivals - arrivals} chose not to move.";
        AddDispatch(DispatchKind.Progress, won ? "Challenge met — " + round.Rules.Title
            : "Challenge missed — " + round.Rules.Title,
            measurements + ". " + round.Result + " " + round.Rules.Lesson, toast: true);
    }

    public string AffordabilityLabel => _state.Affordability switch
    {
        >= 1.15 => "Affordable",
        >= .90 => "Strained",
        >= .70 => "Unaffordable",
        _ => "Leaving",
    };

    public int AffordabilityScore => (int)Math.Round(Math.Clamp((_state.Affordability - .45) / .85 * 100, 0, 100));

    private void UpdateOusterPressure()
    {
        if (_state.Turn - _state.PressureStartedTurn < 6) return;
        var critical = 0;
        if (_state.Affordability < .72) critical++;
        if (_state.Approval < 28) critical++;
        if (_state.NetGrowthRate < -.006) critical++;

        _state.OusterPressure = critical >= 2
            ? Math.Min(100, _state.OusterPressure + (critical == 3 ? 13 : 9))
            : Math.Max(0, _state.OusterPressure - 14);

        var warningStage = _state.OusterPressure switch { >= 75 => 3, >= 50 => 2, >= 25 => 1, _ => 0 };
        if (warningStage > _state.OusterWarningStage)
        {
            _state.OusterWarningStage = warningStage;
            AddDispatch(DispatchKind.Warning, "Mandate at risk", warningStage switch
            {
                1 => "Citizens are losing confidence. Improve at least two city conditions to reverse the pressure.",
                2 => "Emigration and discontent are accelerating. Your administration is now in danger.",
                _ => "Final warning: restore affordability, approval, or growth before the council acts.",
            }, toast: true);
        }
        else if (warningStage == 0 && _state.OusterPressure == 0)
        {
            _state.OusterWarningStage = 0;
        }

        if (_state.OusterPressure < 100) return;
        _state.GameOverReason = "Living costs, public confidence, and emigration remained critical for too long.";
        _state.Phase = GamePhase.GameOver;
        AddDispatch(DispatchKind.Warning, "The mayor has been ousted", _state.GameOverReason, toast: false);
    }

    private void UpdateGoals(int eraIndex, double education)
    {
        EnsureGoals(eraIndex);
        foreach (var goal in _state.EraGoals.Where(g => g.EraIndex == eraIndex && !g.Completed))
        {
            goal.Progress = goal.Kind switch
            {
                EraGoalKind.Population => _state.Population,
                EraGoalKind.BuildAtom when goal.AtomId is int atomId => _state.GetBuiltCount(atomId),
                EraGoalKind.Education => education,
                EraGoalKind.SustainAffordability => _state.Affordability >= .95 ? goal.Progress + 1 : 0,
                _ => goal.Progress,
            };
            if (goal.Progress < goal.Target) continue;
            goal.Progress = goal.Target;
            goal.Completed = true;
            AddDispatch(DispatchKind.Progress, "Era goal complete", goal.Title, toast: true);
        }

        var eraGoals = _state.EraGoals.Where(g => g.EraIndex == eraIndex).ToList();
        if (eraGoals.Count != 3 || eraGoals.Any(g => !g.Completed) || _state.GoalRewardedEraIndexes.Contains(eraIndex)) return;
        var reward = GoalReward(eraIndex);
        _state.Gold += reward;
        _state.GoalRewardedEraIndexes.Add(eraIndex);
        AddDispatch(DispatchKind.Progress, "All era goals complete", $"The city awarded your administration ${EconomyEngine.FormatNumber(reward)}.", toast: true);
    }

    public void EnsureGoals(int eraIndex)
    {
        if (_state.EraGoals.Any(g => g.EraIndex == eraIndex) || _config.Eras.Count == 0) return;
        var era = _config.Eras[Math.Clamp(eraIndex, 0, _config.Eras.Count - 1)];
        var nextMin = eraIndex + 1 < _config.Eras.Count ? _config.Eras[eraIndex + 1].MinPop : Math.Max(era.MinPop + 50, era.MinPop * 2);
        var populationTarget = Math.Max(era.MinPop + 10, (int)Math.Round(nextMin * .72));
        var definingAtom = _config.Atoms.Where(a => a.EraId == era.Id && a.IsBuildable)
            .OrderByDescending(a => a.BasePrice).FirstOrDefault()
            ?? _config.GetAvailableAtoms(eraIndex).Where(a => a.IsBuildable).OrderByDescending(a => a.BasePrice).FirstOrDefault();
        var buildTarget = eraIndex < 2 ? 3 : eraIndex < 5 ? 2 : 1;

        _state.EraGoals.Add(new EraGoal
        {
            Id = $"era-{eraIndex}-population", EraIndex = eraIndex, Kind = EraGoalKind.Population,
            Title = $"Reach {EconomyEngine.FormatNumber(populationTarget)} citizens", Target = populationTarget,
        });
        _state.EraGoals.Add(new EraGoal
        {
            Id = $"era-{eraIndex}-build", EraIndex = eraIndex, Kind = EraGoalKind.BuildAtom,
            AtomId = definingAtom?.Id, Title = definingAtom == null ? "Expand city capacity" : $"Build {buildTarget} × {definingAtom.Name}", Target = buildTarget,
        });
        var useEducation = eraIndex >= 2;
        _state.EraGoals.Add(new EraGoal
        {
            Id = $"era-{eraIndex}-stability", EraIndex = eraIndex,
            Kind = useEducation ? EraGoalKind.Education : EraGoalKind.SustainAffordability,
            Title = useEducation ? $"Reach {Math.Min(80, 42 + eraIndex * 6)}% literacy" : $"Keep life affordable for {5 + eraIndex} turns",
            Target = useEducation ? Math.Min(80, 42 + eraIndex * 6) : 5 + eraIndex,
        });
    }

    public long GoalReward(int eraIndex)
    {
        var buildGoal = _state.EraGoals.FirstOrDefault(g => g.EraIndex == eraIndex && g.Kind == EraGoalKind.BuildAtom);
        var price = buildGoal?.AtomId is int id && _config.AtomsById.TryGetValue(id, out var atom) ? atom.BasePrice : 25;
        return Math.Max(25, price * Math.Max(1, (long)(buildGoal?.Target ?? 1)));
    }

    private void AddDispatch(DispatchKind kind, string title, string outcome, bool toast)
    {
        var dispatch = new GameDispatch
        {
            Kind = kind,
            DecisionTurn = _state.Turn,
            EventTurn = _state.Turn,
            Title = title,
            Cause = title,
            ImmediateOutcome = outcome,
            IsRead = false,
        };
        _state.Dispatches.Add(dispatch);
        if (_state.Dispatches.Count > 120)
            _state.Dispatches.RemoveRange(0, _state.Dispatches.Count - 120);
        if (toast) _state.ToastDispatchId = dispatch.Id;
    }

    private int EraIndexOf(int eraId) => Math.Max(0, _config.Eras.FindIndex(e => e.Id == eraId));

    private double CapacityOf(Atom atom, int eraIndex)
    {
        double capacity;
        if (atom.NeedCapacity > 0) capacity = atom.NeedCapacity;
        else if (atom.HousingWeight > 0) capacity = Math.Max(2, atom.HousingWeight * 6.5);
        else capacity = Math.Max(5, Math.Max(atom.PopGain * 1.5, _config.Eras[eraIndex].MinPop * .16));

        var age = Math.Max(0, eraIndex - EraIndexOf(atom.EraId));
        var efficiency = CategoryOf(atom) == "energy" ? Math.Pow(.55, age) : Math.Pow(.78, age);
        return capacity * efficiency;
    }

    private static string? CategoryOf(Atom atom)
    {
        if (!string.IsNullOrWhiteSpace(atom.NeedCategory)) return atom.NeedCategory.Trim().ToLowerInvariant();
        if (atom.HousingWeight > 0) return "housing";
        var slug = atom.Slug ?? "";
        if (FoodSlugs.Contains(slug) || slug.Contains("food", StringComparison.OrdinalIgnoreCase)) return "food";
        if (EnergySlugs.Contains(slug) || slug.Contains("power", StringComparison.OrdinalIgnoreCase)) return "energy";
        return null;
    }
}
