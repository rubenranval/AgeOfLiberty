using System.Text.Json.Serialization;

namespace AgeOfLiberty.Models;

// Modèle de réponse de l'api Directus

public class DirectusResponse<T>
{
    [JsonPropertyName("data")]
    public T Data { get; set; } = default!;
}

// Config générale du jeu

public class GameConfig
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("base_income")]
    public int BaseIncome { get; set; } = 3;

    [JsonPropertyName("pop_income_multiplier")]
    public double PopIncomeMultiplier { get; set; } = 0.15;

    [JsonPropertyName("tick_interval_ms")]
    public int TickIntervalMs { get; set; } = 800;

    [JsonPropertyName("turn_ticks")]
    public int TurnTicks { get; set; } = 15;

    [JsonPropertyName("pop_growth_rate")]
    public double PopGrowthRate { get; set; } = 0.03;

    [JsonPropertyName("pop_growth_interval_ms")]
    public int PopGrowthIntervalMs { get; set; } = 2000;

    [JsonPropertyName("jitter_min")]
    public double JitterMin { get; set; } = 0.95;

    [JsonPropertyName("jitter_max")]
    public double JitterMax { get; set; } = 1.05;

    [JsonPropertyName("jitter_interval_ms")]
    public int JitterIntervalMs { get; set; } = 3000;

    [JsonPropertyName("market_income_bonus")]
    public int MarketIncomeBonus { get; set; } = 3;

    [JsonPropertyName("farm_income_bonus")]
    public int FarmIncomeBonus { get; set; } = 2;
}

// Era

public class Era
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("min_pop")]
    public int MinPop { get; set; }

    [JsonPropertyName("color")]
    public string Color { get; set; } = "#888888";

    [JsonPropertyName("unlock_message")]
    public string? UnlockMessage { get; set; }

    [JsonPropertyName("sort_order")]
    public int SortOrder { get; set; }
    [JsonPropertyName("era_address")]
    public string? EraAddress { get; set; }        // "era_address"

}

// Atom

public class Atom
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("slug")]
    public string Slug { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("icon")]
    public string Icon { get; set; } = "";
    [JsonPropertyName("sprite_asset")]
    public string SpriteAsset { get; set; } = "";

    [JsonPropertyName("era_id")]
    public int EraId { get; set; }

    [JsonPropertyName("base_price")]
    public int BasePrice { get; set; }

    [JsonPropertyName("pop_gain")]
    public int PopGain { get; set; }

    [JsonPropertyName("is_buildable")]
    public bool IsBuildable { get; set; } = true;

    [JsonPropertyName("position_x")]
    public int PositionX { get; set; }

    [JsonPropertyName("position_y")]
    public int PositionY { get; set; }

    [JsonPropertyName("housing_weight")]
    public double HousingWeight { get; set; }
    [JsonPropertyName("income_bonus")]
    public long IncomeBonus { get; set; }          // "income_bonus"

}

// Dépendances entre différents atomes

public class Dependency
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("atom_id")]
    public int AtomId { get; set; }

    [JsonPropertyName("requires_atom_id")]
    public int RequiresAtomId { get; set; }

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; }
}

// Character

public class Character
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("icon")]
    public string Icon { get; set; } = "";

    [JsonPropertyName("role")]
    public string Role { get; set; } = "";

    [JsonPropertyName("era_id")]
    public int? EraId { get; set; }

    [JsonPropertyName("intro_dialogue")]
    public string? IntroDialogue { get; set; }
    [JsonPropertyName("portrait_asset")]
    public string? PortraitAsset { get; set; }     // "portrait_asset"
    [JsonPropertyName("voice_asset")]
    public string? VoiceAsset { get; set; }
}

// Scenario

public class Scenario
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("slug")]
    public string Slug { get; set; } = "";

    [JsonPropertyName("era_id")]
    public int EraId { get; set; }

    [JsonPropertyName("character_id")]
    public int CharacterId { get; set; }

    [JsonPropertyName("trigger_pop")]
    public int TriggerPop { get; set; }

    [JsonPropertyName("text")]
    public string Text { get; set; } = "";
    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("sort_order")]
    public int SortOrder { get; set; }
    [JsonPropertyName("character_line")]
    public string? CharacterLine { get; set; }     // "character_line"
}

// Choices

public class Choice
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("scenario_id")]
    public int ScenarioId { get; set; }

    [JsonPropertyName("label")]
    public string Label { get; set; } = "";

    [JsonPropertyName("feedback")]
    public string Feedback { get; set; } = "";

    [JsonPropertyName("delayed_feedback")]
    public string? DelayedFeedback { get; set; }

    [JsonPropertyName("delay_turns")]
    public int DelayTurns { get; set; }

    [JsonPropertyName("freedom_weight")]
    public double FreedomWeight { get; set; }

    [JsonPropertyName("sort_order")]
    public int SortOrder { get; set; }

    [JsonPropertyName("learn_url")]
    public string? LearnUrl { get; set; }

    [JsonPropertyName("learn_label")]
    public string? LearnLabel { get; set; }
}

// Effet d'un choix spécifique

public class Effect
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("choice_id")]
    public int ChoiceId { get; set; }

    [JsonPropertyName("atom_id")]
    public int AtomId { get; set; }

    [JsonPropertyName("multiplier")]
    public double Multiplier { get; set; } = 1.0;

    [JsonPropertyName("is_delayed")]
    public bool IsDelayed { get; set; }
}

// LOCAL ONLY - NOT IN THE DIRECTUS API

public class PriceSnapshot
{
    public int Turn { get; set; }
    public Dictionary<int, int> Prices { get; set; } = new();
}

public class PopSnapshot
{
    public int Turn { get; set; }
    public int Pop { get; set; }
    public long Gold { get; set; }
}

public class ChoiceEvent
{
    public int ChoiceId { get; set; }
    public int Turn { get; set; }
    public string Label { get; set; } = "";
    public double FreedomWeight { get; set; }
    public List<int> AffectedAtomIds { get; set; } = new();
    public Dictionary<int, double> Multipliers { get; set; } = new();        // atomId → immediate mult
    public Dictionary<int, double> DelayedMultipliers { get; set; } = new(); // atomId → delayed mult
    public int DelayedTurn { get; set; }                                     // when the delayed ones hit
    public string? LearnUrl { get; set; }
    public string? LearnLabel { get; set; }
}

public class DelayedEffect
{
    public int TriggerTurn { get; set; }
    public string Feedback { get; set; } = "";
    public string? LearnUrl { get; set; }
    public string? LearnLabel { get; set; }
    public Dictionary<int, double> Effects { get; set; } = new();
}

public class FreedomScore
{
    public int Score { get; set; } = 50;
    public string Title { get; set; } = "Undecided";
    public string Grade { get; set; } = "?";
}
