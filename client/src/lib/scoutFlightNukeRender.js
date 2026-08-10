/**
 * Savvy Scout Flight — Nuke Flight canvas rendering.
 *
 * Readability contract: every effect in this module is either drawn behind the
 * gameplay layer, or clipped to the region left of Scout. Nothing opaque is ever
 * drawn to the right of Scout, so upcoming pipes, gaps, and coins stay readable
 * at maximum intensity.
 */

import { NUKE_STATE } from './scoutFlightNukeConfig';
import { getNukeShakeAmplitude } from './scoutFlightNukeEngine';

const PHASE_INTENSITY = { phase1: 0.35, phase2: 0.55, phase3: 0.78, extreme: 1 };

/** Full-screen flash is hard-capped so a flash can never hide an obstacle. */
const MAX_FLASH_ALPHA = 0.34;

function phaseIntensity(nuke) {
  return PHASE_INTENSITY[nuke?.visualPhase] ?? PHASE_INTENSITY.phase1;
}

function isRunning(nuke) {
  return nuke?.state === NUKE_STATE.NUKE_ACTIVATION || nuke?.state === NUKE_STATE.NUKE_ACTIVE;
}

/**
 * Camera shake offset. Purely a render translation — collision math never sees it.
 * @returns {{ x: number, y: number }}
 */
export function getNukeShakeOffset(game, t) {
  const amp = getNukeShakeAmplitude(game);
  if (amp <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(t * 0.031) * amp + Math.sin(t * 0.077) * amp * 0.4,
    y: Math.cos(t * 0.043) * amp * 0.7,
  };
}

