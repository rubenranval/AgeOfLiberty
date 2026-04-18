using Microsoft.Extensions.Logging;
using AgeOfLiberty.Services;

namespace AgeOfLiberty;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
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
