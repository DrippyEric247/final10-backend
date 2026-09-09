/**
 * Savvy Watch Live QR Welcome Bonus — one-time 500 Savvy per verified account.
 * Server-side only, idempotent, fixed payout (no multiplier).
 */
const crypto = require('crypto');
const User = require('../models/User');
const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchLiveWelcomeRedemption = require('../models/SavvyWatchLiveWelcomeRedemption');
const {
  isSavvyWatchEnabled,
  LIVE_WELCOME_BONUS_AMOUNT,
  LIVE_WELCOME_BONUS_SOURCE,
  isStreamQrAttribution,
  normalizeAttributionSource,
  sanitizeEventSlug,
} = require('../config/savvyWatchConfig');
const { grantSavvyReward } = require('./savvyRewardService');

class SavvyWatchLiveWelcomeError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyWatchLiveWelcomeError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildLiveWelcomeIdempotencyKey(userId) {
  return `savvy_watch_live_welcome:${String(userId)}`;
}

async function getLiveWelcomeBonusStatus(userId) {
  const redemption = await SavvyWatchLiveWelcomeRedemption.findOne({ userId }).lean();
  if (!redemption) {
    return { claimed: false, amount: LIVE_WELCOME_BONUS_AMOUNT };
  }
  return {
    claimed: true,
    amount: redemption.amount,
    eventSlug: redemption.eventSlug,
    eventId: redemption.eventId,
    redeemedAt: redemption.redeemedAt,
    source: redemption.source,
  };
}

