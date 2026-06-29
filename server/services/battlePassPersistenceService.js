const BattlePassProgress = require('../models/BattlePassProgress');
const CosmeticInventory = require('../models/CosmeticInventory');
const BattlePassEventLog = require('../models/BattlePassEventLog');
const User = require('../models/User');
const {
  BATTLE_PASS_CUMULATIVE_XP,
  BATTLE_PASS_TIERS,
  computeTierFromXp,
  clamp,
  tierRewardClaimKey,
  missionRewardClaimKey,
  legacyMissionRewardClaimKey,
} = require('../lib/battlePassConfig');
const { getSeasonTaskDefinition, resolveProgressRulesForSeason } = require('../data/battlePassSeasonBundle');
const {
  buildActiveBattlePassTasks,
  processBattlePassActionEvent,
} = require('../lib/battlePassProgressEngine');
const { auditFireAndForget } = require('./securityAuditService');
const {
  premiumStatusGrantsBattlePassAccess,
  getEntitlementByUserId,
} = require('./premiumEntitlementService');
const { validateStrictEventPayload } = require('../validation/progressionEventsStrict');
const { assertEventTrustOrDeny, assertClientOriginEventAllowed } = require('./progressionTrustService');
const { grantSavvyReward } = require('./savvyRewardService');
const {
  CLIENT_ALLOWED_EVENT_TYPES,
  ALL_BATTLE_PASS_EVENT_TYPES,
  SERVER_ONLY_EVENT_TYPES,
} = require('../config/battlePassTrust');

/** HTTP-accepted events only (no synthetic `task_completed` from clients). */
const INCOMING_EVENT_TYPES = CLIENT_ALLOWED_EVENT_TYPES;

const DEFAULT_STARTER_UNLOCKS = ['sigil_starter', 'card_default'];

function addUnlocks(inventory, ids) {
  const set = new Set(inventory.unlockedItemIds || []);
  for (const id of ids) {
    if (id) set.add(id);
  }
  inventory.unlockedItemIds = [...set];
  const newSet = new Set(inventory.newItemIds || []);
  for (const id of ids) {
    if (id) newSet.add(id);
  }
  inventory.newItemIds = [...newSet];
}

async function applyMissionGrantPayload(user, inventory, bpDoc, payload, idempotencyKey) {
  const rawXp = Math.max(0, Number(payload?.xp) || 0);
  const savvy = Math.max(0, Number(payload?.savvyPoints) || 0);
  const lint = Math.max(0, Number(payload?.powerLintDelta) || 0);
  const cosmeticId = payload?.cosmeticId;

  // Apply an active 1.5× Battle Pass XP boost from the Perk Machine, if any.
  let bpXpMult = 1;
  try {
    // eslint-disable-next-line global-require
    bpXpMult = require('./perkBoostService').getBpXpMultiplier(user) || 1;
  } catch (_e) {
    bpXpMult = 1;
  }
  const xp = Math.round(rawXp * bpXpMult);

  if (xp > 0) {
    bpDoc.xp = (bpDoc.xp || 0) + xp;
  }
  if (savvy > 0 && idempotencyKey) {
    await grantSavvyReward(user, {
      rewardType: 'battle_pass_mission',
      amount: savvy,
      idempotencyKey,
      note: 'Battle Pass mission Savvy',
      meta: { source: 'battle_pass_mission' },
    });
  }
  if (lint > 0) {
    user.powerMultiplier = clamp((user.powerMultiplier || 1) + lint, 1, 3.5);
  }
  if (cosmeticId) {
    addUnlocks(inventory, [cosmeticId]);
  }
}

function applyTrackTierReward(reward, user, inventory, bp, claimedSet, claimKey) {
  if (!reward) return;
  claimedSet.add(claimKey);
  switch (reward.type) {
    case 'points': {
      const n = Number(reward.value) || 0;
      user.points = (user.points || 0) + n;
      break;
    }
    case 'emblem':
    case 'card':
      if (reward.id) addUnlocks(inventory, [reward.id]);
      break;
    case 'boost': {
      const v = Number(reward.value) || 0;
      user.powerMultiplier = clamp((user.powerMultiplier || 1) + v, 1, 3.5);
      break;
    }
    case 'bp_xp': {
      bp.xp += Number(reward.value) || 0;
      break;
    }
    default:
      break;
  }
}

