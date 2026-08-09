/**
 * Authoritative Deal Streak + Nuke category challenge progression.
 * All qualifying deal events must flow through recordQualifyingDeal().
 */
const User = require('../models/User');
const QualifiedDealRecord = require('../models/QualifiedDealRecord');
const {
  DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS,
  DEAL_STREAK_CONTRACT_MILESTONE,
  DEAL_STREAK_HISTORY_LIMIT,
  DEAL_STREAK_SOURCE_TYPES,
} = require('../config/dealStreak');
const {
  NUKE_CATEGORY_CHALLENGES,
  getNukeCategoryChallengeByCategory,
} = require('../config/nukeCategoryChallenges');
const { resolveDealCategory } = require('../lib/dealCategoryUtils');
const { grantCamoUnlock } = require('./camoLockerService');
const { fireContractTrigger } = require('./contractHooks');

class DealStreakError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function ensureDealStreakDoc(user) {
  if (!user.dealStreak || typeof user.dealStreak !== 'object') {
    user.dealStreak = {};
  }
  const ds = user.dealStreak;
  if (typeof ds.currentDealStreak !== 'number') ds.currentDealStreak = 0;
  if (typeof ds.longestDealStreak !== 'number') ds.longestDealStreak = 0;
  if (typeof ds.totalQualifiedDeals !== 'number') ds.totalQualifiedDeals = 0;
  if (!Array.isArray(ds.streakMilestonesClaimed)) ds.streakMilestonesClaimed = [];
  if (!Array.isArray(ds.streakHistory)) ds.streakHistory = [];

  if (!ds.nuke || typeof ds.nuke !== 'object') {
    ds.nuke = {};
  }
  const nuke = ds.nuke;
  if (typeof nuke.activeCategory !== 'string' && nuke.activeCategory !== null) {
    nuke.activeCategory = nuke.activeCategory || null;
  }
  if (typeof nuke.activeStreak !== 'number') nuke.activeStreak = 0;
  if (!nuke.longestByCategory || typeof nuke.longestByCategory !== 'object') {
    nuke.longestByCategory = {};
  }
  if (!Array.isArray(nuke.completedChallenges)) nuke.completedChallenges = [];

  return ds;
}

function isChallengeCompleted(ds, challengeId) {
  return (ds.nuke.completedChallenges || []).some((c) => c.challengeId === challengeId);
}

function pushStreakHistory(ds, entry) {
  ds.streakHistory.unshift({
    dealId: entry.dealId,
    category: entry.category || null,
    source: entry.source,
    counted: Boolean(entry.counted),
    skipReason: entry.skipReason || null,
    at: entry.at || new Date(),
  });
  if (ds.streakHistory.length > DEAL_STREAK_HISTORY_LIMIT) {
    ds.streakHistory = ds.streakHistory.slice(0, DEAL_STREAK_HISTORY_LIMIT);
  }
}

function readLongestByCategory(nuke, category) {
  const map = nuke.longestByCategory;
  if (map instanceof Map) return Number(map.get(category)) || 0;
  return Number(map?.[category]) || 0;
}

function setLongestByCategory(nuke, category, value) {
  if (nuke.longestByCategory instanceof Map) {
    nuke.longestByCategory.set(category, value);
  } else {
    nuke.longestByCategory[category] = value;
  }
}

function buildNukeChallengeProgress(ds) {
  const nuke = ds.nuke || {};
  const activeCategory = nuke.activeCategory || null;
  const activeStreak = Number(nuke.activeStreak) || 0;
  const completedIds = new Set((nuke.completedChallenges || []).map((c) => c.challengeId));

  return NUKE_CATEGORY_CHALLENGES.map((challenge) => {
    const isComplete = completedIds.has(challenge.id);
    const progress =
      isComplete
        ? challenge.requiredConsecutiveDeals
        : activeCategory === challenge.category
          ? activeStreak
          : 0;

    return {
      id: challenge.id,
      title: challenge.title,
      category: challenge.category,
      categoryName: challenge.categoryName,
      target: challenge.requiredConsecutiveDeals,
      progress: Math.min(progress, challenge.requiredConsecutiveDeals),
      isComplete,
      isActive: !isComplete && activeCategory === challenge.category && activeStreak > 0,
      camoItemId: challenge.camoItemId,
      camoName: challenge.camoName,
    };
  });
}

