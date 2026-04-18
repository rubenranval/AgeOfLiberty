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

            if (Window != null)
            {
                // plein écran
                if (Build.VERSION.SdkInt >= BuildVersionCodes.R)
                {
                    Window.SetDecorFitsSystemWindows(false);
                    var controller = Window.InsetsController;
                    if (controller != null)
                    {
                        controller.Hide(Android.Views.WindowInsets.Type.StatusBars() | Android.Views.WindowInsets.Type.NavigationBars());
                        //controller.SystemBarsBehavior = WindowInsetsControllerBehavior.ShowTransientBarsBySwipe;
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
}
