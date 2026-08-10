/**
 * Savvy Scout Flight — Nuke Flight Streak engine.
 *
 * Layers a secret 30-minute event on top of the existing Scout Flight loop.
 * Hard rules enforced here:
 *  - Player physics, gap generation, and collision are never touched.
 *  - Debris lives in its own array that collision code never reads.
 *  - An obstacle is only destroyed once it is provably behind Scout.
 *  - Exactly one state is active; activation can happen at most once per run.
 */

import {
  NUKE_ACTIVATION_MS,
  NUKE_DEATH_SEQUENCE_MS,
  NUKE_DESTRUCTION_SAFE_MARGIN_PX,
  NUKE_SHAKE_AMPLITUDE,
  NUKE_STATE,
  NUKE_TRIGGER_SECONDS,
  resolveNukeMultiplier,
  resolveNukeSpeedScale,
  resolveNukeVisualPhase,
  resolveNukeWarningStage,
} from './scoutFlightNukeConfig';
import { detectNukeQualityTier, getDebrisLimits, getQualityScale } from './scoutFlightNukeQuality';

/** Guard against a single pathological frame inflating the survival clock. */
const MAX_FRAME_MS = 50;

const MAX_SHOCKWAVES = 6;

/**
 * @param {{ practice?: boolean, qualityTier?: 'high'|'low'|'reduced', testOffsetMs?: number }} opts
 */
export function createNukeState(opts = {}) {
  const qualityTier = opts.qualityTier || detectNukeQualityTier();
  return {
    state: NUKE_STATE.NORMAL,
    practice: Boolean(opts.practice),
    qualityTier,
    qualityScale: getQualityScale(qualityTier),
    debrisLimits: getDebrisLimits(qualityTier),

    /** Active gameplay milliseconds. Only advances on playing, unpaused frames. */
    activeMs: Math.max(0, Number(opts.testOffsetMs) || 0),
    /** activeMs at the moment Nuke Flight activated. */
    activatedAtMs: null,
    nukeSurvivalMs: 0,

    activationTimerMs: 0,
    deathTimerMs: 0,

    multiplier: 1,
    highestMultiplier: 1,
    visualPhase: 'phase1',
    warningStage: null,
    warningStagesSeen: [],

    bonusScore: 0,
    obstaclesEscaped: 0,
    structuresDestroyed: 0,

    debris: [],
    shockwaves: [],
    flash: 0,
    hasActivated: false,
    testSeeded: Number(opts.testOffsetMs) > 0,
  };
}

export function attachNukeState(game, opts = {}) {
  game.nuke = createNukeState(opts);
  return game.nuke;
}

export function isNukeActive(game) {
  return game?.nuke?.state === NUKE_STATE.NUKE_ACTIVE;
}

/** True while the activation cinematic plays — gameplay continues throughout. */
export function isNukeActivating(game) {
  return game?.nuke?.state === NUKE_STATE.NUKE_ACTIVATION;
}

export function isNukeRunning(game) {
  const s = game?.nuke?.state;
  return s === NUKE_STATE.NUKE_ACTIVATION || s === NUKE_STATE.NUKE_ACTIVE;
}

/**
 * Multiplier applied to eligible rewards right now.
 * Returns 1 until Nuke Flight is genuinely active.
 */
export function getNukeRewardMultiplier(game) {
  if (!isNukeActive(game)) return 1;
  return Math.max(1, Number(game.nuke.multiplier) || 1);
}

/**
 * Combines the Nuke multiplier with any existing temporary run multiplier.
 *
 * `game.runMultiplier` is the integration point for Scout Flight pickup
 * multipliers (none ship today, so it stays 1). Nuke 5x with a 2x pickup
 * legitimately yields 10x through this single code path.
 */
export function getCombinedRewardMultiplier(game) {
  const runMult = Math.max(1, Number(game?.runMultiplier) || 1);
  return getNukeRewardMultiplier(game) * runMult;
}

/** Scroll-speed scale. 1 unless Nuke Flight is active. */
export function getNukeSpeedScale(game) {
  if (!isNukeActive(game)) return 1;
  return resolveNukeSpeedScale(game.nuke.nukeSurvivalMs);
}