function buildDealStreakStatus(user) {
  const ds = ensureDealStreakDoc(user);
  const nukeChallenges = buildNukeChallengeProgress(ds);

  return {
    currentDealStreak: Number(ds.currentDealStreak) || 0,
    longestDealStreak: Number(ds.longestDealStreak) || 0,
    totalQualifiedDeals: Number(ds.totalQualifiedDeals) || 0,
    lastQualifiedDealAt: ds.lastQualifiedDealAt || null,
    latestQualifiedDealId: ds.latestQualifiedDealId || null,
    streakStartedAt: ds.streakStartedAt || null,
    streakUpdatedAt: ds.streakUpdatedAt || null,
    streakMilestonesClaimed: [...(ds.streakMilestonesClaimed || [])],
    contractMilestone: DEAL_STREAK_CONTRACT_MILESTONE,
    minQualifyIntervalMs: DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS,
    recentHistory: (ds.streakHistory || []).slice(0, 12),
    nuke: {
      activeCategory: ds.nuke?.activeCategory || null,
      activeStreak: Number(ds.nuke?.activeStreak) || 0,
      challenges: nukeChallenges,
      completedChallenges: (ds.nuke?.completedChallenges || []).map((c) => ({
        challengeId: c.challengeId,
        category: c.category,
        camoItemId: c.camoItemId,
        completedAt: c.completedAt,
        rewardGranted: Boolean(c.rewardGranted),
      })),
      pendingCelebration: ds.nuke?.pendingCelebration || null,
    },
  };
}

async function completeNukeChallenge(user, ds, challenge, now) {
  if (isChallengeCompleted(ds, challenge.id)) {
    return { alreadyComplete: true, challengeId: challenge.id };
  }

  const granted = await grantCamoUnlock(user._id, challenge.camoItemId, 'nuke_category_streak');

  ds.nuke.completedChallenges.push({
    challengeId: challenge.id,
    category: challenge.category,
    camoItemId: challenge.camoItemId,
    completedAt: now,
    rewardGranted: Boolean(granted),
  });

  ds.nuke.pendingCelebration = {
    challengeId: challenge.id,
    title: challenge.title,
    category: challenge.category,
    categoryName: challenge.categoryName,
    camoItemId: challenge.camoItemId,
    camoName: challenge.camoName,
    target: challenge.requiredConsecutiveDeals,
    completedAt: now,
  };

  return {
    completed: true,
    challengeId: challenge.id,
    category: challenge.category,
    categoryName: challenge.categoryName,
    camoItemId: challenge.camoItemId,
    camoName: challenge.camoName,
    target: challenge.requiredConsecutiveDeals,
    granted: Boolean(granted),
  };
}

function updateNukeCategoryStreak(ds, category, now) {
  if (!category) {
    return { updated: false, reason: 'unmapped_category' };
  }

  const challenge = getNukeCategoryChallengeByCategory(category);
  if (!challenge) {
    return { updated: false, reason: 'no_challenge_for_category' };
  }

  if (isChallengeCompleted(ds, challenge.id)) {
    return { updated: false, reason: 'already_complete', challengeId: challenge.id };
  }

  const nuke = ds.nuke;
  let categorySwitched = false;

  if (nuke.activeCategory === category) {
    nuke.activeStreak = Number(nuke.activeStreak || 0) + 1;
  } else {
    categorySwitched = Boolean(nuke.activeCategory);
    nuke.activeCategory = category;
    nuke.activeStreak = 1;
  }

  const longest = readLongestByCategory(nuke, category);
  if (nuke.activeStreak > longest) {
    setLongestByCategory(nuke, category, nuke.activeStreak);
  }

  return {
    updated: true,
    category,
    activeStreak: nuke.activeStreak,
    categorySwitched,
    challenge,
  };
}

/**
 * Record a verified qualifying deal — single authoritative entry point.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {{ sourceType: string, sourceId: string, categoryRaw?: string, meta?: object }} params
 */
