using AgeOfLiberty.Models;
using AgeOfLiberty.Services;

namespace AgeOfLiberty.Services;

/// <summary>
/// Holds the resolved game config data loaded from Directus.
/// Provides fast lookups by ID and pre-joined relationships.
/// </summary>
public class GameConfigStore
{
    public GameConfig Config { get; private set; } = new();
    public List<Era> Eras { get; private set; } = new();
    public List<Atom> Atoms { get; private set; } = new();
    public List<Dependency> Dependencies { get; private set; } = new();
    public List<Character> Characters { get; private set; } = new();
    public List<Scenario> Scenarios { get; private set; } = new();
    public List<Choice> Choices { get; private set; } = new();
    public List<Models.Effect> Effects { get; private set; } = new();

    // Lookup dictionaries
    public Dictionary<int, Atom> AtomsById { get; private set; } = new();
    public Dictionary<int, Era> ErasById { get; private set; } = new();
    public Dictionary<int, Character> CharsById { get; private set; } = new();
    public Dictionary<int, List<Dependency>> DepsByAtomId { get; private set; } = new();
    public Dictionary<int, List<Choice>> ChoicesByScenarioId { get; private set; } = new();
    public Dictionary<int, List<Models.Effect>> EffectsByChoiceId { get; private set; } = new();

    public bool IsLoaded { get; private set; }

    public void Load(GameBundle bundle)
    {
        Config = bundle.Config;
        Eras = bundle.Eras.OrderBy(e => e.SortOrder).ToList();
        Atoms = bundle.Atoms;
        Dependencies = bundle.Dependencies;
        Characters = bundle.Characters;
        Scenarios = bundle.Scenarios.OrderBy(s => s.TriggerPop).ToList();
        Choices = bundle.Choices;
        Effects = bundle.Effects;

        // Build lookups
        AtomsById = Atoms.ToDictionary(a => a.Id);
        ErasById = Eras.ToDictionary(e => e.Id);
        CharsById = Characters.ToDictionary(c => c.Id);
        DepsByAtomId = Dependencies.GroupBy(d => d.AtomId).ToDictionary(g => g.Key, g => g.ToList());
        ChoicesByScenarioId = Choices.GroupBy(c => c.ScenarioId).ToDictionary(g => g.Key, g => g.OrderBy(c => c.SortOrder).ToList());
        EffectsByChoiceId = Effects.GroupBy(e => e.ChoiceId).ToDictionary(g => g.Key, g => g.ToList());

        IsLoaded = true;
    }

    /// <summary>Get the era for a given population.</summary>
    public Era GetEra(int population)
    {
        for (int i = Eras.Count - 1; i >= 0; i--)
            if (population >= Eras[i].MinPop) return Eras[i];
        return Eras.FirstOrDefault() ?? new Era { Name = "Unknown" };
    }

    /// <summary>Get era index (0-based) for a given population.</summary>
    public int GetEraIndex(int population)
    {
        for (int i = Eras.Count - 1; i >= 0; i--)
            if (population >= Eras[i].MinPop) return i;
        return 0;
    }

    /// <summary>Get atoms available at a given era index.</summary>
    public List<Atom> GetAvailableAtoms(int eraIndex)
    {
        if (Eras.Count == 0) return new();
        var maxEraId = Eras.Take(eraIndex + 1).Select(e => e.Id).ToHashSet();
        return Atoms.Where(a => maxEraId.Contains(a.EraId)).ToList();
    }

    /// <summary>Get dependencies for building an atom.</summary>
    public List<Dependency> GetDependencies(int atomId)
    {
        return DepsByAtomId.TryGetValue(atomId, out var deps) ? deps : new();
    }

    public List<Choice> GetChoices(int scenarioId)
    {
        return ChoicesByScenarioId.TryGetValue(scenarioId, out var choices) ? choices : new();
    }

    public (List<Models.Effect> Immediate, List<Models.Effect> Delayed) GetEffects(int choiceId)
    {
        if (!EffectsByChoiceId.TryGetValue(choiceId, out var all))
            return (new(), new());
        return (
            all.Where(e => !e.IsDelayed).ToList(),
            all.Where(e => e.IsDelayed).ToList()
        );
    }
}