/** Current camera shake amplitude in px (0 under reduced motion). */
export function getNukeShakeAmplitude(game) {
  const nuke = game?.nuke;
  if (!nuke || !isNukeRunning(game)) return 0;
  const base = NUKE_SHAKE_AMPLITUDE[nuke.visualPhase] ?? NUKE_SHAKE_AMPLITUDE.phase1;
  const activationBoost = nuke.state === NUKE_STATE.NUKE_ACTIVATION ? 1.6 : 1;
  return base * activationBoost * nuke.qualityScale;
}

function pushShockwave(nuke, x, y, strength = 1) {
  if (nuke.qualityScale === 0) return;
  nuke.shockwaves.push({ x, y, r: 10, maxR: 260 * strength, life: 900, maxLife: 900 });
  if (nuke.shockwaves.length > MAX_SHOCKWAVES) {
    nuke.shockwaves.splice(0, nuke.shockwaves.length - MAX_SHOCKWAVES);
  }
}

function advanceWarningStage(game) {
  const nuke = game.nuke;
  const stage = resolveNukeWarningStage(nuke.activeMs);
  if (!stage) return;

  nuke.warningStage = stage;
  if (nuke.state === NUKE_STATE.NORMAL) {
    nuke.state = NUKE_STATE.NUKE_WARNING;
  }
  if (!nuke.warningStagesSeen.includes(stage.id)) {
    nuke.warningStagesSeen.push(stage.id);
    game.events.push({ type: 'nuke_warning', stage: stage.id, intensity: stage.intensity });
  }
}

function activateNuke(game) {
  const nuke = game.nuke;
  if (nuke.hasActivated) return;

  nuke.hasActivated = true;
  nuke.state = NUKE_STATE.NUKE_ACTIVATION;
  nuke.activatedAtMs = nuke.activeMs;
  nuke.activationTimerMs = 0;
  nuke.nukeSurvivalMs = 0;
  nuke.multiplier = resolveNukeMultiplier(0);
  nuke.highestMultiplier = nuke.multiplier;
  nuke.visualPhase = resolveNukeVisualPhase(0).id;
  nuke.warningStage = null;
  nuke.flash = 1;
  pushShockwave(nuke, game.width * 1.1, game.height * 0.45, 1.6);
  game.events.push({ type: 'nuke_activated', practice: nuke.practice });
}

function spawnDebrisForObstacle(game, o) {
  const nuke = game.nuke;
  const limits = nuke.debrisLimits;
  if (nuke.debris.length >= limits.maxPieces) return;

  const budget = Math.min(limits.perObstacle, limits.maxPieces - nuke.debris.length);
  const segments = [
    { y: 0, h: o.topH },
    { y: o.bottomY, h: Math.max(0, game.height - game.groundH - o.bottomY) },
  ];

  for (let i = 0; i < budget; i += 1) {
    const seg = segments[i % segments.length];
    if (seg.h <= 4) continue;
    const size = 6 + Math.random() * 14;
    nuke.debris.push({
      x: o.x + Math.random() * o.w,
      y: seg.y + Math.random() * Math.max(1, seg.h - size),
      w: size,
      h: size,
      // Always negative: debris is pulled further away from Scout, never toward them.
      vx: -(game.speed * (1.15 + Math.random() * 0.85)),
      vy: (Math.random() - 0.5) * 2.2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.22,
      life: 1300 + Math.random() * 700,
      maxLife: 2000,
      /** Debris is decorative. Collision code never reads this array. */
      collides: false,
    });
  }
}

/**
 * Destroys obstacles that are safely behind Scout and counts escapes.
 * Called after obstacles have been moved for this frame.
 */
