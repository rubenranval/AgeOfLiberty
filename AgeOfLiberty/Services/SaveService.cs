using System.Text.Json;
using AgeOfLiberty.Models;
using Microsoft.Maui.Storage;

namespace AgeOfLiberty.Services;

/// <summary>
/// Versioned snapshot of a running experiment, persisted to app storage.
/// Written on a debounce from the GamePage ticker; loaded at startup to
/// skip the intro and resume in place.
/// </summary>
public class SaveGame
{
    public int SchemaVersion { get; set; } = 3;
    public DateTime SavedAtUtc { get; set; }
    public string CityName { get; set; } = "";
    public long Gold { get; set; }
    public int Population { get; set; }
    public double PopGrowthFraction { get; set; }
    public int Turn { get; set; }
    public int TickCount { get; set; }
    public Dictionary<int, int> Built { get; set; } = new();
    public Dictionary<int, double> PriceMultipliers { get; set; } = new();
    public Dictionary<int, double> DemandMultipliers { get; set; } = new();
    public double Affordability { get; set; } = 1.05;
    public double Approval { get; set; } = 58;
    public double NetGrowthRate { get; set; } = .003;
    public double OusterPressure { get; set; }
    public int OusterWarningStage { get; set; }
    public int PressureStartedTurn { get; set; }
    public int HighestEraIndex { get; set; }
    public string? GameOverReason { get; set; }
    public bool IsGameOver { get; set; }
    public List<EraGoal> EraGoals { get; set; } = new();
    public List<int> GoalRewardedEraIndexes { get; set; } = new();
    public Dictionary<int, int> IssueProgressByEra { get; set; } = new();
    public List<PriceSnapshot> PriceHistory { get; set; } = new();
    public List<PopSnapshot> PopHistory { get; set; } = new();
    public List<ChoiceEvent> ChoiceEvents { get; set; } = new();
    public List<GameDispatch> Dispatches { get; set; } = new();
    public List<DelayedEffect> DelayedEffects { get; set; } = new();
    public List<string> ScenariosDone { get; set; } = new();
    public List<IndicatorSnapshot> IndicatorHistory { get; set; } = new();
    // Session baselines for the era stat cards
    public DateTime EraStartUtc { get; set; }
    public int EraStartPop { get; set; }
}

public static class SaveService
{
    private const int CurrentSchema = 3;
    private static string SavePath => Path.Combine(FileSystem.AppDataDirectory, "aol_save.json");
    private static string TmpPath => SavePath + ".tmp";
    private static string CheckpointPath => Path.Combine(FileSystem.AppDataDirectory, "aol_checkpoint.json");

    public static bool Exists => File.Exists(SavePath);
    public static bool CheckpointExists => File.Exists(CheckpointPath);
    public static string LastError { get; private set; } = "";
    public static DateTime LastSaveUtc { get; private set; } = DateTime.MinValue;

    public static bool Save(GameState state, DateTime eraStartUtc, int eraStartPop)
    {
        try
        {
            var s = Snapshot(state, eraStartUtc, eraStartPop);
            // Atomic write: a process kill mid-write must never corrupt the save
            File.WriteAllText(TmpPath, JsonSerializer.Serialize(s));
            File.Move(TmpPath, SavePath, true);
            LastSaveUtc = DateTime.UtcNow;
            LastError = "";
            return true;
        }
        catch (Exception ex)
        {
            // Likely a concurrent-mutation race with an economy timer thread;
            // the caller keeps the dirty flag and retries on the next tick.
            LastError = ex.GetType().Name + ": " + ex.Message;
            return false;
        }
    }

    public static bool SaveCheckpoint(GameState state, DateTime eraStartUtc, int eraStartPop, IEnumerable<int> eraIds)
    {
        try
        {
            var snapshot = Snapshot(state, eraStartUtc, eraStartPop);
            snapshot.IssueProgressByEra = eraIds.ToDictionary(id => id, IssueProgress.Done);
            File.WriteAllText(CheckpointPath + ".tmp", JsonSerializer.Serialize(snapshot));
            File.Move(CheckpointPath + ".tmp", CheckpointPath, true);
            return true;
        }
        catch (Exception ex)
        {
            LastError = "checkpoint: " + ex.GetType().Name + ": " + ex.Message;
            return false;
        }
    }

    public static SaveGame? LoadCheckpoint()
    {
        try
        {
            if (!File.Exists(CheckpointPath)) return null;
            var s = JsonSerializer.Deserialize<SaveGame>(File.ReadAllText(CheckpointPath));
            return s is { SchemaVersion: <= CurrentSchema } ? s : null;
        }
        catch (Exception ex)
        {
            LastError = "checkpoint load: " + ex.GetType().Name + ": " + ex.Message;
            return null;
        }
    }

