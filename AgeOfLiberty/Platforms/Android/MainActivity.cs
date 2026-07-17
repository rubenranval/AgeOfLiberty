using Android.App;
using Android.Content.PM;
using Android.OS;
using Android.Views;

namespace AgeOfLiberty
{
    [Activity(Theme = "@style/Maui.SplashTheme", MainLauncher = true, ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode | ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
    public class MainActivity : MauiAppCompatActivity
    {
        protected override void OnCreate(Bundle? savedInstanceState)
        {
            base.OnCreate(savedInstanceState);

            // Draw into the notch/punch-hole region instead of leaving a dead band
            if (Build.VERSION.SdkInt >= BuildVersionCodes.P && Window?.Attributes != null)
            {
                Window.Attributes.LayoutInDisplayCutoutMode = LayoutInDisplayCutoutMode.ShortEdges;
            }

            ApplyImmersiveMode();
        }

        // Android drops immersive mode on keyboard, dialogs, and task switches —
        // it must be re-applied every time the window regains focus.
        public override void OnWindowFocusChanged(bool hasFocus)
        {
            base.OnWindowFocusChanged(hasFocus);
            if (hasFocus) ApplyImmersiveMode();
        }

        void ApplyImmersiveMode()
        {
            if (Window == null) return;

            if (Build.VERSION.SdkInt >= BuildVersionCodes.R)
            {
                Window.SetDecorFitsSystemWindows(false);
                var controller = Window.InsetsController;
                if (controller != null)
                {
                    controller.Hide(WindowInsets.Type.StatusBars() | WindowInsets.Type.NavigationBars());
                    // Swipe shows the bars briefly as an overlay, then they re-hide
                    controller.SystemBarsBehavior = (int)WindowInsetsControllerBehavior.ShowTransientBarsBySwipe;
                }
            }
            else
            {
#pragma warning disable CA1422
                Window.DecorView.SystemUiVisibility = (StatusBarVisibility)(
                    SystemUiFlags.Fullscreen |
                    SystemUiFlags.HideNavigation |
                    SystemUiFlags.ImmersiveSticky |
                    SystemUiFlags.LayoutFullscreen |
                    SystemUiFlags.LayoutHideNavigation |
                    SystemUiFlags.LayoutStable);
#pragma warning restore CA1422
            }

            Window.SetStatusBarColor(Android.Graphics.Color.Transparent);
            Window.SetNavigationBarColor(Android.Graphics.Color.Transparent);
        }
    }
}