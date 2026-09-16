using Plugin.LocalNotification;
using Plugin.LocalNotification.Core.Models;

namespace AgeOfLiberty.Services;

/// <summary>
/// Local push notification for issue maturity.
/// Requires NuGet: Plugin.LocalNotification
///   dotnet add package Plugin.LocalNotification
/// And in MauiProgram.cs builder chain:  .UseLocalNotification()
/// Android 13+: POST_NOTIFICATIONS permission is requested at runtime below.
/// </summary>
public static class NotificationHelper
{
    private const int IssueNotifId = 4201;
    private const string PrefKey = "aol_notifs_enabled";

    /// <summary>User preference (Settings toggle). Persisted via MAUI Preferences.
    /// Turning it off also cancels anything already scheduled.</summary>
    public static bool Enabled
    {
        get { try { return Microsoft.Maui.Storage.Preferences.Get(PrefKey, true); } catch { return true; } }
        set
        {
            try { Microsoft.Maui.Storage.Preferences.Set(PrefKey, value); } catch { }
            if (!value) CancelIssue();
        }
    }

    public static async Task ScheduleIssueAsync(DateTime utc)
    {
        try
        {
            if (!Enabled) return;
            CancelIssue();
            var local = utc.ToLocalTime();
            if (local <= DateTime.Now.AddSeconds(10)) return; // too soon to bother the OS

            var request = new NotificationRequest
            {
                NotificationId = IssueNotifId,
                Title = "An issue awaits your judgment",
                Description = "The simulation has paused on a decision, observer.",
                Schedule = new NotificationRequestSchedule { NotifyTime = local }
            };
            await LocalNotificationCenter.Current.Show(request);
        }
        catch { /* notifications are best-effort */ }
    }

    public static void CancelIssue()
    {
        try { LocalNotificationCenter.Current.Cancel(IssueNotifId); } catch { }
    }

    public static async Task RequestPermissionAsync()
    {
        try { await LocalNotificationCenter.Current.RequestNotificationPermission(); } catch { }
    }
}
