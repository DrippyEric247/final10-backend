/**
 * Savvy Perk Machine V1 — server-authoritative spins, rewards, inventory.
 */

const crypto = require('crypto');
const { utcDayKey } = require('../config/savvyRewards');
const { normalizeTier } = require('../config/subscriptionPlans');
const { grantSavvyReward, spendSavvyReward } = require('./savvyRewardService');
const {
  getSavvyMultiplier,
  serializeActiveBoosts,
  serializeTimedEventTokens,
  serializePersonalEvents,
  isPersonalEventActive,
} = require('./perkBoostService');
const { applySavvySaleDiscountPercent } = require('../config/savvySaleConfig');
const { buildEggHatchPool } = require('../config/eggHatchRewards');
const { getActiveSavvySale, resolveSavvySaleSpinPricing } = require('./savvySaleService');
const {
  acquirePerkSpinLock,
  releasePerkSpinLock,
  claimFreeSpinSlot,
  assertSpinCooldown,
  SpinLockError,
} = require('./perkSpinLockService');
const {
  SPIN_MODES,
  SPIN_COOLDOWN_MS,
  HATCH_COOLDOWN_MS,
  MAX_HISTORY,
  getSpinConfig,
  buildWeightedPool,
  HATCHABLE_EGG_TIERS,
  pickWeightedReward,
  pickResultMessage,
  emptyEggInventory,
} = require('../config/perkMachineRewards');
const {
  computeSpinMultiplier,
  countMultiplierTiles,
  scaleRewardForMultiplier,
  buildMultiplierBreakdown,
  MULTIPLIER_TYPE,
} = require('./perkMachineMultiplier');
const { createSupplyDrop } = require('./supplyDropService');
const {
  buildTournamentTicketProgress,
  recordSpinForTournamentTicket,
  ensureEventInventory,
} = require('./scoutFlightTicketService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const {
  PERK_CALLING_CARD_DUPLICATE_SAVVY,
  pickPerkCallingCard,
} = require('../config/perkCallingCards');
const {
  maybeResetSpinHeat,
  getSpinHeatState,
  formatSpinHeatForClient,
  advanceSpinHeat,
} = require('./spinHeatService');
const { applySpinHeatToBaseCost } = require('../config/spinHeatConfig');
const {
  maybeExpireNukeEvent,
  captureNukeEligibility,
  applyNukeMultiplierToReward,
  recordQualifyingNukeSpin,
  recordNukeSpinStats,
  formatNukeForClient,
  ensureNukeDoc,
} = require('./perkMachineNukeService');

function ensurePerkMachineDoc(user) {
  if (!user.perkMachine || typeof user.perkMachine !== 'object') {
    user.perkMachine = {};
  }
  const pm = user.perkMachine;
  if (!pm.eggInventory) pm.eggInventory = emptyEggInventory();
  if (!Array.isArray(pm.spinHistory)) pm.spinHistory = [];
  if (typeof pm.extraFreeSpins !== 'number') pm.extraFreeSpins = 0;
  if (!pm.tokens || typeof pm.tokens !== 'object') {
    pm.tokens = { battlePassXp15: 0, savvyLevelXp15: 0, savvyMultiplier15: 0, paid3Spin: 0 };
  }
  if (typeof pm.tokens.paid3Spin !== 'number') pm.tokens.paid3Spin = 0;
  if (typeof pm.tokens.paid2Spin !== 'number') pm.tokens.paid2Spin = 0;
  if (typeof pm.tokens.maxSupplyDrop !== 'number') pm.tokens.maxSupplyDrop = 0;
  if (typeof pm.tokens.battlePassTierSkip !== 'number') pm.tokens.battlePassTierSkip = 0;
  if (typeof pm.callingCardDrops !== 'number') pm.callingCardDrops = 0;
  if (typeof pm.scoutUpgrades !== 'number') pm.scoutUpgrades = 0;
  if (typeof pm.ticketSpinProgress !== 'number') pm.ticketSpinProgress = 0;
  if (typeof pm.nextSpinGuaranteedMultiplier !== 'number') pm.nextSpinGuaranteedMultiplier = 0;
  if (typeof pm.nextSupplyDropDouble !== 'boolean') pm.nextSupplyDropDouble = false;
  if (!Array.isArray(pm.timedEventTokens)) pm.timedEventTokens = [];
  if (!pm.personalEvents || typeof pm.personalEvents !== 'object') pm.personalEvents = {};
  if (pm.eggInventory && typeof pm.eggInventory.mythic !== 'number') pm.eggInventory.mythic = 0;
  if (typeof pm.spinHeatTierIndex !== 'number') pm.spinHeatTierIndex = 0;
  if (pm.spinHeatCooldownUntil === undefined) pm.spinHeatCooldownUntil = null;
  ensureNukeDoc(pm);
  return pm;
}

function readTier(user) {
  return normalizeTier(user.subscription?.tier || user.membershipTier || 'free');
}

function formatTierLabel(tier) {
  const t = normalizeTier(tier);
  if (t === 'core' || t === 'premium') return 'Premium';
  if (t === 'pro' || t === 'elite') return 'Pro';
  return 'Free';
}

