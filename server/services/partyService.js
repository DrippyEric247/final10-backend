/**
 * partyService — "Squad Sync" v1 core logic.
 *
 * Responsibilities:
 *   • Central tuning constants for the party system
 *   • Join eligibility (friendship, account age, bans, capacity, one-party rule)
 *   • Active-member detection (recent valid event within window)
 *   • Boost formula + energy cap combination
 *   • Session lifecycle helpers (start/end/cooldown)
 *   • Event recording with per-session action caps & burst detection
 *
 * All math lives here so routes stay thin and the rules stay testable.
 */
const mongoose = require('mongoose');
const Party = require('../models/Party');
const PartySessionEvent = require('../models/PartySessionEvent');
const User = require('../models/User');

const PARTY = Object.freeze({
  MAX_MEMBERS: 5,
  MIN_ACTIVE_FOR_BOOST: 2,

  SESSION_DURATION_MS: 30 * 60 * 1000,     // 30 minutes
  COOLDOWN_MS: 60 * 60 * 1000,             // 60 minutes
  LOBBY_EXPIRY_MS: 24 * 60 * 60 * 1000,    // idle lobby lifespan
  ACTIVE_WINDOW_MS: 5 * 60 * 1000,         // recent-action window for "active"

  MIN_ACCOUNT_AGE_MS: 24 * 60 * 60 * 1000, // 24h

  BOOST_MIN: 0.10,
  BOOST_MAX: 0.50,
  BOOST_SLOPE: 0.30, // (teamAverage - 1.0) * slope
  FINAL_MULTIPLIER_CAP: 3.50,

  MAX_ENERGY: 200,

  /** Per-event energy contributions (pre anti-abuse clamp). */
  ENERGY_BY_EVENT: {
    save_deal: 5,
    share_deal: 8,
    purchase_clickout: 15,
    verified_reward: 25,
  },

  /** Energy % thresholds → energy-based boost cap. Highest matching wins. */
  ENERGY_STEPS: [
    { pct: 1.00, boost: 0.50 },
    { pct: 0.75, boost: 0.35 },
    { pct: 0.50, boost: 0.20 },
    { pct: 0.25, boost: 0.10 },
  ],

  /** Anti-abuse */
  MAX_BOOSTED_ACTIONS_PER_USER_PER_SESSION: 40,
  BURST_WINDOW_MS: 60 * 1000,
  BURST_MAX_EVENTS: 12,   // more than this in BURST_WINDOW_MS trips boostDisabled
});

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Number(n) || 0));
}

function sameId(a, b) {
  return String(a) === String(b);
}

/**
 * Compute the energy-based boost cap from current energy value.
 * Linear thresholds: <25% → 0, ≥25% → .10, ≥50% → .20, ≥75% → .35, 100% → .50.
 */
function energyToBoostCap(energy) {
  const pct = clamp(energy / PARTY.MAX_ENERGY, 0, 1);
  for (const row of PARTY.ENERGY_STEPS) {
    if (pct >= row.pct) return row.boost;
  }
  return 0;
}

/**
 * Returns the authoritative Party boost formula output given team average
 * personal multiplier. Does NOT consider energy cap or session state.
 */
function formulaBoostFromTeamAverage(teamAverage) {
  const raw = (Number(teamAverage) - 1.0) * PARTY.BOOST_SLOPE;
  return clamp(raw, PARTY.BOOST_MIN, PARTY.BOOST_MAX);
}

/**
 * Look up "active members" for a party session.
 * A member is active if they have recorded at least one valid event in the
 * last ACTIVE_WINDOW_MS during the current session.
 *
 * Returns a Set of userId strings.
 */