async function recordQualifyingDeal(userId, params = {}) {
  const sourceType = String(params.sourceType || '').trim();
  const sourceId = String(params.sourceId || params.dealId || '').trim();

  if (!sourceId) {
    throw new DealStreakError(400, 'MISSING_DEAL_ID', 'sourceId is required.');
  }
  if (!DEAL_STREAK_SOURCE_TYPES.includes(sourceType)) {
    throw new DealStreakError(400, 'INVALID_SOURCE', 'Unknown qualifying deal source.');
  }

  const sourceKey = `${sourceType}:${sourceId}`;

  const existing = await QualifiedDealRecord.findOne({ userId, sourceKey }).lean();
  if (existing) {
    const user = await User.findById(userId);
    return {
      duplicate: true,
      counted: Boolean(existing.countedForStreak),
      skipReason: existing.skipReason,
      status: user ? buildDealStreakStatus(user) : null,
    };
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new DealStreakError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const ds = ensureDealStreakDoc(user);
  const now = new Date();
  const category = resolveDealCategory(params.categoryRaw);
  const categoryRaw = params.categoryRaw ? String(params.categoryRaw) : null;

  let counted = true;
  let skipReason = null;

  if (ds.lastQualifiedDealAt) {
    const elapsed = now.getTime() - new Date(ds.lastQualifiedDealAt).getTime();
    if (elapsed < DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS) {
      counted = false;
      skipReason = 'cooldown';
    }
  }

  let contractTriggered = false;
  let nukeCompletion = null;
  let nukeUpdate = null;

  if (counted) {
    const prevStreak = Number(ds.currentDealStreak) || 0;
    ds.currentDealStreak = prevStreak + 1;
    ds.totalQualifiedDeals = Number(ds.totalQualifiedDeals || 0) + 1;
    ds.lastQualifiedDealAt = now;
    ds.latestQualifiedDealId = sourceId;
    ds.streakUpdatedAt = now;
    if (ds.currentDealStreak === 1) {
      ds.streakStartedAt = now;
    }
    if (ds.currentDealStreak > ds.longestDealStreak) {
      ds.longestDealStreak = ds.currentDealStreak;
    }

    if (ds.currentDealStreak === DEAL_STREAK_CONTRACT_MILESTONE) {
      fireContractTrigger(user._id, 'deal_streak_complete');
      contractTriggered = true;
    }

    nukeUpdate = updateNukeCategoryStreak(ds, category, now);

    if (
      nukeUpdate?.updated &&
      nukeUpdate.challenge &&
      nukeUpdate.activeStreak >= nukeUpdate.challenge.requiredConsecutiveDeals
    ) {
      nukeCompletion = await completeNukeChallenge(user, ds, nukeUpdate.challenge, now);
    }
  }

  pushStreakHistory(ds, {
    dealId: sourceId,
    category,
    source: sourceType,
    counted,
    skipReason,
    at: now,
  });

  user.markModified('dealStreak');
  await user.save();

  await QualifiedDealRecord.create({
    userId: user._id,
    sourceKey,
    sourceType,
    dealId: sourceId,
    category,
    categoryRaw,
    countedForStreak: counted,
    skipReason,
    meta: params.meta || null,
  });

  const status = buildDealStreakStatus(user);

  return {
    duplicate: false,
    counted,
    skipReason,
    contractTriggered,
    nukeCompletion,
    nukeUpdate,
    category,
    status,
    event: {
      type: 'QUALIFYING_DEAL_RECORDED',
      userId: String(user._id),
      sourceType,
      sourceId,
      category,
      counted,
      skipReason,
      currentDealStreak: status.currentDealStreak,
      nukeActiveCategory: status.nuke.activeCategory,
      nukeActiveStreak: status.nuke.activeStreak,
      nukeCompletion,
    },
  };
}

async function getDealStreakStatusForUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new DealStreakError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return buildDealStreakStatus(user);
}

async function acknowledgeNukeCelebration(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new DealStreakError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  const ds = ensureDealStreakDoc(user);
  if (ds.nuke?.pendingCelebration) {
    ds.nuke.pendingCelebration = null;
    user.markModified('dealStreak');
    await user.save();
  }
  return buildDealStreakStatus(user);
}

module.exports = {
  DealStreakError,
  recordQualifyingDeal,
  getDealStreakStatusForUser,
  acknowledgeNukeCelebration,
  buildDealStreakStatus,
  ensureDealStreakDoc,
  updateNukeCategoryStreak,
};
