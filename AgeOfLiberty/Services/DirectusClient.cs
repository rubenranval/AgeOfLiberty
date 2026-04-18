using AgeOfLiberty.Models;
using System.Net.Http.Json;
using System.Text.Json;

namespace AgeOfLiberty.Services;

public class DirectusClient
{
    private readonly HttpClient _http;
    private const string DefaultBaseUrl = "https://api.ageofliberty.org"; 

    public string BaseUrl { get; set; }

    public DirectusClient()
    {
        _http = new HttpClient();
        BaseUrl = Preferences.Get("directus_url", DefaultBaseUrl);
    }

    // Todo: mettre à jour manuellement les niveaux

    public async Task<GameBundle?> FetchGameBundleAsync()
    {
        try
        {
            var configTask = FetchAsync<GameConfig>("/items/game_config");
            var erasTask = FetchListAsync<Era>("/items/eras?sort=sort_order&fields=*");
            var atomsTask = FetchListAsync<Atom>("/items/atoms?fields=*&sort=era_id,name");
            var depsTask = FetchListAsync<Dependency>("/items/dependencies?fields=*");
            var charsTask = FetchListAsync<Character>("/items/characters?fields=*&sort=era_id");
            var scenariosTask = FetchListAsync<Scenario>("/items/scenarios?fields=*&sort=trigger_pop");
            var choicesTask = FetchListAsync<Choice>("/items/choices?fields=*&sort=scenario_id,sort_order");
            var effectsTask = FetchListAsync<Models.Effect>("/items/effects?fields=*");

            await Task.WhenAll(configTask, erasTask, atomsTask, depsTask, charsTask, scenariosTask, choicesTask, effectsTask);

            return new GameBundle
            {
                Config = await configTask ?? new GameConfig(),
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


    private async Task<T?> FetchAsync<T>(string path)
    {
        var response = await _http.GetFromJsonAsync<DirectusResponse<T>>($"{BaseUrl}{path}");
        return response != null ? response.Data : default;
    }

    private async Task<List<T>?> FetchListAsync<T>(string path)
    {
        var response = await _http.GetFromJsonAsync<DirectusResponse<List<T>>>($"{BaseUrl}{path}");
        return response?.Data;
    }

    // Local cache - Todo: implement update mechanism

    private static string CachePath => Path.Combine(FileSystem.CacheDirectory, "game_bundle.json");

    public async Task SaveBundleToCacheAsync(GameBundle bundle)
    {
        var json = JsonSerializer.Serialize(bundle);
        await File.WriteAllTextAsync(CachePath, json);
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