async function getActiveMemberIds(party, now = new Date()) {
  if (!party.sessionStartedAt) return new Set();
  const since = new Date(now.getTime() - PARTY.ACTIVE_WINDOW_MS);
  const rows = await PartySessionEvent.aggregate([
    {
      $match: {
        partyId: party._id,
        sessionStartedAt: party.sessionStartedAt,
        createdAt: { $gte: since },
        eventType: { $in: PartySessionEvent.VALID_EVENT_TYPES },
      },
    },
    { $group: { _id: '$userId' } },
  ]);
  const ids = new Set();
  for (const r of rows) ids.add(String(r._id));
  // Host is assumed active the first 2 minutes of a fresh session so the
  // party can bootstrap its boost without two simultaneous events.
  if (party.sessionStartedAt &&
      now.getTime() - party.sessionStartedAt.getTime() < 2 * 60 * 1000) {
    ids.add(String(party.hostUserId));
  }
  return ids;
}

/**
 * Convert a map of userId → personalMultiplier into:
 *   { teamAverage, activeCount, formulaBoost, energyCap, partyBoost }
 *
 * `multipliers` is keyed by string userId. Missing multipliers default to 1.0.
 * If fewer than MIN_ACTIVE_FOR_BOOST members are active, partyBoost is 0.
 */
function deriveBoost(party, activeIds, multipliers) {
  const ids = [...activeIds];
  const activeCount = ids.length;

  if (activeCount < PARTY.MIN_ACTIVE_FOR_BOOST || party.boostDisabled) {
    return {
      teamAverage: 1,
      activeCount,
      formulaBoost: 0,
      energyCap: energyToBoostCap(party.energy || 0),
      partyBoost: 0,
    };
  }

  const sum = ids.reduce((acc, id) => acc + (Number(multipliers[id]) || 1), 0);
  const teamAverage = sum / activeCount;

  const formulaBoost = formulaBoostFromTeamAverage(teamAverage);
  const energyCap = energyToBoostCap(party.energy || 0);

  // Use the LOWER of the two caps as specified.
  const partyBoost = Math.min(formulaBoost, energyCap);

  return { teamAverage, activeCount, formulaBoost, energyCap, partyBoost };
}

/**
 * Apply the party boost on top of a personal multiplier, clamped to the
 * absolute finalMultiplier cap.
 */
function applyBoost(personalMultiplier, partyBoost) {
  const personal = Number(personalMultiplier) || 1;
  const final = personal + (Number(partyBoost) || 0);
  return clamp(final, personal, PARTY.FINAL_MULTIPLIER_CAP);
}

/** ----- Join eligibility ------------------------------------------------ */

/**
 * Returns { ok:true } or { ok:false, code, message }.
 * joinerUser is a User document; party is a Party document.
 */
async function canJoinParty(joinerUser, hostUser, party) {
  if (!joinerUser || !hostUser || !party) {
    return { ok: false, code: 'INVALID', message: 'Missing data' };
  }

  if (joinerUser.isBanned || joinerUser.isFlagged) {
    return { ok: false, code: 'ACCOUNT_RESTRICTED', message: 'Account is restricted.' };
  }

  const createdAt = joinerUser.createdAt || joinerUser._id?.getTimestamp?.();
  if (createdAt && Date.now() - new Date(createdAt).getTime() < PARTY.MIN_ACCOUNT_AGE_MS) {
    return { ok: false, code: 'ACCOUNT_TOO_YOUNG', message: 'Account too new to join a squad.' };
  }

  if (party.status === 'ended') {
    return { ok: false, code: 'PARTY_ENDED', message: 'This squad has ended.' };
  }

  if (party.isFull()) {
    return { ok: false, code: 'PARTY_FULL', message: 'Squad is full.' };
  }

  if (party.isMember(joinerUser._id)) {
    return { ok: false, code: 'ALREADY_MEMBER', message: 'Already in this squad.' };
  }

  // One active party per user
  const other = await Party.findOne({
    memberUserIds: joinerUser._id,
    status: { $in: ['idle', 'active', 'cooldown'] },
  }).select('_id').lean();
  if (other) {
    return { ok: false, code: 'ALREADY_IN_PARTY', message: 'You are already in a squad.' };
  }

  // Friends/followers connection with the host (bidirectional OR either way
  // to keep the product usable on a young social graph).
  const joinerFollowing = (joinerUser.following || []).map(String);
  const hostFollowing = (hostUser.following || []).map(String);
  const isConnected =
    joinerFollowing.includes(String(hostUser._id)) ||
    hostFollowing.includes(String(joinerUser._id));
  if (!isConnected) {
    return { ok: false, code: 'NOT_CONNECTED', message: 'You must follow each other to squad up.' };
  }

  return { ok: true };
}