    private static SaveGame Snapshot(GameState state, DateTime eraStartUtc, int eraStartPop) => new()
    {
        SchemaVersion = CurrentSchema,
        SavedAtUtc = DateTime.UtcNow,
        CityName = state.CityName,
        Gold = state.Gold,
        Population = state.Population,
        PopGrowthFraction = state.PopGrowthFraction,
        Turn = state.Turn,
        TickCount = state.TickCount,
        Built = new Dictionary<int, int>(state.Built),
        PriceMultipliers = new Dictionary<int, double>(state.PriceMultipliers),
        DemandMultipliers = new Dictionary<int, double>(state.DemandMultipliers),
        Affordability = state.Affordability,
        Approval = state.Approval,
        NetGrowthRate = state.NetGrowthRate,
        OusterPressure = state.OusterPressure,
        OusterWarningStage = state.OusterWarningStage,
        PressureStartedTurn = state.PressureStartedTurn,
        HighestEraIndex = state.HighestEraIndex,
        GameOverReason = state.GameOverReason,
        IsGameOver = state.Phase == GamePhase.GameOver,
        EraGoals = state.EraGoals.Select(g => new EraGoal
        {
            Id = g.Id, EraIndex = g.EraIndex, Kind = g.Kind, AtomId = g.AtomId,
            Title = g.Title, Target = g.Target, Progress = g.Progress, Completed = g.Completed,
        }).ToList(),
        GoalRewardedEraIndexes = state.GoalRewardedEraIndexes.ToList(),
        PriceHistory = state.PriceHistory.ToList(),
        PopHistory = state.PopHistory.ToList(),
        ChoiceEvents = state.ChoiceEvents.ToList(),
        Dispatches = state.Dispatches.ToList(),
        DelayedEffects = state.DelayedEffects.ToList(),
        IndicatorHistory = state.IndicatorHistory.ToList(),
        ScenariosDone = state.ScenariosDone.ToList(),
        EraStartUtc = eraStartUtc,
        EraStartPop = eraStartPop,
    };

    public static SaveGame? Load()
    {
        try
        {
            if (!File.Exists(SavePath)) return null;
            var s = JsonSerializer.Deserialize<SaveGame>(File.ReadAllText(SavePath));
            if (s == null || s.SchemaVersion > CurrentSchema) { LastError = "save schema mismatch"; return null; }
            return s;
        }
        catch (Exception ex)
        {
            LastError = "load: " + ex.GetType().Name + ": " + ex.Message;
            return null;
        }
    }

    /// <summary>One-line status for the Beta panel.</summary>
    public static string Describe()
    {
        try
        {
            if (!File.Exists(SavePath)) return "no save file";
            var fi = new FileInfo(SavePath);
            return $"{fi.Length / 1024}kb · {fi.LastWriteTimeUtc:HH:mm:ss}Z";
        }
        catch (Exception ex) { return ex.Message; }
    }

    public static void Apply(SaveGame s, GameState state)
    {
        state.CityName = s.CityName;
        state.Gold = s.Gold;
        state.Population = s.Population;
        state.PopGrowthFraction = s.PopGrowthFraction;
        state.Turn = s.Turn;
        state.TickCount = s.TickCount;
        state.Built.Clear();
        foreach (var kv in s.Built) state.Built[kv.Key] = kv.Value;
        state.PriceMultipliers.Clear();
        foreach (var kv in s.PriceMultipliers) state.PriceMultipliers[kv.Key] = kv.Value;
        state.DemandMultipliers.Clear();
        foreach (var kv in s.DemandMultipliers ?? new()) state.DemandMultipliers[kv.Key] = kv.Value;
        state.Affordability = s.Affordability;
        state.Approval = s.Approval;
        state.NetGrowthRate = s.NetGrowthRate;
        state.OusterPressure = s.OusterPressure;
        state.OusterWarningStage = s.OusterWarningStage;
        state.PressureStartedTurn = s.PressureStartedTurn;
        state.HighestEraIndex = s.HighestEraIndex;
        state.GameOverReason = s.GameOverReason;
        state.Phase = s.IsGameOver ? GamePhase.GameOver : GamePhase.Play;
        state.EraGoals.Clear();
        state.EraGoals.AddRange(s.EraGoals ?? new List<EraGoal>());
        state.GoalRewardedEraIndexes.Clear();
        foreach (var eraIndex in s.GoalRewardedEraIndexes ?? new List<int>()) state.GoalRewardedEraIndexes.Add(eraIndex);
        state.PriceHistory.Clear();
        state.PriceHistory.AddRange(s.PriceHistory);
        state.PopHistory.Clear();
        state.PopHistory.AddRange(s.PopHistory);
        state.ChoiceEvents.Clear();
        state.ChoiceEvents.AddRange(s.ChoiceEvents ?? new List<ChoiceEvent>());
        state.Dispatches.Clear();
        state.Dispatches.AddRange(s.Dispatches ?? new List<GameDispatch>());
        state.DelayedEffects.Clear();
        state.DelayedEffects.AddRange(s.DelayedEffects ?? new List<DelayedEffect>());
        state.IndicatorHistory.Clear();
        state.IndicatorHistory.AddRange(s.IndicatorHistory ?? new List<IndicatorSnapshot>());
        state.ScenariosDone.Clear();
        foreach (var slug in s.ScenariosDone) state.ScenariosDone.Add(slug);
    }

    public static void Delete()
    {
        try
        {
            if (File.Exists(SavePath)) File.Delete(SavePath);
            if (File.Exists(CheckpointPath)) File.Delete(CheckpointPath);
        }
        catch { }
    }
}
