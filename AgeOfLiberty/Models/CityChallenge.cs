namespace AgeOfLiberty.Models;

public enum ChallengeStatus { Active, Won, Lost }

// Content and run state are separate: a future Directus provider only needs to
// supply definitions. Each accepted challenge saves its own copy of the rules.
public sealed class ChallengeDefinition
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Objective { get; set; } = "";
    public string Lesson { get; set; } = "";
    public string[] Categories { get; set; } = Array.Empty<string>();
    public int DurationTurns { get; set; }
    public int RequiredTurns { get; set; } = 2;
    public double TargetCoverage { get; set; } = 1;
}

public sealed class CityChallenge
{
    public ChallengeDefinition Rules { get; set; } = new();
    public ChallengeStatus Status { get; set; }
    public int StartedTurn { get; set; }
    public int DeadlineTurn { get; set; }
    public int LastEvaluatedTurn { get; set; }
    public int ConsecutiveTurns { get; set; }
    public int ExpectedCitizens { get; set; }
    public int SuccessArrivals { get; set; }
    public int FailureArrivals { get; set; }
    public Dictionary<string, double> Coverage { get; set; } = new();
    public string Result { get; set; } = "";
}
