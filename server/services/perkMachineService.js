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
  validateSpinRewardConfig,
} = require('../config/perkMachineRewards');
const {
  computeSpinMultiplier,
  countMultiplierTiles,
  scaleRewardForMultiplier,
  buildMultiplierBreakdown,
  MULTIPLIER_TYPE,
} = require('./perkMachineMultiplier');
const {
  buildTournamentTicketProgress,
  recordSpinForTournamentTicket,
} = require('./scoutFlightTicketService');
const {
  maybeResetSpinHeat,
  getSpinHeatState,
  formatSpinHeatForClient,
  advanceSpinHeat,
} = require('./spinHeatService');
const { applySpinHeatToBaseCost, SPIN_HEAT_MULTIPLIERS } = require('../config/spinHeatConfig');
const {
  maybeExpireNukeEvent,
  captureNukeEligibility,
  applyNukeMultiplierToReward,
  recordQualifyingNukeSpin,
  recordNukeSpinStats,
  formatNukeForClient,
  ensureNukeDoc,
} = require('./perkMachineNukeService');
const { createSpinTracer } = require('./perkMachineSpinTrace');
const {
  sanitizeRewardForGrantLog,
  validateRewardBeforeGrant,
  executePerkMachineRewardGrant,
  enrichGrantError,
  resolveGrantHandler,
} = require('./perkMachineRewardGrant');

function sanitizePerkMachineDate(value) {
  if (value == null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeStringIdArray(value, cap = 100) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (entry == null) continue;
    const id = String(entry).trim();
    if (!id) continue;
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

function sanitizeTimedEventMap(events) {
  if (!events || typeof events !== 'object' || Array.isArray(events)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(events)) {
    if (!raw || typeof raw !== 'object') continue;
    out[key] = {
      ...raw,
      activatedAt: sanitizePerkMachineDate(raw.activatedAt),
      expiresAt: sanitizePerkMachineDate(raw.expiresAt),
    };
  }
  return out;
}

function sanitizeActiveBoostsMap(boosts) {
  if (!boosts || typeof boosts !== 'object' || Array.isArray(boosts)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(boosts)) {
    if (!raw || typeof raw !== 'object') continue;
    out[key] = {
      ...raw,
      activatedAt: sanitizePerkMachineDate(raw.activatedAt),
      expiresAt: sanitizePerkMachineDate(raw.expiresAt),
    };
  }
  return out;
}

function clampSpinHeatTierIndex(value) {
  const maxIndex = SPIN_HEAT_MULTIPLIERS.length - 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(maxIndex, Math.max(0, Math.round(parsed)));
}

function sanitizePerkMachineDocDates(pm) {
  if (!pm || typeof pm !== 'object') return;
  pm.lastSpinAt = sanitizePerkMachineDate(pm.lastSpinAt);
  pm.spinLockUntil = sanitizePerkMachineDate(pm.spinLockUntil);
  pm.spinHeatCooldownUntil = sanitizePerkMachineDate(pm.spinHeatCooldownUntil);
  pm.freePerkSpinUntil = sanitizePerkMachineDate(pm.freePerkSpinUntil);
  pm.lastHatchAt = sanitizePerkMachineDate(pm.lastHatchAt);
  pm.lastExchangeAt = sanitizePerkMachineDate(pm.lastExchangeAt);
  pm.spinHeatTierIndex = clampSpinHeatTierIndex(pm.spinHeatTierIndex);

  pm.personalEvents = sanitizeTimedEventMap(pm.personalEvents);
  pm.activeBoosts = sanitizeActiveBoostsMap(pm.activeBoosts);

  if (pm.nuke && typeof pm.nuke === 'object') {
    pm.nuke.lastActivationAt = sanitizePerkMachineDate(pm.nuke.lastActivationAt);
    pm.nuke.lastCompletionAt = sanitizePerkMachineDate(pm.nuke.lastCompletionAt);
    pm.nuke.lifetimeQualifyingSpins = Math.max(0, Math.round(Number(pm.nuke.lifetimeQualifyingSpins) || 0));
    pm.nuke.nukeEventsTriggered = Math.max(0, Math.round(Number(pm.nuke.nukeEventsTriggered) || 0));
    pm.nuke.processedSpinIds = sanitizeStringIdArray(pm.nuke.processedSpinIds);
    pm.nuke.milestonesSeen = sanitizeStringIdArray(pm.nuke.milestonesSeen, 50);
    if (pm.nuke.activeEvent && typeof pm.nuke.activeEvent === 'object') {
      pm.nuke.activeEvent.activatedAt = sanitizePerkMachineDate(pm.nuke.activeEvent.activatedAt);
      pm.nuke.activeEvent.expiresAt = sanitizePerkMachineDate(pm.nuke.activeEvent.expiresAt);
    }
  }

  if (Array.isArray(pm.timedEventTokens)) {
    pm.timedEventTokens = pm.timedEventTokens.map((token) => {
      if (!token || typeof token !== 'object') return token;
      return {
        ...token,
        acquiredAt: sanitizePerkMachineDate(token.acquiredAt) || new Date(),
      };
    });
  }

  if (Array.isArray(pm.eggHaulGrants)) {
    pm.eggHaulGrants = pm.eggHaulGrants.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      return {
        ...entry,
        grantedAt: sanitizePerkMachineDate(entry.grantedAt) || entry.grantedAt || new Date(),
      };
    });
  }

  if (Array.isArray(pm.eggExchangeHistory)) {
    pm.eggExchangeHistory = pm.eggExchangeHistory.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      return {
        ...entry,
        createdAt: sanitizePerkMachineDate(entry.createdAt) || entry.createdAt || new Date(),
      };
    });
  }

  if (!Array.isArray(pm.spinHistory)) {
    pm.spinHistory = [];
  }
}

