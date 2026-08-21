using AgeOfLiberty.Services;
using Microsoft.Extensions.Logging;
using System.Globalization;

namespace AgeOfLiberty;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {

        // SVG/JS interop requires invariant numeric formatting ("12.5", never "12,5")
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("JetBrainsMono-Regular.ttf", "JetBrainsMono");
                fonts.AddFont("JetBrainsMono-Bold.ttf", "JetBrainsMono-Bold");
                fonts.AddFont("Outfit-Regular.ttf", "Outfit");
                fonts.AddFont("Outfit-Bold.ttf", "Outfit-Bold");
            });

        builder.Services.AddMauiBlazorWebView();

        Microsoft.AspNetCore.Components.WebView.Maui.BlazorWebViewHandler.BlazorWebViewMapper
            .AppendToMapping("AllowAutoplay", (handler, view) =>
            {
#if ANDROID
                handler.PlatformView.Settings.MediaPlaybackRequiresUserGesture = false;
#endif
            });

        Microsoft.AspNetCore.Components.WebView.Maui.BlazorWebViewHandler.BlazorWebViewMapper
    .AppendToMapping("iOSMediaConfig", (handler, view) =>
    {
#if IOS
        handler.PlatformView.Configuration.AllowsInlineMediaPlayback = true;
        handler.PlatformView.Configuration.MediaTypesRequiringUserActionForPlayback =
            WebKit.WKAudiovisualMediaTypes.None;
        handler.PlatformView.ScrollView.ContentInsetAdjustmentBehavior =
            UIKit.UIScrollViewContentInsetAdjustmentBehavior.Never;
#endif
    });

#if DEBUG
        builder.Services.AddBlazorWebViewDeveloperTools();
        builder.Logging.AddDebug();
#endif

        // Game services
        builder.Services.AddSingleton<DirectusClient>();
        builder.Services.AddSingleton<GameConfigStore>();
        builder.Services.AddSingleton<GameState>();
        builder.Services.AddSingleton<EconomyEngine>();
        builder.Services.AddSingleton<ScenarioEngine>();

        return builder.Build();
    }
}