/**
 * Beta: tier rewards are now MANUALLY claimed via `battlePassClaimService`
 * (the new 25-tier ecosystem rewards route to Savvy/eggs/spins/cosmetics and
 * surface a claim popup). This function is intentionally a no-op for tier
 * granting — it only preserves the call sites that recompute premium/tier.
 *
 * Legacy `applyTrackTierReward` (points/emblem/card/boost/bp_xp) is retained for
 * reference but no longer invoked, and historical `tier:` claim keys remain in
 * `claimedRewardIds` (preserving prior progress) without blocking new `tier2:`
 * manual claims.
 */
function applyPendingTierRewards() {
  return [];
}

/**
 * Sync battle pass premium flag + tier grants from PremiumEntitlement (Stripe webhook truth).
 */
async function reconcileBattlePassPremiumFromEntitlement(userId) {
  const ent = await getEntitlementByUserId(userId);
  const eligible = premiumStatusGrantsBattlePassAccess(ent);
  const user = await User.findById(userId);
  if (!user) return;
  const { bp, inv } = await ensureProgressDocuments(userId);
  bp.premiumUnlocked = Boolean(eligible);
  applyPendingTierRewards(bp, user, inv);
  bp.tier = computeTierFromXp(bp.xp || 0);
  await user.save();
  await inv.save();
  await bp.save();
}

function taskProgressMapFromDoc(bpDoc) {
  const m = {};
  for (const row of bpDoc.taskProgress || []) {
    m[row.taskId] = {
      progress: row.progress,
      completed: row.completed,
      rewardGranted: row.rewardGranted,
      completedAt: row.completedAt,
    };
  }
  return m;
}

function syncTaskProgressArray(bpDoc, updatedTasks) {
  const prev = new Map((bpDoc.taskProgress || []).map((r) => [r.taskId, r]));
  bpDoc.taskProgress = updatedTasks.map((t) => {
    const was = prev.get(t.id);
    const completedAt =
      t.completed && (was?.completedAt || new Date());
    return {
      taskId: t.id,
      progress: t.progress,
      completed: t.completed,
      rewardGranted: t.rewardGranted,
      completedAt: completedAt || null,
    };
  });
  bpDoc.completedTaskIds = updatedTasks.filter((t) => t.completed).map((t) => t.id);
}

function normalizeClientEvent(event, serverUserId, options = {}) {
  if (!event || typeof event !== 'object') return null;
  const { id, type, timestamp, payload } = event;
  if (typeof id !== 'string' || !id.length) return null;
  const allowed = options.trustedServerOrigin ? ALL_BATTLE_PASS_EVENT_TYPES : INCOMING_EVENT_TYPES;
  if (typeof type !== 'string' || !allowed.has(type)) return null;
  if (!payload || typeof payload !== 'object') return null;
  return {
    id,
    type,
    userId: String(serverUserId),
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
    payload: { ...payload },
  };
}

async function ensureProgressDocuments(userId) {
  let bp = await BattlePassProgress.findOne({ userId, seasonId: 'neon_hunt_s1' });
  if (!bp) {
    bp = await BattlePassProgress.create({
      userId,
      seasonId: 'neon_hunt_s1',
      xp: 0,
      tier: 0,
      completedTaskIds: [],
      claimedRewardIds: [],
      taskProgress: [],
      premiumUnlocked: false,
    });
  }
  let inv = await CosmeticInventory.findOne({ userId });
  if (!inv) {
    inv = await CosmeticInventory.create({
      userId,
      unlockedItemIds: [...DEFAULT_STARTER_UNLOCKS],
      newItemIds: [],
    });
  }
  return { bp, inv };
}

/**
 * @returns {Promise<{ state: object, httpError?: { status: number, body: object } }>}
 */
