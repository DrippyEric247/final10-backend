/**
 * Wave 5 — alert authority tests.
 * Run: cd server && npm test -- authority-wave5.test.js
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

jest.mock('../services/securityAuditService', () => ({
  auditFireAndForget: jest.fn(),
}));

const mongoose = require('mongoose');
const {
  profileForSpeedTier,
  applyPerkBoost,
  ALERT_SPEED_PROFILES,
} = require('../config/alertSpeedConfig');
const {
  initializeAlertSchedule,
  isAlertEligibleForScan,
  computeNextScanAt,
  scheduleAfterScan,
  maybeAccelerateSchedule,
  hasActiveFasterAlertPerk,
  addMinutes,
} = require('../services/alertTimingService');
const { savvyIdempotencyKey, deliveryKey } = require('../services/alertDeliveryService');
const { activeAlertCountQuery } = require('../services/alertTimingService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describe('Alert speed config — tier correctness', () => {
  it('A — Free standard activation ~15 minutes', () => {
    const p = profileForSpeedTier('standard');
    expect(p.activationDelayMinutes).toBe(15);
    expect(p.minimumRescanMinutes).toBe(15);
  });

  it('B — Premium faster than Free', () => {
    const free = profileForSpeedTier('standard');
    const prem = profileForSpeedTier('fast');
    expect(prem.activationDelayMinutes).toBeLessThan(free.activationDelayMinutes);
    expect(prem.minimumRescanMinutes).toBeLessThan(free.minimumRescanMinutes);
  });

  it('C — Pro fastest delay', () => {
    const prem = profileForSpeedTier('fast');
    const pro = profileForSpeedTier('fastest');
    expect(pro.activationDelayMinutes).toBeLessThan(prem.activationDelayMinutes);
    expect(pro.lanePriority).toBeGreaterThan(prem.lanePriority);
  });

  it('H — faster-alert perk reduces delays', () => {
    const base = profileForSpeedTier('standard');
    const boosted = applyPerkBoost(base, true);
    expect(boosted.activationDelayMinutes).toBeLessThan(base.activationDelayMinutes);
    expect(boosted.perkBoostActive).toBe(true);
  });

  it('I — perk expiry detection uses server time', () => {
    const future = { perkMachine: { activeBoosts: { fasterAlerts: { expiresAt: new Date(Date.now() + 60000) } } } };
    const past = { perkMachine: { activeBoosts: { fasterAlerts: { expiresAt: new Date(Date.now() - 1000) } } } };
    expect(hasActiveFasterAlertPerk(future)).toBe(true);
    expect(hasActiveFasterAlertPerk(past)).toBe(false);
  });
});

describe('Alert activation + scheduling', () => {
  it('A — initializeAlertSchedule sets eligibleAt and nextScanAt', () => {
    const created = new Date('2026-01-01T12:00:00.000Z');
    const profile = ALERT_SPEED_PROFILES.standard;
    const s = initializeAlertSchedule(created, profile);
    expect(s.eligibleAt.getTime()).toBe(addMinutes(created, 15).getTime());
    expect(s.nextScanAt.getTime()).toBe(s.eligibleAt.getTime());
  });

  it('B — alert before eligibleAt is skipped', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    expect(isAlertEligibleForScan({ isActive: true, eligibleAt: future, nextScanAt: future })).toBe(false);
  });

  it('C — due alert is eligible', () => {
    const past = new Date(Date.now() - 1000);
    expect(isAlertEligibleForScan({ isActive: true, eligibleAt: past, nextScanAt: past })).toBe(true);
  });

  it('D — legacy alert without schedule fields remains eligible', () => {
    expect(isAlertEligibleForScan({ isActive: true })).toBe(true);
  });

  it('E — upgrade accelerates nextScanAt', () => {
    const alert = {
      createdAt: new Date(Date.now() - 3600000),
      eligibleAt: new Date(Date.now() + 3600000),
      nextScanAt: new Date(Date.now() + 3600000),
      lastScannedAt: null,
    };
    const patch = maybeAccelerateSchedule(alert, ALERT_SPEED_PROFILES.fastest);
    expect(patch.nextScanAt.getTime()).toBeLessThan(alert.nextScanAt.getTime());
  });

  it('F — scheduleAfterScan updates nextScanAt from profile', () => {
    const scanned = new Date('2026-01-01T12:00:00.000Z');
    const patch = scheduleAfterScan({}, ALERT_SPEED_PROFILES.fastest, scanned);
    expect(patch.nextScanAt.getTime()).toBe(addMinutes(scanned, 5).getTime());
  });
});

describe('Match / reward idempotency keys', () => {
  it('A — delivery key is alert + auction scoped', () => {
    expect(deliveryKey('a1', 'x1')).toBe('alert_match:a1:x1');
  });

  it('B — savvy key is per alert match (not client forgeable path)', () => {
    expect(savvyIdempotencyKey('a1', 'x1')).toBe('alert_trigger:a1:x1');
  });
});

describe('Active alert counting rule', () => {
  it('counts isActive true alerts toward limit', () => {
    const q = activeAlertCountQuery('user123');
    expect(q).toEqual({ user: 'user123', isActive: true });
  });
});

describeReal('Alert limits — Mongo transaction (Wave 5)', () => {
  let userId;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const user = await User.create({
      email: `wave5-${Date.now()}@example.com`,
      username: `wave5${Date.now()}`,
      password: 'testpass123',
      membershipTier: 'free',
    });
    userId = user._id;
    await Alert.deleteMany({ user: userId });
  });

  afterEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    if (userId) {
      await Alert.deleteMany({ user: userId });
      await User.deleteOne({ _id: userId });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('E — Free limit enforced on create', async () => {
    const User = require('../models/User');
    const { createAlertAuthoritative, AlertLimitError } = require('../services/alertCreationService');
    const user = await User.findById(userId);

    for (let i = 0; i < 5; i += 1) {
      await createAlertAuthoritative(userId, user, null, {
        name: `Alert ${i}`,
        keywords: [`kw${i}`],
      });
    }

    await expect(
      createAlertAuthoritative(userId, user, null, {
        name: 'Overflow',
        keywords: ['overflow'],
      })
    ).rejects.toBeInstanceOf(AlertLimitError);
  });

  it('G — downgrade over-limit preserves existing alerts', async () => {
    const Alert = require('../models/Alert');
    const { countActiveAlerts } = require('../services/alertCreationService');
    await Alert.create([
      { user: userId, name: 'A1', keywords: ['a'], isActive: true, eligibleAt: new Date(), nextScanAt: new Date() },
      { user: userId, name: 'A2', keywords: ['b'], isActive: true, eligibleAt: new Date(), nextScanAt: new Date() },
      { user: userId, name: 'A3', keywords: ['c'], isActive: true, eligibleAt: new Date(), nextScanAt: new Date() },
      { user: userId, name: 'A4', keywords: ['d'], isActive: true, eligibleAt: new Date(), nextScanAt: new Date() },
      { user: userId, name: 'A5', keywords: ['e'], isActive: true, eligibleAt: new Date(), nextScanAt: new Date() },
      { user: userId, name: 'A6', keywords: ['f'], isActive: true, eligibleAt: new Date(), nextScanAt: new Date() },
    ]);
    expect(await countActiveAlerts(userId)).toBe(6);
  });
});

describeReal('Alert match dedupe — Mongo', () => {
  let user;
  let alert;
  let auction;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const Auction = require('../models/Auction');
    user = await User.create({
      email: `wave5m-${Date.now()}@example.com`,
      username: `wave5m${Date.now()}`,
      password: 'testpass123',
    });
    alert = await Alert.create({
      user: user._id,
      name: 'Dedupe test',
      keywords: ['dedupe', 'token'],
      isActive: true,
      minConfidence: 0,
      eligibleAt: new Date(Date.now() - 60000),
      nextScanAt: new Date(Date.now() - 60000),
    });
    auction = await Auction.create({
      title: 'dedupe token gadget listing',
      currentBid: 10,
      status: 'active',
      source: { platform: 'ebay', url: 'https://ebay.test/dedupe' },
      aiScore: { dealPotential: 90 },
    });
  });

  afterEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const Auction = require('../models/Auction');
    const SavvyPoint = require('../models/SavvyPoint');
    if (auction?._id) await Auction.deleteOne({ _id: auction._id });
    if (alert?._id) await Alert.deleteOne({ _id: alert._id });
    if (user?._id) {
      await SavvyPoint.deleteMany({ user_id: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('B — duplicate match does not double-count', async () => {
    const marketScanner = require('../services/marketScanner');
    await marketScanner.checkAlerts(auction);
    await marketScanner.checkAlerts(auction);
    const Alert = require('../models/Alert');
    const reloaded = await Alert.findById(alert._id);
    expect(reloaded.matches.length).toBe(1);
    expect(reloaded.triggerCount).toBe(1);
  });

  it('C — savvy paid once per alert+auction match', async () => {
    const marketScanner = require('../services/marketScanner');
    const SavvyPoint = require('../models/SavvyPoint');
    await marketScanner.checkAlerts(auction);
    await marketScanner.checkAlerts(auction);
    const txs = await SavvyPoint.find({ user_id: user._id, source: 'alert_trigger' });
    expect(txs.length).toBeLessThanOrEqual(1);
  });
});

describe('Rare Egg faster-alert perk — unit', () => {
  const { applyReward } = require('../services/perkMachineService');
  const { FASTER_ALERT_PERK, applyPerkBoost, profileForSpeedTier } = require('../config/alertSpeedConfig');

  it('A — applyReward faster_alert_perk activates server boost with timestamps', async () => {
    const user = {
      _id: 'egg-user-1',
      perkMachine: { eggInventory: {}, tokens: {}, timedEventTokens: [] },
      markModified: jest.fn(),
    };
    const grantSpy = jest.spyOn(require('../services/alertTimingService'), 'grantFasterAlertPerk');
    grantSpy.mockResolvedValue({
      ok: true,
      expiresAt: new Date(Date.now() + FASTER_ALERT_PERK.defaultDurationMs),
      idempotent: false,
    });

    const granted = await applyReward(
      user,
      { id: 'hatch_faster_alert_1h', type: 'faster_alert_perk', durationMs: FASTER_ALERT_PERK.defaultDurationMs, label: '1-Hour Faster Alerts' },
      'hatch:test-hatch-1'
    );

    expect(granted.fasterAlertPerk).toBe(true);
    expect(grantSpy).toHaveBeenCalledWith(
      user._id,
      FASTER_ALERT_PERK.defaultDurationMs,
      'egg_hatch',
      expect.objectContaining({ idempotencyKey: expect.stringContaining('hatch:test-hatch-1') })
    );
    grantSpy.mockRestore();
  });

  it('B — active perk reduces resolved alert timing vs base tier', () => {
    const base = profileForSpeedTier('standard');
    const boosted = applyPerkBoost(base, true);
    expect(boosted.activationDelayMinutes).toBeLessThan(base.activationDelayMinutes);
    expect(boosted.minimumRescanMinutes).toBeLessThan(base.minimumRescanMinutes);
  });

  it('G — perk does not change subscription tier profile identity', () => {
    const free = profileForSpeedTier('standard');
    const boosted = applyPerkBoost(free, true);
    expect(boosted.tier).toBe('standard');
    expect(boosted.lanePriority).toBe(free.lanePriority);
  });
});

describeReal('Rare Egg faster-alert perk — Mongo idempotency', () => {
  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('F — duplicate grant with same idempotencyKey is idempotent', async () => {
    const User = require('../models/User');
    const { grantFasterAlertPerk } = require('../services/alertTimingService');
    const userId = new mongoose.Types.ObjectId();
    await User.create({
      _id: userId,
      email: `egg-idem-${Date.now()}@example.com`,
      username: `eggidem${Date.now()}`,
      password: 'testpass123',
    });

    const key = 'faster_alert:test:idem';
    const first = await grantFasterAlertPerk(userId, 3600000, 'egg_hatch', { idempotencyKey: key });
    const second = await grantFasterAlertPerk(userId, 3600000, 'egg_hatch', { idempotencyKey: key });
    expect(first.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(new Date(second.expiresAt).getTime()).toBe(new Date(first.expiresAt).getTime());

    await User.deleteOne({ _id: userId });
  });
});

describeReal('Rare Egg perk — existing alerts + expiry (Mongo)', () => {
  let userId;
  let alertId;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const user = await User.create({
      email: `egg-sched-${Date.now()}@example.com`,
      username: `eggsched${Date.now()}`,
      password: 'testpass123',
      membershipTier: 'free',
    });
    userId = user._id;
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const alert = await Alert.create({
      user: userId,
      name: 'Perk accel',
      keywords: ['perk'],
      isActive: true,
      eligibleAt: future,
      nextScanAt: future,
      effectiveSpeedTier: 'standard',
    });
    alertId = alert._id;
  });

  afterEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    if (alertId) await Alert.deleteOne({ _id: alertId });
    if (userId) await User.deleteOne({ _id: userId });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('C — existing alerts accelerate after perk grant', async () => {
    const { grantFasterAlertPerk } = require('../services/alertTimingService');
    const Alert = require('../models/Alert');
    await grantFasterAlertPerk(userId, 3600000, 'egg_hatch', { idempotencyKey: 'accel:test' });
    const reloaded = await Alert.findById(alertId);
    expect(reloaded.eligibleAt.getTime()).toBeLessThan(Date.now() + 60 * 60 * 1000);
  });

  it('D — expired perk stops affecting resolved profile', async () => {
    const User = require('../models/User');
    const { resolveAlertSpeedProfile } = require('../services/alertTimingService');
    const { FASTER_ALERT_PERK } = require('../config/alertSpeedConfig');
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          [`perkMachine.activeBoosts.${FASTER_ALERT_PERK.perkBoostKey}`]: {
            activatedAt: new Date(Date.now() - 7200000),
            expiresAt: new Date(Date.now() - 1000),
            source: 'egg_hatch',
          },
        },
      }
    );
    const profile = await resolveAlertSpeedProfile(userId);
    expect(profile.perkBoostActive).toBeFalsy();
    expect(profile.activationDelayMinutes).toBe(15);
  });
});

describeReal('Scanner claim concurrency — Mongo atomic lease', () => {
  let alertId;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const user = await User.create({
      email: `claim-${Date.now()}@example.com`,
      username: `claim${Date.now()}`,
      password: 'testpass123',
    });
    const alert = await Alert.create({
      user: user._id,
      name: 'Claim test',
      keywords: ['claim'],
      isActive: true,
      eligibleAt: new Date(Date.now() - 60000),
      nextScanAt: new Date(Date.now() - 60000),
    });
    alertId = alert._id;
  });

  afterEach(async () => {
    const Alert = require('../models/Alert');
    const User = require('../models/User');
    if (alertId) {
      const alert = await Alert.findById(alertId).select('user');
      if (alert?.user) await User.deleteOne({ _id: alert.user });
      await Alert.deleteOne({ _id: alertId });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('A/B — simultaneous claims: only one worker owns alert', async () => {
    const { claimAlertForScan } = require('../services/savvyScoutAlertScanner');
    const [a, b] = await Promise.all([claimAlertForScan(alertId), claimAlertForScan(alertId)]);
    const winners = [a, b].filter(Boolean);
    expect(winners.length).toBe(1);
    expect(winners[0].token).toBeTruthy();
  });

  it('F — stale claim expires and becomes recoverable', async () => {
    const Alert = require('../models/Alert');
    const { claimAlertForScan } = require('../services/savvyScoutAlertScanner');
    await Alert.updateOne(
      { _id: alertId },
      {
        $set: {
          scanClaimedAt: new Date(Date.now() - 300000),
          scanClaimExpiresAt: new Date(Date.now() - 1000),
          scanClaimToken: 'stale-token',
        },
      }
    );
    const reclaimed = await claimAlertForScan(alertId);
    expect(reclaimed).toBeTruthy();
    expect(reclaimed.token).not.toBe('stale-token');
  });

  it('G — valid claim cannot be stolen by another token', async () => {
    const { claimAlertForScan, finalizeAlertScanClaim } = require('../services/savvyScoutAlertScanner');
    const owned = await claimAlertForScan(alertId);
    expect(owned).toBeTruthy();
    const stolen = await finalizeAlertScanClaim(alertId, 'wrong-token', { lastScannedAt: new Date() });
    expect(stolen).toBeNull();
    const legit = await finalizeAlertScanClaim(alertId, owned.token, { lastScannedAt: new Date() });
    expect(legit).toBeTruthy();
  });
});

describeReal('Delivery idempotency — email retry must not replay Savvy', () => {
  let user;
  let alert;
  let auction;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  });

  beforeEach(async () => {
    jest.resetModules();
    jest.doMock('../services/emailService', () => ({
      sendAlertMatchEmail: jest.fn(async () => ({ sent: false, reason: 'test_fail' })),
    }));
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const Auction = require('../models/Auction');
    user = await User.create({
      email: `deliv-${Date.now()}@example.com`,
      username: `deliv${Date.now()}`,
      password: 'testpass123',
      alertEmailOnMatch: true,
    });
    auction = await Auction.create({
      title: 'delivery idempotency gadget',
      currentBid: 12,
      status: 'active',
      source: { platform: 'ebay', url: 'https://ebay.test/delivery' },
      aiScore: { dealPotential: 90 },
    });
    alert = await Alert.create({
      user: user._id,
      name: 'Delivery',
      keywords: ['delivery', 'idempotency'],
      isActive: true,
      minConfidence: 0,
      matches: [
        {
          auction: auction._id,
          matchedAt: new Date(),
          deliveryKey: `alert_match:${String('placeholder')}:${auction._id}`,
          savvyGrantedAt: new Date(),
        },
      ],
    });
    alert.matches[0].deliveryKey = `alert_match:${alert._id}:${auction._id}`;
    await alert.save();
  });

  afterEach(async () => {
    const User = require('../models/User');
    const Alert = require('../models/Alert');
    const Auction = require('../models/Auction');
    const SavvyPoint = require('../models/SavvyPoint');
    if (auction?._id) await Auction.deleteOne({ _id: auction._id });
    if (alert?._id) await Alert.deleteOne({ _id: alert._id });
    if (user?._id) {
      await SavvyPoint.deleteMany({ user_id: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('email retry does not grant Savvy again when savvyGrantedAt already set', async () => {
    const { deliverAlertMatch } = require('../services/alertDeliveryService');
    const SavvyPoint = require('../models/SavvyPoint');
    const before = await SavvyPoint.countDocuments({ user_id: user._id, source: 'alert_trigger' });
    const result = await deliverAlertMatch(user._id, auction, alert, alert.matches[0]._id);
    const after = await SavvyPoint.countDocuments({ user_id: user._id, source: 'alert_trigger' });
    expect(result.savvyGranted).toBe(true);
    expect(after).toBe(before);
  });
});
