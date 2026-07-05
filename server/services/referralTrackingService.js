/**
 * Emergency referral tracking layer — permanent audit logs even when grants fail.
 * Does not replace referralService; hooks alongside it for beta safety.
 */
const ReferralTrackingLog = require('../models/ReferralTrackingLog');
const User = require('../models/User');
const { creditSavvy } = require('./savvyBalanceService');
const { getClientIp, getClientUa } = require('./referralGuard');
const {
  REFERRAL_TRACKING_POINTS_EXPECTED,
  REFERRAL_TRACKING_COOKIE,
} = require('../config/referralTracking');
const { WELCOME_REFERRAL_CODE } = require('../config/referralRewards');

function parseCookieHeader(req, name) {
  const header = req?.headers?.cookie;
  if (!header || !name) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    const value = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function normalizeReferralCode(raw) {
  const code = String(raw || '').trim();
  if (!code || code === WELCOME_REFERRAL_CODE) return null;
  return code;
}

/**
 * Resolve referral code from body, query, cookie, or attribution payload.
 */
function resolveSignupReferralCode(req) {
  const candidates = [
    req?.body?.referralCode,
    req?.query?.ref,
    req?.body?.attribution?.referralCode,
    parseCookieHeader(req, REFERRAL_TRACKING_COOKIE),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeReferralCode(candidate);
    if (normalized) return normalized;
  }
  return null;
}

async function resolveReferrerContext(referralCode) {
  const code = normalizeReferralCode(referralCode);
  if (!code) {
    return { referralCode: null, referrer: null, referrerUserId: null, referrerEmail: null };
  }

  const { resolveReferrer } = require('./referralService');
  const referrer = await resolveReferrer(code);
  return {
    referralCode: code,
    referrer,
    referrerUserId: referrer?._id || null,
    referrerEmail: referrer?.email || null,
  };
}

function requestContext(req) {
  return {
    ipAddress: getClientIp(req) || '',
    userAgent: getClientUa(req) || '',
  };
}

function logTrack(details) {
  // eslint-disable-next-line no-console
  console.log('[REFERRAL_TRACK]', details);
}

function logGrantFailed(error, details = {}) {
  // eslint-disable-next-line no-console
  console.error('[REFERRAL_GRANT_FAILED]', error?.message || error, details);
}

async function createTrackingEntry(payload) {
  const row = await ReferralTrackingLog.create({
    pointsExpected: REFERRAL_TRACKING_POINTS_EXPECTED,
    grantStatus: payload.grantStatus || 'pending',
    ...payload,
  });

  logTrack({
    id: String(row._id),
    eventType: row.eventType,
    referralCode: row.referralCode,
    referrerUserId: row.referrerUserId ? String(row.referrerUserId) : null,
    referredUserId: row.referredUserId ? String(row.referredUserId) : null,
    grantStatus: row.grantStatus,
  });

  return row;
}

/**
 * @param {import('express').Request} req
 * @param {string} referralCode
 */
async function trackLinkVisit(req, referralCode) {
  const code = normalizeReferralCode(referralCode);
  if (!code) return null;

  const ctx = await resolveReferrerContext(code);
  const { ipAddress, userAgent } = requestContext(req);

  return createTrackingEntry({
    referralCode: code,
    referrerUserId: ctx.referrerUserId,
    referrerEmail: ctx.referrerEmail,
    eventType: 'LINK_VISIT',
    grantStatus: 'pending',
    ipAddress,
    userAgent,
  });
}

async function trackSignupStarted(req, referralCode, { referredEmail } = {}) {
  const code = normalizeReferralCode(referralCode);
  if (!code) return null;

  const ctx = await resolveReferrerContext(code);
  const { ipAddress, userAgent } = requestContext(req);

  if (ctx.referrer && referredEmail && ctx.referrer.email === referredEmail) {
    logTrack({ eventType: 'SIGNUP_STARTED', skipped: true, reason: 'self_referral' });
    return null;
  }

  return createTrackingEntry({
    referralCode: code,
    referrerUserId: ctx.referrerUserId,
    referrerEmail: ctx.referrerEmail,
    referredEmail: referredEmail || null,
    eventType: 'SIGNUP_STARTED',
    grantStatus: 'pending',
    ipAddress,
    userAgent,
  });
}

async function trackSignupCompleted(req, referralCode, referee) {
  const code = normalizeReferralCode(referralCode);
  if (!code || !referee?._id) return null;

  const ctx = await resolveReferrerContext(code);
  const { ipAddress, userAgent } = requestContext(req);

  if (ctx.referrer && String(ctx.referrer._id) === String(referee._id)) {
    logTrack({ eventType: 'SIGNUP_COMPLETED', skipped: true, reason: 'self_referral' });
    return null;
  }

  return createTrackingEntry({
    referralCode: code,
    referrerUserId: ctx.referrerUserId,
    referrerEmail: ctx.referrerEmail,
    referredUserId: referee._id,
    referredEmail: referee.email || null,
    eventType: 'SIGNUP_COMPLETED',
    grantStatus: 'pending',
    ipAddress,
    userAgent,
  });
}

async function trackPointGrantAttempt(req, { referralCode, referrer, referee }) {
  const code = normalizeReferralCode(referralCode);
  if (!code || !referrer?._id || !referee?._id) return null;

  if (String(referrer._id) === String(referee._id)) return null;

  const { ipAddress, userAgent } = requestContext(req);

  return createTrackingEntry({
    referralCode: code,
    referrerUserId: referrer._id,
    referrerEmail: referrer.email || null,
    referredUserId: referee._id,
    referredEmail: referee.email || null,
    eventType: 'POINT_GRANT_ATTEMPT',
    grantStatus: 'pending',
    ipAddress,
    userAgent,
  });
}

async function trackPointGrantSuccess(req, { referralCode, referrer, referee, savvyAmount } = {}) {
  const code = normalizeReferralCode(referralCode);
  if (!referrer?._id || !referee?._id) return null;

  const { ipAddress, userAgent } = requestContext(req);

  return createTrackingEntry({
    referralCode: code || String(referrer.referralCode || referrer._id),
    referrerUserId: referrer._id,
    referrerEmail: referrer.email || null,
    referredUserId: referee._id,
    referredEmail: referee.email || null,
    eventType: 'POINT_GRANT_SUCCESS',
    grantStatus: 'success',
    ipAddress,
    userAgent,
    meta: { savvyAmount: savvyAmount ?? null },
  });
}

async function trackPointGrantFailed(req, error, { referralCode, referrer, referee } = {}) {
  const code = normalizeReferralCode(referralCode);
  const failureReason = error?.message || String(error || 'unknown_error');
  const { ipAddress, userAgent } = requestContext(req);

  logGrantFailed(error, {
    referralCode: code,
    referrerUserId: referrer?._id ? String(referrer._id) : null,
    referredUserId: referee?._id ? String(referee._id) : null,
  });

  if (!referrer?._id || !referee?._id) return null;

  return createTrackingEntry({
    referralCode: code || String(referrer.referralCode || referrer._id),
    referrerUserId: referrer._id,
    referrerEmail: referrer.email || null,
    referredUserId: referee._id,
    referredEmail: referee.email || null,
    eventType: 'POINT_GRANT_FAILED',
    grantStatus: 'manual_needed',
    failureReason,
    ipAddress,
    userAgent,
  });
}

async function hasReferralRewardGranted(referredUserId) {
  if (!referredUserId) return false;

  const successLog = await ReferralTrackingLog.findOne({
    referredUserId,
    $or: [
      { eventType: 'POINT_GRANT_SUCCESS', grantStatus: 'success' },
      { manualGranted: true },
    ],
  }).lean();

  return Boolean(successLog);
}

function serializeLog(row) {
  return {
    referralLogId: String(row._id),
    referralCode: row.referralCode,
    referrerUserId: row.referrerUserId ? String(row.referrerUserId) : null,
    referrerEmail: row.referrerEmail || null,
    referredUserId: row.referredUserId ? String(row.referredUserId) : null,
    referredEmail: row.referredEmail || null,
    eventType: row.eventType,
    pointsExpected: row.pointsExpected,
    grantStatus: row.grantStatus,
    failureReason: row.failureReason || null,
    manualGranted: Boolean(row.manualGranted),
    ipAddress: row.ipAddress || null,
    userAgent: row.userAgent || null,
    createdAt: row.createdAt,
  };
}

async function listTrackingLogs({ status, limit = 100 } = {}) {
  const filter = {};
  if (status) {
    filter.grantStatus = status;
  }

  const rows = await ReferralTrackingLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .lean();

  return rows.map(serializeLog);
}

/**
 * Admin manual grant — 5000 Savvy to referrer for a failed/pending referral log.
 */
async function manualGrantFromLog(referralLogId, adminUserId) {
  const row = await ReferralTrackingLog.findById(referralLogId);
  if (!row) {
    return { ok: false, status: 404, message: 'Referral log not found' };
  }

  if (row.manualGranted || row.grantStatus === 'success') {
    return { ok: false, status: 409, message: 'This referral log was already granted' };
  }

  const grantableTypes = ['POINT_GRANT_FAILED', 'SIGNUP_COMPLETED', 'POINT_GRANT_ATTEMPT'];
  if (!grantableTypes.includes(row.eventType)) {
    return {
      ok: false,
      status: 400,
      message: `Log event type ${row.eventType} is not eligible for manual grant`,
    };
  }

  if (!row.referrerUserId || !row.referredUserId) {
    return { ok: false, status: 400, message: 'Referral log missing referrer or referred user' };
  }

  if (String(row.referrerUserId) === String(row.referredUserId)) {
    return { ok: false, status: 400, message: 'Self-referrals cannot be granted' };
  }

  const alreadyGranted = await hasReferralRewardGranted(row.referredUserId);
  if (alreadyGranted) {
    return {
      ok: false,
      status: 409,
      message: 'This referred user already has a referral reward recorded',
    };
  }

  const referrer = await User.findById(row.referrerUserId).select('username email savvyPoints').lean();
  if (!referrer) {
    return { ok: false, status: 404, message: 'Referrer user not found' };
  }

  const idempotencyKey = `referral:manual_grant:${row._id}`;
  const points = row.pointsExpected || REFERRAL_TRACKING_POINTS_EXPECTED;

  try {
    const credit = await creditSavvy(row.referrerUserId, {
      amount: points,
      source: 'referral_manual_grant',
      idempotencyKey,
      note: `Manual referral grant — referred ${row.referredEmail || row.referredUserId}`,
      meta: {
        referralLogId: String(row._id),
        referredUserId: String(row.referredUserId),
        referralCode: row.referralCode,
        adminUserId: String(adminUserId),
      },
    });

    if (!credit.granted && !credit.duplicate) {
      throw new Error('SAVVY_CREDIT_FAILED');
    }

    row.grantStatus = 'success';
    row.manualGranted = true;
    row.manualGrantedAt = new Date();
    row.manualGrantedBy = adminUserId;
    row.savvyTransactionKey = idempotencyKey;
    row.failureReason = row.failureReason || null;
    await row.save();

    await createTrackingEntry({
      referralCode: row.referralCode,
      referrerUserId: row.referrerUserId,
      referrerEmail: row.referrerEmail,
      referredUserId: row.referredUserId,
      referredEmail: row.referredEmail,
      eventType: 'POINT_GRANT_SUCCESS',
      grantStatus: 'success',
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      savvyTransactionKey: idempotencyKey,
      meta: { manualGrant: true, sourceLogId: String(row._id), savvyAmount: points },
    });

    logTrack({
      eventType: 'MANUAL_GRANT_SUCCESS',
      referralLogId: String(row._id),
      referrerUserId: String(row.referrerUserId),
      referredUserId: String(row.referredUserId),
      points,
    });

    return {
      ok: true,
      referralLogId: String(row._id),
      referrerUserId: String(row.referrerUserId),
      referrerEmail: referrer.email,
      referredUserId: String(row.referredUserId),
      referredEmail: row.referredEmail,
      pointsGranted: credit.granted ? credit.amount : points,
      newBalance: credit.newBalance,
      duplicate: Boolean(credit.duplicate),
    };
  } catch (err) {
    logGrantFailed(err, { referralLogId: String(row._id), phase: 'manual_grant' });
    return {
      ok: false,
      status: 500,
      message: err?.message || 'Manual grant failed',
    };
  }
}

module.exports = {
  parseCookieHeader,
  normalizeReferralCode,
  resolveSignupReferralCode,
  resolveReferrerContext,
  trackLinkVisit,
  trackSignupStarted,
  trackSignupCompleted,
  trackPointGrantAttempt,
  trackPointGrantSuccess,
  trackPointGrantFailed,
  hasReferralRewardGranted,
  listTrackingLogs,
  manualGrantFromLog,
  serializeLog,
};