async function progressionStateForResponse(userId) {
  try {
    return await buildProgressionPayload(userId);
  } catch {
    return null;
  }
}

async function processBattlePassEvent(userId, seasonId, rawEvent, options = {}) {
  const { req: auditReq, trustedServerOrigin = false } = options;
  const season = getSeasonTaskDefinition(seasonId);
  if (!season) {
    const state = await progressionStateForResponse(userId);
    return {
      httpError: { status: 400, body: { code: 'INVALID_SEASON', message: 'Unknown battle pass season' } },
      state,
    };
  }

  if (
    !trustedServerOrigin &&
    rawEvent &&
    typeof rawEvent.type === 'string' &&
    SERVER_ONLY_EVENT_TYPES.has(rawEvent.type)
  ) {
    auditFireAndForget('PROGRESSION_TRUST_REJECTED', {
      userId,
      req: auditReq,
      meta: { code: 'TRUST_SERVER_EVENT_ONLY', eventId: rawEvent.id, type: rawEvent.type, stage: 'client_origin' },
      severity: 'warn',
    });
    const state = await progressionStateForResponse(userId);
    return {
      httpError: {
        status: 403,
        body: {
          code: 'TRUST_SERVER_EVENT_ONLY',
          message: 'This progression event must be recorded by the server from a verified action.',
        },
      },
      state,
    };
  }

  const event = normalizeClientEvent(rawEvent, userId, { trustedServerOrigin });
  if (!event) {
    const state = await progressionStateForResponse(userId);
    return {
      httpError: { status: 400, body: { code: 'INVALID_EVENT', message: 'Malformed battle pass event' } },
      state,
    };
  }

  if (!trustedServerOrigin) {
    const clientOrigin = assertClientOriginEventAllowed(event.type);
    if (!clientOrigin.ok) {
      auditFireAndForget('PROGRESSION_TRUST_REJECTED', {
        userId,
        req: auditReq,
        meta: { code: clientOrigin.code, eventId: event.id, type: event.type, stage: 'client_origin' },
        severity: 'warn',
      });
      const state = await progressionStateForResponse(userId);
      return {
        httpError: {
          status: 403,
          body: { code: clientOrigin.code, message: clientOrigin.message },
        },
        state,
      };
    }
  }

  const strict = validateStrictEventPayload(event.type, event.payload);
  if (!strict.ok) {
    auditFireAndForget('PROGRESSION_EVENT_REJECTED', {
      userId,
      req: auditReq,
      meta: { reason: strict.code, eventId: event.id, type: event.type },
      severity: 'warn',
    });
    const state = await progressionStateForResponse(userId);
    return {
      httpError: {
        status: 400,
        body: { code: strict.code, message: strict.message },
      },
      state,
    };
  }
  event.payload = strict.payload;

  const priorLog = await BattlePassEventLog.findOne({ userId, eventId: event.id }).lean();
  if (priorLog) {
    auditFireAndForget('PROGRESSION_EVENT_REPLAY', {
      userId,
      req: auditReq,
      meta: { eventId: event.id, eventType: event.type, stage: 'pre_process' },
      severity: 'warn',
    });
    const fresh = await buildProgressionPayload(userId);
    return { state: fresh, idempotentReplay: true };
  }

  const trust = await assertEventTrustOrDeny(event, userId);
  if (!trust.ok) {
    auditFireAndForget('PROGRESSION_TRUST_REJECTED', {
      userId,
      req: auditReq,
      meta: { code: trust.code, eventId: event.id, type: event.type },
      severity: 'warn',
    });
    const state = await progressionStateForResponse(userId);
    return {
      httpError: {
        status: 403,
        body: { code: trust.code, message: trust.message },
      },
      state,
    };
  }

  const user = await User.findById(userId);
  if (!user) {
    return { httpError: { status: 404, body: { code: 'USER_NOT_FOUND', message: 'User not found' } } };
  }

  const powerMultBefore = user.powerMultiplier ?? 1;

  let { bp, inv } = await ensureProgressDocuments(userId);
  await reconcileBattlePassPremiumFromEntitlement(userId);
  ({ bp, inv } = await ensureProgressDocuments(userId));

  const rules = resolveProgressRulesForSeason(season);
  const initial = taskProgressMapFromDoc(bp);
  let activeTasks;
  try {
    activeTasks = buildActiveBattlePassTasks(season.tasks, rules, initial);
  } catch (err) {
    const state = await progressionStateForResponse(userId);
    return {
      httpError: {
        status: 500,
        body: { code: 'SEASON_CONFIG_ERROR', message: err.message || 'Season configuration error' },
      },
      state,
    };
  }

  try {
    await BattlePassEventLog.create({
      userId,
      eventId: event.id,
      eventType: event.type,
      payload: event.payload,
      matchedTaskIds: [],
      grantedRewards: [],
    });
  } catch (e) {
    if (e && e.code === 11000) {
      auditFireAndForget('PROGRESSION_EVENT_REPLAY', {
        userId,
        req: auditReq,
        meta: { eventId: event?.id, eventType: event?.type },
        severity: 'warn',
      });
      const fresh = await buildProgressionPayload(userId);
      return { state: fresh, idempotentReplay: true };
    }
    throw e;
  }

  const result = processBattlePassActionEvent(event, activeTasks, { maxCascadeSteps: 32 });

  const claimed = new Set(bp.claimedRewardIds || []);
  const missionGrants = [];

  for (const g of result.grantedRewards) {
    const key = missionRewardClaimKey(seasonId, g.taskId);
    const legacyKey = legacyMissionRewardClaimKey(g.taskId);
    if (claimed.has(key) || claimed.has(legacyKey)) {
      auditFireAndForget('PROGRESSION_DUPLICATE_REWARD', {
        userId,
        req: auditReq,
        meta: { eventId: event.id, taskId: g.taskId, key, legacyKey },
        severity: 'critical',
      });
      await BattlePassEventLog.updateOne(
        { userId, eventId: event.id },
        {
          $set: {
            matchedTaskIds: result.completedTasks.map((t) => t.id),
            grantedRewards: [{ duplicateSkipped: true, taskId: g.taskId, key, legacyKey }],
          },
        }
      );
      const fresh = await buildProgressionPayload(userId);
      return {
        state: fresh,
        httpError: { status: 409, body: { code: 'DUPLICATE_REWARD', message: 'Reward for this task was already granted' } },
      };
    }
  }

  for (const g of result.grantedRewards) {
    const key = missionRewardClaimKey(seasonId, g.taskId);
    await applyMissionGrantPayload(user, inv, bp, g.payload, `battle_pass_mission:${userId}:${key}`);
    claimed.add(key);
    missionGrants.push({ taskId: g.taskId, payload: g.payload });
  }

  bp.claimedRewardIds = [...claimed];
  syncTaskProgressArray(bp, result.updatedTasks);

  const tierGrants = applyPendingTierRewards(bp, user, inv);
  bp.tier = computeTierFromXp(bp.xp);

  await user.save();
  await inv.save();
  await bp.save();

  const powerMultAfter = user.powerMultiplier ?? 1;
  if (Math.abs(powerMultBefore - powerMultAfter) > 1e-9) {
    setImmediate(() => {
      try {
        const { onPowerMultiplierChangedForBattlePass } = require('./progressionServerEventsService');
        void onPowerMultiplierChangedForBattlePass(
          userId,
          powerMultBefore,
          powerMultAfter,
          `bp_event:${event.id}:pm`
        );
      } catch (_e) {
        /* BP power emit must not fail primary event */
      }
    });
  }

  await BattlePassEventLog.updateOne(
    { userId, eventId: event.id },
    {
      $set: {
        matchedTaskIds: result.completedTasks.map((t) => t.id),
        grantedRewards: [...missionGrants, ...tierGrants],
      },
    }
  );

  auditFireAndForget('PROGRESSION_EVENT_PROCESSED', {
    userId,
    req: auditReq,
    meta: {
      eventId: event.id,
      eventType: event.type,
      completedTaskIds: result.completedTasks.map((t) => t.id),
      missionGrantTaskIds: missionGrants.map((m) => m.taskId),
      tierGrantCount: tierGrants.length,
    },
  });

  const state = await buildProgressionPayload(userId);
  return { state };
}

