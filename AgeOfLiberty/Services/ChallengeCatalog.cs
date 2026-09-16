using AgeOfLiberty.Models;

namespace AgeOfLiberty.Services;

public static class ChallengeCatalog
{
    public const int Count = 3;

    // Return fresh definitions so content edits cannot mutate a running round.
    public static ChallengeDefinition? Get(int index) => index switch
    {
        0 => new()
        {
            Id = "feed-newcomers", Title = "Feed the newcomers", DurationTurns = 6,
            Categories = new[] { "food" },
            Objective = "Supply the newcomers' food needs for the final 2 turns.",
            Lesson = "New customers create an opportunity for producers. Expanding supply helps meet demand.",
        },
        1 => new()
        {
            Id = "power-expansion", Title = "Power the expansion", DurationTurns = 8,
            Categories = new[] { "energy" },
            Objective = "Supply the newcomers' energy needs for the final 2 turns.",
            Lesson = "Scarcity makes extra supply valuable. Investing ahead of demand gives a city room to grow.",
        },
        2 => new()
        {
            Id = "welcome-businesses", Title = "Room for opportunity", DurationTurns = 10,
            Categories = new[] { "food", "housing", "energy" },
            Objective = "Supply food, housing and energy for the final 2 turns.",
            Lesson = "Growth depends on complementary goods. A city benefits when producers meet different needs.",
        },
        _ => null,
    };
}
