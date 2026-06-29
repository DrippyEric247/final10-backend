/**
 * Headless Scout Flight playtests — survival time + coin economy sampling.
 */

import {
  createGame,
  startGame,
  updateGame,
  flap,
  PHASE,
  getSelectableDifficulties,
  getDifficultyConfig,
  getScoutCollisionRadius,
} from './scoutFlightEngine';

const DT_MS = 16;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 640;

/** Conservative bot — underestimates human survival. */
export function botShouldFlap(game) {
  const s = game.scout;
  const cr = getScoutCollisionRadius(game);
  const cy = s.y + s.h / 2;
  const cx = s.x + s.w / 2;

  const upcoming = game.obstacles
    .filter((o) => o.x + o.w > cx - 50)
    .sort((a, b) => a.x - b.x)[0];

  const cruiseY = game.height * 0.4;

  if (upcoming) {
    const gapCenter = (upcoming.topH + upcoming.bottomY) / 2;
    const safeTop = upcoming.topH + cr + 10;
    const safeBottom = upcoming.bottomY - cr - 10;
    const target = Math.max(safeTop, Math.min(safeBottom, gapCenter));
    const dist = upcoming.x - cx;

    if (dist < 360) {
      if (cy > safeBottom) return true;
      if (cy > target + 4) return true;
      if (cy < target && s.vy < 1.2) return false;
      if (cy < safeTop && s.vy < 0.8) return false;
      if (cy > target && s.vy > 0.4) return true;
      return cy > target + 1;
    }

    if (cy > target + 14) return true;
    if (cy < target - 16) return false;
    if (cy > target + 4) return true;
    return false;
  }

  if (cy < 36 && s.vy <= 0) return false;
  if (cy < cruiseY - 22 && s.vy < -1) return false;
  if (cy > cruiseY + 8) return true;
  if (s.vy > 2.4) return true;
  if (cy > game.height * 0.52) return true;

  return false;
}

/**
 * Run one simulated session until game over.
 * @returns {{ survivalMs: number, survivalSec: number, score: number, difficultyId: string }}
 */
export function runSimulatedSession(difficultyId, opts = {}) {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const maxMs = opts.maxMs ?? 180_000;
  const seed = opts.seed ?? Math.random();

  const randomSpy = jestLikeRandom(seed);
  const nativeRandom = Math.random;
  Math.random = randomSpy;

  const game = createGame(width, height, difficultyId, { simMode: true });
  startGame(game);
  flap(game);

  let ticks = 0;
  let framesSinceFlap = 999;
  while (game.phase === PHASE.PLAYING && game.elapsed < maxMs) {
    if (framesSinceFlap >= 12 && botShouldFlap(game)) {
      flap(game);
      framesSinceFlap = 0;
    } else {
      framesSinceFlap += 1;
    }
    updateGame(game, DT_MS);
    ticks += 1;
  }

  Math.random = nativeRandom;

  return {
    difficultyId,
    survivalMs: game.elapsed,
    survivalSec: Math.round((game.elapsed / 1000) * 10) / 10,
    score: game.score,
    ticks,
    seed,
  };
}

/** Simple LCG for reproducible sim runs without pulling in a dependency. */
function jestLikeRandom(seed) {
  let state = Math.floor(seed * 1_000_000) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function summarizeRuns(runs) {
  if (!runs.length) {
    return { runs: 0, avgSurvivalSec: 0, medianSurvivalSec: 0, avgScore: 0, avgScorePerSec: 0 };
  }
  const survival = runs.map((r) => r.survivalSec).sort((a, b) => a - b);
  const scores = runs.map((r) => r.score);
  const avgSurvivalSec =
    Math.round((survival.reduce((a, b) => a + b, 0) / survival.length) * 10) / 10;
  const medianSurvivalSec = survival[Math.floor(survival.length / 2)];
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const avgScorePerSec =
    Math.round(
      (runs.reduce((sum, r) => sum + (r.survivalSec > 0 ? r.score / r.survivalSec : 0), 0) /
        runs.length) *
        100
    ) / 100;

  return {
    runs: runs.length,
    avgSurvivalSec,
    medianSurvivalSec,
    minSurvivalSec: survival[0],
    maxSurvivalSec: survival[survival.length - 1],
    avgScore,
    avgScorePerSec,
  };
}

/**
 * Batch playtest all selectable difficulties.
 * @param {{ runsPerDifficulty?: number, width?: number, height?: number }} opts
 */
export function runPlaytestReport(opts = {}) {
  const runsPerDifficulty = opts.runsPerDifficulty ?? 100;
  const difficulties = getSelectableDifficulties();
  const byDifficulty = {};
  const coinBalance = {
    note: 'Coin spawn rates unchanged; score reflects same economy as live play.',
    comboBonusEvery: 3,
    comboBonusPoints: 10,
  };

  for (const d of difficulties) {
    const runs = [];
    for (let i = 0; i < runsPerDifficulty; i += 1) {
      runs.push(runSimulatedSession(d.id, { ...opts, seed: (opts.baseSeed ?? 0.17) + i * 0.0137 }));
    }
    const summary = summarizeRuns(runs);
    const cfg = getDifficultyConfig(d.id);
    byDifficulty[d.id] = {
      label: d.label,
      hitbox: `${cfg.hitboxW}x${cfg.hitboxH}`,
      sprite: `${cfg.spriteW}x${cfg.spriteH}`,
      hitPad: cfg.hitPad,
      collisionRadius: Math.max(0, cfg.hitboxW / 2 - cfg.hitPad),
      hitboxVsSpritePct: Math.round((1 - cfg.hitboxW / cfg.spriteW) * 100),
      ...summary,
      targetSurvivalSec: '60-120',
      meetsNormalTarget:
        d.id === 'NORMAL' ? summary.avgSurvivalSec >= 60 && summary.avgSurvivalSec <= 120 : null,
    };
  }

  const practice = byDifficulty.PRACTICE;
  const normal = byDifficulty.NORMAL;
  const tournament = byDifficulty.TOURNAMENT;

  return {
    generatedAt: new Date().toISOString(),
    viewport: { width: opts.width ?? DEFAULT_WIDTH, height: opts.height ?? DEFAULT_HEIGHT },
    runsPerDifficulty,
    byDifficulty,
    difficultyOrdering: {
      practiceAvgGteNormal: practice.avgSurvivalSec >= normal.avgSurvivalSec,
      normalAvgGteTournament: normal.avgSurvivalSec >= tournament.avgSurvivalSec,
      practiceMaxGteTournamentMax: practice.maxSurvivalSec >= tournament.maxSurvivalSec,
    },
    humanTargetNote:
      'Design target: practiced human players reach 60–120s on Normal. Automated bot averages are conservative; use debug hitbox overlay for manual QA.',
    coinBalance,
  };
}
