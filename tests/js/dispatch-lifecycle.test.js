const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('feedback is represented by persistent dispatches instead of delayed modal strings', () => {
    const state = read('AgeOfLiberty/Services/GameState.cs');
    const save = read('AgeOfLiberty/Services/SaveService.cs');
    const scenario = read('AgeOfLiberty/Services/ScenarioEngine.cs');
    const economy = read('AgeOfLiberty/Services/EconomyEngine.cs');

    assert.match(state, /List<GameDispatch> Dispatches/);
    assert.doesNotMatch(state, /FeedbackText/);
    assert.match(save, /Dispatches = state\.Dispatches\.ToList\(\)/);
    assert.match(save, /state\.Dispatches\.AddRange/);
    assert.match(scenario, /_state\.ActiveDispatchId = dispatch\.Id/);
    assert.doesNotMatch(scenario, /ScheduleFeedback/);
    assert.match(economy, /dispatch\.IsRead = false/);
    assert.match(economy, /_state\.ToastDispatchId = dispatch\.Id/);
    assert.doesNotMatch(economy, /ScheduleFeedback/);
});

test('only the consequence card dismisses the modal', () => {
    const page = read('AgeOfLiberty/Components/Pages/GamePage.razor');
    const overlay = page.match(/<div class="overlay feedback-overlay"[^>]*>/)?.[0];
    assert.ok(overlay, 'feedback overlay exists');
    assert.doesNotMatch(overlay, /@onclick/);
    assert.match(page, /class="feedback-modal consequence-card"[\s\S]*?@onclick="DismissFeedback"/);
    assert.match(page, /TimeSpan\.FromMilliseconds\(350\)/);
});

test('delayed consequences have pending, unread, and detail surfaces', () => {
    const page = read('AgeOfLiberty/Components/Pages/GamePage.razor');
    assert.match(page, />Unfolding</);
    assert.match(page, /UnreadDispatchCount/);
    assert.match(page, /OpenDispatchDetail\(toastDispatch\.Id\)/);
    assert.match(page, /DisplayPriceChanges\.Take\(3\)/);
});
