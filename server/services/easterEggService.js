/**
 * Easter egg redemption — persisted, idempotent, canonical Savvy ledger.
 */
const { creditSavvy } = require('./savvyBalanceService');
const EasterEggRedemption = require('../models/EasterEggRedemption');

const EASTER_EGG_CODES = Object.freeze({
  TRAILER2024: {
    points: 500,
    name: 'Trailer Master',
    icon: '🎬',
    description: 'Found the trailer easter egg!',
    category: 'trailer',
  },
  TEASER2024: {
    points: 300,
    name: 'Teaser Hunter',
    icon: '🔍',
    description: 'Discovered the teaser code!',
    category: 'teaser',
  },
  EASTEREGG: {
    points: 1000,
    name: 'Easter Egg Finder',
    icon: '🥚',
    description: 'Ultimate easter egg hunter!',
    category: 'special',
  },
  STAYSAVVY: {
    points: 250,
    name: 'Savvy Viewer',
    icon: '💡',
    description: 'You are truly savvy!',
    category: 'brand',
  },
  STAYEARNING: {
    points: 200,
    name: 'Earning Pro',
    icon: '💰',
    description: 'Master of earning!',
    category: 'brand',
  },
  FINAL10: {
    points: 150,
    name: 'Final10 Fan',
    icon: '🎯',
    description: 'True Final10 supporter!',
    category: 'brand',
  },
  LAUNCH2024: {
    points: 750,
    name: 'Launch Explorer',
    icon: '🚀',
    description: 'Early adopter bonus!',
    category: 'launch',
  },
  BETAUSER: {
    points: 600,
    name: 'Beta Tester',
    icon: '🧪',
    description: 'Thank you for testing!',
    category: 'beta',
  },
});

function getEasterEggDefinition(code) {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper || !EASTER_EGG_CODES[upper]) return null;
  return { code: upper, ...EASTER_EGG_CODES[upper] };
}

function listEasterEggHintsForUser(redeemedCodes) {
  const redeemed = new Set((redeemedCodes || []).map((c) => String(c).toUpperCase()));
  return Object.entries(EASTER_EGG_CODES)
    .filter(([code]) => !redeemed.has(code))
    .map(([code, data]) => ({
      code: '???',
      hintCode: code.slice(0, 2) + '***',
      name: data.name,
      icon: data.icon,
      category: data.category,
      description: 'Keep hunting — codes are hidden in trailers and across the app.',
      pointsHidden: true,
    }));
}

async function getUserRedemptionHistory(userId) {
  const rows = await EasterEggRedemption.find({ userId }).sort({ createdAt: -1 }).lean();
  return rows.map((r) => {
    const def = EASTER_EGG_CODES[r.code] || {};
    return {
      code: r.code,
      name: def.name || r.code,
      points: r.pointsAwarded,
      icon: def.icon || '🎁',
      category: def.category || 'special',
      redeemedAt: r.createdAt,
    };
  });
}

async function redeemEasterEggCode(userId, rawCode) {
  const def = getEasterEggDefinition(rawCode);
  if (!def) {
    return { ok: false, status: 400, message: 'Invalid redeem code. Keep watching our trailers for easter eggs! 🎬' };
  }

  const idempotencyKey = `easter_egg:${userId}:${def.code}`;

  const existing = await EasterEggRedemption.findOne({ userId, code: def.code }).lean();
  if (existing) {
    return {
      ok: false,
      status: 400,
      alreadyRedeemed: true,
      message: 'You have already redeemed this code!',
    };
  }

  try {
    await EasterEggRedemption.create({
      userId,
      code: def.code,
      pointsAwarded: def.points,
      savvyTransactionKey: idempotencyKey,
      meta: { name: def.name, category: def.category },
    });
  } catch (e) {
    if (e?.code === 11000) {
      return {
        ok: false,
        status: 400,
        alreadyRedeemed: true,
        message: 'You have already redeemed this code!',
      };
    }
    throw e;
  }

  const credit = await creditSavvy(userId, {
    amount: def.points,
    source: 'easter_egg',
    idempotencyKey,
    note: `${def.description} (Code: ${def.code})`,
    meta: { code: def.code, category: def.category },
  });

  if (!credit.granted && !credit.duplicate) {
    await EasterEggRedemption.deleteOne({ userId, code: def.code });
    return { ok: false, status: 500, message: 'Could not award Savvy for this code.' };
  }

  return {
    ok: true,
    success: true,
    message: `🎉 Amazing! You found the ${def.name} easter egg! +${def.points} Savvy!`,
    easterEgg: {
      code: def.code,
      name: def.name,
      points: def.points,
      icon: def.icon,
      description: def.description,
      category: def.category,
    },
    pointsEarned: credit.granted ? credit.amount : 0,
    savvyEarned: credit.granted ? credit.amount : 0,
    newBalance: credit.newBalance,
    duplicate: Boolean(credit.duplicate),
  };
}

async function getEasterEggStats() {
  const rows = await EasterEggRedemption.find({}).lean();
  const codeStats = {};
  for (const r of rows) {
    const def = EASTER_EGG_CODES[r.code] || {};
    if (!codeStats[r.code]) {
      codeStats[r.code] = {
        code: r.code,
        name: def.name || r.code,
        points: def.points || r.pointsAwarded,
        redemptions: 0,
        totalPointsAwarded: 0,
      };
    }
    codeStats[r.code].redemptions += 1;
    codeStats[r.code].totalPointsAwarded += r.pointsAwarded;
  }

  return {
    totalRedemptions: rows.length,
    totalPointsAwarded: rows.reduce((s, r) => s + r.pointsAwarded, 0),
    uniqueUsers: new Set(rows.map((r) => String(r.userId))).size,
    codeStats: Object.values(codeStats).sort((a, b) => b.redemptions - a.redemptions),
    availableCodes: Object.keys(EASTER_EGG_CODES).length,
  };
}

module.exports = {
  EASTER_EGG_CODES,
  getEasterEggDefinition,
  listEasterEggHintsForUser,
  getUserRedemptionHistory,
  redeemEasterEggCode,
  getEasterEggStats,
};
