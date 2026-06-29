/**
 * Battle Pass beta — manual tier reward claiming + admin testing tools.
 *
 * Rewards route into the live Final10 ecosystem:
 *  - savvy        -> Savvy balance (savvyRewardService)
 *  - egg          -> perkMachine.eggInventory[tier]
 *  - free_spin    -> perkMachine.extraFreeSpins
 *  - streak_shield-> dailyStreak.scoutShields
 *  - token        -> perkMachine.tokens[tokenKey]
 *  - calling_card -> cosmetic inventory (+ perkMachine.callingCardDrops)
 *  - cosmetic     -> cosmetic inventory
 *  - mythic_chance-> chance-based mythic egg, legendary consolation (never guaranteed)
 *
 * Claim state uses the `tier2:{track}:{level}` key namespace so legacy auto-claim
 * (`tier:`) keys do not block the new beta rewards, while XP/progress is preserved.
 */

const User = require('../models/User');
const BattlePassProgress = require('../models/BattlePassProgress');
const CosmeticInventory = require('../models/CosmeticInventory');
const {
  BATTLE_PASS_TIERS,
  BATTLE_PASS_CUMULATIVE_XP,
  computeTierFromXp,
  tierClaimKeyV2,
} = require('../lib/battlePassConfig');
const {
  ensureProgressDocuments,
  buildProgressionPayload,
  reconcileBattlePassPremiumFromEntitlement,
} = require('./battlePassPersistenceService');
const { ensurePerkMachineDoc, getPerkMachineStatus } = require('./perkMachineService');
const { grantSavvyReward } = require('./savvyRewardService');

class ClaimError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getTierDef(level) {
  return BATTLE_PASS_TIERS.find((t) => t.level === Number(level)) || null;
}

function addUnlocks(inventory, ids) {
  const set = new Set(inventory.unlockedItemIds || []);
  const newSet = new Set(inventory.newItemIds || []);
  for (const id of ids) {
    if (id) {
      set.add(id);
      newSet.add(id);
    }
  }
  inventory.unlockedItemIds = [...set];
  inventory.newItemIds = [...newSet];
}

function userHasPremiumTrack(user, bp) {
  if (bp && bp.premiumUnlocked) return true;
  const tiers = [user.membershipTier, user.premiumTier].map((t) => String(t || '').toLowerCase());
  if (tiers.some((t) => t === 'premium' || t === 'pro')) return true;
  if (user.isPremium) return true;
  if (user.foundingTesterAccess || user.betaTester || user.foundingAccess) return true;
  return false;
}

/**
 * Applies a single tier reward to the right inventory field.
 * Mutates `user` and `inventory`. Returns a grant detail object for the popup.
 */
async function applyClaimReward(user, inventory, reward, idemKey) {
  switch (reward.type) {
    case 'savvy': {
      const amount = Math.max(0, Number(reward.amount) || 0);
      const result = await grantSavvyReward(user, {
        rewardType: 'battle_pass',
        amount,
        idempotencyKey: `battle_pass:${user._id}:${idemKey}`,
        note: `Battle Pass — ${reward.label}`,
        meta: { source: 'battle_pass', claimKey: idemKey },
      });
      return { kind: 'savvy', savvyGranted: result.amount, newBalance: result.newBalance };
    }
    case 'egg': {
      const pm = ensurePerkMachineDoc(user);
      const tier = reward.eggTier;
      if (tier === 'extraFreeSpin') {
        pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin || 0) + 1;
        pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
      } else if (tier && pm.eggInventory[tier] != null) {
        pm.eggInventory[tier] = Number(pm.eggInventory[tier] || 0) + 1;
      }
      user.markModified('perkMachine');
      return { kind: 'egg', eggTier: tier };
    }
    case 'free_spin': {
      const pm = ensurePerkMachineDoc(user);
      pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
      user.markModified('perkMachine');
      return { kind: 'free_spin', freeSpins: 1 };
    }
    case 'streak_shield': {
      const count = Math.max(1, Number(reward.count) || 1);
      if (!user.dailyStreak) user.dailyStreak = {};
      user.dailyStreak.scoutShields = Number(user.dailyStreak.scoutShields || 0) + count;
      user.markModified('dailyStreak');
      return { kind: 'streak_shield', shields: count };
    }
    case 'token': {
      const pm = ensurePerkMachineDoc(user);
      const key = reward.tokenKey;
      const count = Math.max(1, Number(reward.count) || 1);
      if (key && pm.tokens && pm.tokens[key] != null) {
        pm.tokens[key] = Number(pm.tokens[key] || 0) + count;
      } else if (key) {
        pm.tokens[key] = count;
      }
      user.markModified('perkMachine');
      return { kind: 'token', tokenKey: key, count };
    }
    case 'calling_card': {
      const pm = ensurePerkMachineDoc(user);
      pm.callingCardDrops = Number(pm.callingCardDrops || 0) + 1;
      user.markModified('perkMachine');
      if (reward.cosmeticId) addUnlocks(inventory, [reward.cosmeticId]);
      return { kind: 'calling_card', cosmeticId: reward.cosmeticId || null };
    }
    case 'cosmetic': {
      if (reward.cosmeticId) addUnlocks(inventory, [reward.cosmeticId]);
      return { kind: 'cosmetic', cosmeticType: reward.cosmeticType || null, cosmeticId: reward.cosmeticId || null };
    }
    case 'mythic_chance': {
      const pm = ensurePerkMachineDoc(user);
      const chance = Number(reward.chance) || 0.15;
      const won = Math.random() < chance;
      const tier = won ? 'mythic' : (reward.consolationEggTier || 'legendary');
      if (pm.eggInventory[tier] != null) {
        pm.eggInventory[tier] = Number(pm.eggInventory[tier] || 0) + 1;
      }
      user.markModified('perkMachine');
      return { kind: 'mythic_chance', eggTier: tier, mythicWon: won };
    }
    default:
      return { kind: 'unknown' };
  }
}

