/**
 * Reusable GTA Car Meet / Savvy Track prediction templates.
 */
const { DEFAULT_PREDICTION_REWARDS } = require('./savvyPredictionsConfig');

function dragRacePreset({ sideA = 'BMW M5', sideB = 'Trackhawk', lockMinutes = 2 } = {}) {
  const locksAt = new Date(Date.now() + lockMinutes * 60 * 1000);
  return [
    {
      type: 'DRAG_WINNER',
      title: `${sideA} vs ${sideB}`,
      description: 'Who wins the drag race?',
      matchup: { sideA, sideB },
      locksAt,
      rewardConfig: { correctSavvy: DEFAULT_PREDICTION_REWARDS.DRAG_WINNER },
      options: [
        { label: sideA, side: 'A' },
        { label: sideB, side: 'B' },
      ],
    },
    {
      type: 'DRAG_ET_BRACKET',
      title: 'Winner ET Bracket',
      description: 'What will the winner run?',
      locksAt,
      rewardConfig: { correctSavvy: DEFAULT_PREDICTION_REWARDS.DRAG_ET_BRACKET },
      options: [
        { label: 'Under 9.00', min: null, max: 8.999 },
        { label: '9.00–9.49', min: 9.0, max: 9.49 },
        { label: '9.50–9.99', min: 9.5, max: 9.99 },
        { label: '10.00–10.49', min: 10.0, max: 10.49 },
        { label: '10.50+', min: 10.5, max: null },
      ],
    },
    {
      type: 'DRAG_MARGIN_BRACKET',
      title: 'Finish Margin',
      description: 'How close will it be?',
      locksAt,
      rewardConfig: { correctSavvy: DEFAULT_PREDICTION_REWARDS.DRAG_MARGIN_BRACKET },
      options: [
        { label: 'Photo finish', min: null, max: 0.05 },
        { label: '< 0.25 sec', min: 0.05, max: 0.249 },
        { label: '0.25–0.49 sec', min: 0.25, max: 0.49 },
        { label: '0.50–0.99 sec', min: 0.5, max: 0.99 },
        { label: '1.00+ sec', min: 1.0, max: null },
      ],
    },
  ];
}

function driftBattlePreset({ driverA = 'Driver A', driverB = 'Driver B', lockMinutes = 2 } = {}) {
  const locksAt = new Date(Date.now() + lockMinutes * 60 * 1000);
  return [
    {
      type: 'DRIFT_WINNER',
      title: `${driverA} vs ${driverB}`,
      description: 'Who posts the better valid run?',
      matchup: { sideA: driverA, sideB: driverB },
      locksAt,
      rewardConfig: { correctSavvy: DEFAULT_PREDICTION_REWARDS.DRIFT_WINNER },
      options: [
        { label: driverA, side: 'A' },
        { label: driverB, side: 'B' },
      ],
    },
    {
      type: 'DRIFT_TIME_BRACKET',
      title: 'Drift Time Bracket',
      description: 'What time will this run post?',
      locksAt,
      rewardConfig: { correctSavvy: DEFAULT_PREDICTION_REWARDS.DRIFT_TIME_BRACKET },
      options: [
        { label: 'Under 40.00', min: null, max: 39.999 },
        { label: '40.00–41.99', min: 40.0, max: 41.99 },
        { label: '42.00–43.99', min: 42.0, max: 43.99 },
        { label: '44.00–45.99', min: 44.0, max: 45.99 },
        { label: '46.00+', min: 46.0, max: null },
      ],
    },
  ];
}

function fastestRunPreset({ participants = [], lockMinutes = 30 } = {}) {
  const locksAt = new Date(Date.now() + lockMinutes * 60 * 1000);
  return {
    type: 'FASTEST_RUN',
    title: 'Fastest Run of the Night',
    description: 'Which driver/car will hold the fastest valid time at event end?',
    locksAt,
    rewardConfig: { correctSavvy: DEFAULT_PREDICTION_REWARDS.FASTEST_RUN },
    options: participants.map((p) => ({ label: p.label || p, participantRef: p.ref || p.label || p })),
  };
}

module.exports = {
  dragRacePreset,
  driftBattlePreset,
  fastestRunPreset,
};