function processObstacleWake(game) {
  const nuke = game.nuke;
  const scoutLeftEdge = game.scout.x;

  for (const o of game.obstacles) {
    const clearedBy = scoutLeftEdge - (o.x + o.w);
    if (clearedBy <= 0) continue;

    if (!o.nukeEscaped) {
      o.nukeEscaped = true;
      nuke.obstaclesEscaped += 1;
    }

    if (!isNukeActive(game)) continue;
    if (o.nukeDestroyed) continue;
    if (clearedBy < NUKE_DESTRUCTION_SAFE_MARGIN_PX) continue;

    o.nukeDestroyed = true;
    o.nukeDestroyProgress = 0;
    nuke.structuresDestroyed += 1;
    spawnDebrisForObstacle(game, o);
    pushShockwave(nuke, o.x + o.w / 2, game.height * 0.5, 0.55);
    game.events.push({ type: 'nuke_structure_destroyed', total: nuke.structuresDestroyed });
  }
}

function updateDebris(game, dtMs) {
  const nuke = game.nuke;
  if (!nuke.debris.length) return;

  const despawnLeft = -80;
  const forwardGuard = game.scout.x - 8;
  const next = [];

  for (const d of nuke.debris) {
    d.x += d.vx;
    d.y += d.vy;
    d.rot += d.vr;
    d.life -= dtMs;
    // Defensive: debris must never end up in the active flight corridor.
    if (d.life <= 0 || d.x + d.w < despawnLeft || d.x > forwardGuard) continue;
    next.push(d);
  }

  nuke.debris = next;
}

function updateShockwaves(game, dtMs) {
  const nuke = game.nuke;
  if (!nuke.shockwaves.length) return;
  const next = [];
  for (const s of nuke.shockwaves) {
    s.life -= dtMs;
    s.r += (s.maxR - s.r) * Math.min(1, dtMs / 320);
    if (s.life > 0) next.push(s);
  }
  nuke.shockwaves = next;
}

function updateDestroyProgress(game, dtMs) {
  for (const o of game.obstacles) {
    if (o.nukeDestroyed && o.nukeDestroyProgress < 1) {
      o.nukeDestroyProgress = Math.min(1, o.nukeDestroyProgress + dtMs / 420);
    }
  }
}

/**
 * Nuke tick for a live playing frame. Must run after obstacles move.
 * @param {object} game
 * @param {number} dtMs
 */
export function updateNukeInPlay(game, dtMs) {
  const nuke = game.nuke;
  if (!nuke) return;

  const dt = Math.min(MAX_FRAME_MS, Math.max(0, Number(dtMs) || 0));
  nuke.activeMs += dt;

  if (nuke.flash > 0) nuke.flash = Math.max(0, nuke.flash - dt / 900);

  if (!nuke.hasActivated) {
    advanceWarningStage(game);
    if (nuke.activeMs >= NUKE_TRIGGER_SECONDS * 1000) {
      activateNuke(game);
    }
  } else if (nuke.state === NUKE_STATE.NUKE_ACTIVATION) {
    nuke.activationTimerMs += dt;
    nuke.nukeSurvivalMs = Math.max(0, nuke.activeMs - nuke.activatedAtMs);
    if (nuke.activationTimerMs >= NUKE_ACTIVATION_MS) {
      nuke.state = NUKE_STATE.NUKE_ACTIVE;
      game.events.push({ type: 'nuke_active' });
    }
  } else if (nuke.state === NUKE_STATE.NUKE_ACTIVE) {
    nuke.nukeSurvivalMs = Math.max(0, nuke.activeMs - nuke.activatedAtMs);

    const nextMultiplier = resolveNukeMultiplier(nuke.nukeSurvivalMs);
    if (nextMultiplier !== nuke.multiplier) {
      const previous = nuke.multiplier;
      nuke.multiplier = nextMultiplier;
      if (nextMultiplier > nuke.highestMultiplier) {
        nuke.highestMultiplier = nextMultiplier;
      }
      game.events.push({ type: 'nuke_multiplier', multiplier: nextMultiplier, previous });
    }

    const nextPhase = resolveNukeVisualPhase(nuke.nukeSurvivalMs).id;
    if (nextPhase !== nuke.visualPhase) {
      nuke.visualPhase = nextPhase;
      nuke.flash = Math.max(nuke.flash, 0.55);
      pushShockwave(nuke, game.width * 1.05, game.height * 0.5, 1.2);
      game.events.push({ type: 'nuke_phase', phase: nextPhase });
    }
  }

  processObstacleWake(game);
  updateDestroyProgress(game, dt);
  updateDebris(game, dt);
  updateShockwaves(game, dt);
}

