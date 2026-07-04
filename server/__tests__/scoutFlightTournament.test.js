const {
  resolveSavvyForScore,
  getRewardTierPreview,
  SCORE_REWARD_TIERS,
} = require('../config/scoutFlightTournamentConfig');
const {
  ScoutFlightTournamentError,
} = require('../services/scoutFlightTournamentService');

describe('scoutFlightTournamentConfig', () => {
  it('exposes reward tiers', () => {
    expect(getRewardTierPreview().length).toBeGreaterThan(0);
    expect(SCORE_REWARD_TIERS.length).toBeGreaterThan(0);
  });

  it('resolves savvy by score tier', () => {
    expect(resolveSavvyForScore(0)).toBe(0);
    expect(resolveSavvyForScore(24)).toBe(0);
    expect(resolveSavvyForScore(25)).toBe(25);
    expect(resolveSavvyForScore(49)).toBe(25);
    expect(resolveSavvyForScore(50)).toBe(75);
    expect(resolveSavvyForScore(100)).toBe(150);
    expect(resolveSavvyForScore(200)).toBe(300);
    expect(resolveSavvyForScore(9999)).toBe(300);
  });
});

const mongoose = require('mongoose');
const User = require('../models/User');
const ScoutFlightRun = require('../models/ScoutFlightRun');
const {
  startTournamentRun,
  submitTournamentScore,
  getTournamentStatus,
  getLeaderboard,
} = require('../services/scoutFlightTournamentService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal('scoutFlightTournament integration', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `sf_${suffix}`,
      email: `sf_${suffix}@test.local`,
      savvyPoints: 500,
      pointsBalance: 500,
      eventInventory: { scoutFlightTicket: 0 },
      perkMachine: {},
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await ScoutFlightRun.deleteMany({ userId: user?._id });
    await User.deleteOne({ _id: user?._id });
    await mongoose.disconnect();
  }, 30000);

  beforeEach(async () => {
    await ScoutFlightRun.deleteMany({ userId: user._id });
    user.eventInventory.scoutFlightTicket = 0;
    user.savvyPoints = 500;
    user.markModified('eventInventory');
    await user.save();
  });

  it('blocks tournament entry with zero tickets', async () => {
    const status = await getTournamentStatus(user);
    expect(status.ticketsOwned).toBe(0);
    await expect(startTournamentRun(user)).rejects.toBeInstanceOf(ScoutFlightTournamentError);
  });

  it('consumes one ticket and completes a tournament run', async () => {
    user.eventInventory.scoutFlightTicket = 1;
    user.markModified('eventInventory');
    await user.save();

    const start = await startTournamentRun(user);
    expect(start.ticketSpent).toBe(true);
    expect(start.runId).toBeTruthy();
    expect(start.status.ticketsOwned).toBe(0);

    const submit = await submitTournamentScore(user, {
      runId: start.runId,
      score: 120,
      elapsedMs: 45000,
    });
    expect(submit.duplicate).toBe(false);
    expect(submit.score).toBe(120);
    expect(submit.savvyEarned).toBe(150);
    expect(submit.savvyGranted).toBe(true);

    const dup = await submitTournamentScore(user, {
      runId: start.runId,
      score: 120,
      elapsedMs: 45000,
    });
    expect(dup.duplicate).toBe(true);
  });

  it('rejects implausible fast high scores', async () => {
    user.eventInventory.scoutFlightTicket = 1;
    user.markModified('eventInventory');
    await user.save();

    const start = await startTournamentRun(user);
    await expect(
      submitTournamentScore(user, {
        runId: start.runId,
        score: 5000,
        elapsedMs: 2000,
      })
    ).rejects.toMatchObject({ code: 'RUN_TOO_SHORT' });
  });

  it('lists only completed tournament runs on leaderboard', async () => {
    user.eventInventory.scoutFlightTicket = 1;
    user.markModified('eventInventory');
    await user.save();

    const start = await startTournamentRun(user);
    await submitTournamentScore(user, {
      runId: start.runId,
      score: 80,
      elapsedMs: 30000,
    });

    const board = await getLeaderboard('daily', { userId: user._id, limit: 10 });
    expect(board.entries.length).toBeGreaterThan(0);
    expect(board.entries[0].score).toBe(80);
    expect(board.currentUser?.score).toBe(80);
  });
});
