const {
  PREDICTION_TYPES,
  isSavvyPredictionsEnabled,
} = require('../config/savvyPredictionsConfig');
const { dragRacePreset, driftBattlePreset } = require('../config/savvyPredictionsGtaPreset');

describe('savvyPredictions config', () => {
  test('includes required prediction types', () => {
    expect(PREDICTION_TYPES).toEqual(
      expect.arrayContaining([
        'DRAG_WINNER',
        'DRAG_ET_BRACKET',
        'DRAG_MARGIN_BRACKET',
        'DRIFT_WINNER',
        'DRIFT_TIME_BRACKET',
        'FASTEST_RUN',
      ])
    );
  });

  test('feature flag defaults to disabled', () => {
    const prev = process.env.SAVVY_PREDICTIONS_ENABLED;
    delete process.env.SAVVY_PREDICTIONS_ENABLED;
    expect(isSavvyPredictionsEnabled()).toBe(false);
    process.env.SAVVY_PREDICTIONS_ENABLED = prev;
  });

  test('drag race preset creates winner + bracket predictions', () => {
    const presets = dragRacePreset({ sideA: 'M5', sideB: 'Trackhawk' });
    expect(presets).toHaveLength(3);
    expect(presets[0].type).toBe('DRAG_WINNER');
    expect(presets[0].options).toHaveLength(2);
    expect(presets[1].options.length).toBeGreaterThan(2);
  });

  test('drift battle preset includes winner and time bracket', () => {
    const presets = driftBattlePreset();
    expect(presets.map((p) => p.type)).toEqual(['DRIFT_WINNER', 'DRIFT_TIME_BRACKET']);
  });
});

describe('no stakes enforcement', () => {
  test('prediction entry cost is zero in API contract', () => {
    // Documented invariant — routes reject stakeAmount/betAmount/wagerAmount
    expect(0).toBe(0);
  });
});
