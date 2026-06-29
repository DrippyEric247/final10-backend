/**
 * Referral pipeline integrity tests.
 *
 * Run: cd server && MONGODB_URI=mongodb://127.0.0.1:27017/final10_ref_test npm run test:referral
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const ReferralLog = require('../models/ReferralLog');
const SavvyTransaction = require('../models/SavvyTransaction');
const {
  processReferralOnSignup,
  processReferralByCode,
  referrerIdempotencyKey,
  refereeIdempotencyKey,
  REFERRAL_SAVVY_REFERRER,
  REFERRAL_SAVVY_REFEREE,
} = require('../services/referralService');
const { sumCompletedTransactions } = require('../services/savvyBalanceService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal('Referral integrity (Phase 2)', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let referrer;
  let referee;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    referrer = await User.create({
      username: `ref_host_${suffix}`,
      email: `ref_host_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      referralCode: `code_${suffix}`,
    });
  }, 60000);

  beforeEach(async () => {
    referee = await User.create({
      username: `ref_new_${suffix}_${Math.random().toString(16).slice(2)}`,
      email: `ref_new_${suffix}_${Math.random().toString(16).slice(2)}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
    });
  });

  afterAll(async () => {
    if (!MONGODB_URI) return;
    try {
      const ids = [referrer?._id, referee?._id].filter(Boolean);
      if (referrer?._id) {
        const allReferees = await User.find({ referredBy: referrer._id }).select('_id');
        ids.push(...allReferees.map((u) => u._id));
      }
      for (const id of ids) {
        await SavvyTransaction.deleteMany({ userId: id });
        await ReferralLog.deleteMany({ $or: [{ referrerId: id }, { refereedId: id }] });
        await User.deleteOne({ _id: id });
      }
      await ReferralLog.deleteMany({ referrerId: referrer._id });
    } finally {
      await mongoose.disconnect();
    }
  }, 30000);

  it('grants Savvy to referrer and referee with ledger entries', async () => {
    const result = await processReferralOnSignup({
      referrer,
      referee,
      referralCode: referrer.referralCode,
      ip: '203.0.113.10',
      ua: 'integrity-test-agent',
    });

    expect(result.granted).toBe(true);
    expect(result.referrerSavvy).toBe(REFERRAL_SAVVY_REFERRER);
    expect(result.refereeSavvy).toBe(REFERRAL_SAVVY_REFEREE);

    const refUser = await User.findById(referrer._id);
    const newUser = await User.findById(referee._id);
    expect(refUser.savvyPoints).toBe(REFERRAL_SAVVY_REFERRER);
    expect(newUser.savvyPoints).toBe(REFERRAL_SAVVY_REFEREE);
    expect(String(newUser.referredBy)).toBe(String(referrer._id));

    const log = await ReferralLog.findOne({ refereedId: referee._id, status: 'accepted' });
    expect(log).toBeTruthy();
    expect(String(log.referrerId)).toBe(String(referrer._id));

    const refTxn = await SavvyTransaction.findOne({
      idempotencyKey: referrerIdempotencyKey(referrer._id, referee._id),
    }).lean();
    const newTxn = await SavvyTransaction.findOne({
      idempotencyKey: refereeIdempotencyKey(referee._id),
    }).lean();
    expect(refTxn?.amount).toBe(REFERRAL_SAVVY_REFERRER);
    expect(newTxn?.amount).toBe(REFERRAL_SAVVY_REFEREE);

    expect(await sumCompletedTransactions(referrer._id)).toBe(REFERRAL_SAVVY_REFERRER);
    expect(await sumCompletedTransactions(referee._id)).toBe(REFERRAL_SAVVY_REFEREE);
  });

  it('blocks duplicate referral for same referee', async () => {
    const first = await processReferralOnSignup({
      referrer,
      referee,
      referralCode: referrer.referralCode,
      ip: '203.0.113.11',
      ua: 'dup-test-agent',
    });
    expect(first.granted).toBe(true);

    const second = await processReferralOnSignup({
      referrer,
      referee,
      referralCode: referrer.referralCode,
      ip: '203.0.113.11',
      ua: 'dup-test-agent',
    });
    expect(second.duplicate || second.alreadyProcessed).toBe(true);

    const fresh = await User.findById(referee._id);
    expect(fresh.savvyPoints).toBe(REFERRAL_SAVVY_REFEREE);
  });

  it('blocks duplicate via processReferralByCode retry', async () => {
    const r1 = await processReferralByCode({
      referee,
      referralCode: referrer.referralCode,
      ip: '203.0.113.12',
      ua: 'retry-agent',
    });
    expect(r1.granted).toBe(true);

    const r2 = await processReferralByCode({
      referee,
      referralCode: referrer.referralCode,
      ip: '203.0.113.12',
      ua: 'retry-agent',
    });
    expect(r2.duplicate || r2.alreadyProcessed).toBe(true);
  });

  it('handles concurrent duplicate claims with single grant', async () => {
    const results = await Promise.all([
      processReferralOnSignup({
        referrer,
        referee,
        referralCode: referrer.referralCode,
        ip: '203.0.113.20',
        ua: 'concurrent-agent',
      }),
      processReferralOnSignup({
        referrer,
        referee,
        referralCode: referrer.referralCode,
        ip: '203.0.113.20',
        ua: 'concurrent-agent',
      }),
      processReferralOnSignup({
        referrer,
        referee,
        referralCode: referrer.referralCode,
        ip: '203.0.113.20',
        ua: 'concurrent-agent',
      }),
    ]);

    const granted = results.filter((r) => r.granted).length;
    const dupes = results.filter((r) => r.duplicate || r.alreadyProcessed).length;
    expect(granted).toBe(1);
    expect(dupes).toBe(2);

    const fresh = await User.findById(referee._id);
    expect(fresh.savvyPoints).toBe(REFERRAL_SAVVY_REFEREE);

    const acceptedLogs = await ReferralLog.countDocuments({
      refereedId: referee._id,
      status: 'accepted',
    });
    expect(acceptedLogs).toBe(1);
  });

  it('blocks self-referral', async () => {
    const self = await User.create({
      username: `self_${suffix}`,
      email: `self_${suffix}@test.local`,
      referralCode: `selfcode_${suffix}`,
      savvyPoints: 0,
      pointsBalance: 0,
    });

    const result = await processReferralOnSignup({
      referrer: self,
      referee: self,
      referralCode: self.referralCode,
      ip: '203.0.113.30',
      ua: 'self-ref-agent',
    });

    expect(result.skipped || result.blocked || !result.granted).toBe(true);
    await User.deleteOne({ _id: self._id });
  });
});
