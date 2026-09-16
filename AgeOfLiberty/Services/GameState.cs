using AgeOfLiberty.Models;

namespace AgeOfLiberty.Services;


public class GameState
{
    // info générales

    public string CityName { get; set; } = "Liberty City";
    public long Gold { get; set; } = 50;
    public int Population { get; set; } = 5;
    public int Turn { get; set; } = 1;
    public int TickCount { get; set; }
    public double PopGrowthFraction { get; set; }

    // Price system

    public Dictionary<int, double> PriceMultipliers { get; set; } = new();

    public Dictionary<int, double> PriceJitter { get; set; } = new();

    /// <summary>Endogenous market pressure caused by citizen demand.</summary>
    public Dictionary<int, double> DemandMultipliers { get; set; } = new();

    public Dictionary<int, bool> Cascading { get; set; } = new();

    // Atoms built

    /// <summary>Count of each atom built. Key = atomId.</summary>
    public Dictionary<int, int> Built { get; set; } = new();

    // Scenarios

    public Scenario? ActiveScenario { get; set; }
    public HashSet<string> ScenariosDone { get; set; } = new();
    public List<DelayedEffect> DelayedEffects { get; set; } = new();

    // History

    public List<PriceSnapshot> PriceHistory { get; set; } = new();
    public List<PopSnapshot> PopHistory { get; set; } = new();
    public List<ChoiceEvent> ChoiceEvents { get; set; } = new();
    public List<GameDispatch> Dispatches { get; set; } = new();
    /// <summary>Per-turn snapshot of the 13 civic indicators (normalized 0–100).
    /// Appended by CivicIndicators.RecordIfNewTurn; capped at 600 like PriceHistory.</summary>
    public List<IndicatorSnapshot> IndicatorHistory { get; set; } = new();
    public List<string> Log { get; set; } = new() { "Welcome to Liberty City." };

    // City pressure. All three headline scores use the same direction:
    // higher is healthier. NetGrowthRate is a per-turn fractional rate.
    public double Affordability { get; set; } = 1.05;
    public double Approval { get; set; } = 58;
    public double NetGrowthRate { get; set; } = 0.003;
    public double OusterPressure { get; set; }
    public int OusterWarningStage { get; set; }
    public int PressureStartedTurn { get; set; }
    public int HighestEraIndex { get; set; }
    public string? GameOverReason { get; set; }
    public List<EraGoal> EraGoals { get; set; } = new();
    public HashSet<int> GoalRewardedEraIndexes { get; set; } = new();

    // UI State

    public GamePhase Phase { get; set; } = GamePhase.Intro;
    public int? SelectedAtomId { get; set; }
    public bool DrawerOpen { get; set; }
    public int? StockViewAtomId { get; set; }
    public bool ShowSummary { get; set; }
    public int? EraUnlockAnimIndex { get; set; }
    public string? ActiveDispatchId { get; set; }
    public string? ToastDispatchId { get; set; }

    // Non-api stuff

    public int GetBuiltCount(int atomId) => Built.TryGetValue(atomId, out var c) ? c : 0;
    public double GetMultiplier(int atomId) => PriceMultipliers.TryGetValue(atomId, out var m) ? m : 1.0;
    public double GetJitter(int atomId) => PriceJitter.TryGetValue(atomId, out var j) ? j : 1.0;
    public double GetDemandMultiplier(int atomId) => DemandMultipliers.TryGetValue(atomId, out var m) ? m : 1.0;

    public int GetPrice(Atom atom)
    {
        return Math.Max(1, (int)Math.Round(atom.BasePrice * GetMultiplier(atom.Id) * GetDemandMultiplier(atom.Id) * GetJitter(atom.Id)));
    }

    public int GetCleanPrice(Atom atom)
    {
        return Math.Max(1, (int)Math.Round(atom.BasePrice * GetMultiplier(atom.Id) * GetDemandMultiplier(atom.Id)));
    }

    public int GetBuildCost(Atom atom, GameConfigStore config)
    {
        var deps = config.GetDependencies(atom.Id);
        if (deps.Count == 0) return GetPrice(atom);
        int total = 0;
        foreach (var dep in deps)
        {
            if (config.AtomsById.TryGetValue(dep.RequiresAtomId, out var reqAtom))
                total += GetPrice(reqAtom) * dep.Quantity;
        }
        return total;
    }

    // Share feature (freedom score)

    public FreedomScore ComputeFreedomScore()
    {
        if (ChoiceEvents.Count == 0)
            return new FreedomScore { Score = 50, Title = "Undecided", Grade = "?" };

        var avg = ChoiceEvents.Average(e => e.FreedomWeight);
        var score = (int)Math.Round((avg + 1) / 2 * 100);
        score = Math.Clamp(score, 0, 100);

        var (title, grade) = score switch
        {
            >= 85 => ("Free Market Champion", "A+"),
            >= 70 => ("Liberty Advocate", "A"),
            >= 55 => ("Pragmatic Governor", "B"),
            >= 40 => ("Moderate Planner", "C"),
            >= 25 => ("Interventionist", "D"),
            _ => ("Central Planner", "F"),
        };

        return new FreedomScore { Score = score, Title = title, Grade = grade };
    }

    // Logs

    public void AddLog(string message)
    {
        Log.Insert(0, message);
        if (Log.Count > 20) Log.RemoveRange(20, Log.Count - 20);
    }


    public event Action? OnStateChanged;
    public void NotifyStateChanged() => OnStateChanged?.Invoke();
}

public enum GamePhase
{
    Intro,
    Play,
    Scenario,
    GameOver,
}
