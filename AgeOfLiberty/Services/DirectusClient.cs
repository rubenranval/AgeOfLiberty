using AgeOfLiberty.Models;
using System.Net.Http.Json;
using System.Text.Json;

namespace AgeOfLiberty.Services;

public class DirectusClient : IDisposable
{
    private readonly HttpClient _http;
    private const string DefaultBaseUrl = "https://api.ageofliberty.org";

 
    public string BaseUrl { get; set; }

    public DirectusClient()
    {
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(12) };
        BaseUrl = Preferences.Get("directus_url", DefaultBaseUrl);
    }

    // Todo: mettre à jour manuellement les niveaux

    public Task ClearCacheAsync()
    {
        try { if (File.Exists(CachePath)) File.Delete(CachePath); } catch { }
        return Task.CompletedTask;
    }

    public async Task<GameBundle?> FetchGameBundleAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // game_config: fetch as list, take first item
            var configTask = FetchListAsync<GameConfig>("/items/game_config?limit=1&fields=*", cancellationToken);
            var erasTask = FetchListAsync<Era>("/items/eras?sort=sort_order&fields=*&limit=-1", cancellationToken);
            var atomsTask = FetchListAsync<Atom>("/items/atoms?fields=*&sort=era_id,name&limit=-1", cancellationToken);
            var depsTask = FetchListAsync<Dependency>("/items/dependencies?fields=*&limit=-1", cancellationToken);
            var charsTask = FetchListAsync<Character>("/items/characters?fields=*&limit=-1", cancellationToken);
            var scenariosTask = FetchListAsync<Scenario>("/items/scenarios?fields=*&sort=trigger_pop&limit=-1", cancellationToken);
            var choicesTask = FetchListAsync<Choice>("/items/choices?fields=*&sort=scenario_id,sort_order&limit=-1", cancellationToken);
            var effectsTask = FetchListAsync<Models.Effect>("/items/effects?fields=*&limit=-1", cancellationToken);

            await Task.WhenAll(configTask, erasTask, atomsTask, depsTask, charsTask, scenariosTask, choicesTask, effectsTask);

            var configList = await configTask;

            return new GameBundle
            {
                Config = configList?.FirstOrDefault() ?? new GameConfig(),
                Eras = await erasTask ?? new(),
                Atoms = await atomsTask ?? new(),
                Dependencies = await depsTask ?? new(),
                Characters = await charsTask ?? new(),
                Scenarios = await scenariosTask ?? new(),
                Choices = await choicesTask ?? new(),
                Effects = await effectsTask ?? new(),
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"DirectusClient error: {ex.Message}");
            return null;
        }
    }


    private async Task<List<T>?> FetchListAsync<T>(string path, CancellationToken cancellationToken)
    {
        var response = await _http.GetFromJsonAsync<DirectusResponse<List<T>>>($"{BaseUrl}{path}", cancellationToken);
        return response?.Data;
    }

    // Local cache - Todo: implement update mechanism

    private static string CachePath => Path.Combine(FileSystem.CacheDirectory, "game_bundle2.json");

    public async Task SaveBundleToCacheAsync(GameBundle bundle)
    {
        var json = JsonSerializer.Serialize(bundle);
        var temporaryPath = CachePath + ".tmp";
        await File.WriteAllTextAsync(temporaryPath, json);
        File.Move(temporaryPath, CachePath, true);
    }

    public async Task<GameBundle?> LoadBundleFromCacheAsync()
    {
        if (!File.Exists(CachePath)) return null;
        try
        {
            var json = await File.ReadAllTextAsync(CachePath);
            return JsonSerializer.Deserialize<GameBundle>(json);
        }
        catch
        {
            return null;
        }
    }

    public void Dispose() => _http.Dispose();
}

public class GameBundle
{
    public GameConfig Config { get; set; } = new();
    public List<Era> Eras { get; set; } = new();
    public List<Atom> Atoms { get; set; } = new();
    public List<Dependency> Dependencies { get; set; } = new();
    public List<Character> Characters { get; set; } = new();
    public List<Scenario> Scenarios { get; set; } = new();
    public List<Choice> Choices { get; set; } = new();
    public List<Models.Effect> Effects { get; set; } = new();
}
