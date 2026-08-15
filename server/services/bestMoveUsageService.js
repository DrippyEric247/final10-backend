/**
 * Server-authoritative Best Move daily usage (Wave 2 closure).
 */

const User = require('../models/User');
const { getEntitlementByUserId } = require('./premiumEntitlementService');
const { resolveUserEntitlements } = require('./userEntitlementService');

function todayKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

async function loadUserAndEntitlements(userId) {
  const userQuery = User.findById(userId);
  const user =
    userQuery && typeof userQuery.lean === 'function' ? await userQuery.lean() : await userQuery;
  const entitlementDoc = await getEntitlementByUserId(userId);
  return { user, entitlementDoc };
}

async function getBestMoveBudget(userId) {
  const { user, entitlementDoc } = await loadUserAndEntitlements(userId);
  if (!user) {
    return {
      allowed: false,
      code: 'USER_NOT_FOUND',
      used: 0,
      cap: 0,
      remaining: 0,
      unlimited: false,
      effectivePlan: 'free',
    };
  }

  const resolved = resolveUserEntitlements(user, entitlementDoc);
  const cap = resolved.features.bestMovesPerDay;
  const day = todayKey();
  const usage = user.bestMoveUsage || {};
  const used = usage.day === day ? Math.max(0, Number(usage.usedToday) || 0) : 0;

  if (!Number.isFinite(cap)) {
    return {
      allowed: true,
      used,
      cap: null,
      remaining: null,
      unlimited: true,
      effectivePlan: resolved.effectivePlan,
      day,
    };
  }

  const remaining = Math.max(0, cap - used);
  return {
    allowed: remaining > 0,
    used,
    cap,
    remaining,
    unlimited: false,
    effectivePlan: resolved.effectivePlan,
    day,
  };
}

/**
 * Atomically consume one Best Move credit when capped.
 * Pro / beta unlimited paths succeed without incrementing a finite cap.
 */
async function consumeBestMoveCredit(userId) {
  const budget = await getBestMoveBudget(userId);
  if (budget.code === 'USER_NOT_FOUND') {
    return { ok: false, ...budget };
  }
  if (budget.unlimited) {
    return { ok: true, ...budget };
  }
  if (!budget.allowed) {
    return { ok: false, code: 'BEST_MOVE_LIMIT_REACHED', ...budget };
  }

  const day = budget.day || todayKey();
  const cap = budget.cap;

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { bestMoveUsage: { $exists: false } },
        { 'bestMoveUsage.day': { $ne: day } },
        { 'bestMoveUsage.usedToday': { $lt: cap } },
      ],
    },
    [
      {
        $set: {
          bestMoveUsage: {
            day,
            usedToday: {
              $add: [
                {
                  $cond: [
                    { $eq: [{ $ifNull: ['$bestMoveUsage.day', ''] }, day] },
                    { $ifNull: ['$bestMoveUsage.usedToday', 0] },
                    0,
                  ],
                },
                1,
              ],
            },
            lastUsedAt: new Date(),
          },
        },
      },
    ],
    { new: true }
  );

  if (!updated) {
    const fresh = await getBestMoveBudget(userId);
    return {
      ok: false,
      code: 'BEST_MOVE_LIMIT_REACHED',
      ...fresh,
    };
  }

  const used = Math.max(0, Number(updated.bestMoveUsage?.usedToday) || 0);
  return {
    ok: true,
    used,
    cap,
    remaining: Math.max(0, cap - used),
    unlimited: false,
    effectivePlan: budget.effectivePlan,
    day,
  };
}

module.exports = {
  todayKey,
  getBestMoveBudget,
  consumeBestMoveCredit,
};