function nextFreeSpinTime(user) {
  const pm = ensurePerkMachineDoc(user);
  const today = utcDayKey();
  if (pm.lastFreeSpinDay !== today || Number(pm.extraFreeSpins) > 0) {
    return null;
  }
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

function canUseFreeSpin(user) {
  const pm = ensurePerkMachineDoc(user);
  const today = utcDayKey();
  if (pm.lastFreeSpinDay !== today) return true;
  if (Number(pm.extraFreeSpins) > 0) return true;
  if (Number(pm.eggInventory?.extraFreeSpin) > 0) return true;
  return false;
}

function serializeEggInventory(pm) {
  const inv = pm.eggInventory || emptyEggInventory();
  return {
    common: Number(inv.common) || 0,
    rare: Number(inv.rare) || 0,
    epic: Number(inv.epic) || 0,
    legendary: Number(inv.legendary) || 0,
    mythic: Number(inv.mythic) || 0,
    extraFreeSpin: Number(inv.extraFreeSpin) || 0,
  };
}

function serializeHistory(pm) {
  return (pm.spinHistory || [])
    .slice(-MAX_HISTORY)
    .reverse()
    .map((entry) => {
      const savvyCost = Number(entry.savvyCost) || 0;
      const originalSavvyCost =
        entry.originalSavvyCost != null ? Number(entry.originalSavvyCost) || savvyCost : savvyCost;
      const savvyWon =
        entry.savvyWon != null
          ? Number(entry.savvyWon) || 0
          : (entry.rewards || []).reduce((sum, r) => sum + (Number(r.savvyGranted) || 0), 0);
      return {
        spinId: entry.spinId,
        mode: entry.mode,
        slots: entry.slots,
        savvyCost,
        originalSavvyCost,
        savvySaleApplied: Boolean(entry.savvySaleApplied),
        savvySaleSavings: Number(entry.savvySaleSavings) || 0,
        savvyWon,
        net: savvyWon - savvyCost,
        rewards: entry.rewards,
        createdAt: entry.createdAt,
      };
    });
}

function getPerkMachineStatus(user) {
  const pm = ensurePerkMachineDoc(user);
  const tier = readTier(user);
  const today = utcDayKey();
  const freeAvailable = canUseFreeSpin(user);

  return {
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    subscriptionTier: tier,
    subscriptionLabel: formatTierLabel(tier),
    freeSpinAvailable: freeAvailable,
    freeSpinUsedToday: pm.lastFreeSpinDay === today && Number(pm.extraFreeSpins) === 0,
    nextFreeSpinAt: freeAvailable ? null : nextFreeSpinTime(user),
    extraFreeSpins: Number(pm.extraFreeSpins) || 0,
    eggInventory: serializeEggInventory(pm),
    tokens: {
      battlePassXp15: Number(pm.tokens?.battlePassXp15) || 0,
      savvyLevelXp15:
        (Number(pm.tokens?.savvyLevelXp15) || 0) + (Number(pm.tokens?.savvyMultiplier15) || 0),
      savvyMultiplier15: Number(pm.tokens?.savvyMultiplier15) || 0,
      paid3Spin: Number(pm.tokens?.paid3Spin) || 0,
      paid2Spin: Number(pm.tokens?.paid2Spin) || 0,
      maxSupplyDrop: Number(pm.tokens?.maxSupplyDrop) || 0,
      battlePassTierSkip: Number(pm.tokens?.battlePassTierSkip) || 0,
    },
    streakShields: Number(user.dailyStreak?.scoutShields) || 0,
    callingCardDrops: Number(pm.callingCardDrops) || 0,
    scoutUpgrades: Number(pm.scoutUpgrades) || 0,
    nextSpinGuaranteedMultiplier: Number(pm.nextSpinGuaranteedMultiplier) || 0,
    nextSupplyDropDouble: Boolean(pm.nextSupplyDropDouble),
    powerMultiplierBonus: Math.round((Number(user.powerMultiplierBonus) || 0) * 100) / 100,
    timedEventTokens: serializeTimedEventTokens(user),
    personalEvents: serializePersonalEvents(user),
    activeBoosts: serializeActiveBoosts(user),
    recentSpins: serializeHistory(pm).slice(0, 10),
    tournamentTicketProgress: buildTournamentTicketProgress(user, pm),
    spinCosts: {
      free: getSpinConfig(SPIN_MODES.FREE),
      paid_1: getSpinConfig(SPIN_MODES.PAID_1),
      paid_2: getSpinConfig(SPIN_MODES.PAID_2),
      paid_3: getSpinConfig(SPIN_MODES.PAID_3),
    },
  };
}

async function getPerkMachineStatusWithEvents(user) {
  ensurePerkMachineDoc(user);
  const heatReset = maybeResetSpinHeat(user);
  if (heatReset) {
    user.markModified('perkMachine');
    await user.save();
  }

  const status = getPerkMachineStatus(user);
  const heatState = getSpinHeatState(user);

  for (const key of ['paid_1', 'paid_2', 'paid_3']) {
    const base = status.spinCosts[key]?.savvy || 0;
    const heatCost = applySpinHeatToBaseCost(base, heatState.multiplier);
    status.spinCosts[key] = {
      ...status.spinCosts[key],
      savvy: heatCost,
      baseSavvy: base,
      spinHeatMultiplier: heatState.multiplier,
      spinHeatApplied: heatState.multiplier > 1,
    };
  }

  status.spinHeat = formatSpinHeatForClient(heatState);

  const savvySale = await getActiveSavvySale();
  const saleActive = savvySale?.active;

  if (saleActive) {
    for (const key of ['paid_1', 'paid_2', 'paid_3']) {
      const heatBase = status.spinCosts[key]?.savvy || 0;
      const pricing = resolveSavvySaleSpinPricing(heatBase, savvySale);
      status.spinCosts[key] = {
        ...status.spinCosts[key],
        savvy: pricing.cost,
        originalSavvy: pricing.originalCost,
        saleApplied: pricing.saleApplied,
        savings: pricing.savings,
      };
    }
  }

  status.savvySale = savvySale;

  const nukeExpired = maybeExpireNukeEvent(user);
  if (nukeExpired) {
    user.markModified('perkMachine');
    await user.save();
  }
  status.nuke = formatNukeForClient(user);
  if (nukeExpired) {
    status.nuke.justEnded = true;
    status.nuke.endSummary = nukeExpired;
  }

  return status;
}

function rewardToPayload(rewardDef) {
  return {
    id: rewardDef.id,
    type: rewardDef.type,
    label: rewardDef.label,
    icon: rewardDef.icon,
    rarity: rewardDef.rarity,
    amount: rewardDef.amount || null,
    eggTier: rewardDef.eggTier || null,
    tokenKey: rewardDef.tokenKey || null,
    quantity: rewardDef.quantity || null,
    baseLabel: rewardDef.baseLabel || null,
    baseAmount: rewardDef.baseAmount || null,
    spinMultiplier: rewardDef.spinMultiplier || null,
    nukeMultiplier: rewardDef.nukeMultiplier || null,
    nukeBonusSavvy: rewardDef.nukeBonusSavvy || null,
    tooltip: rewardDef.tooltip || null,
    multiplierValue: rewardDef.multiplierValue || null,
    eventKind: rewardDef.eventKind || null,
    durationMs: rewardDef.durationMs || null,
    permanentBonus: rewardDef.permanentBonus || null,
  };
}

async function applyReward(user, rewardDef, spinId) {
  const pm = ensurePerkMachineDoc(user);
  const payload = rewardToPayload(rewardDef);
  const qty = Math.max(1, Number(rewardDef.quantity) || 1);
  let granted = { ...payload, granted: true, quantity: qty };

  if (rewardDef.type === MULTIPLIER_TYPE) {
    granted.multiplierRole = true;
    granted.granted = true;
    return granted;
  }

  if (rewardDef.type === 'savvy') {
    const baseAmount = Number(rewardDef.baseAmount ?? rewardDef.amount) || 0;
    const spinMult = Number(rewardDef.spinMultiplier) || 1;
    const scaledBase = Number(rewardDef.amount) || baseAmount;
    const savvyMult = getSavvyMultiplier(user);
    const amount = Math.round(scaledBase * savvyMult);
    const result = await grantSavvyReward(user, {
      rewardType: 'perk_machine',
      amount,
      baseAmount: scaledBase,
      multiplier: savvyMult,
      idempotencyKey: `perk_machine:${user._id}:${spinId}:${rewardDef.id}:${amount}:${spinMult}`,
      note: `Perk Machine — ${rewardDef.label}${savvyMult > 1 ? ' (1.5× boost)' : ''}${spinMult > 1 ? ` (${spinMult}× spin)` : ''}`,
      meta: { spinId, source: 'perk_machine', multiplier: savvyMult, spinMultiplier: spinMult },
    });
    granted.savvyGranted = result.amount;
    granted.savvyBoosted = savvyMult > 1;
    granted.spinMultiplierApplied = spinMult > 1 ? spinMult : null;
    granted.newBalance = result.newBalance;
    if (rewardDef.baseAmount != null) {
      granted.baseAmount = rewardDef.baseAmount;
      granted.baseLabel = rewardDef.baseLabel || `+${rewardDef.baseAmount} Savvy`;
    }
  } else if (rewardDef.type === 'egg') {
    const tier = rewardDef.eggTier;
    if (tier === 'extraFreeSpin') {
      pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin) + qty;
    } else if (tier && pm.eggInventory[tier] != null) {
      pm.eggInventory[tier] = Number(pm.eggInventory[tier]) + qty;
    }
    granted.eggsGranted = qty;
    if (qty > 1) granted.spinMultiplierApplied = qty;
    try {
      const { isHatchableEggTier } = require('../config/eggCamoCollection');
      if (isHatchableEggTier(tier)) {
        const eggSource = String(spinId || '').startsWith('hatch:')
          ? 'perk_machine_hatch'
          : 'perk_machine';
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
  } else if (rewardDef.type === 'token' && rewardDef.tokenKey) {
    pm.tokens[rewardDef.tokenKey] = Number(pm.tokens[rewardDef.tokenKey] || 0) + qty;
    if (qty > 1) granted.spinMultiplierApplied = qty;
  } else if (rewardDef.type === 'streak_shield') {
    if (!user.dailyStreak) user.dailyStreak = {};
    user.dailyStreak.scoutShields = Number(user.dailyStreak.scoutShields || 0) + qty;
    if (qty > 1) granted.spinMultiplierApplied = qty;
  } else if (rewardDef.type === 'calling_card') {
    pm.callingCardDrops = Number(pm.callingCardDrops) + qty;
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes('perk_calling_card')) {
      user.badges.push('perk_calling_card');
    }

    // Award a specific calling card (server-authoritative) so the reveal can
    // name it. Owning it already converts the drop into Savvy — never nothing.
    const card = pickPerkCallingCard();
    granted.label = 'Calling Card Drop';
    granted.callingCardId = card.id;
    granted.callingCardName = card.name;
    granted.callingCardTagline = card.tagline;
    granted.callingCardRarity = card.rarity;

    let newlyUnlocked = false;
    try {
      newlyUnlocked = await grantSystemCosmeticUnlock(user._id, card.id, 'perk_machine_spin');
    } catch (e) {
      newlyUnlocked = false;
    }

    if (newlyUnlocked) {
      granted.callingCardDuplicate = false;
    } else {
      granted.callingCardDuplicate = true;
      const dupResult = await grantSavvyReward(user, {
        rewardType: 'perk_machine',
        amount: PERK_CALLING_CARD_DUPLICATE_SAVVY,
        baseAmount: PERK_CALLING_CARD_DUPLICATE_SAVVY,
        multiplier: 1,
        idempotencyKey: `perk_card_dupe:${spinId}:${card.id}`,
        note: `Perk Machine — duplicate ${card.name} converted to Savvy`,
        meta: { spinId, source: 'perk_machine_calling_card_duplicate', cardId: card.id },
      });
      granted.duplicateSavvy = dupResult.amount;
      granted.savvyGranted = (Number(granted.savvyGranted) || 0) + Number(dupResult.amount || 0);
      granted.newBalance = dupResult.newBalance;
    }
    if (qty > 1) granted.spinMultiplierApplied = qty;
  } else if (rewardDef.type === 'scout_upgrade') {
    pm.scoutUpgrades = Number(pm.scoutUpgrades || 0) + 1;
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes('savvy_scout_upgrade')) {
      user.badges.push('savvy_scout_upgrade');
    }
  } else if (rewardDef.type === 'scout_flight_ticket') {
    const inv = ensureEventInventory(user);
    inv.scoutFlightTicket = Number(inv.scoutFlightTicket) + qty;
    granted.ticketsGranted = qty;
    if (qty > 1) granted.spinMultiplierApplied = qty;
    user.markModified('eventInventory');
  } else if (rewardDef.type === 'guaranteed_multiplier') {
    // Applies to the user's NEXT perk machine spin only (consumed on spin).
    const value = Math.max(2, Number(rewardDef.multiplierValue) || 2);
    pm.nextSpinGuaranteedMultiplier = value;
    granted.guaranteedMultiplier = value;
  } else if (rewardDef.type === 'permanent_multiplier') {
    const bonus = Number(rewardDef.permanentBonus) || 0;
    user.powerMultiplierBonus =
      Math.round(((Number(user.powerMultiplierBonus) || 0) + bonus) * 100) / 100;
    granted.permanentBonus = bonus;
    granted.powerMultiplierBonus = user.powerMultiplierBonus;
  } else if (rewardDef.type === 'timed_savvy_multiplier') {
    const { activateMythicSavvyMultiplier } = require('./savvyMultiplierService');
    const durationMs = Number(rewardDef.durationMs) || 5 * 60 * 60 * 1000;
    const multiplier = Math.max(1, Number(rewardDef.multiplierValue) || 3);
    const boost = activateMythicSavvyMultiplier(user, { durationMs, multiplier });
    granted.savvyEarningsMultiplier = multiplier;
    granted.savvyEarningsExpiresAt = boost.expiresAt;
    user.markModified('savvyEarningBoosts');
  } else if (rewardDef.type === 'timed_event_token') {
    const token = {
      id: crypto.randomUUID(),
      kind: rewardDef.eventKind,
      label: rewardDef.label,
      icon: rewardDef.icon || (rewardDef.eventKind === 'savvySale' ? '🏷️' : '⚡'),
      durationMs: Number(rewardDef.durationMs) || 0,
      acquiredAt: new Date(),
    };
    pm.timedEventTokens.push(token);
    granted.timedTokenId = token.id;
    granted.eventKind = token.kind;
    granted.durationMs = token.durationMs;
  } else if (rewardDef.type === 'supply_drop_token') {
    pm.tokens.maxSupplyDrop = Number(pm.tokens.maxSupplyDrop || 0) + qty;
    granted.supplyDropTokensGranted = qty;
  } else if (rewardDef.type === 'supply_drop_double') {
    pm.tokens.maxSupplyDrop = Number(pm.tokens.maxSupplyDrop || 0) + 1;
    pm.nextSupplyDropDouble = true;
    granted.supplyDropTokensGranted = 1;
    granted.nextSupplyDropDouble = true;
  } else if (rewardDef.type === 'spin_token_2slot') {
    pm.tokens.paid2Spin = Number(pm.tokens.paid2Spin || 0) + qty;
    granted.spinTokensGranted = qty;
  } else if (rewardDef.type === 'bp_tier_skip') {
    pm.tokens.battlePassTierSkip = Number(pm.tokens.battlePassTierSkip || 0) + qty;
    granted.tierSkipsGranted = qty;
  } else if (rewardDef.type === 'supply_drop') {
    const drop = await createSupplyDrop({
      scope: 'user',
      userId: user._id,
      source: 'perk_machine',
    });
    granted.supplyDropId = drop.dropId;
    granted.supplyDrop = drop;
    granted.supplyDropLabel = drop.rewardLabel || rewardDef.label;
  }

  user.markModified('perkMachine');
  if (user.dailyStreak) user.markModified('dailyStreak');
  return granted;
}

