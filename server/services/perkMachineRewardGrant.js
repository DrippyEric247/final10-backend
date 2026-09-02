/**
 * Perk Machine reward grant handlers — validate payloads before every write.
 */
const crypto = require('crypto');
const SupplyDrop = require('../models/SupplyDrop');
const { validateSpinRewardConfig } = require('../config/perkMachineRewards');
const {
  PERK_MACHINE_SAVVY_REWARD_TYPE,
  PERK_MACHINE_CALLING_CARD_DUPLICATE,
  PERK_MACHINE_SUPPLY_DROP_SOURCE,
  PERK_MACHINE_EGG_SOURCE,
  PERK_MACHINE_EGG_HATCH_SOURCE,
  PERK_MACHINE_COSMETIC_SOURCE,
  SUPPLY_DROP_SOURCES,
} = require('../config/perkMachineSources');
const { PERK_CALLING_CARD_DUPLICATE_SAVVY, pickPerkCallingCard } = require('../config/perkCallingCards');
const { MULTIPLIER_TYPE } = require('./perkMachineMultiplier');
const { ensureEventInventory } = require('./scoutFlightTicketService');

/** Lazy resolve — avoids circular-dep undefined binding from top-level destructuring. */
function requireGrantSavvyReward() {
  const { grantSavvyReward } = require('./savvyRewardService');
  if (typeof grantSavvyReward !== 'function') {
    throw new TypeError('grantSavvyReward is not a function');
  }
  return grantSavvyReward;
}

function requireCreateSupplyDrop() {
  const { createSupplyDrop } = require('./supplyDropService');
  if (typeof createSupplyDrop !== 'function') {
    throw new TypeError('createSupplyDrop is not a function');
  }
  return createSupplyDrop;
}

function requireGrantSystemCosmeticUnlock() {
  const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
  if (typeof grantSystemCosmeticUnlock !== 'function') {
    throw new TypeError('grantSystemCosmeticUnlock is not a function');
  }
  return grantSystemCosmeticUnlock;
}

const GRANT_HANDLERS = Object.freeze({
  savvy: 'grantSavvyReward',
  egg: 'perkMachine.eggInventory',
  token: 'perkMachine.tokens',
  streak_shield: 'user.dailyStreak.scoutShields',
  calling_card: 'cosmeticInventoryService.grantSystemCosmeticUnlock',
  multiplier_2x: 'noop',
  scout_flight_ticket: 'eventInventory.scoutFlightTicket',
  supply_drop: 'supplyDropService.createSupplyDrop',
  scout_upgrade: 'perkMachine.scoutUpgrades',
  guaranteed_multiplier: 'perkMachine.nextSpinGuaranteedMultiplier',
  permanent_multiplier: 'user.powerMultiplierBonus',
  timed_savvy_multiplier: 'savvyMultiplierService.activateMythicSavvyMultiplier',
  timed_event_token: 'perkMachine.timedEventTokens',
  faster_alert_perk: 'alertTimingService.grantFasterAlertPerk',
  supply_drop_token: 'perkMachine.tokens.maxSupplyDrop',
  supply_drop_double: 'perkMachine.tokens.maxSupplyDrop',
  spin_token_2slot: 'perkMachine.tokens.paid2Spin',
  bp_tier_skip: 'perkMachine.tokens.battlePassTierSkip',
  bp_tier_skip_bulk: 'battlePassSkipService.applyBattlePassTierSkip',
  login_streak_advance: 'dailyStreakService.advanceLoginStreakProgress',
  free_perk_spin_hour: 'perkMachine.freePerkSpinUntil',
  egg_haul: 'eggHaulService.grantEggHaul',
  easter_challenge_activator: 'easterChallengeService.activateEasterChallenge',
});