/** ----- Session lifecycle ----------------------------------------------- */

function sessionRemainingMs(party, now = Date.now()) {
  if (party.status !== 'active' || !party.sessionStartedAt) return 0;
  const end = party.sessionStartedAt.getTime() + PARTY.SESSION_DURATION_MS;
  return Math.max(0, end - now);
}

function cooldownRemainingMs(party, now = Date.now()) {
  if (!party.cooldownUntil) return 0;
  return Math.max(0, party.cooldownUntil.getTime() - now);
}

/**
 * Transition idle → active. Resets per-session state.
 */
async function startSession(party) {
  if (party.status === 'active') return party;

  if (party.cooldownUntil && party.cooldownUntil.getTime() > Date.now()) {
    const err = new Error('Squad is still cooling down.');
    err.code = 'COOLDOWN';
    throw err;
  }

  if ((party.memberUserIds || []).length < 2) {
    const err = new Error('Need at least 2 members to start a session.');
    err.code = 'NOT_ENOUGH_MEMBERS';
    throw err;
  }

  party.status = 'active';
  party.sessionStartedAt = new Date();
  party.sessionEndedAt = null;
  party.energy = 0;
  party.peakBoost = 0;
  party.currentPartyBoost = 0;
  party.boostDisabled = false;
  party.boostDisabledReason = null;
  party.sessionActionCounts = new Map();
  party.expiresAt = new Date(Date.now() + PARTY.LOBBY_EXPIRY_MS);
  await party.save();
  return party;
}

/**
 * Transition active → cooldown. Does NOT delete the party; it can be restarted
 * after the cooldown elapses. Returns a summary object.
 */
async function endSession(party) {
  if (party.status !== 'active') {
    return buildSessionSummary(party);
  }
  party.status = 'cooldown';
  party.sessionEndedAt = new Date();
  party.cooldownUntil = new Date(Date.now() + PARTY.COOLDOWN_MS);
  party.currentPartyBoost = 0;
  await party.save();
  return buildSessionSummary(party);
}

/** Auto-transition a stale active session to cooldown if past duration. */
async function maybeAutoEndSession(party) {
  if (party.status !== 'active') return party;
  if (sessionRemainingMs(party) > 0) return party;
  await endSession(party);
  return party;
}

async function buildSessionSummary(party) {
  if (!party.sessionStartedAt) {
    return {
      totalSavvy: 0,
      topContributor: null,
      bestDealRefId: null,
      peakBoost: 0,
    };
  }
  const events = await PartySessionEvent.find({
    partyId: party._id,
    sessionStartedAt: party.sessionStartedAt,
  }).lean();

  let totalSavvy = 0;
  const perUser = new Map();
  let bestDealRefId = null;
  let bestDealSavvy = -1;

  for (const e of events) {
    totalSavvy += Number(e.savvyEarned) || 0;
    const key = String(e.userId);
    perUser.set(key, (perUser.get(key) || 0) + (Number(e.savvyEarned) || 0));
    if (e.refId && (Number(e.savvyEarned) || 0) > bestDealSavvy) {
      bestDealSavvy = Number(e.savvyEarned) || 0;
      bestDealRefId = e.refId;
    }
  }

  let topContributor = null;
  let topSavvy = -1;
  for (const [userId, amount] of perUser.entries()) {
    if (amount > topSavvy) {
      topSavvy = amount;
      topContributor = { userId, savvyEarned: amount };
    }
  }

  return {
    totalSavvy,
    topContributor,
    bestDealRefId,
    peakBoost: Number(party.peakBoost) || 0,
  };
}