function highestRarity(rewards) {
  const order = { common: 0, uncommon: 1, rare: 2, epic: 2, legendary: 3 };
  let max = 'common';
  for (const r of rewards) {
    if (r.multiplierRole) continue;
    const rank = order[r.rarity] ?? 0;
    if (rank > (order[max] ?? 0)) max = r.rarity;
  }
  return max;
}

async function spinPerkMachine(user, options = {}) {
  const userId = user._id;
  const mode = String(options.mode || '').trim();
  const config = getSpinConfig(mode);
  if (!config) {
    const err = new Error('Invalid spin mode');
    err.status = 400;
    err.code = 'INVALID_MODE';
    throw err;
  }

  let lockedUser;
  try {
    lockedUser = await acquirePerkSpinLock(userId);
    assertSpinCooldown(lockedUser, options.adminBypassCost);
    user = lockedUser;
    ensurePerkMachineDoc(user);

    if (maybeResetSpinHeat(user)) {
      user.markModified('perkMachine');
    }

    const heatBeforeSpin = getSpinHeatState(user);
    const tier = readTier(user);
    let savvyCost = applySpinHeatToBaseCost(config.savvy, heatBeforeSpin.multiplier);
    let originalSavvyCost = savvyCost;
    let savvySaleApplied = false;
    let savvySaleSavings = 0;
    let usedPaid3Token = false;
    let usedPaid2Token = false;
    let usedExtraFreeSpin = false;

    const savvySale = await getActiveSavvySale();

    if (mode === SPIN_MODES.FREE) {
      const claim = await claimFreeSpinSlot(userId);
      user = claim.user;
      usedExtraFreeSpin = claim.usedExtraFreeSpin;
      ensurePerkMachineDoc(user);
    } else {
      const salePricing = resolveSavvySaleSpinPricing(savvyCost, savvySale);
      originalSavvyCost = salePricing.originalCost;
      savvyCost = salePricing.cost;
      savvySaleApplied = salePricing.saleApplied;
      savvySaleSavings = salePricing.savings;

      const pm = ensurePerkMachineDoc(user);
      const pmTokens = pm.tokens || {};
      if (mode === SPIN_MODES.PAID_3 && Number(pmTokens.paid3Spin) > 0 && !options.adminBypassCost) {
        pm.tokens.paid3Spin = Number(pm.tokens.paid3Spin) - 1;
        savvyCost = 0;
        originalSavvyCost = applySpinHeatToBaseCost(config.savvy, heatBeforeSpin.multiplier);
        usedPaid3Token = true;
        savvySaleApplied = false;
        savvySaleSavings = 0;
      } else if (mode === SPIN_MODES.PAID_2 && Number(pmTokens.paid2Spin) > 0 && !options.adminBypassCost) {
        pm.tokens.paid2Spin = Number(pm.tokens.paid2Spin) - 1;
        savvyCost = 0;
        originalSavvyCost = applySpinHeatToBaseCost(config.savvy, heatBeforeSpin.multiplier);
        usedPaid2Token = true;
        savvySaleApplied = false;
        savvySaleSavings = 0;
      } else if (
        mode !== SPIN_MODES.FREE &&
        isPersonalEventActive(user, 'savvySale') &&
        !savvySaleApplied &&
        !options.adminBypassCost
      ) {
        const heatBase = applySpinHeatToBaseCost(config.savvy, heatBeforeSpin.multiplier);
        const discounted = applySavvySaleDiscountPercent(heatBase);
        savvyCost = discounted;
        originalSavvyCost = heatBase;
        savvySaleApplied = true;
        savvySaleSavings = heatBase - discounted;
      }

      const balance = Math.round(Number(user.savvyPoints) || 0);
      if (!options.adminBypassCost) {
        if (savvyCost > 0 && balance < savvyCost) {
          const err = new Error(`Not enough Savvy. You need ${savvyCost} Savvy for this spin.`);
          err.status = 400;
          err.code = 'INSUFFICIENT_SAVVY';
          err.required = savvyCost;
          err.balance = balance;
          throw err;
        }
      } else {
        savvyCost = 0;
        originalSavvyCost = 0;
      }
    }

    const pm = ensurePerkMachineDoc(user);
    pm.lastSpinAt = new Date();
    const spinId = crypto.randomUUID();
    const nukeSnapshot = captureNukeEligibility(user);

    if (mode !== SPIN_MODES.FREE && savvyCost > 0 && !options.adminBypassCost) {
      const spendSource = savvySaleApplied ? 'perk_spin_sale_discount' : 'perk_machine_spin';
      const spend = await spendSavvyReward(user, {
        amount: savvyCost,
        source: spendSource,
        idempotencyKey: `perk_spin_spend:${spinId}`,
        note: savvySaleApplied
          ? `Perk Machine spin (${mode}) — Savvy Sale ${savvySaleSavings} off`
          : `Perk Machine spin (${mode})`,
        meta: {
          mode,
          spinId,
          savvySaleApplied,
          savvySaleEventId: savvySale?.eventId || null,
          originalSavvyCost,
          savvySaleSavings,
          actualCostCharged: savvyCost,
          spinHeatMultiplier: heatBeforeSpin.multiplier,
        },
      });
      if (!spend.spent && !spend.duplicate) {
        const err = new Error(`Not enough Savvy. You need ${savvyCost} Savvy for this spin.`);
        err.status = 400;
        err.code = 'INSUFFICIENT_SAVVY';
        throw err;
      }
    }

    const pool = buildWeightedPool(tier, options.forceRewardId || null);
    const slots = config.slots;
    const rawPicks = [];

    for (let i = 0; i < slots; i += 1) {
      const forceId = i === 0 ? options.forceRewardId : null;
      const slotPool = forceId ? buildWeightedPool(tier, forceId) : pool;
      rawPicks.push(pickWeightedReward(slotPool));
    }

    const multiplierCount = countMultiplierTiles(rawPicks);
    const tileResult = computeSpinMultiplier(multiplierCount);
    const isJackpot = tileResult.isJackpot;
    // Guaranteed Nx from an egg hatch applies to THIS spin only, then clears.
    const guaranteedMultiplier = Number(pm.nextSpinGuaranteedMultiplier) || 0;
    let multiplierFactor = tileResult.factor;
    let usedGuaranteedMultiplier = 0;
    if (guaranteedMultiplier > 1) {
      multiplierFactor = Math.max(multiplierFactor, guaranteedMultiplier);
      usedGuaranteedMultiplier = guaranteedMultiplier;
      pm.nextSpinGuaranteedMultiplier = 0;
    }
    const rewards = [];
    let grantIndex = 0;
    let totalNukeBonusSavvy = 0;

    for (const pick of rawPicks) {
      if (pick.type === MULTIPLIER_TYPE) {
        rewards.push(await applyReward(user, pick, `${spinId}:${grantIndex}`));
        grantIndex += 1;
        continue;
      }

      let scaled = multiplierFactor > 1 ? scaleRewardForMultiplier(pick, multiplierFactor) : pick;
      if (nukeSnapshot.active) {
        const nukeApplied = applyNukeMultiplierToReward(scaled, nukeSnapshot.multiplier);
        scaled = nukeApplied.reward;
        totalNukeBonusSavvy += nukeApplied.nukeBonusSavvy || 0;
      }
      const granted = await applyReward(user, scaled, `${spinId}:${grantIndex}`);
      if (scaled.nukeBonusSavvy) granted.nukeBonusSavvy = scaled.nukeBonusSavvy;
      if (scaled.nukeMultiplier) granted.nukeMultiplier = scaled.nukeMultiplier;
      rewards.push(granted);
      grantIndex += 1;
    }

    const multiplierBreakdown = buildMultiplierBreakdown(rawPicks, multiplierFactor);
    const rawRewards = rawPicks.map((r) => rewardToPayload(r));

    const finalCost = mode === SPIN_MODES.FREE ? 0 : savvyCost;
    const savvyWon = rewards.reduce((sum, r) => sum + (Number(r.savvyGranted) || 0), 0);
    const netSavvy = savvyWon - finalCost;

    const historyEntry = {
      spinId,
      mode,
      slots,
      savvyCost: finalCost,
      originalSavvyCost: mode === SPIN_MODES.FREE ? 0 : originalSavvyCost,
      savvySaleApplied: usedPaid3Token ? false : savvySaleApplied,
      savvySaleSavings: usedPaid3Token ? 0 : savvySaleSavings,
      savvyWon,
      rewards: rewards.map((r) => ({
        id: r.id,
        label: r.label,
        rarity: r.rarity,
        type: r.type,
        savvyGranted: Number(r.savvyGranted) || 0,
        callingCardId: r.callingCardId || null,
        callingCardName: r.callingCardName || null,
        callingCardRarity: r.callingCardRarity || null,
        callingCardDuplicate: r.callingCardDuplicate || false,
      })),
      createdAt: new Date(),
    };

    pm.spinHistory.push(historyEntry);
    if (pm.spinHistory.length > MAX_HISTORY) {
      pm.spinHistory = pm.spinHistory.slice(-MAX_HISTORY);
    }

    if (savvySaleSavings > 0 && !usedPaid3Token && !usedPaid2Token) {
      try {
        const { recordSavvySaleSavings } = require('./eventSummaryService');
        await recordSavvySaleSavings(user, savvySaleSavings);
      } catch (err) {
        console.warn('[eventSummary] savvy sale savings track failed:', err?.message);
      }
    }

    const ticketResult = recordSpinForTournamentTicket(user, pm);

    let spinHeatAdvance = null;
    if (
      mode !== SPIN_MODES.FREE &&
      savvyCost > 0 &&
      !options.adminBypassCost &&
      !usedPaid3Token &&
      !usedPaid2Token
    ) {
      spinHeatAdvance = advanceSpinHeat(user);
    }

    const combinedMultiplier =
      nukeSnapshot.active && multiplierFactor > 1
        ? multiplierFactor * nukeSnapshot.multiplier
        : nukeSnapshot.active
          ? nukeSnapshot.multiplier
          : multiplierFactor;

    if (nukeSnapshot.active) {
      const baseSavvyEarned = savvyWon - totalNukeBonusSavvy;
      const bestSavvy = rewards.reduce(
        (best, r) => (Number(r.savvyGranted) > best ? Number(r.savvyGranted) : best),
        0
      );
      const bestReward = rewards.find((r) => !r.multiplierRole && Number(r.savvyGranted) === bestSavvy);
      recordNukeSpinStats(user, {
        savvyCost: finalCost,
        baseSavvyEarned,
        nukeBonusEarned: totalNukeBonusSavvy,
        combinedMultiplier,
        bestRewardLabel: bestReward?.label || rewards.find((r) => !r.multiplierRole)?.label || null,
      });
    }

    const nukeProgress = recordQualifyingNukeSpin(user, {
      spinId,
      mode,
      savvyCostCharged: finalCost,
      usedPaid3Token,
      usedPaid2Token,
      adminBypass: Boolean(options.adminBypassCost),
    });

    user.markModified('perkMachine');
    await user.save();

    const { fireContractTrigger } = require('./contractHooks');
    fireContractTrigger(userId, 'perk_machine_spin');

    const topRarity = highestRarity(rewards);
    let resultMessage = pickResultMessage(topRarity);
    if (isJackpot) {
      resultMessage = '8× JACKPOT! Every reward just multiplied to the max!';
    } else if (usedGuaranteedMultiplier > 1) {
      resultMessage = `Guaranteed ${usedGuaranteedMultiplier}× applied — every reward multiplied!`;
    } else if (multiplierFactor > 1 && multiplierBreakdown?.expression) {
      resultMessage = `${multiplierFactor}× multiplier activated!`;
    }
    if (nukeSnapshot.active && totalNukeBonusSavvy > 0) {
      resultMessage = `☢ ${nukeSnapshot.multiplier}× NUKE MULTIPLIER — ${resultMessage}`;
    }

    const eggsWon = rewards
      .filter((r) => r.type === 'egg' && !r.multiplierRole)
      .map((r) => r.label);

    const directTicketsWon = rewards
      .filter((r) => r.type === 'scout_flight_ticket')
      .reduce((sum, r) => sum + (Number(r.ticketsGranted) || 0), 0);

    return {
      spinId,
      mode,
      slots,
      savvyCost: finalCost,
      actualCostCharged: finalCost,
      savvyWon,
      net: netSavvy,
      summary: {
        cost: finalCost,
        actualCostCharged: finalCost,
        originalSavvyCost: mode === SPIN_MODES.FREE ? 0 : originalSavvyCost,
        savvySaleApplied: usedPaid3Token ? false : savvySaleApplied,
        savvySaleSavings: usedPaid3Token ? 0 : savvySaleSavings,
        savvyWon,
        net: netSavvy,
        eggs: eggsWon,
        directTicketsWon,
      },
      savvyBalance: Math.round(Number(user.savvyPoints) || 0),
      rawRewards,
      multiplier: {
        count: multiplierCount,
        factor: multiplierFactor,
        isJackpot,
        guaranteed: usedGuaranteedMultiplier || null,
        breakdown: multiplierBreakdown,
        nukeActive: nukeSnapshot.active,
        nukeFactor: nukeSnapshot.active ? nukeSnapshot.multiplier : null,
        combinedFactor: combinedMultiplier > 1 ? combinedMultiplier : null,
      },
      rewards,
      resultMessage,
      topRarity,
      usedExtraFreeSpin,
      usedPaid3Token,
      savvySaleApplied: usedPaid3Token ? false : savvySaleApplied,
      savvySaleSavings: usedPaid3Token ? 0 : savvySaleSavings,
      originalSavvyCost: mode === SPIN_MODES.FREE ? 0 : originalSavvyCost,
      tournamentTicket: ticketResult,
      spinHeat: spinHeatAdvance
        ? {
            ...formatSpinHeatForClient(getSpinHeatState(user)),
            previousMultiplier: spinHeatAdvance.previousMultiplier,
            currentMultiplier: spinHeatAdvance.currentMultiplier,
            increased: spinHeatAdvance.increased,
            paidMultiplier: heatBeforeSpin.multiplier,
          }
        : {
            ...formatSpinHeatForClient(getSpinHeatState(user)),
            paidMultiplier: heatBeforeSpin.multiplier,
          },
      nuke: {
        snapshot: nukeSnapshot,
        progress: nukeProgress,
        nukeBonusSavvy: totalNukeBonusSavvy,
        combinedMultiplier: combinedMultiplier > 1 ? combinedMultiplier : null,
      },
      status: await getPerkMachineStatusWithEvents(user),
    };
  } catch (err) {
    if (err instanceof SpinLockError) {
      const mapped = new Error(err.message);
      mapped.status = err.status;
      mapped.code = err.code;
      mapped.required = err.required;
      mapped.balance = err.balance;
      throw mapped;
    }
    throw err;
  } finally {
    await releasePerkSpinLock(userId);
  }
}

