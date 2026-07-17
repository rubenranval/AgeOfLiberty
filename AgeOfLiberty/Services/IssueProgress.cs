using Microsoft.Maui.Storage;

namespace AgeOfLiberty.Services;

/// <summary>
/// Persistent per-era issue progress. Shared source of truth between the
/// GamePage issue scheduler and (optionally) any engine-side era gating.
/// Survives app restarts; reset on every new experiment.
/// </summary>
public static class IssueProgress
{
    private static string DoneKey(int eraId) => $"aol_issues_done_{eraId}";

    public static int Done(int eraId) => Preferences.Get(DoneKey(eraId), 0);

    public static void SetDone(int eraId, int count) => Preferences.Set(DoneKey(eraId), count);

    public static bool EraComplete(int eraId, int totalScenarios) => Done(eraId) >= totalScenarios;

    public static void Reset(IEnumerable<int> eraIds)
    {
        foreach (var id in eraIds) Preferences.Remove(DoneKey(id));
        Preferences.Remove("aol_next_issue_era");
        Preferences.Remove("aol_next_issue_ticks");
    }
}