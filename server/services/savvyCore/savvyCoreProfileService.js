/**
 * Savvy Core V1 — profile read model for cross-app clients.
 */
const User = require('../../models/User');
const CosmeticInventory = require('../../models/CosmeticInventory');
const { resolveSavvyBalance } = require('../../lib/dataAuthority/savvyBalance');
const { getProfileProgress } = require('../profileXpService');
const { listRegisteredApps, SAVVY_CORE_VERSION, isSavvyCoreEnabled } = require('../../config/savvyCoreConfig');

async function getSavvyCoreMe(user) {
  if (!user) return null;

  const [progress, inv] = await Promise.all([
    getProfileProgress(user._id),
    CosmeticInventory.findOne({ userId: user._id }).lean(),
  ]);

  const unlockedCosmetics = (inv?.unlockedItemIds || []).slice(0, 100);

  return {
    savvyCoreVersion: SAVVY_CORE_VERSION,
    enabled: isSavvyCoreEnabled(),
    user: {
      userId: String(user._id),
      username: user.username,
      firstName: user.firstName,
      email: user.email ? `${String(user.email).slice(0, 2)}***` : null,
    },
    wallet: {
      balance: resolveSavvyBalance(user),
      lifetimeEarned: Math.round(Number(user.lifetimePointsEarned) || 0),
    },
    progression: {
      accountLevel: progress.profileLevel,
      prestige: progress.prestige,
      currentXP: progress.profileXp,
      xpToNext: progress.xpToNext,
      rankName: progress.rankName,
      rankColor: progress.rankColor,
    },
    cosmetics: {
      unlockedCount: unlockedCosmetics.length,
      equipped: user.equippedCosmetics || {},
      globalUnlocksSample: unlockedCosmetics.filter((id) => id.includes('savvy_core') || id.includes('universe')),
    },
    registeredApps: listRegisteredApps().filter((a) => a.production).map((a) => a.appId),
  };
}

module.exports = { getSavvyCoreMe };
