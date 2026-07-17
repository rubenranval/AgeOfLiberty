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
    public int SchemaVersion { get; set; } = 1;
    public DateTime SavedAtUtc { get; set; }
    public string CityName { get; set; } = "";
    public long Gold { get; set; }
    public int Population { get; set; }
    public double PopGrowthFraction { get; set; }
    public int Turn { get; set; }
    public int TickCount { get; set; }
    public Dictionary<int, int> Built { get; set; } = new();
    public Dictionary<int, double> PriceMultipliers { get; set; } = new();
    public List<PriceSnapshot> PriceHistory { get; set; } = new();
    public List<PopSnapshot> PopHistory { get; set; } = new();
    public List<ChoiceEvent> ChoiceEvents { get; set; } = new();
    public List<DelayedEffect> DelayedEffects { get; set; } = new();
    public List<string> ScenariosDone { get; set; } = new();
    // Session baselines for the era stat cards
    public DateTime EraStartUtc { get; set; }
    public int EraStartPop { get; set; }
}

public static class SaveService
{
    private const int CurrentSchema = 1;
    private static string SavePath => Path.Combine(FileSystem.AppDataDirectory, "aol_save.json");
    private static string TmpPath => SavePath + ".tmp";

    public static bool Exists => File.Exists(SavePath);
    public static string LastError { get; private set; } = "";
    public static DateTime LastSaveUtc { get; private set; } = DateTime.MinValue;

    public static bool Save(GameState state, DateTime eraStartUtc, int eraStartPop)
    {
        try
        {
            var s = new SaveGame
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
                PriceHistory = state.PriceHistory.ToList(),
                PopHistory = state.PopHistory.ToList(),
                ChoiceEvents = state.ChoiceEvents.ToList(),
                DelayedEffects = state.DelayedEffects.ToList(),
                ScenariosDone = state.ScenariosDone.ToList(),
                EraStartUtc = eraStartUtc,
                EraStartPop = eraStartPop,
            };
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
        state.PriceHistory.Clear();
        state.PriceHistory.AddRange(s.PriceHistory);
        state.PopHistory.Clear();
        state.PopHistory.AddRange(s.PopHistory);
        state.ChoiceEvents.Clear();
        state.ChoiceEvents.AddRange(s.ChoiceEvents);
        state.DelayedEffects.Clear();
        state.DelayedEffects.AddRange(s.DelayedEffects);
        state.ScenariosDone.Clear();
        foreach (var slug in s.ScenariosDone) state.ScenariosDone.Add(slug);
    }

    public static void Delete()
    {
        try { if (File.Exists(SavePath)) File.Delete(SavePath); } catch { }
    }
}