function sanitizeRewardForGrantLog(rewardDef) {
  if (!rewardDef || typeof rewardDef !== 'object') {
    return { rewardId: null, rewardType: null };
  }
  const metadataKeys = [];
  if (rewardDef.eggTier) metadataKeys.push('eggTier');
  if (rewardDef.tokenKey) metadataKeys.push('tokenKey');
  if (rewardDef.eventKind) metadataKeys.push('eventKind');
  if (rewardDef.multiplierValue != null) metadataKeys.push('multiplierValue');
  if (rewardDef.durationMs != null) metadataKeys.push('durationMs');
  if (rewardDef.permanentBonus != null) metadataKeys.push('permanentBonus');
  if (rewardDef.spinMultiplier != null) metadataKeys.push('spinMultiplier');
  if (rewardDef.nukeMultiplier != null) metadataKeys.push('nukeMultiplier');
  return {
    rewardId: rewardDef.id || null,
    rewardCode: rewardDef.id || null,
    rewardType: rewardDef.type || null,
    rarity: rewardDef.rarity || null,
    amount: rewardDef.amount ?? rewardDef.baseAmount ?? null,
    quantity: rewardDef.quantity ?? null,
    duration: rewardDef.durationMs ?? null,
    metadataKeys,
  };
}

function resolveGrantHandler(rewardType) {
  return GRANT_HANDLERS[String(rewardType || '')] || null;
}

function assertSupplyDropSourceAllowed() {
  if (!SUPPLY_DROP_SOURCES.includes(PERK_MACHINE_SUPPLY_DROP_SOURCE)) {
    const err = new Error(
      'Supply Drop source perk_machine is not registered in SUPPLY_DROP_SOURCES'
    );
    err.code = 'REWARD_CONFIG_UNAVAILABLE';
    err.status = 500;
    err.model = 'SupplyDrop';
    err.field = 'source';
    err.value = PERK_MACHINE_SUPPLY_DROP_SOURCE;
    err.allowedValues = [...SUPPLY_DROP_SOURCES];
    throw err;
  }

  const schemaSources =
    SupplyDrop.schema.path('source')?.enumValues ||
    SupplyDrop.schema.path('source')?.options?.enum ||
    [];
  if (!schemaSources.includes(PERK_MACHINE_SUPPLY_DROP_SOURCE)) {
    const err = new Error(
      `SupplyDrop schema missing source enum value: ${PERK_MACHINE_SUPPLY_DROP_SOURCE}`
    );
    err.name = 'ValidationError';
    err.code = 'REWARD_CONFIG_UNAVAILABLE';
    err.status = 500;
    err.model = 'SupplyDrop';
    err.field = 'source';
    err.value = PERK_MACHINE_SUPPLY_DROP_SOURCE;
    err.allowedValues = schemaSources;
    throw err;
  }
}

async function validateSupplyDropGrantPayload({ userId, source }) {
  assertSupplyDropSourceAllowed();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const doc = new SupplyDrop({
    dropId: crypto.randomUUID(),
    scope: 'user',
    userId,
    source,
    rewardDef: { id: 'validation_probe', type: 'savvy', amount: 1 },
    expiresAt,
    active: true,
    claims: [],
  });
  await doc.validate();
  return doc;
}

function enrichGrantError(err, rewardDef, handler) {
  if (!err) return err;
  err.rewardId = err.rewardId || rewardDef?.id || null;
  err.rewardType = err.rewardType || rewardDef?.type || null;
  err.grantHandler = err.grantHandler || handler || resolveGrantHandler(rewardDef?.type);
  if (err.name === 'ValidationError' && err.errors?.source) {
    err.model = 'SupplyDrop';
    err.field = 'source';
    err.value = err.errors.source.value;
    err.allowedValues =
      err.errors.source.properties?.enumValues ||
      SupplyDrop.schema.path('source')?.enumValues ||
      [];
  }
  return err;
}

