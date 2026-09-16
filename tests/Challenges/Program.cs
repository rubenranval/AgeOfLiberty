using System.Text.Json;
using AgeOfLiberty.Models;
using AgeOfLiberty.Services;

static void Check(bool passed, string label)
{
    if (!passed) throw new Exception(label);
    Console.WriteLine("PASS: " + label);
}
static Dictionary<string, double> Supply(double food = 1, double energy = 1, double housing = 1) =>
    new() { ["food"] = food, ["energy"] = energy, ["housing"] = housing };
static CityChallenge Start(int index = 0) => ChallengeRules.Start(ChallengeCatalog.Get(index)!, 10, 100);

var round = Start();
Check(round.DeadlineTurn == 16 && round.SuccessArrivals == 10 && round.FailureArrivals == 3, "deadline and outcomes frozen at acceptance");
Check(!ChallengeRules.Advance(round, 10, Supply()), "start turn is not counted");
for (int t = 11; t < 16; t++) Check(!ChallengeRules.Advance(round, t, Supply()), "no early settlement");
Check(ChallengeRules.Advance(round, 16, Supply()) && round.Status == ChallengeStatus.Won, "win at deadline");
Check(!ChallengeRules.Advance(round, 16, Supply()) && !ChallengeRules.Advance(round, 17, Supply()), "settlement is idempotent");
round = Start();
for (int t = 11; t <= 14; t++) ChallengeRules.Advance(round, t, Supply());
ChallengeRules.Advance(round, 15, Supply(.8));
Check(round.ConsecutiveTurns == 0, "shortage resets streak");
ChallengeRules.Advance(round, 16, Supply());
Check(round.Status == ChallengeStatus.Lost, "earlier success does not bypass final two turns");
round = Start();
ChallengeRules.Advance(round, 15, Supply());
var resumed = JsonSerializer.Deserialize<CityChallenge>(JsonSerializer.Serialize(round))!;
Check(!ChallengeRules.Advance(resumed, 15, Supply()), "reload does not double count a turn");
Check(ChallengeRules.Advance(resumed, 16, Supply()) && resumed.Status == ChallengeStatus.Won, "saved streak survives reload");
round = Start(2);
for (int t = 11; t <= 20; t++) ChallengeRules.Advance(round, t, Supply(1, .7, 1));
Check(round.Status == ChallengeStatus.Lost, "all required categories must pass");
round = Start();
ChallengeRules.Advance(round, 15, Supply());
ChallengeRules.Advance(round, 16, Supply(double.NaN));
Check(round.Status == ChallengeStatus.Lost, "invalid coverage cannot win");
round = Start();
ChallengeRules.Advance(round, 16, Supply());
Check(round.Status == ChallengeStatus.Lost, "skipped turns cannot fabricate a streak");
Check(ChallengeCatalog.Get(3) == null, "prototype sequence ends after three rounds");
Console.WriteLine("Challenge behavior checks complete.");