/** ----- Event recording ------------------------------------------------- */

/**
 * Record a member's party-eligible action. Returns:
 *   { event, energyGranted, boostApplied, finalMultiplier, partyState }
 *
 * personalMultiplier is authoritative from the caller (client snapshot).
 * `baseSavvy` is the un-boosted points amount for this action; the party boost
 * is added on top as bonus savvy proportional to (partyBoost / personal).
 *
 * NOTE: This function does NOT grant points in PointsLedger — the route layer
 * composes granting with other reward flows. It only records the party event.
 */
async function recordEvent({
  party,
  userId,
  eventType,
  personalMultiplier = 1,
  baseSavvy = 0,
  refId = null,
}) {
  if (!PartySessionEvent.VALID_EVENT_TYPES.includes(eventType)) {
    const err = new Error('Invalid event type');
    err.code = 'INVALID_EVENT';
    throw err;
  }
  if (party.status !== 'active') {
    const err = new Error('Squad session not active');
    err.code = 'NOT_ACTIVE';
    throw err;
  }
  if (!party.isMember(userId)) {
    const err = new Error('Not a member of this squad');
    err.code = 'NOT_MEMBER';
    throw err;
  }

  await maybeAutoEndSession(party);
  if (party.status !== 'active') {
    const err = new Error('Squad session ended');
    err.code = 'NOT_ACTIVE';
    throw err;
  }

  // Per-user action cap for the session
  const countsMap = party.sessionActionCounts instanceof Map
    ? party.sessionActionCounts
    : new Map(Object.entries(party.sessionActionCounts || {}));
  const userKey = String(userId);
  const prior = Number(countsMap.get(userKey) || 0);
  const overCap = prior >= PARTY.MAX_BOOSTED_ACTIONS_PER_USER_PER_SESSION;

  // Burst detection (per party across all members)
  const burstSince = new Date(Date.now() - PARTY.BURST_WINDOW_MS);
  const recentBurst = await PartySessionEvent.countDocuments({
    partyId: party._id,
    sessionStartedAt: party.sessionStartedAt,
    createdAt: { $gte: burstSince },
  });
  if (recentBurst >= PARTY.BURST_MAX_EVENTS && !party.boostDisabled) {
    party.boostDisabled = true;
    party.boostDisabledReason = 'suspicious_burst';
  }

  // Energy grant (skipped if user is over cap or boost is disabled)
  const rawEnergy = PARTY.ENERGY_BY_EVENT[eventType] || 0;
  const energyGranted = (overCap || party.boostDisabled) ? 0 : rawEnergy;
  party.energy = clamp((Number(party.energy) || 0) + energyGranted, 0, PARTY.MAX_ENERGY);

  // Update per-user counter (count the event even when uncapped at 0-energy
  // to keep burst detection accurate).
  countsMap.set(userKey, prior + 1);
  party.sessionActionCounts = countsMap;

  // Re-derive boost with latest state
  const activeIds = await getActiveMemberIds(party);
  activeIds.add(userKey); // this event makes the actor active right now
  const multipliers = { [userKey]: Number(personalMultiplier) || 1 };
  // For other active members we fall back to 1.0; callers can enrich via
  // computeState() + a richer API if desired.
  const derived = deriveBoost(party, activeIds, multipliers);

  party.currentPartyBoost = derived.partyBoost;
  if (derived.partyBoost > (party.peakBoost || 0)) {
    party.peakBoost = derived.partyBoost;
  }

  // Bonus savvy this user earns because of the party boost
  // boostShare = partyBoost / personalMultiplier applied to baseSavvy
  const personal = Number(personalMultiplier) || 1;
  const boostBonus = overCap || party.boostDisabled
    ? 0
    : Math.round(Number(baseSavvy) * (derived.partyBoost / personal));
  const savvyEarned = Math.max(0, Math.round(Number(baseSavvy) + boostBonus));

  const event = await PartySessionEvent.create({
    partyId: party._id,
    userId,
    sessionStartedAt: party.sessionStartedAt,
    eventType,
    energyGranted,
    savvyEarned,
    personalMultiplierAtEvent: personal,
    refId: refId ? String(refId).slice(0, 120) : null,
  });

  await party.save();

  const finalMultiplier = applyBoost(personal, derived.partyBoost);

  return {
    event,
    energyGranted,
    partyBoost: derived.partyBoost,
    boostBonusSavvy: boostBonus,
    savvyEarned,
    finalMultiplier,
    partyState: {
      energy: party.energy,
      currentPartyBoost: party.currentPartyBoost,
      peakBoost: party.peakBoost,
      boostDisabled: party.boostDisabled,
      boostDisabledReason: party.boostDisabledReason,
      activeCount: derived.activeCount,
      teamAverage: derived.teamAverage,
    },
  };
}

