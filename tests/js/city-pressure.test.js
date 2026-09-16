const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('scarcity affects prices and signed population growth', () => {
    const pressure = read('AgeOfLiberty/Services/CityPressureEngine.cs');
    const economy = read('AgeOfLiberty/Services/EconomyEngine.cs');
    const state = read('AgeOfLiberty/Services/GameState.cs');

    assert.match(pressure, /DemandMultipliers\[atomId\]/);
    assert.match(pressure, /minimumCoverage/);
    assert.match(pressure, /NetGrowthRate/);
    assert.match(state, /GetDemandMultiplier/);
    assert.match(state, /GetCleanPrice[\s\S]*GetDemandMultiplier/);
    assert.match(economy, /while \(_state\.PopGrowthFraction <= -1/);
    assert.match(economy, /_state\.Population--/);
});

test('mandate failure is gradual, warned, recoverable, and persisted', () => {
    const pressure = read('AgeOfLiberty/Services/CityPressureEngine.cs');
    const save = read('AgeOfLiberty/Services/SaveService.cs');
    const page = read('AgeOfLiberty/Components/Pages/GamePage.razor');

    assert.match(pressure, /critical >= 2/);
    assert.match(pressure, /OusterPressure - 14/);
    assert.match(pressure, /warningStage/);
    assert.match(pressure, /GamePhase\.GameOver/);
    assert.match(save, /SaveCheckpoint/);
    assert.match(save, /DemandMultipliers = new Dictionary/);
    assert.match(page, /RewindToLastIssue/);
});

test('era unlocks do not regress and goals remain optional UI guidance', () => {
    const economy = read('AgeOfLiberty/Services/EconomyEngine.cs');
    const page = read('AgeOfLiberty/Components/Pages/GamePage.razor');
    const pressure = read('AgeOfLiberty/Services/CityPressureEngine.cs');

    assert.match(economy, /HighestEraIndex = Math\.Max/);
    assert.match(page, /unlockedIdx = Math\.Clamp\(State\.HighestEraIndex/);
    assert.match(page, /class="era-goals/);
    assert.match(page, /class="condition-meters/);
    assert.match(pressure, /GoalRewardedEraIndexes/);
});
