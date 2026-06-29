/**
 * Authoritative referral reward pipeline — signup and authenticated catch-up.
 * All Savvy grants via creditSavvy with idempotency keys; audit via ReferralLog + security audit.
 */
const User = require('../models/User');
const ReferralLog = require('../models/ReferralLog');
const { creditSavvy } = require('./savvyBalanceService');
const { referralFraudCheck, logReferral } = require('./referralGuard');
const { auditFireAndForget } = require('./securityAuditService');
const {
  REFERRAL_SAVVY_REFERRER,
  REFERRAL_SAVVY_REFEREE,
  REFERRAL_DAILY_CAP,
  WELCOME_REFERRAL_CODE,
} = require('../config/referralRewards');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function referrerIdempotencyKey(referrerId, refereeId) {
  return `referral:referrer:${referrerId}:${refereeId}`;
}

function refereeIdempotencyKey(refereeId) {
  return `referral:referee:${refereeId}`;
}

async function resolveReferrer(referralCode) {
  const code = String(referralCode || '').trim();
  if (!code || code === WELCOME_REFERRAL_CODE) return null;
  const byCode = await User.findOne({ referralCode: code });
  if (byCode) return byCode;
  try {
    return await User.findById(code);
  } catch {
    return null;
  }
}

async function hasAcceptedReferral(refereeId) {
  const row = await ReferralLog.findOne({ refereedId: refereeId, status: 'accepted' }).lean();
  return Boolean(row);
}

async function grantReferralSavvy(referrerId, refereeId, refereeUsername) {
  const referrerKey = referrerIdempotencyKey(referrerId, refereeId);
  const refereeKey = refereeIdempotencyKey(refereeId);

  const referrerCredit = await creditSavvy(referrerId, {
    amount: REFERRAL_SAVVY_REFERRER,
    source: 'referral_referrer',
    idempotencyKey: referrerKey,
    meta: { refereeId: String(refereeId) },
    note: `Referral bonus — invited ${refereeUsername || 'new user'}`,
  });

  const refereeCredit = await creditSavvy(refereeId, {
    amount: REFERRAL_SAVVY_REFEREE,
    source: 'referral_referee',
    idempotencyKey: refereeKey,
    meta: { referrerId: String(referrerId) },
    note: 'Welcome bonus — signed up with a referral',
  });

  return {
    referrerSavvy: referrerCredit.granted ? referrerCredit.amount : 0,
    refereeSavvy: refereeCredit.granted ? refereeCredit.amount : 0,
    referrerDuplicate: Boolean(referrerCredit.duplicate),
    refereeDuplicate: Boolean(refereeCredit.duplicate),
    referrerNewBalance: referrerCredit.newBalance,
    refereeNewBalance: refereeCredit.newBalance,
  };
}

/**
 * Process referral rewards for a new signup (or catch-up for authenticated user).
 *
 * @param {{
 *   referrer: import('mongoose').Document|null,
 *   referee: import('mongoose').Document,
 *   referralCode?: string,
 *   ip?: string,
 *   ua?: string,
 *   req?: import('express').Request,
 * }} params
 */
