/**
 * Final10 Live Event Activation — queue, seen state, and HUD bubble payload.
 */

const { WEEKEND_MULTIPLIER } = require('../config/points');
const {
  ACTIVATION_EVENT_KEYS,
  getActivationDef,
  todayKey,
} = require('../config/liveEventActivationConfig');
const { getActiveDropForUser } = require('./supplyDropService');
const { getActiveSavvySale } = require('./savvySaleService');
const { applyTierEventMultiplier } = require('../lib/pointsEventMultipliers');

function isWeekendUtc(date = new Date()) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function weekendDoublePointsActive() {
  return isWeekendUtc() && Number(WEEKEND_MULTIPLIER) >= 2;
}

function ensureActivationDoc(user) {
  if (!Array.isArray(user.liveEventActivations)) {
    user.liveEventActivations = [];
  }
  return user.liveEventActivations;
}

function isActivatedToday(user, activationId, dayKey = todayKey()) {
  const rows = user.liveEventActivations || [];
  return rows.some((r) => r.activationId === activationId && r.dayKey === dayKey);
}

function readPointsEnvMultiplier() {
  const raw = String(process.env.POINTS_EVENT_MULTIPLIER || '1').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(3, Math.floor(n));
}

function isDoublePointsLive() {
  if (String(process.env.DOUBLE_POINTS_EVENT_ACTIVE || '').trim().toLowerCase() === 'true') {
    return true;
  }
  if (readPointsEnvMultiplier() === 2) return true;
  return weekendDoublePointsActive() && Number(WEEKEND_MULTIPLIER) >= 2;
}

function isTriplePointsLive() {
  if (String(process.env.TRIPLE_POINTS_EVENT_ACTIVE || '').trim().toLowerCase() === 'true') {
    return true;
  }
  return readPointsEnvMultiplier() >= 3;
}

function buildActivationCard(def, instance) {
  return {
    activationId: instance.activationId,
    eventKey: def.eventKey,
    iconKey: def.iconKey,
    audioKey: def.audioKey,
    shortLabel: def.shortLabel,
    title: def.title,
    subtitle: def.subtitle,
    detailTitle: def.detailTitle,
    detailBody: def.detailBody,
    theme: def.theme,
    msRemaining: instance.msRemaining ?? null,
    expiresAt: instance.expiresAt ?? null,
    startsAt: instance.startsAt ?? null,
    sortOrder: def.sortOrder,
    meta: instance.meta ?? {},
  };
}

async function collectLiveActivationInstances(user) {
  const instances = [];
  const tier = user?.subscription?.tier || user?.membershipTier || 'free';
  const dayKey = todayKey();

  if (isTriplePointsLive()) {
    const mult = applyTierEventMultiplier(3, tier);
    instances.push({
      activationId: `triple_points_${dayKey}`,
      eventKey: ACTIVATION_EVENT_KEYS.TRIPLE_POINTS,
      msRemaining: msUntilEndOfUtcDay(),
      expiresAt: endOfUtcDayIso(),
      meta: { multiplier: mult },
    });
  } else if (isDoublePointsLive()) {
    const mult = applyTierEventMultiplier(2, tier);
    instances.push({
      activationId: `double_points_${dayKey}`,
      eventKey: ACTIVATION_EVENT_KEYS.DOUBLE_POINTS,
      msRemaining: msUntilEndOfUtcDay(),
      expiresAt: endOfUtcDayIso(),
      meta: { multiplier: mult },
    });
  }

  const sale = await getActiveSavvySale();
  if (sale?.active) {
    instances.push({
      activationId: `savvy_sale_${sale.eventId}`,
      eventKey: ACTIVATION_EVENT_KEYS.SAVVY_SALE,
      msRemaining: sale.msRemaining,
      expiresAt: sale.expiresAt,
      startsAt: sale.startAt,
      meta: { eventId: sale.eventId, saleSpinCost: sale.saleSpinCost },
    });
  }

  const drop = await getActiveDropForUser(user._id);
  if (drop && !drop.expired && !drop.alreadyClaimed) {
    instances.push({
      activationId: `max_supply_drop_${drop.dropId}`,
      eventKey: ACTIVATION_EVENT_KEYS.MAX_SUPPLY_DROP,
      msRemaining: drop.msRemaining,
      expiresAt: drop.expiresAt,
      meta: { dropId: drop.dropId },
    });
  }

  return instances
    .map((inst) => {
      const def = getActivationDef(inst.eventKey);
      if (!def) return null;
      return buildActivationCard(def, inst);
    })
    .filter(Boolean)
    .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
}

function msUntilEndOfUtcDay(date = new Date()) {
  const end = new Date(date);
  end.setUTCHours(24, 0, 0, 0);
  return Math.max(0, end.getTime() - date.getTime());
}

function endOfUtcDayIso(date = new Date()) {
  const end = new Date(date);
  end.setUTCHours(24, 0, 0, 0);
  return end.toISOString();
}

async function buildActivationState(user) {
  const dayKey = todayKey();
  const live = await collectLiveActivationInstances(user);
  const activatedSet = new Set(
    (user.liveEventActivations || [])
      .filter((r) => r.dayKey === dayKey || live.some((e) => e.activationId === r.activationId))
      .map((r) => r.activationId)
  );

  const activatedBubbles = live.filter((e) => activatedSet.has(e.activationId));
  const activationQueue = live.filter((e) => !activatedSet.has(e.activationId));

  return {
    dayKey,
    activationQueue,
    activatedBubbles,
    liveCount: live.length,
  };
}

async function markEventActivated(user, { activationId, eventKey }) {
  const id = String(activationId || '').trim();
  const key = String(eventKey || '').trim();
  if (!id || !key) {
    const err = new Error('activationId and eventKey are required.');
    err.status = 400;
    err.code = 'INVALID_ACTIVATION';
    throw err;
  }

  const live = await collectLiveActivationInstances(user);
  const match = live.find((e) => e.activationId === id && e.eventKey === key);
  if (!match) {
    const err = new Error('That event is not currently active.');
    err.status = 400;
    err.code = 'EVENT_NOT_ACTIVE';
    throw err;
  }

  const dayKey = todayKey();
  const rows = ensureActivationDoc(user);
  if (!isActivatedToday(user, id, dayKey)) {
    rows.push({
      activationId: id,
      eventKey: key,
      dayKey,
      activatedAt: new Date(),
    });
    if (rows.length > 120) {
      user.liveEventActivations = rows.slice(-120);
    }
    user.markModified('liveEventActivations');
    await user.save();
  }

  return buildActivationState(user);
}

async function resetActivationSeen(user) {
  user.liveEventActivations = [];
  user.markModified('liveEventActivations');
  await user.save();
  return buildActivationState(user);
}

module.exports = {
  buildActivationState,
  markEventActivated,
  resetActivationSeen,
  isDoublePointsLive,
  isTriplePointsLive,
  collectLiveActivationInstances,
};