/** Pre-Nuke anomalies: subtle, never explanatory. */
export function drawNukeWarningAtmosphere(ctx, w, h, t, nuke) {
  const stage = nuke?.warningStage;
  if (!stage || nuke.qualityScale === 0) return;

  const intensity = stage.intensity / 6;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.0011 * (1 + intensity));

  ctx.save();
  ctx.globalAlpha = 0.05 + intensity * 0.11 * pulse;
  const g = ctx.createLinearGradient(0, h, 0, h * 0.35);
  g.addColorStop(0, '#7f1d1d');
  g.addColorStop(1, 'rgba(127, 29, 29, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  if (stage.intensity >= 3) {
    const beacon = 0.5 + 0.5 * Math.sin(t * 0.004);
    ctx.save();
    ctx.globalAlpha = 0.12 + intensity * 0.2 * beacon;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w * 0.08, h * 0.18, 5 + intensity * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Nuclear sky wash. Drawn over the base background, under all gameplay objects. */
export function drawNukeSky(ctx, w, h, t, nuke) {
  if (!isRunning(nuke) && nuke?.state !== NUKE_STATE.NUKE_DEATH) return;
  const intensity = phaseIntensity(nuke);
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.0016);

  ctx.save();
  ctx.globalAlpha = 0.3 + intensity * 0.34;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3b0a02');
  g.addColorStop(0.4, `rgba(180, 45, 8, ${0.55 + pulse * 0.16})`);
  g.addColorStop(1, '#160303');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  if (nuke.qualityScale > 0) {
    ctx.save();
    ctx.globalAlpha = 0.1 + intensity * 0.18;
    ctx.fillStyle = '#fbbf24';
    const emberCount = nuke.qualityTier === 'high' ? 22 : 9;
    for (let i = 0; i < emberCount; i += 1) {
      const ex = (w - ((i * 91 + t * 0.11) % (w + 60))) - 20;
      const ey = (i * 67 + Math.sin(t * 0.002 + i) * 24) % h;
      ctx.beginPath();
      ctx.arc(ex, ey, 1 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * The blast wall chasing from behind (obstacles travel right-to-left, so
 * "behind" is the left edge). Its reach is hard-clamped well short of Scout.
 */
export function drawNukeBlastWall(ctx, game, t) {
  const nuke = game.nuke;
  if (!isRunning(nuke) && nuke?.state !== NUKE_STATE.NUKE_DEATH) return;

  const intensity = phaseIntensity(nuke);
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.005);
  const dying = nuke.state === NUKE_STATE.NUKE_DEATH;
  // Never allowed to reach the player or the corridor in front of them.
  const safeReach = Math.max(40, game.scout.x - 90);
  const reach = dying
    ? Math.max(safeReach, game.scout.x + game.scout.w)
    : Math.min(safeReach, game.width * (0.18 + intensity * 0.16) + pulse * 12);

  ctx.save();
  const g = ctx.createLinearGradient(0, 0, reach, 0);
  g.addColorStop(0, `rgba(255, 247, 214, ${0.85 * (dying ? 1 : 0.55 + intensity * 0.35)})`);
  g.addColorStop(0.35, `rgba(251, 146, 60, ${0.5 + intensity * 0.3})`);
  g.addColorStop(0.75, `rgba(180, 40, 10, ${0.3 + intensity * 0.25})`);
  g.addColorStop(1, 'rgba(120, 20, 5, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, reach, game.height);
  ctx.restore();
}

export function drawNukeShockwaves(ctx, nuke) {
  if (!nuke?.shockwaves?.length) return;
  ctx.save();
  for (const s of nuke.shockwaves) {
    const alpha = Math.max(0, s.life / s.maxLife) * 0.4;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Debris. Clipped to the region behind Scout so a stray piece can never visually
 * imply a hazard in the flight path (it has no collision either way).
 */
export function drawNukeDebris(ctx, game) {
  const nuke = game.nuke;
  if (!nuke?.debris?.length) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Math.max(0, game.scout.x - 8), game.height);
  ctx.clip();

  for (const d of nuke.debris) {
    const alpha = Math.max(0, Math.min(1, d.life / d.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
    ctx.rotate(d.rot);
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    ctx.strokeStyle = `rgba(251, 146, 60, ${alpha * 0.7})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * A pipe mid-collapse. Only ever called for obstacles already behind Scout, so
 * fading it out cannot remove information the player still needs.
 */
export function drawCrumblingObstacle(ctx, o, h, groundH) {
  const p = Math.min(1, Math.max(0, o.nukeDestroyProgress || 0));
  const alpha = 1 - p;
  if (alpha <= 0.02) return;

  const lean = p * 14;
  const blocks = [
    { x: o.x - lean, y: 0, w: o.w, hh: o.topH * (1 - p * 0.45) },
    { x: o.x - lean * 0.6, y: o.bottomY + p * 12, w: o.w, hh: (h - groundH - o.bottomY) * (1 - p * 0.4) },
  ];

  ctx.save();
  ctx.globalAlpha = alpha;
  for (const b of blocks) {
    if (b.hh <= 0) continue;
    const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.hh);
    grad.addColorStop(0, '#3b0764');
    grad.addColorStop(0.5, '#7c2d12');
    grad.addColorStop(1, '#1a0f35');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.w, b.hh);
    ctx.strokeStyle = `rgba(251, 146, 60, ${0.6 * alpha})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, Math.max(0, b.hh - 2));
  }
  ctx.restore();
}

/** Global flash, alpha-capped so visibility is preserved. */
export function drawNukeFlash(ctx, w, h, nuke) {
  const flash = Number(nuke?.flash) || 0;
  if (flash <= 0 || !nuke) return;
  const alpha = Math.min(MAX_FLASH_ALPHA, flash * MAX_FLASH_ALPHA) * (nuke.qualityScale || 0.35);
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff7ed';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Thin vignette that frames the action without covering it. Skipped entirely
 * under reduced motion.
 */
export function drawNukeVignette(ctx, w, h, nuke) {
  if (!isRunning(nuke) || !nuke.qualityScale) return;
  const intensity = phaseIntensity(nuke);
  ctx.save();
  ctx.globalAlpha = 0.18 + intensity * 0.2;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.42, w * 0.5, h * 0.5, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(60, 5, 0, 0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
