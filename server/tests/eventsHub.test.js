/**
 * Events hub service smoke tests.
 */

jest.mock('../services/supplyDropService', () => ({
  getActiveDropForUser: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/savvySaleService', () => ({
  getActiveSavvySale: jest.fn().mockResolvedValue(null),
}));

const { buildEventsHub, weekendDoublePointsActive } = require('../services/eventsHubService');

describe('eventsHubService', () => {
  test('weekendDoublePointsActive is boolean', () => {
    expect(typeof weekendDoublePointsActive()).toBe('boolean');
  });

  test('buildEventsHub returns hub sections', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      subscription: { tier: 'free' },
      supplyDropClaimHistory: [],
      scoutSupport: {
        dealStreakCount: 2,
        scoutSupportProgress: 2,
        scoutSupportMilestonesClaimed: [],
        milestonesReady: [],
        dealStreakHistory: [],
      },
    };

    const hub = await buildEventsHub(user);
    expect(hub).toHaveProperty('activeEvents');
    expect(hub).toHaveProperty('claimableRewards');
    expect(hub).toHaveProperty('upcomingEvents');
    expect(hub).toHaveProperty('completedHistory');
    expect(hub).toHaveProperty('scoutSupport');
    expect(hub).toHaveProperty('claimableCount');
    expect(Array.isArray(hub.upcomingEvents)).toBe(true);
    expect(hub.upcomingEvents.length).toBeGreaterThan(0);
  });
});
