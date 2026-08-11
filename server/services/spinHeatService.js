/**
 * Server-authoritative Spin Heat state for Perk Machine paid spins.
 */
const {
  SPIN_HEAT_MULTIPLIERS,
  SPIN_HEAT_MAX,
  SPIN_HEAT_COOLDOWN_MS,
  PERK_SPIN_HEAT_RESET_MINUTES,
  PERK_SPIN_HEAT_RESET_MS,
  applySpinHeatToBaseCost,
} = require('../config/spinHeatConfig');

function ensureSpinHeatFields(pm) {
  if (typeof pm.spinHeatTierIndex !== 'number') pm.spinHeatTierIndex = 0;
  if (pm.spinHeatCooldownUntil === undefined) pm.spinHeatCooldownUntil = null;
}

function resetSpinHeatToNormal(pm) {
  pm.spinHeatTierIndex = 0;
  pm.spinHeatCooldownUntil = null;
}

function getLastPerkSpinAtMs(pm) {
  if (!pm?.lastSpinAt) return null;
  const ts = new Date(pm.lastSpinAt).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/**
 * Reset heat to 1x after PERK_SPIN_HEAT_RESET_MINUTES without a completed Perk Machine spin.
 * Uses perkMachine.lastSpinAt as the authoritative lastPerkSpinAt timestamp.
 * @returns {boolean} whether a reset was applied
 */
function maybeResetSpinHeatFromInactivity(user) {
  const pm = user?.perkMachine;
  if (!pm) return false;
  ensureSpinHeatFields(pm);

  const lastSpinAtMs = getLastPerkSpinAtMs(pm);
  if (lastSpinAtMs == null) return false;

  if (Date.now() - lastSpinAtMs < PERK_SPIN_HEAT_RESET_MS) return false;

  const hasHeatState =
    (Number(pm.spinHeatTierIndex) || 0) > 0 || pm.spinHeatCooldownUntil != null;
  if (!hasHeatState) return false;

  resetSpinHeatToNormal(pm);
  return true;
}

/**
 * Reset heat to 1x when max-heat cap cooldown has elapsed (anti-abuse cap behavior).
 * Separate from inactivity reset — applies while the user may still be actively spinning at 10x.
 * @returns {boolean} whether a reset was applied
 */
function maybeResetSpinHeatFromCapCooldown(user) {
  const pm = user?.perkMachine;
  if (!pm) return false;
  ensureSpinHeatFields(pm);
  if (!pm.spinHeatCooldownUntil) return false;

  const until = new Date(pm.spinHeatCooldownUntil).getTime();
  if (Number.isNaN(until) || Date.now() < until) return false;

  resetSpinHeatToNormal(pm);
  return true;
}

/**
 * Apply any elapsed inactivity or cap-cooldown resets.
 * @returns {boolean} whether a reset was applied
 */
function maybeResetSpinHeat(user) {
  const inactivityReset = maybeResetSpinHeatFromInactivity(user);
  const capReset = maybeResetSpinHeatFromCapCooldown(user);
  return inactivityReset || capReset;
}

function getSpinHeatState(user) {
  const pm = user?.perkMachine || {};
  ensureSpinHeatFields(pm);
  maybeResetSpinHeat(user);

  const tierIndex = Math.min(
    SPIN_HEAT_MULTIPLIERS.length - 1,
    Math.max(0, Number(pm.spinHeatTierIndex) || 0)
  );
  const multiplier = SPIN_HEAT_MULTIPLIERS[tierIndex];
  const isMax = multiplier === SPIN_HEAT_MAX;
  const cooldownUntil = pm.spinHeatCooldownUntil ? new Date(pm.spinHeatCooldownUntil) : null;
  const cooldownActive =
    isMax && cooldownUntil && !Number.isNaN(cooldownUntil.getTime()) && cooldownUntil.getTime() > Date.now();
  const msUntilReset = cooldownActive ? Math.max(0, cooldownUntil.getTime() - Date.now()) : 0;

  const lastSpinAtMs = getLastPerkSpinAtMs(pm);
  const msSinceLastSpin = lastSpinAtMs != null ? Math.max(0, Date.now() - lastSpinAtMs) : null;
  const msUntilInactivityReset =
    lastSpinAtMs != null && multiplier > 1
      ? Math.max(0, PERK_SPIN_HEAT_RESET_MS - (Date.now() - lastSpinAtMs))
      : null;

  return {
    tierIndex,
    multiplier,
    isMax,
    cooldownActive,
    cooldownUntil: cooldownUntil && !Number.isNaN(cooldownUntil.getTime())
      ? cooldownUntil.toISOString()
      : null,
    msUntilReset,
    lastPerkSpinAt: lastSpinAtMs != null ? new Date(lastSpinAtMs).toISOString() : null,
    msSinceLastSpin,
    inactivityResetMinutes: PERK_SPIN_HEAT_RESET_MINUTES,
    msUntilInactivityReset,
  };
}

function formatInactivityResetLabel(minutes) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function formatSpinHeatForClient(state) {
  return {
    multiplier: state.multiplier,
    tierIndex: state.tierIndex,
    isMax: state.isMax,
    cooldownActive: state.cooldownActive,
    cooldownUntil: state.cooldownUntil,
    msUntilReset: state.msUntilReset,
    lastPerkSpinAt: state.lastPerkSpinAt,
    inactivityResetMinutes: state.inactivityResetMinutes,
    inactivityHint: `Spin Heat cools back to normal after ${formatInactivityResetLabel(
      state.inactivityResetMinutes
    )} without spinning.`,
    label:
      state.isMax && state.cooldownActive
        ? `MAX HEAT — Resets in ${formatHeatCountdown(state.msUntilReset)}`
        : state.isMax
          ? `MAX SPIN HEAT — ${state.multiplier}x`
          : `SPIN HEAT — ${state.multiplier}x`,
  };
}

function formatHeatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Advance heat after a successful paid Savvy spin.
 * @returns {{ previousMultiplier: number, currentMultiplier: number, increased: boolean }}
 */
function advanceSpinHeat(user) {
  const pm = user.perkMachine;
  ensureSpinHeatFields(pm);

  let tierIndex = Math.min(
    SPIN_HEAT_MULTIPLIERS.length - 1,
    Math.max(0, Number(pm.spinHeatTierIndex) || 0)
  );
  const previousMultiplier = SPIN_HEAT_MULTIPLIERS[tierIndex];

  if (tierIndex < SPIN_HEAT_MULTIPLIERS.length - 1) {
    tierIndex += 1;
    pm.spinHeatTierIndex = tierIndex;
  }

  const currentMultiplier = SPIN_HEAT_MULTIPLIERS[tierIndex];

  if (currentMultiplier === SPIN_HEAT_MAX && !pm.spinHeatCooldownUntil) {
    pm.spinHeatCooldownUntil = new Date(Date.now() + SPIN_HEAT_COOLDOWN_MS);
  }

  return {
    previousMultiplier,
    currentMultiplier,
    increased: currentMultiplier > previousMultiplier,
    tierIndex,
    isMax: currentMultiplier === SPIN_HEAT_MAX,
    cooldownUntil: pm.spinHeatCooldownUntil
      ? new Date(pm.spinHeatCooldownUntil).toISOString()
      : null,
  };
}

function resolveHeatAdjustedSavvyCost(baseSavvy, user) {
  const state = getSpinHeatState(user);
  return {
    cost: applySpinHeatToBaseCost(baseSavvy, state.multiplier),
    baseSavvy: baseSavvy,
    spinHeat: state,
  };
}

module.exports = {
  maybeResetSpinHeat,
  maybeResetSpinHeatFromInactivity,
  maybeResetSpinHeatFromCapCooldown,
  getSpinHeatState,
  formatSpinHeatForClient,
  formatHeatCountdown,
  advanceSpinHeat,
  resolveHeatAdjustedSavvyCost,
  ensureSpinHeatFields,
  resetSpinHeatToNormal,
  getLastPerkSpinAtMs,
};