/**
 * Claim a single tier reward for a track.
 * @param {string} userId
 * @param {{ level: number|string, track: 'free'|'premium' }} args
 * @param {{ bypassUnlock?: boolean, bypassPremium?: boolean }} [opts]
 */
async function claimTierReward(userId, args, opts = {}) {
  const level = Number(args?.level);
  const track = String(args?.track || '').toLowerCase();
  if (!Number.isInteger(level) || level < 1) {
    throw new ClaimError(400, 'INVALID_TIER', 'Invalid tier level');
  }
  if (track !== 'free' && track !== 'premium') {
    throw new ClaimError(400, 'INVALID_TRACK', 'Track must be "free" or "premium"');
  }
  const tierDef = getTierDef(level);
  if (!tierDef) {
    throw new ClaimError(400, 'INVALID_TIER', `Tier ${level} does not exist`);
  }
  const reward = tierDef[track];
  if (!reward) {
    throw new ClaimError(400, 'INVALID_REWARD', 'No reward defined for this track/tier');
  }

  const user = await User.findById(userId);
  if (!user) throw new ClaimError(404, 'USER_NOT_FOUND', 'User not found');

  if (track === 'premium' && !opts.bypassPremium) {
    try {
      await reconcileBattlePassPremiumFromEntitlement(userId);
    } catch {
      /* non-fatal: fall back to membership check */
    }
  }

  const { bp, inv } = await ensureProgressDocuments(userId);

  const unlockedTier = computeTierFromXp(bp.xp || 0);
  if (!opts.bypassUnlock && unlockedTier < level) {
    throw new ClaimError(423, 'TIER_LOCKED', `Reach tier ${level} to claim this reward`);
  }

  if (track === 'premium' && !opts.bypassPremium && !userHasPremiumTrack(user, bp)) {
    throw new ClaimError(402, 'PREMIUM_LOCKED', 'Unlock Premium to claim this reward');
  }

  const claimKey = tierClaimKeyV2(track, level);

  const bpLocked = await BattlePassProgress.findOneAndUpdate(
    {
      _id: bp._id,
      claimedRewardIds: { $ne: claimKey },
    },
    { $addToSet: { claimedRewardIds: claimKey } },
    { new: true }
  );

  if (!bpLocked) {
    throw new ClaimError(409, 'ALREADY_CLAIMED', 'Reward already claimed');
  }

  const grant = await applyClaimReward(user, inv, reward, claimKey);

  bpLocked.tier = computeTierFromXp(bpLocked.xp || 0);
  Object.assign(bp, bpLocked.toObject ? bpLocked.toObject() : bpLocked);

  await user.save();
  await inv.save();
  await bp.save();

  const state = await buildProgressionPayload(userId);
  return {
    ok: true,
    level,
    track,
    claimKey,
    reward: { ...reward },
    grant,
    savvyBalance: Number(user.savvyPoints) || 0,
    perkMachine: getPerkMachineStatus(user),
    state,
  };
}

/* ----------------------------- Admin testing ----------------------------- */

async function adminSetTier(userId, level) {
  const lv = Math.max(0, Math.min(Number(level) || 0, BATTLE_PASS_TIERS.length));
  const { bp } = await ensureProgressDocuments(userId);
  bp.xp = lv === 0 ? 0 : BATTLE_PASS_CUMULATIVE_XP[lv - 1];
  bp.tier = computeTierFromXp(bp.xp || 0);
  await bp.save();
  return buildProgressionPayload(userId);
}

async function adminGrantXp(userId, amount = 1000) {
  const add = Math.max(0, Number(amount) || 0);
  const { bp } = await ensureProgressDocuments(userId);
  bp.xp = Number(bp.xp || 0) + add;
  bp.tier = computeTierFromXp(bp.xp || 0);
  await bp.save();
  return buildProgressionPayload(userId);
}

async function adminResetClaims(userId) {
  const { bp } = await ensureProgressDocuments(userId);
  bp.claimedRewardIds = (bp.claimedRewardIds || []).filter(
    (id) => !/^tier2?:(free|premium):\d+$/.test(String(id))
  );
  await bp.save();
  return buildProgressionPayload(userId);
}

async function adminForceClaimTier(userId, level) {
  const results = [];
  for (const track of ['free', 'premium']) {
    try {
      const out = await claimTierReward(userId, { level, track }, { bypassUnlock: true, bypassPremium: true });
      results.push({ track, ok: true, grant: out.grant });
    } catch (err) {
      results.push({ track, ok: false, code: err.code || 'ERROR', message: err.message });
    }
  }
  const state = await buildProgressionPayload(userId);
  return { ok: true, level: Number(level), results, state };
}

module.exports = {
  ClaimError,
  claimTierReward,
  adminSetTier,
  adminGrantXp,
  adminResetClaims,
  adminForceClaimTier,
  userHasPremiumTrack,
};
