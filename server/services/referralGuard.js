const ReferralLog = require('../models/ReferralLog');
const User = require('../models/User');

function getClientIp(req) {
  if (!req) return '';
  const fwd = req.headers?.['x-forwarded-for'];
  if (Array.isArray(fwd)) return fwd[0];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

function getClientUa(req) {
  if (!req) return '';
  return String(req.headers?.['user-agent'] || '');
}

/**
 * Basic fraud rules:
 *  - No self-referral
 *  - 1 accepted referral per IP per 24h
 *  - Max 2 accepted referrals per IP+UA per 7 days
 */
async function referralFraudCheck({ referrerId, newUserId, newUserEmail, ip, ua }) {
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|::1)/.test(ip || '')) {
    return { ok: false, code: 'private_ip', ip, ua, reason: 'Private/local IP not allowed for referral credit' };
  }

  const referrer = await User.findById(referrerId).lean();
  if (!referrer) return { ok: false, code: 'no_referrer', ip, ua, reason: 'Referrer not found' };

  if (referrer.email?.toLowerCase() === String(newUserEmail || '').toLowerCase()) {
    return { ok: false, code: 'self_email', ip, ua, reason: 'Self-referral by email' };
  }

  if (String(referrerId) === String(newUserId)) {
    return { ok: false, code: 'self_id', ip, ua, reason: 'Self-referral by user id' };
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ipCount24h = await ReferralLog.countDocuments({
    ip: ip || '',
    createdAt: { $gte: since24h },
    status: 'accepted',
  });
  if (ip && ipCount24h >= 1) {
    return { ok: false, code: 'ip_quota', ip, ua, reason: 'IP quota exceeded (1/24h)' };
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const uaCount7d = await ReferralLog.countDocuments({
    ip: ip || '',
    ua: ua || '',
    createdAt: { $gte: since7d },
    status: 'accepted',
  });
  if (ip && ua && uaCount7d >= 2) {
    return { ok: false, code: 'device_quota', ip, ua, reason: 'Device/IP quota exceeded (2/7d)' };
  }

  return { ok: true, ip, ua };
}

async function logReferral({ referrerId, refereedId, ip, ua, status, reason }) {
  try {
    await ReferralLog.create({
      referrerId,
      refereedId,
      ip: ip || '',
      ua: ua || '',
      status,
      reason: reason || '',
    });
    return { ok: true };
  } catch (err) {
    console.warn('[referralGuard] ReferralLog write failed:', err?.message);
    return { ok: false, error: err?.message };
  }
}

module.exports = {
  getClientIp,
  getClientUa,
  referralFraudCheck,
  logReferral,
};
