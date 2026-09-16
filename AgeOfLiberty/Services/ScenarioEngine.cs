using AgeOfLiberty.Models;
using AgeOfLiberty.Services;

namespace AgeOfLiberty.Services;


public class ScenarioEngine
{
    private readonly GameState _state;
    private readonly GameConfigStore _config;

    public EconomyEngine? Economy { get; set; }

    public ScenarioEngine(GameState state, GameConfigStore config)
    {
        _state = state;
        _config = config;
    }

    public void CheckTriggers()
    {
       
    }

    public void MakeChoice(int choiceId)
    {
        if (_state.ActiveScenario == null || Economy == null) return;

        var choice = _config.Choices.FirstOrDefault(c => c.Id == choiceId);
        if (choice == null) return;

        var (immediate, delayed) = _config.GetEffects(choiceId);

        var immEffects = immediate
                    .GroupBy(e => e.AtomId)
                    .ToDictionary(g => g.Key, g => g.First().Multiplier);
        Economy.ApplyEffects(immEffects);

        if (delayed.Count > 0)
        {
            var delEffects = delayed
                .GroupBy(e => e.AtomId)
                .ToDictionary(g => g.Key, g => g.First().Multiplier);
            _state.DelayedEffects.Add(new DelayedEffect
            {
                TriggerTurn = _state.Turn + choice.DelayTurns,
                Feedback = choice.DelayedFeedback ?? "",
                LearnUrl = choice.LearnUrl,
                LearnLabel = choice.LearnLabel,
                Effects = delEffects,
            });
        }

        // Record event
        var allAffected = immediate.Select(e => e.AtomId)
            .Concat(delayed.Select(e => e.AtomId))
            .Distinct().ToList();

        _state.ChoiceEvents.Add(new ChoiceEvent
        {
            Turn = _state.Turn,
            Label = choice.Label,
            FreedomWeight = choice.FreedomWeight,
            AffectedAtomIds = allAffected,
            ChoiceId = choice.Id,
        });

        // Feedback
        //_state.FeedbackText = choice.Feedback;
        Economy.ScheduleFeedback(choice.Feedback);
        _state.AddLog(choice.Feedback);
        _state.ScenariosDone.Add(_state.ActiveScenario.Slug);
        _state.ActiveScenario = null;
        _state.Phase = GamePhase.Play;

        // Resume economy
        Economy.Start();
        _state.NotifyStateChanged();

    }
}
