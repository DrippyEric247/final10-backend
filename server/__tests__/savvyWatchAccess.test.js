const {
  isSavvyWatchEnabled,
  isSavvyWatchAdminOnly,
  canUserParticipateInSavvyWatch,
} = require('../config/savvyWatchConfig');
const { SavvyWatchError, joinEvent } = require('../services/savvyWatchService');

jest.mock('../models/SavvyWatchEvent', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/SavvyWatchSession', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/SavvyWatchAudit', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/savvyWatchPresenceService', () => ({
  findOrCreateSession: jest.fn(),
  processHeartbeat: jest.fn(),
  buildCheckpointProgress: jest.fn(() => []),
}));

jest.mock('../services/savvyWatchRewardService', () => ({
  claimSavvyWatchReward: jest.fn(),
  SavvyWatchRewardError: class SavvyWatchRewardError extends Error {},
}));

const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const { findOrCreateSession } = require('../services/savvyWatchPresenceService');

describe('Savvy Watch access gate', () => {
  const prevEnabled = process.env.SAVVY_WATCH_ENABLED;
  const prevAdminOnly = process.env.SAVVY_WATCH_ADMIN_ONLY;

  afterEach(() => {
    process.env.SAVVY_WATCH_ENABLED = prevEnabled;
    process.env.SAVVY_WATCH_ADMIN_ONLY = prevAdminOnly;
    jest.clearAllMocks();
  });

  test('SAVVY_WATCH_ADMIN_ONLY defaults to true when unset', () => {
    delete process.env.SAVVY_WATCH_ADMIN_ONLY;
    expect(isSavvyWatchAdminOnly()).toBe(true);
  });

  test('canUserParticipateInSavvyWatch allows normal users when admin-only is false', () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'false';
    const user = { _id: '507f1f77bcf86cd799439011', role: 'user' };
    expect(canUserParticipateInSavvyWatch(user)).toBe(true);
  });

  test('canUserParticipateInSavvyWatch blocks normal users when admin-only is true', () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'true';
    const user = { _id: '507f1f77bcf86cd799439011', role: 'user' };
    expect(canUserParticipateInSavvyWatch(user)).toBe(false);
  });

  test('canUserParticipateInSavvyWatch allows admins when admin-only is true', () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'true';
    const admin = { _id: '507f1f77bcf86cd799439012', role: 'admin' };
    expect(canUserParticipateInSavvyWatch(admin)).toBe(true);
  });

  test('joinEvent rejects normal users when SAVVY_WATCH_ADMIN_ONLY=true', async () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'true';
    const user = { _id: '507f1f77bcf86cd799439011', role: 'user' };

    await expect(joinEvent(user, 'gta-car-meet-001', { source: 'homepage-live' })).rejects.toMatchObject({
      code: 'SAVVY_WATCH_ADMIN_ONLY',
      message: 'Savvy Watch is in admin preview mode.',
    });
    expect(findOrCreateSession).not.toHaveBeenCalled();
  });

  test('joinEvent allows normal users when SAVVY_WATCH_ADMIN_ONLY=false', async () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'false';

    SavvyWatchEvent.findOne.mockResolvedValue({
      eventId: 'sw_gta',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      status: 'live',
      rewardRules: { checkpoints: [{ id: 'join', kind: 'join', savvyReward: 5 }] },
    });
    findOrCreateSession.mockResolvedValue({
      created: true,
      session: {
        sessionId: 'sws_test',
        checkpointClaims: [],
        joinedAt: new Date(),
        savvyEarned: 0,
        verifiedActiveSeconds: 0,
        save: jest.fn(),
      },
    });

    const user = { _id: '507f1f77bcf86cd799439011', role: 'user' };
    const result = await joinEvent(user, 'gta-car-meet-001', { source: 'homepage-live' });
    expect(result.sessionId).toBe('sws_test');
    expect(SavvyWatchEvent.updateOne).toHaveBeenCalledTimes(1);
  });

  test('joinEvent does not increment attribution on repeat join', async () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'false';

    SavvyWatchEvent.findOne.mockResolvedValue({
      eventId: 'sw_gta',
      slug: 'gta-car-meet-001',
      title: 'GTA Car Meet',
      status: 'live',
      rewardRules: { checkpoints: [{ id: 'join', kind: 'join', savvyReward: 5 }] },
    });
    findOrCreateSession.mockResolvedValue({
      created: false,
      session: {
        sessionId: 'sws_existing',
        checkpointClaims: ['join'],
        joinedAt: new Date(),
        savvyEarned: 5,
        verifiedActiveSeconds: 0,
        save: jest.fn(),
      },
    });

    const user = { _id: '507f1f77bcf86cd799439011', role: 'user' };
    await joinEvent(user, 'gta-car-meet-001', { source: 'homepage-live' });
    expect(SavvyWatchEvent.updateOne).not.toHaveBeenCalled();
  });
});

describe('Savvy Watch access error shape', () => {
  test('admin preview error uses SAVVY_WATCH_ADMIN_ONLY code', () => {
    const err = new SavvyWatchError(403, 'SAVVY_WATCH_ADMIN_ONLY', 'Savvy Watch is in admin preview mode.');
    expect(err.code).toBe('SAVVY_WATCH_ADMIN_ONLY');
    expect(err.message).toContain('admin preview mode');
  });
});