async function processReferralOnSignup({
  referrer,
  referee,
  referralCode,
  ip = '',
  ua = '',
  req = null,
}) {
  const refereeId = referee._id;
  const refereeEmail = referee.email;

  if (!referrer || String(referrer._id) === String(refereeId)) {
    return { ok: false, skipped: true, reason: 'no_referrer' };
  }

  const referrerId = referrer._id;

  if (await hasAcceptedReferral(refereeId)) {
    auditFireAndForget('REFERRAL_DUPLICATE_SKIPPED', {
      userId: refereeId,
      req,
      meta: { referrerId: String(referrerId), reason: 'already_accepted' },
      severity: 'warn',
    });
    return {
      ok: true,
      duplicate: true,
      alreadyProcessed: true,
      referrerId: String(referrerId),
      refereeId: String(refereeId),
    };
  }

  const check = await referralFraudCheck({
    referrerId,
    newUserId: refereeId,
    newUserEmail: refereeEmail,
    ip,
    ua,
  });

  if (!check.ok) {
    await logReferral({
      referrerId,
      refereedId: refereeId,
      ip: check.ip,
      ua: check.ua,
      status: 'blocked',
      reason: check.reason || check.code,
    });
    auditFireAndForget('REFERRAL_BLOCKED', {
      userId: refereeId,
      req,
      meta: { referrerId: String(referrerId), code: check.code, reason: check.reason },
      severity: 'warn',
    });
    return { ok: false, blocked: true, code: check.code, reason: check.reason };
  }

  const todayAcceptedCount = await ReferralLog.countDocuments({
    referrerId,
    status: 'accepted',
    createdAt: { $gte: startOfToday(), $lte: endOfToday() },
  });

  if (todayAcceptedCount >= REFERRAL_DAILY_CAP) {
    await logReferral({
      referrerId,
      refereedId: refereeId,
      ip: check.ip,
      ua: check.ua,
      status: 'capped',
      reason: 'daily_cap_reached',
    });
    auditFireAndForget('REFERRAL_CAPPED', {
      userId: refereeId,
      req,
      meta: { referrerId: String(referrerId), dailyCap: REFERRAL_DAILY_CAP },
      severity: 'warn',
    });
    return { ok: false, capped: true, dailyCap: REFERRAL_DAILY_CAP };
  }

  try {
    await ReferralLog.create({
      referrerId,
      refereedId: refereeId,
      ip: check.ip || '',
      ua: check.ua || '',
      status: 'accepted',
      reason: 'ok',
    });
  } catch (err) {
    if (err?.code === 11000) {
      auditFireAndForget('REFERRAL_DUPLICATE_SKIPPED', {
        userId: refereeId,
        req,
        meta: { referrerId: String(referrerId), reason: 'log_unique_violation' },
        severity: 'warn',
      });
      return {
        ok: true,
        duplicate: true,
        alreadyProcessed: true,
        referrerId: String(referrerId),
        refereeId: String(refereeId),
      };
    }
    throw err;
  }

  const grants = await grantReferralSavvy(referrerId, refereeId, referee.username);

  referee.referredBy = referrerId;
  if (referralCode) referee.referralCodeUsed = referralCode;
  await referee.save();

  if (typeof referrer.trackReferral === 'function') {
    await referrer.trackReferral();
  }

  auditFireAndForget('REFERRAL_REWARD_GRANTED', {
    userId: refereeId,
    req,
    meta: {
      referrerId: String(referrerId),
      referrerSavvy: grants.referrerSavvy,
      refereeSavvy: grants.refereeSavvy,
      referralCode: referralCode || null,
      referrerIdempotencyKey: referrerIdempotencyKey(referrerId, refereeId),
      refereeIdempotencyKey: refereeIdempotencyKey(refereeId),
    },
  });

  return {
    ok: true,
    granted: true,
    referrerId: String(referrerId),
    refereeId: String(refereeId),
    referrerUsername: referrer.username,
    refereeUsername: referee.username,
    referrerSavvy: grants.referrerSavvy,
    refereeSavvy: grants.refereeSavvy,
    referrerNewBalance: grants.referrerNewBalance,
    refereeNewBalance: grants.refereeNewBalance,
    duplicate: grants.referrerDuplicate && grants.refereeDuplicate,
  };
}

/**
 * Resolve referrer by code and run the pipeline.
 */
async function processReferralByCode({ referee, referralCode, ip, ua, req }) {
  const referrer = await resolveReferrer(referralCode);
  if (!referrer) {
    return { ok: false, skipped: true, reason: 'invalid_referral_code' };
  }
  return processReferralOnSignup({ referrer, referee, referralCode, ip, ua, req });
}

module.exports = {
  processReferralOnSignup,
  processReferralByCode,
  resolveReferrer,
  referrerIdempotencyKey,
  refereeIdempotencyKey,
  hasAcceptedReferral,
  REFERRAL_SAVVY_REFERRER,
  REFERRAL_SAVVY_REFEREE,
  REFERRAL_DAILY_CAP,
};