async function hatchEgg(user, options = {}) {
  const eggTier = String(options.eggTier || '').trim();
  if (!HATCHABLE_EGG_TIERS.includes(eggTier)) {
    const err = new Error('That egg cannot be hatched.');
    err.status = 400;
    err.code = 'INVALID_EGG_TIER';
    throw err;
  }

  const pm = ensurePerkMachineDoc(user);
  const now = Date.now();
  const lastHatch = pm.lastHatchAt ? new Date(pm.lastHatchAt).getTime() : 0;
  if (lastHatch && now - lastHatch < HATCH_COOLDOWN_MS) {
    const err = new Error('Hatch already in progress. Please wait.');
    err.status = 429;
    err.code = 'HATCH_IN_PROGRESS';
    throw err;
  }

  const owned = Number(pm.eggInventory?.[eggTier]) || 0;
  if (owned < 1) {
    const err = new Error('You do not own that egg.');
    err.status = 400;
    err.code = 'NO_EGG';
    throw err;
  }

  pm.eggInventory[eggTier] = owned - 1;
  pm.lastHatchAt = new Date();

  const hatchId = crypto.randomUUID();
  const pool = buildEggHatchPool(eggTier);
  const picked = pickWeightedReward(pool);

  let reward;
  try {
    reward = await applyReward(user, picked, `hatch:${hatchId}`);
    // eslint-disable-next-line no-console
    console.log('[EGG_HATCH_REWARD]', String(user._id), eggTier, picked.label, reward);
    // eslint-disable-next-line no-console
    console.log('[EGG_REWARD_GRANTED]', String(user._id), picked.label);
  } catch (error) {
    // Refund the egg so a failed grant never consumes it.
    pm.eggInventory[eggTier] = owned;
    user.markModified('perkMachine');
    await user.save().catch(() => {});
    // eslint-disable-next-line no-console
    console.error('[EGG_REWARD_FAILED]', error);
    throw error;
  }

  const hatchSavvyWon = Number(reward.savvyGranted) || 0;
  const historyEntry = {
    spinId: hatchId,
    mode: `hatch_${eggTier}`,
    slots: 0,
    savvyCost: 0,
    savvyWon: hatchSavvyWon,
    rewards: [
      {
        id: reward.id,
        label: reward.label,
        rarity: reward.rarity,
        type: reward.type,
        savvyGranted: hatchSavvyWon,
        callingCardId: reward.callingCardId || null,
        callingCardName: reward.callingCardName || null,
        callingCardRarity: reward.callingCardRarity || null,
        callingCardDuplicate: reward.callingCardDuplicate || false,
      },
    ],
    createdAt: new Date(),
  };
  pm.spinHistory.push(historyEntry);
  if (pm.spinHistory.length > MAX_HISTORY) {
    pm.spinHistory = pm.spinHistory.slice(-MAX_HISTORY);
  }

  user.markModified('perkMachine');
  await user.save();

  return {
    hatchId,
    eggTier,
    reward,
    savvyWon: hatchSavvyWon,
    net: hatchSavvyWon,
    summary: {
      cost: 0,
      savvyWon: hatchSavvyWon,
      net: hatchSavvyWon,
      eggs: reward.type === 'egg' ? [reward.label] : [],
    },
    resultMessage: pickResultMessage(reward.rarity),
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    status: getPerkMachineStatus(user),
  };
}

