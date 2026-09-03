/**
 * Savvy Watch — live Savvy Check codes.
 */
const crypto = require('crypto');
const SavvyWatchLiveCode = require('../models/SavvyWatchLiveCode');
const SavvyWatchSession = require('../models/SavvyWatchSession');
const { generateLiveCode } = require('../config/savvyWatchConfig');
const { SavvyWatchError, getEventBySlug, logAudit } = require('./savvyWatchService');
const { claimSavvyWatchReward } = require('./savvyWatchRewardService');

async function createLiveCode(adminUser, slug, { reward = 10, durationMinutes = 5, label = 'SAVVY CHECK', maxClaims = null } = {}) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1, Number(durationMinutes) || 5) * 60 * 1000);

  let code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = generateLiveCode(8);
    const exists = await SavvyWatchLiveCode.findOne({ eventId: event.eventId, code }).lean();
    if (!exists) break;
  }

  const liveCode = await SavvyWatchLiveCode.create({
    liveCodeId: `swlc_${crypto.randomBytes(8).toString('hex')}`,
    eventId: event.eventId,
    code,
    label,
    reward: Math.round(Number(reward) || 0),
    startsAt: now,
    expiresAt,
    maxClaims: maxClaims != null ? Math.round(Number(maxClaims)) : null,
    status: 'active',
    createdBy: adminUser._id,
  });

  await logAudit(event.eventId, adminUser._id, 'live_code_created', { liveCodeId: liveCode.liveCodeId, code });
  return liveCode;
}

async function getActiveLiveCodes(eventId) {
  const now = new Date();
  return SavvyWatchLiveCode.find({
    eventId,
    status: 'active',
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
  })
    .select('liveCodeId label reward expiresAt claimCount maxClaims')
    .lean();
}

async function redeemLiveCode(user, slug, codeInput) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');

  const session = await SavvyWatchSession.findOne({ eventId: event.eventId, userId: user._id });
  if (!session) throw new SavvyWatchError(400, 'NOT_JOINED', 'Join the event before redeeming a Savvy Check code.');

  const code = String(codeInput || '').trim().toUpperCase();
  const liveCode = await SavvyWatchLiveCode.findOne({ eventId: event.eventId, code });
  if (!liveCode) throw new SavvyWatchError(404, 'CODE_NOT_FOUND', 'Savvy Check code not found.');
  if (liveCode.status !== 'active') throw new SavvyWatchError(400, 'CODE_INACTIVE', 'This Savvy Check code is not active.');

  const now = new Date();
  if (now < liveCode.startsAt) {
    throw new SavvyWatchError(400, 'CODE_NOT_ACTIVE', 'This Savvy Check code is not active yet.');
  }
  if (now >= liveCode.expiresAt) {
    throw new SavvyWatchError(400, 'CODE_EXPIRED', 'This Savvy Check code has expired.');
  }
  if (liveCode.maxClaims != null && liveCode.claimCount >= liveCode.maxClaims) {
    throw new SavvyWatchError(409, 'CODE_EXHAUSTED', 'This Savvy Check code has reached its claim limit.');
  }

  if ((session.liveCodeClaims || []).includes(liveCode.liveCodeId)) {
    throw new SavvyWatchError(409, 'ALREADY_CLAIMED', 'You already claimed this Savvy Check code.');
  }

  const result = await claimSavvyWatchReward(user, {
    eventId: event.eventId,
    sessionId: session.sessionId,
    claimType: 'live_code',
    liveCodeId: liveCode.liveCodeId,
    amount: liveCode.reward,
    rewardType: 'savvy_watch_live_code',
    note: `Savvy Watch live code — ${liveCode.label}`,
    meta: { code: liveCode.code },
  });

  if (!result.duplicate) {
    await SavvyWatchLiveCode.updateOne({ liveCodeId: liveCode.liveCodeId }, { $inc: { claimCount: 1 } });
    session.liveCodeClaims.push(liveCode.liveCodeId);
    await session.save();
  }

  return { ...result, code: liveCode.code, label: liveCode.label };
}

async function expireLiveCode(adminUser, liveCodeId) {
  const liveCode = await SavvyWatchLiveCode.findOne({ liveCodeId });
  if (!liveCode) throw new SavvyWatchError(404, 'CODE_NOT_FOUND', 'Live code not found.');
  await SavvyWatchLiveCode.updateOne({ liveCodeId }, { $set: { status: 'expired' } });
  await logAudit(liveCode.eventId, adminUser._id, 'live_code_expired', { liveCodeId });
  return { expired: true };
}

module.exports = {
  createLiveCode,
  getActiveLiveCodes,
  redeemLiveCode,
  expireLiveCode,
};
