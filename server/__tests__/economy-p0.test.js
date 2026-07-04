/**
 * Economy P0 hardening tests — spin lock, savvy sale, webhook idempotency, easter eggs.
 *
 * Run: cd server && npm test -- economy-p0.test.js
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const EasterEggRedemption = require('../models/EasterEggRedemption');
const StripeWebhookEvent = require('../models/StripeWebhookEvent');
const ScoutMissionProgress = require('../models/ScoutMissionProgress');
const {
  validateActiveSavvySale,
  resolveSavvySaleSpinPricing,
  applySavvySaleToSpinCost,
} = require('../services/savvySaleService');
const { redeemEasterEggCode } = require('../services/easterEggService');
const { withStripeEventIdempotency } = require('../services/stripeWebhookIdempotency');
const { isDonationCheckoutSession } = require('../services/donationService');
const { acquirePerkSpinLock, releasePerkSpinLock, SpinLockError } = require('../services/perkSpinLockService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describe('Economy P0 unit guards', () => {
  it('rejects savvy sale when window is in the future (no client clock spoof)', () => {
    const future = {
      active: true,
      startAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 120_000),
      eventId: 'future-sale',
    };
    expect(validateActiveSavvySale(future)).toBe(false);
    const pricing = resolveSavvySaleSpinPricing(60, future);
    expect(pricing.saleApplied).toBe(false);
    expect(pricing.cost).toBe(60);
  });

  it('applies 50% savvy sale discount per tier', () => {
    const now = Date.now();
    const live = {
      active: true,
      startAt: new Date(now - 1000),
      expiresAt: new Date(now + 60_000),
      eventId: 'live-sale',
    };
    expect(resolveSavvySaleSpinPricing(20, live)).toMatchObject({
      saleApplied: true,
      cost: 10,
      originalCost: 20,
      savings: 10,
    });
    expect(resolveSavvySaleSpinPricing(40, live)).toMatchObject({
      saleApplied: true,
      cost: 20,
      savings: 20,
    });
    expect(resolveSavvySaleSpinPricing(60, live)).toMatchObject({
      saleApplied: true,
      cost: 30,
      savings: 30,
    });

    const legacy = applySavvySaleToSpinCost(40, true);
    expect(legacy.cost).toBe(20);
  });

  it('detects donation checkout sessions vs subscriptions', () => {
    expect(isDonationCheckoutSession({ mode: 'payment', amount_total: 500 })).toBe(true);
    expect(isDonationCheckoutSession({ mode: 'subscription', subscription: 'sub_1' })).toBe(false);
    expect(isDonationCheckoutSession({ mode: 'payment', amount_total: 25 })).toBe(false);
  });
});

describeReal('Economy P0 integration', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `p0_${suffix}`,
      email: `p0_${suffix}@test.local`,
      savvyPoints: 1000,
      pointsBalance: 1000,
      perkMachine: {},
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await new Promise((r) => setTimeout(r, 300));
    try {
      if (user?._id) {
        await EasterEggRedemption.deleteMany({ userId: user._id });
        await ScoutMissionProgress.deleteMany({ userId: user._id });
        await StripeWebhookEvent.deleteMany({ stripeEventId: new RegExp(`^evt_test_${suffix}`) });
        await User.deleteOne({ _id: user._id });
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 30000);

  it('easter egg redemption is persisted and idempotent', async () => {
    const first = await redeemEasterEggCode(user._id, 'FINAL10');
    expect(first.ok).toBe(true);
    expect(first.savvyEarned).toBe(150);

    const dup = await redeemEasterEggCode(user._id, 'FINAL10');
    expect(dup.ok).toBe(false);
    expect(dup.alreadyRedeemed).toBe(true);

    const row = await EasterEggRedemption.findOne({ userId: user._id, code: 'FINAL10' });
    expect(row).toBeTruthy();
  });

  it('stripe webhook idempotency processes event id once', async () => {
    const eventId = `evt_test_${suffix}_donation`;
    let runs = 0;
    const handler = async () => {
      runs += 1;
      return { ok: true };
    };

    const first = await withStripeEventIdempotency(eventId, 'checkout.session.completed', handler);
    const second = await withStripeEventIdempotency(eventId, 'checkout.session.completed', handler);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(runs).toBe(1);
  });

  it('perk spin lock rejects concurrent acquire', async () => {
    const first = await acquirePerkSpinLock(user._id);
    expect(first).toBeTruthy();

    await expect(acquirePerkSpinLock(user._id)).rejects.toBeInstanceOf(SpinLockError);

    await releasePerkSpinLock(user._id);
    const second = await acquirePerkSpinLock(user._id);
    expect(second).toBeTruthy();
    await releasePerkSpinLock(user._id);
  });
});