async function buildProgressionPayload(userId) {
  await reconcileBattlePassPremiumFromEntitlement(userId);
  const user = await User.findById(userId).select('-password');
  if (!user) return null;

  const { bp, inv } = await ensureProgressDocuments(userId);
  const season = getSeasonTaskDefinition(bp.seasonId);
  const rules = resolveProgressRulesForSeason(season);
  const initial = taskProgressMapFromDoc(bp);
  const activeTasks = buildActiveBattlePassTasks(season.tasks, rules, initial);

  return {
    user: {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      premiumTier: user.premiumTier || user.membershipTier || 'free',
      leaderboardScore: user.leaderboardScore ?? 0,
      currentStreak: user.currentStreak ?? 0,
      powerMultiplier: user.powerMultiplier ?? 1,
      points: user.points ?? 0,
      savvyPoints: user.savvyPoints ?? 0,
      membershipTier: user.membershipTier,
      equippedCosmetics: {
        emblemId: user.equippedCosmetics?.emblemId || 'sigil_starter',
        callingCardId: user.equippedCosmetics?.callingCardId || 'card_default',
        titleId: user.equippedCosmetics?.titleId || null,
      },
    },
    battlePass: {
      seasonId: bp.seasonId,
      xp: bp.xp,
      tier: computeTierFromXp(bp.xp || 0),
      premiumUnlocked: Boolean(bp.premiumUnlocked),
      completedTaskIds: bp.completedTaskIds || [],
      claimedRewardIds: bp.claimedRewardIds || [],
      taskStates: activeTasks,
    },
    cosmetics: {
      unlockedItemIds: inv.unlockedItemIds || [],
      newItemIds: inv.newItemIds || [],
      equipped: {
        emblemId: user.equippedCosmetics?.emblemId || 'sigil_starter',
        callingCardId: user.equippedCosmetics?.callingCardId || 'card_default',
        titleId: user.equippedCosmetics?.titleId || null,
      },
    },
  };
}