function validateRewardBeforeGrant(rewardDef) {
  const validation = validateSpinRewardConfig(rewardDef);
  if (!validation.valid) {
    const err = new Error(validation.message || 'Invalid reward configuration');
    err.status = 500;
    err.code = validation.code || 'INVALID_REWARD_CONFIG';
    err.rewardId = validation.rewardId || rewardDef?.id || null;
    err.rewardType = rewardDef?.type || null;
    throw err;
  }

  if (rewardDef.type === 'savvy') {
    const amount = Number(rewardDef.amount ?? rewardDef.baseAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const err = new Error(`Savvy reward ${rewardDef.id} has invalid grant amount`);
      err.status = 500;
      err.code = 'INVALID_REWARD_CONFIG';
      err.rewardId = rewardDef.id;
      err.rewardType = rewardDef.type;
      err.field = 'amount';
      err.value = rewardDef.amount;
      throw err;
    }
  }

  if (rewardDef.type === 'supply_drop') {
    assertSupplyDropSourceAllowed();
  }

  const handler = resolveGrantHandler(rewardDef.type);
  if (!handler) {
    const err = new Error(`No grant handler for reward type: ${rewardDef.type}`);
    err.status = 500;
    err.code = 'INVALID_REWARD_CONFIG';
    err.rewardId = rewardDef.id;
    err.rewardType = rewardDef.type;
    throw err;
  }

  return { handler };
}

async function grantPerkMachineSavvy(user, rewardDef, spinId) {
  const baseAmount = Number(rewardDef.baseAmount ?? rewardDef.amount) || 0;
  const spinMult = Number(rewardDef.spinMultiplier) || 1;
  const scaledBase = Number(rewardDef.amount) || baseAmount;
  if (!Number.isFinite(scaledBase) || scaledBase <= 0) {
    const err = new Error(`Savvy reward ${rewardDef.id} has non-grantable amount`);
    err.status = 500;
    err.code = 'INVALID_REWARD_CONFIG';
    err.field = 'amount';
    err.value = scaledBase;
    throw err;
  }

  const result = await requireGrantSavvyReward()(user, {
    rewardType: PERK_MACHINE_SAVVY_REWARD_TYPE,
    amount: scaledBase,
    baseAmount: scaledBase,
    idempotencyKey: `perk_machine:${user._id}:${spinId}:${rewardDef.id}:${scaledBase}:${spinMult}`,
    note: `Perk Machine — ${rewardDef.label}${spinMult > 1 ? ` (${spinMult}× spin)` : ''}`,
    meta: { spinId, source: PERK_MACHINE_SAVVY_REWARD_TYPE, spinMultiplier: spinMult },
  });

  return {
    savvyGranted: result.amount,
    savvyBoosted: false,
    spinMultiplierApplied: spinMult > 1 ? spinMult : null,
    newBalance: result.newBalance,
    rewardClass: result.rewardClass,
    multiplierEligible: result.multiplierEligible,
    baseAmount: rewardDef.baseAmount != null ? rewardDef.baseAmount : undefined,
    baseLabel:
      rewardDef.baseAmount != null
        ? rewardDef.baseLabel || `+${rewardDef.baseAmount} Savvy`
        : undefined,
  };
}

async function grantPerkMachineSupplyDrop(user) {
  assertSupplyDropSourceAllowed();
  await validateSupplyDropGrantPayload({
    userId: user._id,
    source: PERK_MACHINE_SUPPLY_DROP_SOURCE,
  });
  const drop = await requireCreateSupplyDrop()({
    scope: 'user',
    userId: user._id,
    source: PERK_MACHINE_SUPPLY_DROP_SOURCE,
  });
  return {
    supplyDropId: drop.dropId,
    supplyDrop: drop,
    supplyDropLabel: drop.rewardPreview?.label || drop.rewardLabel || 'Supply Drop',
  };
}

async function grantPerkMachineCallingCard(user, spinId, qty = 1) {
  const pm = user.perkMachine;
  pm.callingCardDrops = Number(pm.callingCardDrops) + qty;
  if (!Array.isArray(user.badges)) user.badges = [];
  if (!user.badges.includes('perk_calling_card')) {
    user.badges.push('perk_calling_card');
  }

  const card = pickPerkCallingCard();
  const granted = {
    label: 'Calling Card Drop',
    callingCardId: card.id,
    callingCardName: card.name,
    callingCardTagline: card.tagline,
    callingCardRarity: card.rarity,
  };

  let newlyUnlocked = false;
  try {
    newlyUnlocked = await requireGrantSystemCosmeticUnlock()(
      user._id,
      card.id,
      PERK_MACHINE_COSMETIC_SOURCE
    );
  } catch (_err) {
    newlyUnlocked = false;
  }

  if (newlyUnlocked) {
    granted.callingCardDuplicate = false;
    return granted;
  }

  granted.callingCardDuplicate = true;
  const dupResult = await requireGrantSavvyReward()(user, {
    rewardType: PERK_MACHINE_SAVVY_REWARD_TYPE,
    amount: PERK_CALLING_CARD_DUPLICATE_SAVVY,
    baseAmount: PERK_CALLING_CARD_DUPLICATE_SAVVY,
    multiplier: 1,
    idempotencyKey: `perk_card_dupe:${spinId}:${card.id}`,
    note: `Perk Machine — duplicate ${card.name} converted to Savvy`,
    meta: {
      spinId,
      source: PERK_MACHINE_CALLING_CARD_DUPLICATE,
      cardId: card.id,
    },
  });
  granted.duplicateSavvy = dupResult.amount;
  granted.savvyGranted = Number(dupResult.amount || 0);
  granted.newBalance = dupResult.newBalance;
  return granted;
}