/**
 * Nuke tick for non-playing frames: death cinematic and settling debris.
 * Never resurrects gameplay and never advances the survival clock.
 */
export function updateNukeAfterlife(game, dtMs) {
  const nuke = game?.nuke;
  if (!nuke) return;
  const dt = Math.min(MAX_FRAME_MS, Math.max(0, Number(dtMs) || 0));

  if (nuke.flash > 0) nuke.flash = Math.max(0, nuke.flash - dt / 900);

  if (nuke.state === NUKE_STATE.NUKE_DEATH) {
    nuke.deathTimerMs += dt;
    if (nuke.deathTimerMs >= NUKE_DEATH_SEQUENCE_MS) {
      nuke.state = NUKE_STATE.NUKE_RESULTS;
      game.events.push({ type: 'nuke_results' });
    }
  }

  updateDebris(game, dt);
  updateShockwaves(game, dt);
}

/**
 * Called when the run ends. Escalates into the Nuke death cinematic only if
 * Nuke Flight was genuinely running.
 */
export function handleNukeRunEnd(game) {
  const nuke = game?.nuke;
  if (!nuke) return false;
  if (!isNukeRunning(game)) {
    nuke.state = NUKE_STATE.NORMAL;
    return false;
  }

  nuke.state = NUKE_STATE.NUKE_DEATH;
  nuke.deathTimerMs = 0;
  nuke.flash = 1;
  pushShockwave(nuke, game.scout.x + game.scout.w / 2, game.scout.y + game.scout.h / 2, 2);
  game.events.push({ type: 'nuke_death' });
  return true;
}

/**
 * Verified-by-construction run summary for the results screen and server submit.
 */
export function getNukeRunSummary(game) {
  const nuke = game?.nuke;
  if (!nuke) return null;
  return {
    triggered: nuke.hasActivated,
    practice: nuke.practice,
    state: nuke.state,
    totalSurvivalMs: Math.round(nuke.activeMs),
    nukeSurvivalMs: Math.round(nuke.nukeSurvivalMs),
    highestMultiplier: nuke.highestMultiplier,
    obstaclesEscaped: nuke.obstaclesEscaped,
    structuresDestroyed: nuke.structuresDestroyed,
    baseScore: Math.round(Number(game.baseScore) || 0),
    bonusScore: Math.round(nuke.bonusScore),
    totalScore: Math.round(Number(game.score) || 0),
    testSeeded: Boolean(nuke.testSeeded),
  };
}

/**
 * Dev/admin only: seed the survival clock so the final seconds can be rehearsed.
 * The server derives payouts from its own run duration, so this can never pay out.
 */
export function devSeedNukeClock(game, seconds) {
  const nuke = game?.nuke;
  if (!nuke || nuke.hasActivated) return false;
  const target = Math.max(0, Number(seconds) || 0) * 1000;
  nuke.activeMs = Math.min(target, NUKE_TRIGGER_SECONDS * 1000 - 1);
  nuke.testSeeded = true;
  advanceWarningStage(game);
  return true;
}

/** Dev/admin only: force activation immediately. */
export function devForceNukeActivation(game) {
  const nuke = game?.nuke;
  if (!nuke || nuke.hasActivated) return false;
  nuke.activeMs = NUKE_TRIGGER_SECONDS * 1000;
  nuke.testSeeded = true;
  activateNuke(game);
  return true;
}

/** Dev/admin only: jump the Nuke survival clock to exercise later phases. */
export function devSetNukeSurvival(game, seconds) {
  const nuke = game?.nuke;
  if (!nuke || !nuke.hasActivated) return false;
  const ms = Math.max(0, Number(seconds) || 0) * 1000;
  nuke.activatedAtMs = nuke.activeMs - ms;
  nuke.nukeSurvivalMs = ms;
  nuke.multiplier = resolveNukeMultiplier(ms);
  nuke.highestMultiplier = Math.max(nuke.highestMultiplier, nuke.multiplier);
  nuke.visualPhase = resolveNukeVisualPhase(ms).id;
  nuke.testSeeded = true;
  return true;
}