async function initProgressionForUser(userId, options = {}) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const { reset } = options;
  if (reset) {
    await BattlePassProgress.deleteMany({ userId });
    await CosmeticInventory.deleteOne({ userId });
  }

  await ensureProgressDocuments(userId);

  if (!user.equippedCosmetics || !user.equippedCosmetics.emblemId) {
    user.equippedCosmetics = {
      emblemId: 'sigil_starter',
      callingCardId: 'card_default',
      titleId: null,
    };
  }
  user.premiumTier = user.premiumTier || user.membershipTier || 'free';
  user.powerMultiplier = user.powerMultiplier ?? 1;
  await user.save();

  const inv = await CosmeticInventory.findOne({ userId });
  addUnlocks(inv, DEFAULT_STARTER_UNLOCKS);
  await inv.save();

  return buildProgressionPayload(userId);
}

/**
 * Re-read Stripe-driven entitlement and return progression state.
 * Client cannot set premium to true; webhooks + this sync establish truth.
 */
async function syncPremiumFromEntitlement(userId, options = {}) {
  const { req: auditReq } = options;
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  auditFireAndForget('BATTLE_PASS_PREMIUM_SYNCED', {
    userId,
    req: auditReq,
    meta: {},
    severity: 'info',
  });
  return buildProgressionPayload(userId);
}

module.exports = {
  processBattlePassEvent,
  buildProgressionPayload,
  ensureProgressDocuments,
  initProgressionForUser,
  syncPremiumFromEntitlement,
  reconcileBattlePassPremiumFromEntitlement,
  applyPendingTierRewards,
  DEFAULT_STARTER_UNLOCKS,
  VALID_EVENT_TYPES: INCOMING_EVENT_TYPES,
  INCOMING_EVENT_TYPES,
};
