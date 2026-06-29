/**
 * Scout Flight automated playtest — run: npm test -- scoutFlightPlaytest --watchAll=false
 */

import { runPlaytestReport } from '../scoutFlightSimulator';

describe('Scout Flight playtest', () => {
  it('reports average survival by difficulty preset', () => {
    const report = runPlaytestReport({ runsPerDifficulty: 80 });
    // eslint-disable-next-line no-console
    console.log('\n=== Scout Flight Playtest Report ===\n', JSON.stringify(report, null, 2));

    const { PRACTICE, NORMAL, TOURNAMENT } = report.byDifficulty;
    expect(PRACTICE).toBeDefined();
    expect(NORMAL).toBeDefined();
    expect(TOURNAMENT).toBeDefined();

    expect(report.difficultyOrdering.practiceAvgGteNormal).toBe(true);
    expect(report.difficultyOrdering.normalAvgGteTournament).toBe(true);
    expect(report.difficultyOrdering.practiceMaxGteTournamentMax).toBe(true);

    expect(NORMAL.hitboxVsSpritePct).toBeGreaterThanOrEqual(10);
    expect(NORMAL.hitboxVsSpritePct).toBeLessThanOrEqual(16);
    expect(NORMAL.collisionRadius).toBeLessThan(47 / 2);
    expect(NORMAL.avgScorePerSec).toBeLessThan(200);
    expect(PRACTICE.maxSurvivalSec).toBeGreaterThan(6);
  });
});