async function claimLiveWelcomeBonus(user, slug, { source } = {}) {
  if (!isSavvyWatchEnabled()) {
    throw new SavvyWatchLiveWelcomeError(503, 'SAVVY_WATCH_DISABLED', 'Savvy Watch is not enabled.');
  }

  const normalizedSource = normalizeAttributionSource(source);
  if (!isStreamQrAttribution(normalizedSource)) {
    return {
      awarded: false,
      savvyAmount: 0,
      alreadyClaimed: false,
      reason: 'SOURCE_NOT_ELIGIBLE',
      message: 'Live welcome bonus requires stream QR attribution.',
    };
  }

  let safeSlug;
  try {
    safeSlug = sanitizeEventSlug(slug);
  } catch {
    throw new SavvyWatchLiveWelcomeError(400, 'INVALID_EVENT_SLUG', 'Invalid event slug.');
  }

  const event = await SavvyWatchEvent.findOne({ slug: safeSlug }).lean();
  if (!event) {
    throw new SavvyWatchLiveWelcomeError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');
  }

  if (!['scheduled', 'live'].includes(event.status)) {
    if (event.status === 'ended' || event.status === 'archived') {
      return {
        awarded: false,
        savvyAmount: 0,
        alreadyClaimed: false,
        reason: 'EVENT_ENDED',
        message: 'Live welcome bonus is no longer available for ended events.',
      };
    }
    throw new SavvyWatchLiveWelcomeError(400, 'EVENT_NOT_ELIGIBLE', 'This event is not eligible for the live welcome bonus.');
  }

  const userId = user._id;
  const idempotencyKey = buildLiveWelcomeIdempotencyKey(userId);
  const amount = LIVE_WELCOME_BONUS_AMOUNT;

  const existing = await SavvyWatchLiveWelcomeRedemption.findOne({ userId }).lean();
  if (existing) {
    const freshUser = await User.findById(userId).select('savvyPoints').lean();
    return {
      awarded: false,
      alreadyClaimed: true,
      savvyAmount: 0,
      newBalance: Math.round(Number(freshUser?.savvyPoints) || 0),
      eventSlug: existing.eventSlug,
      eventId: existing.eventId,
      redeemedAt: existing.redeemedAt,
      message: 'Live welcome bonus already claimed for this account.',
    };
  }

  let redemption;
  try {
    redemption = await SavvyWatchLiveWelcomeRedemption.create({
      redemptionId: `swlwr_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      eventId: event.eventId,
      eventSlug: event.slug,
      source: LIVE_WELCOME_BONUS_SOURCE,
      amount,
      idempotencyKey,
      redeemedAt: new Date(),
      meta: { claimSource: normalizedSource },
    });
  } catch (err) {
    if (err?.code === 11000) {
      const dup = await SavvyWatchLiveWelcomeRedemption.findOne({ userId }).lean();
      const freshUser = await User.findById(userId).select('savvyPoints').lean();
      return {
        awarded: false,
        alreadyClaimed: true,
        savvyAmount: 0,
        newBalance: Math.round(Number(freshUser?.savvyPoints) || 0),
        eventSlug: dup?.eventSlug || event.slug,
        eventId: dup?.eventId || event.eventId,
        redeemedAt: dup?.redeemedAt || null,
        message: 'Live welcome bonus already claimed for this account.',
      };
    }
    throw err;
  }

  try {
    const grant = await grantSavvyReward(user, {
      rewardType: 'savvy_watch_live_welcome_bonus',
      amount,
      idempotencyKey,
      note: 'Savvy Watch Live Welcome Bonus',
      meta: {
        eventId: event.eventId,
        eventSlug: event.slug,
        source: LIVE_WELCOME_BONUS_SOURCE,
        joinSource: normalizedSource,
      },
      applyRewardPolicy: true,
    });

    await SavvyWatchLiveWelcomeRedemption.updateOne(
      { _id: redemption._id },
      { $set: { transactionId: grant.transactionId || null } }
    );

    await SavvyWatchEvent.updateOne(
      { eventId: event.eventId },
      { $inc: { 'meta.liveQrStats.bonusClaims': grant.duplicate ? 0 : 1 } }
    );

    const accountAgeMs = user.createdAt ? Date.now() - new Date(user.createdAt).getTime() : null;
    if (accountAgeMs != null && accountAgeMs <= 15 * 60 * 1000) {
      await SavvyWatchEvent.updateOne(
        { eventId: event.eventId },
        { $inc: { 'meta.liveQrStats.signups': grant.duplicate ? 0 : 1 } }
      );
    }

    return {
      awarded: !grant.duplicate,
      alreadyClaimed: Boolean(grant.duplicate),
      savvyAmount: grant.duplicate ? 0 : amount,
      newBalance: grant.newBalance,
      eventSlug: event.slug,
      eventId: event.eventId,
      eventTitle: event.title,
      redeemedAt: redemption.redeemedAt,
      message: grant.duplicate
        ? 'Live welcome bonus already claimed for this account.'
        : '+500 SAVVY — LIVE WELCOME BONUS',
    };
  } catch (err) {
    await SavvyWatchLiveWelcomeRedemption.deleteOne({ _id: redemption._id }).catch(() => {});
    throw err;
  }
}

async function recordQrVisit(slug, { source } = {}) {
  const normalizedSource = normalizeAttributionSource(source);
  if (!isStreamQrAttribution(normalizedSource)) {
    return { recorded: false };
  }

  let safeSlug;
  try {
    safeSlug = sanitizeEventSlug(slug);
  } catch {
    return { recorded: false, reason: 'INVALID_SLUG' };
  }

  const event = await SavvyWatchEvent.findOne({ slug: safeSlug }).select('eventId status').lean();
  if (!event) {
    return { recorded: false, reason: 'EVENT_NOT_FOUND' };
  }

  const { isPubliclyVisibleEventStatus } = require('../config/savvyWatchConfig');
  if (!isPubliclyVisibleEventStatus(event.status)) {
    return { recorded: false, reason: 'EVENT_NOT_PUBLIC' };
  }

  await SavvyWatchEvent.updateOne(
    { eventId: event.eventId },
    { $inc: { 'meta.liveQrStats.visits': 1 } }
  );

  return { recorded: true, eventId: event.eventId };
}

async function getEventQrStats(slug) {
  const safeSlug = sanitizeEventSlug(slug);
  const event = await SavvyWatchEvent.findOne({ slug: safeSlug }).lean();
  if (!event) {
    throw new SavvyWatchLiveWelcomeError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');
  }

  const stats = event.meta?.liveQrStats || {};
  let attribution = {};
  const rawAttr = event.attributionCounts;
  if (rawAttr instanceof Map) {
    attribution = Object.fromEntries(rawAttr);
  } else if (rawAttr && typeof rawAttr === 'object') {
    attribution = rawAttr;
  }

  return {
    eventId: event.eventId,
    slug: event.slug,
    visits: Math.round(Number(stats.visits) || 0),
    signups: Math.round(Number(stats.signups) || 0),
    bonusClaims: Math.round(Number(stats.bonusClaims) || 0),
    liveEventJoins: Math.round(Number(attribution['stream-qr']) || 0),
    globalBonusClaims: await SavvyWatchLiveWelcomeRedemption.countDocuments({ eventId: event.eventId }),
  };
}

module.exports = {
  SavvyWatchLiveWelcomeError,
  buildLiveWelcomeIdempotencyKey,
  getLiveWelcomeBonusStatus,
  claimLiveWelcomeBonus,
  recordQrVisit,
  getEventQrStats,
};
