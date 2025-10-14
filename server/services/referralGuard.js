const ReferralLog = require('../models/ReferralLog');
const User = require('../models/User');

// Best-effort client IP
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (Array.isArray(fwd)) return fwd[0];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

/**
 * Basic fraud rules:
 *  - No self-referral (same referrer + email/username match, or referrer==new user)
 *  - Only 1 referred signup per IP per 24h (configurable)
 *  - Limit multiple signups from same IP+UA fingerprint in 7 days
 *  - Optionally block private / local IP ranges
 */

async function referralFraudCheck({ referrerId, newUserId, newUserEmail, ip, ua }) {
  // Block private ranges quickly (optional)
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|::1)/.test(ip)) {
    return { ok: false, code: 'private_ip', ip, ua, reason: 'Private/local IP not allowed for referral credit' };
  }

  // Self-referral: same account or same email
  const referrer = await User.findById(referrerId).lean();
  if (!referrer) return { ok: false, code: 'no_referrer', ip, ua, reason: 'Referrer not found' };

  if (referrer.email?.toLowerCase() === newUserEmail.toLowerCase()) {
    return { ok: false, code: 'self_email', ip, ua, reason: 'Self-referral by email' };
  }

  if (String(referrerId) === String(newUserId)) {
    return { ok: false, code: 'self_id', ip, ua, reason: 'Self-referral by user id' };
  }

  // 1 referred signup per IP per 24h (tune if you want)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ipCount24h = await ReferralLog.countDocuments({ ip, createdAt: { $gte: since24h }, status: 'accepted' });
  if (ipCount24h >= 1) {
    return { ok: false, code: 'ip_quota', ip, ua, reason: 'IP quota exceeded (1/24h)' };
  }

  // 2 signups max per 7 days on same IP+UA (stricter fingerprint)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const uaCount7d = await ReferralLog.countDocuments({ ip, ua, createdAt: { $gte: since7d }, status: 'accepted' });
  if (uaCount7d >= 2) {
    return { ok: false, code: 'device_quota', ip, ua, reason: 'Device/IP quota exceeded (2/7d)' };
  }

  return { ok: true, ip, ua };
}

async function logReferral({ referrerId, refereeId, ip, ua, status, reason }) {
  try {
    await ReferralLog.create({ referrer: referrerId, referee: refereeId, ip, ua, status, reason });
  } catch {}
}

module.exports = { getClientIp, referralFraudCheck, logReferral };

