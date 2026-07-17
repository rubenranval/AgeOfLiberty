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

    public static async void ScheduleIssue(DateTime utc)
    {
        try
        {
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

    public static async void RequestPermission()
    {
        try { await LocalNotificationCenter.Current.RequestNotificationPermission(); } catch { }
    }
}