/**
 * Compute a full public-facing state snapshot of a party for UI rendering.
 *
 * `personalMultipliers` is an optional map of userId → personalMultiplier
 * gathered from the caller's cache. When omitted, everyone defaults to 1.0.
 */
async function computeState(party, { personalMultipliers = {} } = {}) {
  await maybeAutoEndSession(party);
  const now = new Date();
  const activeIds = await getActiveMemberIds(party, now);
  const derived = deriveBoost(party, activeIds, personalMultipliers);

  const sessionMsLeft = sessionRemainingMs(party, now.getTime());
  const cooldownMsLeft = cooldownRemainingMs(party, now.getTime());

  // Recent events (lightweight feed)
  let recentEvents = [];
  if (party.sessionStartedAt) {
    recentEvents = await PartySessionEvent.find({
      partyId: party._id,
      sessionStartedAt: party.sessionStartedAt,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }

  return {
    partyId: String(party._id),
    name: party.name,
    hostUserId: String(party.hostUserId),
    memberUserIds: (party.memberUserIds || []).map(String),
    maxMembers: party.maxMembers,
    status: party.status,
    sessionStartedAt: party.sessionStartedAt,
    sessionEndedAt: party.sessionEndedAt,
    sessionMsLeft,
    cooldownUntil: party.cooldownUntil,
    cooldownMsLeft,
    energy: party.energy || 0,
    energyMax: PARTY.MAX_ENERGY,
    energyPct: clamp((party.energy || 0) / PARTY.MAX_ENERGY, 0, 1),
    energyBoostCap: derived.energyCap,
    formulaBoost: derived.formulaBoost,
    currentPartyBoost: derived.partyBoost,
    peakBoost: party.peakBoost || 0,
    activeMemberIds: [...activeIds],
    activeCount: derived.activeCount,
    teamAverage: derived.teamAverage,
    boostDisabled: party.boostDisabled,
    boostDisabledReason: party.boostDisabledReason,
    recentEvents: recentEvents.map((e) => ({
      userId: String(e.userId),
      eventType: e.eventType,
      savvyEarned: e.savvyEarned,
      energyGranted: e.energyGranted,
      createdAt: e.createdAt,
      refId: e.refId || null,
    })),
  };
}

/** Find the single "primary" party for a user (the one still going). */
async function findPartyForUser(userId) {
  return Party.findOne({
    memberUserIds: userId,
    status: { $in: ['idle', 'active', 'cooldown'] },
  });
}

module.exports = {
  PARTY,
  canJoinParty,
  getActiveMemberIds,
  deriveBoost,
  applyBoost,
  energyToBoostCap,
  formulaBoostFromTeamAverage,
  startSession,
  endSession,
  maybeAutoEndSession,
  buildSessionSummary,
  recordEvent,
  computeState,
  findPartyForUser,
  sessionRemainingMs,
  cooldownRemainingMs,
};
