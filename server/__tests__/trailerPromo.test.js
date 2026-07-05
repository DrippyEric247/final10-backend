/**
 * @jest-environment node
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const TrailerPromoRedemption = require('../models/TrailerPromoRedemption');
const SupplyDrop = require('../models/SupplyDrop');
const { redeemTrailerPromoCode } = require('../services/trailerPromoService');
const { ensureProgressDocuments } = require('../services/battlePassPersistenceService');

describe('Trailer promo BETA247', () => {
  let user;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI required for integration test');
    await mongoose.connect(uri);
  }, 30000);

  beforeEach(async () => {
    user = await User.create({
      username: `beta247_${suffix}`,
      email: `beta247_${suffix}@test.final10.app`,
      password: 'TestPass123!',
      savvyPoints: 0,
      pointsBalance: 0,
    });
  });

  afterEach(async () => {
    if (user?._id) {
      await TrailerPromoRedemption.deleteMany({ userId: user._id });
      await SupplyDrop.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  }, 30000);

  it('redeems BETA247 case-insensitively with bundled rewards', async () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.10' } };
    const first = await redeemTrailerPromoCode(user._id, 'beta247', { req });

    expect(first.ok).toBe(true);
    expect(first.trailerPromo).toBe(true);
    expect(first.code).toBe('BETA247');
    expect(first.rewards.savvy).toBe(247);
    expect(first.rewards.callingCard).toBe('card_beta_hunter');
    expect(first.rewards.supplyDropId).toBeTruthy();

    const row = await TrailerPromoRedemption.findOne({ userId: user._id, code: 'BETA247' });
    expect(row).toBeTruthy();
    expect(row.username).toBe(user.username);
    expect(row.email).toBe(user.email);
    expect(row.ipAddress).toBe('203.0.113.10');

    const refreshed = await User.findById(user._id);
    expect(refreshed.savvyPoints).toBe(247);

    const { inv } = await ensureProgressDocuments(user._id);
    expect(inv.unlockedItemIds).toContain('card_beta_hunter');
  });

  it('rejects duplicate BETA247 redemption per account', async () => {
    const first = await redeemTrailerPromoCode(user._id, 'BETA247');
    expect(first.ok).toBe(true);

    const dup = await redeemTrailerPromoCode(user._id, 'Beta247');
    expect(dup.ok).toBe(false);
    expect(dup.alreadyRedeemed).toBe(true);
    expect(dup.message).toMatch(/already claimed/i);
  });

  it('returns null for non-trailer legacy codes', async () => {
    const result = await redeemTrailerPromoCode(user._id, 'FINAL10');
    expect(result).toBeNull();
  });
});

describe('Trailer promo INVITEFRIENDS', () => {
  let user;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI required for integration test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  }, 30000);

  beforeEach(async () => {
    user = await User.create({
      username: `invitefriends_${suffix}`,
      email: `invitefriends_${suffix}@test.final10.app`,
      password: 'TestPass123!',
      savvyPoints: 0,
      pointsBalance: 0,
    });
  });

  afterEach(async () => {
    if (user?._id) {
      await TrailerPromoRedemption.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  it('redeems INVITEFRIENDS case-insensitively with 500 Savvy only', async () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.20' } };
    const first = await redeemTrailerPromoCode(user._id, 'invitefriends', { req });

    expect(first.ok).toBe(true);
    expect(first.trailerPromo).toBe(true);
    expect(first.code).toBe('INVITEFRIENDS');
    expect(first.title).toBe('🎉 Invite Friends Code Redeemed!');
    expect(first.message).toBe('You earned +500 Savvy.');
    expect(first.scoutMessage).toMatch(/invite your friends/i);
    expect(first.ctaLabel).toBe('Invite Friends');
    expect(first.ctaPath).toBe('/invite-friends');
    expect(first.rewards.savvy).toBe(500);
    expect(first.rewards.callingCard).toBeNull();
    expect(first.rewards.supplyDropId).toBeFalsy();

    const row = await TrailerPromoRedemption.findOne({ userId: user._id, code: 'INVITEFRIENDS' });
    expect(row).toBeTruthy();
    expect(row.username).toBe(user.username);
    expect(row.email).toBe(user.email);
    expect(row.ipAddress).toBe('203.0.113.20');
    expect(row.createdAt).toBeTruthy();

    const refreshed = await User.findById(user._id);
    expect(refreshed.savvyPoints).toBe(500);
  });

  it('rejects duplicate INVITEFRIENDS redemption per account', async () => {
    const first = await redeemTrailerPromoCode(user._id, 'INVITEFRIENDS');
    expect(first.ok).toBe(true);

    const dup = await redeemTrailerPromoCode(user._id, 'InviteFriends');
    expect(dup.ok).toBe(false);
    expect(dup.alreadyRedeemed).toBe(true);
    expect(dup.message).toBe("You've already claimed the INVITEFRIENDS reward.");
  });

  it('returns invalid message for unknown trailer-style codes', async () => {
    const result = await redeemTrailerPromoCode(user._id, 'NOTAREALCODE');
    expect(result).toBeNull();
  });
});
