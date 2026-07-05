/**
 * @jest-environment node
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const ReferralTrackingLog = require('../models/ReferralTrackingLog');
const {
  trackLinkVisit,
  trackSignupStarted,
  trackSignupCompleted,
  trackPointGrantFailed,
  manualGrantFromLog,
  listTrackingLogs,
  hasReferralRewardGranted,
} = require('../services/referralTrackingService');

describe('Referral tracking emergency logs', () => {
  let referrer;
  let admin;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const req = {
    headers: {
      'x-forwarded-for': '198.51.100.42',
      'user-agent': 'ReferralTrackTest/1.0',
    },
    ip: '198.51.100.42',
  };

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error('MONGODB_URI required for integration test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  }, 30000);

  beforeEach(async () => {
    referrer = await User.create({
      username: `ref_track_${suffix}`,
      email: `ref_track_${suffix}@test.final10.app`,
      password: 'TestPass123!',
      savvyPoints: 0,
      pointsBalance: 0,
    });
    referrer.referralCode = referrer._id.toString();
    await referrer.save();

    admin = await User.create({
      username: `ref_admin_${suffix}`,
      email: `ref_admin_${suffix}@test.final10.app`,
      password: 'TestPass123!',
      role: 'admin',
      savvyPoints: 0,
      pointsBalance: 0,
    });
  });

  afterEach(async () => {
    const ids = [referrer?._id, admin?._id].filter(Boolean);
    if (ids.length) {
      await ReferralTrackingLog.deleteMany({
        $or: [{ referrerUserId: { $in: ids } }, { referredUserId: { $in: ids } }],
      });
      await User.deleteMany({ _id: { $in: ids } });
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  }, 30000);

  it('logs LINK_VISIT with referrer context', async () => {
    const row = await trackLinkVisit(req, referrer._id.toString());
    expect(row).toBeTruthy();
    expect(row.eventType).toBe('LINK_VISIT');
    expect(String(row.referrerUserId)).toBe(String(referrer._id));
    expect(row.referrerEmail).toBe(referrer.email);
    expect(row.ipAddress).toBe('198.51.100.42');
  });

  it('logs signup flow and manual grant once', async () => {
    const refereeEmail = `referee_${suffix}@test.final10.app`;

    await trackSignupStarted(req, referrer._id.toString(), { referredEmail: refereeEmail });

    const referee = await User.create({
      username: `referee_${suffix}`,
      email: refereeEmail,
      password: 'TestPass123!',
      savvyPoints: 0,
      pointsBalance: 0,
    });

    await trackSignupCompleted(req, referrer._id.toString(), referee);

    const failed = await trackPointGrantFailed(req, new Error('SAVVY_CREDIT_FAILED'), {
      referralCode: referrer._id.toString(),
      referrer,
      referee,
    });

    expect(failed.eventType).toBe('POINT_GRANT_FAILED');
    expect(failed.grantStatus).toBe('manual_needed');
    expect(failed.failureReason).toMatch(/SAVVY_CREDIT_FAILED/);

    const manualLogs = await listTrackingLogs({ status: 'manual_needed' });
    expect(manualLogs.some((l) => l.referralLogId === String(failed._id))).toBe(true);

    const grant = await manualGrantFromLog(failed._id, admin._id);
    expect(grant.ok).toBe(true);
    expect(grant.pointsGranted).toBe(5000);

    const refreshedReferrer = await User.findById(referrer._id);
    expect(refreshedReferrer.savvyPoints).toBe(5000);

    const dup = await manualGrantFromLog(failed._id, admin._id);
    expect(dup.ok).toBe(false);
    expect(dup.status).toBe(409);

    expect(await hasReferralRewardGranted(referee._id)).toBe(true);

    await ReferralTrackingLog.deleteMany({
      $or: [{ referredUserId: referee._id }, { referrerUserId: referrer._id }],
    });
    await User.deleteOne({ _id: referee._id });
  });

  it('rejects self-referral manual grant', async () => {
    const failed = await trackPointGrantFailed(req, new Error('test'), {
      referralCode: referrer._id.toString(),
      referrer,
      referee: referrer,
    });

    const grant = await manualGrantFromLog(failed._id, admin._id);
    expect(grant.ok).toBe(false);
    expect(grant.message).toMatch(/Self-referral/i);
  });
});
