using AgeOfLiberty.Models;

namespace AgeOfLiberty.Services;

// Pure turn resolution; no clocks, random rolls, UI, or platform dependencies.
public static class ChallengeRules
{
    public static CityChallenge Start(ChallengeDefinition rules, int turn, int population)
    {
        int arrivals = Math.Max(2, (int)Math.Ceiling(Math.Max(1, population) * .10));
        return new CityChallenge
        {
            Rules = rules, StartedTurn = turn, DeadlineTurn = turn + rules.DurationTurns,
            LastEvaluatedTurn = turn, ExpectedCitizens = arrivals,
            SuccessArrivals = arrivals, FailureArrivals = arrivals / 3,
        };
    }

    // Returns true exactly once, when the round resolves. Call only for actual
    // simulation turns: background time and reloading must not advance rounds.
    public static bool Advance(CityChallenge round, int turn, IReadOnlyDictionary<string, double> coverage)
    {
        if (round.Status != ChallengeStatus.Active || turn <= round.LastEvaluatedTurn) return false;
        bool contiguous = turn == round.LastEvaluatedTurn + 1;
        round.LastEvaluatedTurn = turn;
        round.Coverage = coverage.ToDictionary(kv => kv.Key, kv => kv.Value);
        bool supplied = round.Rules.Categories.All(c => coverage.TryGetValue(c, out var value)
            && double.IsFinite(value) && value >= round.Rules.TargetCoverage);
        round.ConsecutiveTurns = supplied ? (contiguous ? round.ConsecutiveTurns + 1 : 1) : 0;
        if (turn < round.DeadlineTurn) return false;
        round.Status = turn == round.DeadlineTurn && round.ConsecutiveTurns >= round.Rules.RequiredTurns
            ? ChallengeStatus.Won : ChallengeStatus.Lost;
        return true;
    }
}