/** Final normalization immediately before user.save() on spin completion. */
function sanitizePerkMachineForPersist(user) {
  const pm = ensurePerkMachineDoc(user);
  if (!Array.isArray(pm.spinHistory)) pm.spinHistory = [];
  sanitizePerkMachineDocDates(pm);
  if (typeof pm.ticketSpinProgress !== 'number' || Number.isNaN(pm.ticketSpinProgress)) {
    pm.ticketSpinProgress = 0;
  }
  user.markModified('perkMachine');
  return pm;
}

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
  if (typeof pm.spinHeatTierIndex !== 'number' || Number.isNaN(pm.spinHeatTierIndex)) {
    pm.spinHeatTierIndex = 0;
  }
  pm.spinHeatTierIndex = clampSpinHeatTierIndex(pm.spinHeatTierIndex);
  sanitizePerkMachineDocDates(pm);
  ensureNukeDoc(pm);
  return pm;
}

function isFreePerkSpinHourActive(user) {
  const pm = ensurePerkMachineDoc(user);
  if (!pm.freePerkSpinUntil) return false;
  return new Date(pm.freePerkSpinUntil).getTime() > Date.now();
}

const { planTierForMultiplier } = require('../lib/dataAuthority');

function readTier(user) {
  return planTierForMultiplier(user);
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
    freePerkSpinUntil: pm.freePerkSpinUntil || null,
    freePerkSpinHourActive: isFreePerkSpinHourActive(user),
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

  if (isFreePerkSpinHourActive(user)) {
    for (const key of ['paid_1', 'paid_2', 'paid_3']) {
      const base = status.spinCosts[key]?.baseSavvy ?? status.spinCosts[key]?.savvy ?? 0;
      status.spinCosts[key] = {
        ...status.spinCosts[key],
        savvy: 0,
        originalSavvy: base,
        freePerkHourApplied: true,
      };
    }
  }

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

  const handler = resolveGrantHandler(rewardDef.type);
  try {
    validateRewardBeforeGrant(rewardDef);
    const grantResult = await executePerkMachineRewardGrant(user, rewardDef, spinId, pm);
    granted = { ...granted, ...grantResult };
  } catch (err) {
    throw enrichGrantError(err, rewardDef, handler);
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

function logPerkSpin(event, payload) {
  // Structured stage logging in all environments (no auth tokens or secrets).
  // eslint-disable-next-line no-console
  console.log(`[PERK_SPIN_${event}]`, JSON.stringify(payload));
}

function formatMongooseErrorDetails(err) {
  if (!err?.errors || typeof err.errors !== 'object') return null;
  return Object.entries(err.errors).map(([path, detail]) => ({
    path,
    kind: detail?.kind,
    message: detail?.message,
    value: detail?.value,
  }));
}

function logPerkSpinFailed(stage, err, context = {}) {
  const { getServerCommitSha } = require('../lib/deploySha');
  console.error('[PERK_SPIN_ERROR]', {
    stage,
    serverCommitSha: getServerCommitSha(),
    errorName: err?.name,
    errorMessage: err?.message,
    validationDetails: formatMongooseErrorDetails(err),
    stack: err?.stack,
    failedStage: err?.failedStage || stage,
    lastOkStage: err?.lastOkStage || null,
    rewardId: err?.rewardId || null,
    rewardType: err?.rewardType || null,
    grantHandler: err?.grantHandler || null,
    ...context,
  });
}

async function rollbackFailedSpinEntitlements(user, rollback = {}) {
  if (!user) return;
  const pm = ensurePerkMachineDoc(user);
  if (rollback.usedPaid3Token) {
    pm.tokens.paid3Spin = Number(pm.tokens.paid3Spin || 0) + 1;
  }
  if (rollback.usedPaid2Token) {
    pm.tokens.paid2Spin = Number(pm.tokens.paid2Spin || 0) + 1;
  }
  if (rollback.guaranteedMultiplier > 0) {
    pm.nextSpinGuaranteedMultiplier = rollback.guaranteedMultiplier;
  }
  user.markModified('perkMachine');
  await user.save().catch(() => {});
}

async function rollbackFailedFreeSpinClaim(user, rollback = {}) {
  if (!user || !rollback.freeSpinClaimed) return;
  const pm = ensurePerkMachineDoc(user);
  if (rollback.usedExtraFreeSpin) {
    pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
  } else if (rollback.usedEggExtraFreeSpin) {
    pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin || 0) + 1;
  } else {
    pm.lastFreeSpinDay = rollback.previousLastFreeSpinDay ?? null;
  }
  user.markModified('perkMachine');
  await user.save().catch(() => {});
}

async function refundFailedSpinSavvy(user, { spinId, amount, spendSource }) {
  const refundAmount = Math.round(Number(amount) || 0);
  if (!spinId || refundAmount <= 0) return;
  await grantSavvyReward(user, {
    rewardType: 'perk_machine_refund',
    amount: refundAmount,
    idempotencyKey: `perk_spin_refund:${spinId}`,
    note: 'Perk Machine spin failed — Savvy refunded',
    meta: { spinId, source: 'spin_failure_refund', originalSpendSource: spendSource || null },
  });
}

async function spinPerkMachine(user, options = {}) {
  const trace = createSpinTracer(options.spinTraceId);
  const spinTraceId = trace.spinTraceId;
  const userId = user._id;
  const mode = String(options.mode || '').trim();
  const isFreeSpin = mode === SPIN_MODES.FREE;

  trace.log('START', { userId: String(userId), mode, isFreeSpin });

  const config = getSpinConfig(mode);
  if (!config) {
    const err = new Error('Invalid spin mode');
    err.status = 400;
    err.code = 'INVALID_MODE';
    err.spinTraceId = spinTraceId;
    trace.logError('REQUEST_PARSED', err, { mode });
    throw err;
  }

  let lockedUser;
  let spinContext = null;
  try {
    lockedUser = await trace.runStage('LOCK_ACQUIRE', () => acquirePerkSpinLock(userId));
    trace.runStageSync('SPIN_COOLDOWN_CHECK', () => {
      assertSpinCooldown(lockedUser, options.adminBypassCost);
      return {};
    });
    user = lockedUser;
    ensurePerkMachineDoc(user);
    trace.logOk('LEGACY_STATE_SANITIZED', {
      spinHeatTierIndex: user.perkMachine?.spinHeatTierIndex ?? 0,
    });

    trace.logOk('USER_LOADED', {
      userId: String(userId),
      hasPerkMachine: Boolean(user.perkMachine),
      spinHeatTierIndex: user.perkMachine?.spinHeatTierIndex ?? 0,
    });

    if (maybeResetSpinHeat(user)) {
      user.markModified('perkMachine');
    }

    const heatBeforeSpin = getSpinHeatState(user);
    trace.logOk('HEAT_STATE_READ', {
      heatMultiplier: heatBeforeSpin.multiplier,
      heatTierIndex: heatBeforeSpin.tierIndex,
    });
    const tier = readTier(user);
    let savvyCost = applySpinHeatToBaseCost(config.savvy, heatBeforeSpin.multiplier);
    let originalSavvyCost = savvyCost;
    let savvySaleApplied = false;
    let savvySaleSavings = 0;
    let usedPaid3Token = false;
    let usedPaid2Token = false;
    let usedExtraFreeSpin = false;
    let freePerkHourApplied = false;
    let freeSpinRollback = null;
    const balanceBefore = Math.round(Number(user.savvyPoints) || 0);
    const freeSpinAvailable = canUseFreeSpin(user);

    trace.logOk('BALANCE_READ', { balance: balanceBefore, isFreeSpin });

    const savvySale = await getActiveSavvySale();

    if (mode === SPIN_MODES.FREE) {
      const pmBeforeFree = ensurePerkMachineDoc(user);
      const previousLastFreeSpinDay = pmBeforeFree.lastFreeSpinDay ?? null;
      const eggExtraBefore = Number(pmBeforeFree.eggInventory?.extraFreeSpin) || 0;
      const claim = await claimFreeSpinSlot(userId);
      user = claim.user;
      usedExtraFreeSpin = claim.usedExtraFreeSpin;
      ensurePerkMachineDoc(user);
      freeSpinRollback = {
        previousLastFreeSpinDay,
        freeSpinClaimed: true,
        usedExtraFreeSpin,
        usedEggExtraFreeSpin:
          usedExtraFreeSpin &&
          eggExtraBefore > (Number(user.perkMachine?.eggInventory?.extraFreeSpin) || 0),
      };
      trace.logOk('BALANCE_VALIDATED', { balance: balanceBefore, required: 0, isFreeSpin: true });
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

      if (
        mode !== SPIN_MODES.FREE &&
        isFreePerkSpinHourActive(user) &&
        savvyCost > 0 &&
        !options.adminBypassCost
      ) {
        originalSavvyCost = savvyCost;
        savvyCost = 0;
        freePerkHourApplied = true;
        savvySaleApplied = false;
        savvySaleSavings = 0;
      }

      const balance = Math.round(Number(user.savvyPoints) || 0);
      if (!options.adminBypassCost) {
        if (savvyCost > 0 && balance < savvyCost) {
          const err = new Error(`Not enough Savvy. You need ${savvyCost} Savvy for this spin.`);
          err.status = 402;
          err.code = 'INSUFFICIENT_SAVVY';
          err.required = savvyCost;
          err.balance = balance;
          err.spinTraceId = spinTraceId;
          trace.logError('BALANCE_VALIDATED', err, { balance, required: savvyCost });
          throw err;
        }
      } else {
        savvyCost = 0;
        originalSavvyCost = 0;
      }
      trace.logOk('BALANCE_VALIDATED', { balance, required: savvyCost, isFreeSpin: false });
    }

    trace.logOk('REQUEST_PARSED', {
      spinType: mode,
      slotCount: config.slots,
      isFreeSpin,
      baseCost: config.savvy,
      heatMultiplier: heatBeforeSpin.multiplier,
      effectiveCost: savvyCost,
      effectiveCostIsNaN: Number.isNaN(Number(savvyCost)),
    });
    trace.logOk('HEAT_PRICE_CALCULATED', {
      baseCost: config.savvy,
      heatMultiplier: heatBeforeSpin.multiplier,
      effectiveCost: savvyCost,
    });

    const pm = ensurePerkMachineDoc(user);
    const spinId = crypto.randomUUID();
    const nukeSnapshot = captureNukeEligibility(user);
    const slots = config.slots;

    spinContext = {
      stage: 'init',
      spinTraceId,
      userId: String(userId),
      spinId,
      mode,
      slotCount: slots,
      basePrice: config.savvy,
      heatMultiplier: heatBeforeSpin.multiplier,
      effectivePrice: savvyCost,
      balanceBefore,
      freeSpinRequested: isFreeSpin,
      freeSpinAvailable,
      savvyCost,
      savvySpent: false,
      spendSource: null,
      usedPaid3Token,
      usedPaid2Token,
      guaranteedMultiplier: Number(pm.nextSpinGuaranteedMultiplier) || 0,
      ...(freeSpinRollback || {}),
    };

    const pool = buildWeightedPool(tier, options.forceRewardId || null);
    trace.logOk('REWARD_POOL_VALIDATED', {
      poolSize: pool.length,
      forcedRewardId: options.forceRewardId || null,
    });
    const rawPicks = [];

    for (let i = 0; i < slots; i += 1) {
      const forceId = i === 0 ? options.forceRewardId : null;
      const slotPool = forceId ? buildWeightedPool(tier, forceId) : pool;
      const picked = pickWeightedReward(slotPool);
      const validation = validateSpinRewardConfig(picked);
      if (!validation.valid) {
        const err = new Error(validation.message || `Invalid reward configuration for slot ${i + 1}`);
        err.status = 500;
        err.code = validation.code || 'INVALID_REWARD_CONFIG';
        err.rewardKey = validation.rewardId || picked?.id || null;
        err.spinTraceId = spinTraceId;
        trace.logError('REWARD_POOL_VALIDATED', err, {
          slotIndex: i,
          rewardId: validation.rewardId,
          code: validation.code,
        });
        throw err;
      }
      rawPicks.push(picked);
    }
    trace.logOk('REWARDS_SELECTED', {
      slotCount: slots,
      rewardIds: rawPicks.map((r) => r.id),
      rewardTypes: rawPicks.map((r) => r.type),
    });

    const multiplierCount = countMultiplierTiles(rawPicks);
    const tileResult = computeSpinMultiplier(multiplierCount);
    const isJackpot = tileResult.isJackpot;
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

    spinContext.stage = 'reward_generation';
    trace.logStart('DB_TRANSACTION', { note: 'logical spin transaction — rewards then persist' });
    for (const pick of rawPicks) {
      if (pick.type === MULTIPLIER_TYPE) {
        rewards.push(
          await trace.runStage(
            `REWARD_GRANT_${grantIndex}`,
            () => applyReward(user, pick, `${spinId}:${grantIndex}`),
            {
              ...sanitizeRewardForGrantLog(pick),
              slot: grantIndex,
              handler: resolveGrantHandler(pick.type),
            }
          )
        );
        grantIndex += 1;
        continue;
      }

      let scaled = multiplierFactor > 1 ? scaleRewardForMultiplier(pick, multiplierFactor) : pick;
      if (nukeSnapshot.active) {
        const nukeApplied = applyNukeMultiplierToReward(scaled, nukeSnapshot.multiplier);
        scaled = nukeApplied.reward;
        totalNukeBonusSavvy += nukeApplied.nukeBonusSavvy || 0;
      }
      const grantLogPayload = {
        ...sanitizeRewardForGrantLog(scaled),
        slot: grantIndex,
        handler: resolveGrantHandler(scaled.type),
      };
      validateRewardBeforeGrant(scaled);
      const granted = await trace.runStage(
        `REWARD_GRANT_${grantIndex}`,
        () => applyReward(user, scaled, `${spinId}:${grantIndex}`),
        grantLogPayload
      );
      if (scaled.nukeBonusSavvy) granted.nukeBonusSavvy = scaled.nukeBonusSavvy;
      if (scaled.nukeMultiplier) granted.nukeMultiplier = scaled.nukeMultiplier;
      rewards.push(granted);
      grantIndex += 1;
    }
    trace.logOk('REWARD_GRANT', {
      count: rewards.length,
      rewardTypes: rewards.map((r) => r.type),
    });

    spinContext.stage = 'savvy_spend';
    if (mode !== SPIN_MODES.FREE && savvyCost > 0 && !options.adminBypassCost) {
      const spendSource = savvySaleApplied ? 'perk_spin_sale_discount' : 'perk_machine_spin';
      spinContext.spendSource = spendSource;
      const spend = await trace.runStage(
        'WALLET_DEBIT',
        () =>
          spendSavvyReward(user, {
            amount: savvyCost,
            source: spendSource,
            idempotencyKey: `perk_spin_spend:${spinId}`,
            note: savvySaleApplied
              ? `Perk Machine spin (${mode}) — Savvy Sale ${savvySaleSavings} off`
              : `Perk Machine spin (${mode})`,
            meta: {
              mode,
              spinId,
              spinTraceId,
              savvySaleApplied,
              savvySaleEventId: savvySale?.eventId || null,
              originalSavvyCost,
              savvySaleSavings,
              actualCostCharged: savvyCost,
              spinHeatMultiplier: heatBeforeSpin.multiplier,
            },
          }),
        { amount: savvyCost, source: spendSource, isFreeSpin: false }
      );
      if (!spend.spent && !spend.duplicate) {
        const err = new Error(`Not enough Savvy. You need ${savvyCost} Savvy for this spin.`);
        err.status = 402;
        err.code = 'INSUFFICIENT_SAVVY';
        err.required = savvyCost;
        err.balance = Math.round(Number(user.savvyPoints) || 0);
        err.spinTraceId = spinTraceId;
        trace.logError('WALLET_DEBIT', err, { amount: savvyCost });
        throw err;
      }
      spinContext.savvySpent = Boolean(spend.spent);
      trace.logOk('WALLET_LEDGER', {
        transactionId: spend.transactionId || null,
        balanceAfter: spend.newBalance,
        spent: spend.spent,
      });
    } else {
      trace.logOk('WALLET_DEBIT', { skipped: true, reason: isFreeSpin ? 'free_spin' : 'zero_cost' });
      trace.logOk('WALLET_LEDGER', { skipped: true });
    }

    trace.logOk('BALANCE_UPDATED', {
      savvySpent: spinContext.savvySpent,
      savvyCost: mode === SPIN_MODES.FREE ? 0 : savvyCost,
      balanceAfterSpend: Math.round(Number(user.savvyPoints) || 0),
    });

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

    trace.runStageSync(
      'SPIN_HISTORY',
      () => {
        pm.spinHistory.push(historyEntry);
        if (pm.spinHistory.length > MAX_HISTORY) {
          pm.spinHistory = pm.spinHistory.slice(-MAX_HISTORY);
        }
        user.markModified('perkMachine');
        return { historyLength: pm.spinHistory.length };
      },
      { mode, slots: historyEntry.slots, savvyCost: historyEntry.savvyCost }
    );

    if (savvySaleSavings > 0 && !usedPaid3Token && !usedPaid2Token) {
      try {
        const { recordSavvySaleSavings } = require('./eventSummaryService');
        await recordSavvySaleSavings(user, savvySaleSavings);
      } catch (err) {
        console.warn('[eventSummary] savvy sale savings track failed:', err?.message);
      }
    }

    const ticketResult = trace.runStageSync(
      'TOURNAMENT_PROGRESS',
      () => recordSpinForTournamentTicket(user, pm),
      { isFreeSpin }
    );

    let spinHeatAdvance = null;
    if (
      mode !== SPIN_MODES.FREE &&
      savvyCost > 0 &&
      !options.adminBypassCost &&
      !usedPaid3Token &&
      !usedPaid2Token
    ) {
      spinHeatAdvance = trace.runStageSync(
        'HEAT_UPDATE',
        () => advanceSpinHeat(user),
        {
          heatTierBefore: heatBeforeSpin.tierIndex,
          heatMultiplierBefore: heatBeforeSpin.multiplier,
        }
      );
      user.markModified('perkMachine');
    } else {
      trace.logOk('HEAT_UPDATE', { skipped: true, isFreeSpin });
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

    const nukeProgress = trace.runStageSync(
      'NUKE_PROGRESS',
      () =>
        recordQualifyingNukeSpin(user, {
          spinId,
          mode,
          savvyCostCharged: finalCost,
          usedPaid3Token,
          usedPaid2Token,
          adminBypass: Boolean(options.adminBypassCost),
        }),
      { isFreeSpin, savvyCostCharged: finalCost }
    );

    pm.lastSpinAt = new Date();
    spinContext.stage = 'persist';
    await trace.runStage(
      'USER_SAVE',
      async () => {
        sanitizePerkMachineForPersist(user);
        await trace.validateUserDoc(user, 'USER');
        await user.save();
        return {
          heatTierIndex: user.perkMachine?.spinHeatTierIndex,
          balanceAfter: Math.round(Number(user.savvyPoints) || 0),
        };
      },
      { isFreeSpin }
    );
    trace.logOk('DB_TRANSACTION_COMMIT', { spinId, mode });

    trace.logOk('SUCCESS', {
      slotCount: slots,
      effectivePrice: finalCost,
      balanceAfter: Math.round(Number(user.savvyPoints) || 0),
      heatTierIndex: user.perkMachine?.spinHeatTierIndex,
      isFreeSpin,
    });

    if (nukeProgress?.thresholdReached) {
      try {
        const { evaluateNukeEggKeychainGrant } = require('./eggKeychainService');
        await evaluateNukeEggKeychainGrant(user, 'nuke_event_activation');
      } catch (err) {
        console.error('[egg-keychains] nuke keychain grant failed', err?.message || err);
      }
    }

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

    let status;
    try {
      status = await getPerkMachineStatusWithEvents(user);
    } catch (statusErr) {
      console.warn('[perk-machine/spin] status refresh failed:', statusErr?.message || statusErr);
      status = getPerkMachineStatus(user);
    }

    return {
      spinTraceId,
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
      status,
    };
  } catch (err) {
    trace.logError(err.failedStage || spinContext?.stage || 'unknown', err, {
      userId: spinContext?.userId || String(userId),
      spinId: spinContext?.spinId || null,
      mode: spinContext?.mode || mode,
      lastOkStage: trace.getLastOkStage(),
    });
    if (spinContext) {
      logPerkSpinFailed(spinContext.stage || 'unknown', err, {
        spinTraceId,
        userId: spinContext.userId,
        spinId: spinContext.spinId,
        mode: spinContext.mode,
        slotCount: spinContext.slotCount,
        effectivePrice: spinContext.effectivePrice,
        heatMultiplier: spinContext.heatMultiplier,
        heatTierIndex: user?.perkMachine?.spinHeatTierIndex,
        savvySpent: spinContext.savvySpent,
        lastOkStage: trace.getLastOkStage(),
      });
      if (spinContext.savvySpent && spinContext.savvyCost > 0) {
        try {
          await refundFailedSpinSavvy(user, spinContext);
        } catch (refundErr) {
          console.error('[perk-machine/spin] savvy refund failed:', refundErr?.message || refundErr);
        }
      }
      try {
        await rollbackFailedSpinEntitlements(user, spinContext);
      } catch (rollbackErr) {
        console.error('[perk-machine/spin] entitlement rollback failed:', rollbackErr?.message || rollbackErr);
      }
      try {
        await rollbackFailedFreeSpinClaim(user, spinContext);
      } catch (freeRollbackErr) {
        console.error('[perk-machine/spin] free spin rollback failed:', freeRollbackErr?.message || freeRollbackErr);
      }
    }
    if (err instanceof SpinLockError) {
      const mapped = new Error(err.message);
      mapped.status = err.status;
      mapped.code = err.code;
      mapped.required = err.required;
      mapped.balance = err.balance;
      mapped.spinTraceId = spinTraceId;
      mapped.failedStage = err.failedStage || 'LOCK_ACQUIRE';
      mapped.lastOkStage = trace.getLastOkStage();
      throw mapped;
    }
    if (err?.name === 'InsufficientSavvyError') {
      const mapped = new Error(err.message);
      mapped.status = 402;
      mapped.code = 'INSUFFICIENT_SAVVY';
      mapped.required = err.required;
      mapped.balance = err.balance;
      mapped.spinTraceId = spinTraceId;
      mapped.failedStage = err.failedStage || 'WALLET_DEBIT';
      mapped.lastOkStage = trace.getLastOkStage();
      throw mapped;
    }
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      const mapped = new Error(err.message || 'Spin reward validation failed');
      mapped.status = 500;
      mapped.code = 'SPIN_FAILED';
      mapped.spinTraceId = spinTraceId;
      mapped.failedStage = err.failedStage || spinContext?.stage || 'USER_SAVE';
      mapped.lastOkStage = trace.getLastOkStage();
      throw mapped;
    }
    if (err && !err.spinTraceId) err.spinTraceId = spinTraceId;
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
  applyReward,
  isFreePerkSpinHourActive,
};
