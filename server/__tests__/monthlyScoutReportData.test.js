const {
  normalizeMonthlyReportData,
  sampleMonthlyReportData,
} = require('../templates/email/savvyScoutMonthlyReportTemplate');
const { LIGHT_ACTIVITY_MESSAGE } = require('../services/monthlyScoutReportDataService');

describe('Monthly Scout Report — real data normalization', () => {
  it('sampleMonthlyReportData uses zeros, not placeholder stats', () => {
    const sample = sampleMonthlyReportData();
    expect(sample.savvyEarned).toBe(0);
    expect(sample.estimatedSavings).toBe(0);
    expect(sample.currentStreak).toBe(0);
    expect(sample.bestMovesUsed).toBe(0);
    expect(sample.achievements).toEqual([]);
    expect(sample.lightActivity).toBe(true);
  });

  it('normalizeMonthlyReportData defaults missing stats to zero', () => {
    const d = normalizeMonthlyReportData({
      userName: 'Test Operator',
      monthLabel: 'June 2026',
      savvyEarned: 0,
      estimatedSavings: 0,
      currentStreak: 0,
      lightActivity: true,
      lightActivityMessage: LIGHT_ACTIVITY_MESSAGE,
      achievements: [],
    });

    expect(d.stats.find((s) => s.key === 'savvyEarned')?.value).toBe('0');
    expect(d.stats.find((s) => s.key === 'estimatedSavings')?.value).toBe('$0');
    expect(d.stats.find((s) => s.key === 'currentStreak')?.value).toBe('0 Days');
    expect(d.achievements).toEqual([]);
    expect(d.scoutMessage).toContain('still gathering');
  });

  it('normalizeMonthlyReportData formats real user stats', () => {
    const d = normalizeMonthlyReportData({
      userName: 'Eric',
      monthLabel: 'June 2026',
      savvyEarned: 150,
      estimatedSavings: 42,
      currentStreak: 5,
      alertsCreated: 2,
      achievements: [{ icon: '🔥', title: 'Streak Starter', description: '5-day streak' }],
      lightActivity: false,
    });

    expect(d.stats.find((s) => s.key === 'savvyEarned')?.value).toBe('150');
    expect(d.stats.find((s) => s.key === 'estimatedSavings')?.value).toBe('$42');
    expect(d.achievements).toHaveLength(1);
    expect(d.scoutMessage).toContain('150');
  });
});
