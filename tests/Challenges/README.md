# Challenge prototype checks

Run with the .NET 10 SDK (no mobile workloads or NuGet test packages needed):

```sh
dotnet run --project tests/Challenges/Challenges.csproj
```

The executable uses the game's actual challenge definitions and resolver. It
checks final-turn success, broken streaks, missing/invalid supply, duplicate
settlement, skipped turns, save round trips, fixed outcomes, and sequence end.

Device playtest:

1. Open a new or existing city. No deadline starts until Start challenge is tapped.
2. Start Feed the newcomers. Check six turns remain and both arrival outcomes
   are shown. Tap food to open the relevant supply building.
3. Hold projected food coverage at 100% for the final two turns; verify the
   declared citizen count arrives once and a result is recorded in Dispatches.
4. In a separate run, leave coverage below target in either final turn. Verify
   the smaller arrival count and the final streak explanation.
5. Restart the app mid-round; the deadline, streak and outcomes must be retained.
   Close it after resolution; the arrivals must not be applied twice.
6. Complete the energy and combined-supply rounds. The prototype then ends and
   ordinary city play continues. Rewind an issue checkpoint and verify challenge
   state rewinds with the economy.

Definitions live in ChallengeCatalog.cs; accepted rules live in the save. Supply
uses the currently unlocked era. These first three rounds exercise existing
production capacity; import/export contracts and Directus content are later work.