/**
 * Consume a Battle Pass Tier Skip token and advance the user exactly one tier
 * by crediting the XP needed to reach the next tier threshold.
 */
async function useBattlePassTierSkip(user) {
  const pm = ensurePerkMachineDoc(user);
  const have = Number(pm.tokens?.battlePassTierSkip) || 0;
  if (have < 1) {
    const err = new Error('You have no Battle Pass Tier Skip tokens.');
    err.status = 400;
    err.code = 'NO_TOKEN';
    throw err;
  }

  // Lazy require to avoid circular load order between perk machine + battle pass.
  const { ensureProgressDocuments } = require('./battlePassPersistenceService');
  const { adminGrantXp } = require('./battlePassClaimService');
  const {
    BATTLE_PASS_CUMULATIVE_XP,
    BATTLE_PASS_TIERS,
    computeTierFromXp,
  } = require('../lib/battlePassConfig');

  const { bp } = await ensureProgressDocuments(user._id);
  const currentXp = Number(bp.xp) || 0;
  const currentTier = computeTierFromXp(currentXp);
  if (currentTier >= BATTLE_PASS_TIERS.length) {
    const err = new Error('You are already at the max Battle Pass tier.');
    err.status = 400;
    err.code = 'MAX_TIER';
    throw err;
  }

  const target = Number(BATTLE_PASS_CUMULATIVE_XP[currentTier]) || currentXp + 1;
  const delta = Math.max(1, target - currentXp);

  await adminGrantXp(String(user._id), delta);

  pm.tokens.battlePassTierSkip = have - 1;
  user.markModified('perkMachine');
  await user.save();

  return {
    skipped: true,
    fromTier: currentTier,
    toTier: currentTier + 1,
    xpGranted: delta,
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    status: getPerkMachineStatus(user),
  };
}

module.exports = {
  ensurePerkMachineDoc,
  getPerkMachineStatus,
  getPerkMachineStatusWithEvents,
  spinPerkMachine,
  hatchEgg,
  useBattlePassTierSkip,
  canUseFreeSpin,
  serializeEggInventory,
  serializeHistory,
};