/**
 * Grant a Perk Machine reward after validation.
 * @param {import('../models/User')} user
 * @param {object} rewardDef
 * @param {string} spinId
 * @param {import('../models/User')} pm - ensured perkMachine doc
 */
async function executePerkMachineRewardGrant(user, rewardDef, spinId, pm) {
  const qty = Math.max(1, Number(rewardDef.quantity) || 1);
  const handler = resolveGrantHandler(rewardDef.type);

  if (rewardDef.type === MULTIPLIER_TYPE) {
    return { multiplierRole: true, handler };
  }

  if (rewardDef.type === 'savvy') {
    return grantPerkMachineSavvy(user, rewardDef, spinId);
  }

  if (rewardDef.type === 'egg') {
    const tier = rewardDef.eggTier;
    if (tier === 'extraFreeSpin') {
      pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin) + qty;
    } else if (tier && pm.eggInventory[tier] != null) {
      pm.eggInventory[tier] = Number(pm.eggInventory[tier]) + qty;
    }
    const out = { eggsGranted: qty };
    if (qty > 1) out.spinMultiplierApplied = qty;
    try {
      const { isHatchableEggTier } = require('../config/eggCamoCollection');
      if (isHatchableEggTier(tier)) {
        const eggSource = String(spinId || '').startsWith('hatch:')
          ? PERK_MACHINE_EGG_HATCH_SOURCE
          : PERK_MACHINE_EGG_SOURCE;
        const { recordLegitimateEggAcquisition } = require('./eggCamoProgressService');
        await recordLegitimateEggAcquisition(user, {
          tier,
          quantity: qty,
          source: eggSource,
          skipSave: true,
        });
      }
    } catch (err) {
      console.error('[egg-camo] perk machine grant tracking failed', err?.message || err);
    }
    return out;
  }

  if (rewardDef.type === 'token' && rewardDef.tokenKey) {
    pm.tokens[rewardDef.tokenKey] = Number(pm.tokens[rewardDef.tokenKey] || 0) + qty;
    const out = {};
    if (qty > 1) out.spinMultiplierApplied = qty;
    return out;
  }

  if (rewardDef.type === 'streak_shield') {
    if (!user.dailyStreak) user.dailyStreak = {};
    user.dailyStreak.scoutShields = Number(user.dailyStreak.scoutShields || 0) + qty;
    const out = {};
    if (qty > 1) out.spinMultiplierApplied = qty;
    return out;
  }

  if (rewardDef.type === 'calling_card') {
    const out = await grantPerkMachineCallingCard(user, spinId, qty);
    if (qty > 1) out.spinMultiplierApplied = qty;
    return out;
  }

  if (rewardDef.type === 'scout_upgrade') {
    pm.scoutUpgrades = Number(pm.scoutUpgrades || 0) + 1;
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes('savvy_scout_upgrade')) {
      user.badges.push('savvy_scout_upgrade');
    }
    return {};
  }

  if (rewardDef.type === 'scout_flight_ticket') {
    const inv = ensureEventInventory(user);
    inv.scoutFlightTicket = Number(inv.scoutFlightTicket) + qty;
    user.markModified('eventInventory');
    const out = { ticketsGranted: qty };
    if (qty > 1) out.spinMultiplierApplied = qty;
    return out;
  }

  if (rewardDef.type === 'guaranteed_multiplier') {
    const value = Math.max(2, Number(rewardDef.multiplierValue) || 2);
    pm.nextSpinGuaranteedMultiplier = value;
    return { guaranteedMultiplier: value };
  }

  if (rewardDef.type === 'permanent_multiplier') {
    const bonus = Number(rewardDef.permanentBonus) || 0;
    user.powerMultiplierBonus =
      Math.round(((Number(user.powerMultiplierBonus) || 0) + bonus) * 100) / 100;
    return {
      permanentBonus: bonus,
      powerMultiplierBonus: user.powerMultiplierBonus,
    };
  }

  if (rewardDef.type === 'timed_savvy_multiplier') {
    const { activateMythicSavvyMultiplier } = require('./savvyMultiplierService');
    const durationMs = Number(rewardDef.durationMs) || 5 * 60 * 60 * 1000;
    const multiplier = Math.max(1, Number(rewardDef.multiplierValue) || 3);
    const boost = activateMythicSavvyMultiplier(user, { durationMs, multiplier });
    user.markModified('savvyEarningBoosts');
    return {
      savvyEarningsMultiplier: multiplier,
      savvyEarningsExpiresAt: boost.expiresAt,
    };
  }

  if (rewardDef.type === 'timed_event_token') {
    const token = {
      id: crypto.randomUUID(),
      kind: rewardDef.eventKind,
      label: rewardDef.label,
      icon: rewardDef.icon || (rewardDef.eventKind === 'savvySale' ? '🏷️' : '⚡'),
      durationMs: Number(rewardDef.durationMs) || 0,
      acquiredAt: new Date(),
    };
    pm.timedEventTokens.push(token);
    return {
      timedTokenId: token.id,
      eventKind: token.kind,
      durationMs: token.durationMs,
    };
  }

  if (rewardDef.type === 'faster_alert_perk') {
    const { grantFasterAlertPerk } = require('./alertTimingService');
    const { FASTER_ALERT_PERK } = require('../config/alertSpeedConfig');
    const durationMs = Number(rewardDef.durationMs) || FASTER_ALERT_PERK.defaultDurationMs;
    const perkSource = String(spinId || '').startsWith('hatch:')
      ? PERK_MACHINE_EGG_HATCH_SOURCE
      : PERK_MACHINE_EGG_SOURCE;
    const perkResult = await grantFasterAlertPerk(user._id, durationMs, perkSource, {
      idempotencyKey: `faster_alert:${user._id}:${spinId}:${rewardDef.id}`,
    });
    return {
      fasterAlertPerk: true,
      fasterAlertExpiresAt: perkResult.expiresAt,
      fasterAlertIdempotent: Boolean(perkResult.idempotent),
    };
  }

  if (rewardDef.type === 'supply_drop_token') {
    pm.tokens.maxSupplyDrop = Number(pm.tokens.maxSupplyDrop || 0) + qty;
    return { supplyDropTokensGranted: qty };
  }

  if (rewardDef.type === 'supply_drop_double') {
    pm.tokens.maxSupplyDrop = Number(pm.tokens.maxSupplyDrop || 0) + 1;
    pm.nextSupplyDropDouble = true;
    return { supplyDropTokensGranted: 1, nextSupplyDropDouble: true };
  }

  if (rewardDef.type === 'spin_token_2slot') {
    pm.tokens.paid2Spin = Number(pm.tokens.paid2Spin || 0) + qty;
    return { spinTokensGranted: qty };
  }

  if (rewardDef.type === 'bp_tier_skip') {
    pm.tokens.battlePassTierSkip = Number(pm.tokens.battlePassTierSkip || 0) + qty;
    return { tierSkipsGranted: qty };
  }

  if (rewardDef.type === 'bp_tier_skip_bulk') {
    const tiers = Math.max(1, Number(rewardDef.tiers) || Number(rewardDef.quantity) || 1);
    const { applyBattlePassTierSkip } = require('./battlePassSkipService');
    const skipResult = await applyBattlePassTierSkip(user, tiers, {
      idempotencyKey: `bp_skip_bulk:${user._id}:${spinId}`,
      source: rewardDef.id || 'mythic_bp_skip_20',
    });
    const out = {
      tierSkipsGranted: skipResult.tiersApplied || 0,
      battlePassSkip: skipResult,
    };
    if (skipResult.converted) {
      out.savvyGranted = skipResult.savvyGranted || 0;
      out.label = 'Battle Pass Complete — +2,000 Savvy';
      out.convertedFromBpSkip = true;
    }
    return out;
  }

  if (rewardDef.type === 'login_streak_advance') {
    const advanceDays = Math.max(1, Number(rewardDef.days) || 1);
    const { advanceLoginStreakProgress } = require('./dailyStreakService');
    const advance = await advanceLoginStreakProgress(user, advanceDays, {
      idempotencyKey: `login_skip:${user._id}:${spinId}`,
      source: rewardDef.id || 'login_streak_skip',
    });
    const out = { loginStreakAdvance: advance, daysAdvanced: advanceDays };
    if (advance.savvyGranted) {
      out.savvyGranted = advance.savvyGranted;
    }
    return out;
  }

  if (rewardDef.type === 'free_perk_spin_hour') {
    const durationMs = Number(rewardDef.durationMs) || 60 * 60 * 1000;
    const now = Date.now();
    const currentUntil = pm.freePerkSpinUntil ? new Date(pm.freePerkSpinUntil).getTime() : 0;
    const base = currentUntil > now ? currentUntil : now;
    pm.freePerkSpinUntil = new Date(base + durationMs);
    return {
      freePerkSpinUntil: pm.freePerkSpinUntil,
      freePerkSpinHour: true,
    };
  }

  if (rewardDef.type === 'egg_haul') {
    const { grantEggHaul } = require('./eggHaulService');
    const haul = await grantEggHaul(user, `egg_haul:${user._id}:${spinId}`);
    return { eggHaul: haul, totalEggsGranted: haul.totalEggs || 0 };
  }

  if (rewardDef.type === 'easter_challenge_activator') {
    const { activateEasterChallenge } = require('./easterChallengeService');
    const challengeId = rewardDef.challengeId || 'wave3_placeholder';
    const activation = await activateEasterChallenge(user, challengeId, {
      idempotencyKey: `easter_activate:${user._id}:${spinId}`,
      adminBypass: Boolean(rewardDef.adminBypass),
    });
    const out = { easterChallenge: activation };
    if (activation.fallbackRequired && activation.slotOccupied) {
      const { REWARD_CLASS } = require('../config/savvyRewardPolicy');
      const fallback = await requireGrantSavvyReward()(user, {
        rewardType: 'easter_challenge',
        amount: 5000,
        baseAmount: 5000,
        idempotencyKey: `easter_fallback:${user._id}:${spinId}`,
        note: 'Easter challenge slot occupied — Savvy fallback',
        meta: {
          rewardClass: REWARD_CLASS.FIXED,
          multiplierEligible: false,
          fallbackReason: 'slot_occupied',
          activeChallengeId: activation.activeChallengeId,
        },
      });
      out.easterChallengeFallback = true;
      out.savvyGranted = fallback.amount || 0;
      out.label = 'Challenge Slot Occupied — +5,000 Savvy';
    }
    return out;
  }

  if (rewardDef.type === 'supply_drop') {
    return grantPerkMachineSupplyDrop(user);
  }

  const err = new Error(`Unhandled Perk Machine reward type: ${rewardDef.type}`);
  err.status = 500;
  err.code = 'INVALID_REWARD_CONFIG';
  err.rewardId = rewardDef.id;
  err.rewardType = rewardDef.type;
  err.grantHandler = handler;
  throw err;
}

module.exports = {
  GRANT_HANDLERS,
  sanitizeRewardForGrantLog,
  resolveGrantHandler,
  validateRewardBeforeGrant,
  validateSupplyDropGrantPayload,
  assertSupplyDropSourceAllowed,
  executePerkMachineRewardGrant,
  enrichGrantError,
  requireGrantSavvyReward,
  requireCreateSupplyDrop,
  requireGrantSystemCosmeticUnlock,
};
