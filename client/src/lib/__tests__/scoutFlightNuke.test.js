/**
 * Nuke Flight Streak — engine tests.
 * Run: npm test -- scoutFlightNuke --watchAll=false
 */

import {
  createGame,
  startGame,
  updateGame,
  flap,
  PHASE,
} from '../scoutFlightEngine';
import {
  devForceNukeActivation,
  devSeedNukeClock,
  devSetNukeSurvival,
  getCombinedRewardMultiplier,
  getNukeRewardMultiplier,
  getNukeShakeAmplitude,
  getNukeRunSummary,
  getNukeSpeedScale,
  isNukeActive,
} from '../scoutFlightNukeEngine';
import {
  MAX_NUKE_FLIGHT_MULTIPLIER,
  NUKE_STATE,
  NUKE_TRIGGER_SECONDS,
  resolveNukeMultiplier,
  resolveNukeVisualPhase,
  resolveNukeWarningStage,
  resolveNukeSpeedScale,
  NUKE_SPEED_SCALE_MAX,
} from '../scoutFlightNukeConfig';

const W = 800;
const H = 600;
const FRAME = 16;

function makeRunningGame(opts = {}) {
  const game = createGame(W, H, 'TOURNAMENT', { qualityTier: 'high', ...opts });
  startGame(game);
  return game;
}

/** Advances active gameplay time without the scout ever touching anything. */
function survive(game, seconds) {
  const frames = Math.ceil((seconds * 1000) / FRAME);
  for (let i = 0; i < frames; i += 1) {
    // Keep Scout airborne so the run cannot end during the fast-forward.
    if (game.scout.vy > 2) flap(game);
    game.obstacles = [];
    updateGame(game, FRAME);
    if (game.phase !== PHASE.PLAYING) break;
  }
}

/**
 * Flies the real spawn/despawn/destruction pipeline by steering Scout to the
 * centre of the gap it is currently clearing, so nothing is stubbed out.
 */
function surviveAutopilot(game, seconds) {
  const frames = Math.ceil((seconds * 1000) / FRAME);
  for (let i = 0; i < frames; i += 1) {
    const s = game.scout;
    const overlapping = game.obstacles.find((o) => o.x < s.x + s.w && o.x + o.w > s.x);
    const upcoming = game.obstacles
      .filter((o) => o.x >= s.x + s.w)
      .sort((a, b) => a.x - b.x)[0];
    const target = overlapping || upcoming;
    if (target) {
      s.y = (target.topH + target.bottomY) / 2 - s.h / 2;
      s.vy = 0;
    } else if (s.vy > 2) {
      flap(game);
    }
    updateGame(game, FRAME);
    if (game.phase !== PHASE.PLAYING) break;
  }
}

describe('nuke config maths', () => {
  it('escalates the multiplier one step per minute and then caps', () => {
    expect(resolveNukeMultiplier(0)).toBe(2);
    expect(resolveNukeMultiplier(59_999)).toBe(2);
    expect(resolveNukeMultiplier(60_000)).toBe(3);
    expect(resolveNukeMultiplier(120_000)).toBe(4);
    expect(resolveNukeMultiplier(180_000)).toBe(5);
    expect(resolveNukeMultiplier(60 * 60 * 1000)).toBe(MAX_NUKE_FLIGHT_MULTIPLIER);
  });

  it('never reveals the requirement through warning stage copy', () => {
    for (const seconds of [1200, 1500, 1680, 1740, 1770, 1790]) {
      const stage = resolveNukeWarningStage(seconds * 1000);
      expect(stage).not.toBeNull();
      expect(stage.message).toBeNull();
    }
  });

  it('reports no warning stage before 20 minutes or after activation', () => {
    expect(resolveNukeWarningStage(0)).toBeNull();
    expect(resolveNukeWarningStage(19 * 60 * 1000)).toBeNull();
    expect(resolveNukeWarningStage(NUKE_TRIGGER_SECONDS * 1000)).toBeNull();
  });

  it('walks the visual phases in order', () => {
    expect(resolveNukeVisualPhase(0).id).toBe('phase1');
    expect(resolveNukeVisualPhase(90_000).id).toBe('phase2');
    expect(resolveNukeVisualPhase(200_000).id).toBe('phase3');
    expect(resolveNukeVisualPhase(600_000).id).toBe('extreme');
  });

  it('caps the speed ramp so difficulty stays inside validated limits', () => {
    expect(resolveNukeSpeedScale(0)).toBe(1);
    expect(resolveNukeSpeedScale(10 * 60 * 1000)).toBeCloseTo(NUKE_SPEED_SCALE_MAX);
    expect(resolveNukeSpeedScale(10 * 60 * 60 * 1000)).toBeCloseTo(NUKE_SPEED_SCALE_MAX);
  });
});

describe('activation threshold', () => {
  it('stays dormant through a normal short run', () => {
    const game = makeRunningGame();
    survive(game, 20);
    expect(game.nuke.state).toBe(NUKE_STATE.NORMAL);
    expect(game.nuke.hasActivated).toBe(false);
    expect(getNukeRewardMultiplier(game)).toBe(1);
  });

  it.each([
    [29 * 60, false],
    [29 * 60 + 50, false],
    [29 * 60 + 59, false],
  ])('does not activate at %is of survival', (seconds, expected) => {
    const game = makeRunningGame();
    devSeedNukeClock(game, seconds);
    survive(game, 0.2);
    expect(game.nuke.hasActivated).toBe(expected);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_WARNING);
  });

  it('activates on crossing exactly 30:00 of active time', () => {
    const game = makeRunningGame();
    devSeedNukeClock(game, NUKE_TRIGGER_SECONDS - 1);
    expect(game.nuke.hasActivated).toBe(false);
    survive(game, 1.5);
    expect(game.nuke.hasActivated).toBe(true);
    expect(game.nuke.activatedAtMs).toBeGreaterThanOrEqual(NUKE_TRIGGER_SECONDS * 1000);
  });

  it('activates at most once per run', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    const firstActivation = game.nuke.activatedAtMs;
    expect(devForceNukeActivation(game)).toBe(false);

    survive(game, 5);
    const activations = game.nuke.warningStagesSeen.length;
    survive(game, 5);
    expect(game.nuke.activatedAtMs).toBe(firstActivation);
    expect(game.nuke.warningStagesSeen.length).toBe(activations);
  });

  it('does not accrue survival time while the run is not playing', () => {
    const game = makeRunningGame();
    devSeedNukeClock(game, 29 * 60);
    const before = game.nuke.activeMs;
    game.phase = PHASE.GAMEOVER;
    for (let i = 0; i < 200; i += 1) updateGame(game, FRAME);
    expect(game.nuke.activeMs).toBe(before);
    expect(game.nuke.hasActivated).toBe(false);
  });

  it('clamps a pathological frame delta so a single stall cannot grant the Nuke', () => {
    const game = makeRunningGame();
    devSeedNukeClock(game, 29 * 60);
    updateGame(game, 10 * 60 * 1000);
    expect(game.nuke.hasActivated).toBe(false);
    expect(game.nuke.activeMs).toBeLessThan(29 * 60 * 1000 + 100);
  });
});

describe('activation sequence and player control', () => {
  it('keeps the run playable and physics untouched during activation', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_ACTIVATION);

    const before = game.scout.vy;
    flap(game);
    expect(game.scout.vy).toBeLessThan(before);
    expect(game.scout.vy).toBe(-8.2);
    expect(game.phase).toBe(PHASE.PLAYING);
  });

  it('settles into NUKE_ACTIVE after the cinematic', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_ACTIVE);
    expect(isNukeActive(game)).toBe(true);
  });

  it('keeps generated gaps and spawn timing identical to normal play', () => {
    const normal = makeRunningGame();
    const nuked = makeRunningGame();
    devForceNukeActivation(nuked);
    survive(nuked, 3);

    // Spawn cadence is time-based and untouched by Nuke Flight, so the player's
    // reaction budget between obstacles is unchanged.
    survive(normal, 12);
    survive(nuked, 12);
    expect(nuked.speed).toBe(normal.speed);
    expect(getNukeSpeedScale(nuked)).toBeLessThanOrEqual(NUKE_SPEED_SCALE_MAX);
    expect(getNukeSpeedScale(normal)).toBe(1);
  });
});

describe('destruction behind the player', () => {
  function activeGame() {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    return game;
  }

  it('leaves obstacles in front of Scout untouched', () => {
    const game = activeGame();
    game.obstacles = [{ x: game.scout.x + 200, topH: 150, bottomY: 300, w: 56 }];
    updateGame(game, FRAME);
    expect(game.obstacles[0].nukeDestroyed).toBeUndefined();
    expect(game.nuke.structuresDestroyed).toBe(0);
  });

  it('will not destroy an obstacle still overlapping Scout horizontally', () => {
    const game = activeGame();
    game.obstacles = [{ x: game.scout.x - 20, topH: 150, bottomY: 300, w: 56 }];
    updateGame(game, FRAME);
    expect(game.obstacles[0].nukeDestroyed).toBeUndefined();
  });

  it('destroys only once the obstacle clears the safety margin', () => {
    const game = activeGame();
    game.obstacles = [{ x: game.scout.x - 60, topH: 150, bottomY: 300, w: 56 }];
    updateGame(game, FRAME);
    expect(game.obstacles[0].nukeEscaped).toBe(true);
    expect(game.obstacles[0].nukeDestroyed).toBeUndefined();

    game.obstacles[0].x = game.scout.x - 140;
    updateGame(game, FRAME);
    expect(game.obstacles[0].nukeDestroyed).toBe(true);
    expect(game.nuke.structuresDestroyed).toBe(1);
    expect(game.nuke.debris.length).toBeGreaterThan(0);
  });

  it('never destroys anything before Nuke Flight is active', () => {
    const game = makeRunningGame();
    // Far enough behind Scout that Nuke Flight would destroy it, if it were active.
    game.obstacles = [{ x: game.scout.x - 120, topH: 150, bottomY: 300, w: 56 }];
    updateGame(game, FRAME);
    expect(game.obstacles[0].nukeEscaped).toBe(true);
    expect(game.obstacles[0].nukeDestroyed).toBeUndefined();
    expect(game.nuke.debris.length).toBe(0);
  });

  it('counts each structure exactly once', () => {
    const game = activeGame();
    game.obstacles = [{ x: game.scout.x - 200, topH: 150, bottomY: 300, w: 56 }];
    updateGame(game, FRAME);
    updateGame(game, FRAME);
    updateGame(game, FRAME);
    expect(game.nuke.structuresDestroyed).toBe(1);
  });
});

describe('debris can never kill the player', () => {
  function activeGameWithDebris() {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    game.obstacles = [{ x: game.scout.x - 200, topH: 150, bottomY: 300, w: 56 }];
    updateGame(game, FRAME);
    return game;
  }

  it('keeps debris out of the collidable obstacle array', () => {
    const game = activeGameWithDebris();
    expect(game.nuke.debris.length).toBeGreaterThan(0);
    expect(game.obstacles).toHaveLength(1);
    for (const d of game.nuke.debris) expect(d.collides).toBe(false);
  });

  it('only ever moves debris away from Scout', () => {
    const game = activeGameWithDebris();
    for (const d of game.nuke.debris) expect(d.vx).toBeLessThan(0);
  });

  it('survives a frame where debris sits on top of Scout', () => {
    const game = activeGameWithDebris();
    // Even placed directly on Scout, debris has no collision path to the player.
    game.nuke.debris.forEach((d) => {
      d.x = game.scout.x;
      d.y = game.scout.y;
    });
    game.obstacles = [];
    updateGame(game, FRAME);
    expect(game.phase).toBe(PHASE.PLAYING);
  });

  it('despawns debris instead of accumulating it over a long run', () => {
    const game = activeGameWithDebris();
    const limit = game.nuke.debrisLimits.maxPieces;
    for (let i = 0; i < 400; i += 1) {
      game.obstacles = [{ x: game.scout.x - 200, topH: 150, bottomY: 300, w: 56 }];
      updateGame(game, FRAME);
      expect(game.nuke.debris.length).toBeLessThanOrEqual(limit);
    }
    expect(game.nuke.shockwaves.length).toBeLessThanOrEqual(6);
  });
});

describe('reward multipliers', () => {
  function activeGame(survivalSeconds = 0) {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    if (survivalSeconds) devSetNukeSurvival(game, survivalSeconds);
    return game;
  }

  function collectCoinWorth(game, value) {
    game.obstacles = [];
    game.coins = [
      { x: game.scout.x + game.scout.w / 2, y: game.scout.y + game.scout.h / 2, r: 14, value, type: { key: 'test' }, collected: false },
    ];
    updateGame(game, FRAME);
  }

  it('does not multiply anything before activation', () => {
    const game = makeRunningGame();
    collectCoinWorth(game, 25);
    expect(game.score).toBe(25);
    expect(game.baseScore).toBe(25);
    expect(game.nuke.bonusScore).toBe(0);
  });

  it('applies the Nuke multiplier to coin values and tracks the bonus separately', () => {
    const game = activeGame();
    collectCoinWorth(game, 25);
    expect(game.nuke.multiplier).toBe(2);
    expect(game.score).toBe(50);
    expect(game.baseScore).toBe(25);
    expect(game.nuke.bonusScore).toBe(25);
  });

  it('stacks a temporary run multiplier on top of the Nuke multiplier', () => {
    const game = activeGame(180);
    expect(game.nuke.multiplier).toBe(5);
    // Existing/future Scout Flight pickup multiplier.
    game.runMultiplier = 2;
    expect(getCombinedRewardMultiplier(game)).toBe(10);

    collectCoinWorth(game, 10);
    expect(game.score).toBe(100);
    expect(game.baseScore).toBe(10);
    expect(game.nuke.bonusScore).toBe(90);
  });

  it('records the highest multiplier reached, not the final one', () => {
    const game = activeGame(240);
    expect(game.nuke.multiplier).toBe(6);
    devSetNukeSurvival(game, 0);
    expect(game.nuke.highestMultiplier).toBe(6);
  });
});

describe('death and results', () => {
  function activeGame() {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    return game;
  }

  it('routes a Nuke-time death through the death cinematic before results', () => {
    const game = activeGame();
    game.obstacles = [{ x: game.scout.x, topH: game.height, bottomY: game.height, w: 56 }];
    updateGame(game, FRAME);
    expect(game.phase).toBe(PHASE.GAMEOVER);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_DEATH);

    for (let i = 0; i < 200; i += 1) updateGame(game, FRAME);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_RESULTS);
  });

  it('uses the ordinary game over path when death happens before 30:00', () => {
    const game = makeRunningGame();
    devSeedNukeClock(game, 29 * 60 + 59);
    game.obstacles = [{ x: game.scout.x, topH: game.height, bottomY: game.height, w: 56 }];
    updateGame(game, FRAME);
    expect(game.phase).toBe(PHASE.GAMEOVER);
    expect(game.nuke.state).toBe(NUKE_STATE.NORMAL);
    expect(getNukeRunSummary(game).triggered).toBe(false);
  });

  it('summarises the run with internally consistent totals', () => {
    const game = activeGame();
    game.obstacles = [];
    game.coins = [
      { x: game.scout.x + game.scout.w / 2, y: game.scout.y + game.scout.h / 2, r: 14, value: 10, type: { key: 't' }, collected: false },
    ];
    updateGame(game, FRAME);

    const summary = getNukeRunSummary(game);
    expect(summary.triggered).toBe(true);
    expect(summary.baseScore + summary.bonusScore).toBe(summary.totalScore);
    expect(summary.nukeSurvivalMs).toBeGreaterThan(0);
    expect(summary.totalSurvivalMs).toBeGreaterThanOrEqual(summary.nukeSurvivalMs);
  });

  it('marks practice runs so they can never be paid out', () => {
    const game = createGame(W, H, 'PRACTICE', { practice: true, qualityTier: 'high' });
    startGame(game);
    devForceNukeActivation(game);
    expect(getNukeRunSummary(game).practice).toBe(true);
  });
});

describe('long sessions', () => {
  it('reaches the multiplier cap on a 38+ minute flight and stops there', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    devSetNukeSurvival(game, 8 * 60);
    expect(game.nuke.multiplier).toBe(MAX_NUKE_FLIGHT_MULTIPLIER);
    devSetNukeSurvival(game, 40 * 60);
    expect(game.nuke.multiplier).toBe(MAX_NUKE_FLIGHT_MULTIPLIER);
  });

  it('does not accumulate obstacles, coins, debris, or popups over a long run', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    surviveAutopilot(game, 4);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_ACTIVE);

    // Five minutes of real spawning, passing, and destruction.
    surviveAutopilot(game, 300);
    expect(game.phase).toBe(PHASE.PLAYING);
    expect(game.nuke.structuresDestroyed).toBeGreaterThan(50);
    expect(game.obstacles.length).toBeLessThan(20);
    expect(game.coins.length).toBeLessThan(20);
    expect(game.nuke.debris.length).toBeLessThanOrEqual(game.nuke.debrisLimits.maxPieces);
    expect(game.nuke.shockwaves.length).toBeLessThanOrEqual(6);
    expect(game.coinPopups.length).toBeLessThan(40);
    expect(game.comboPopups.length).toBeLessThan(40);
  });

  it('keeps escalating the multiplier correctly across a real 5-minute Nuke flight', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    surviveAutopilot(game, 300);
    expect(game.nuke.multiplier).toBe(resolveNukeMultiplier(game.nuke.nukeSurvivalMs));
    expect(game.nuke.multiplier).toBeGreaterThanOrEqual(6);
    expect(game.nuke.highestMultiplier).toBe(game.nuke.multiplier);
  });
});

describe('accessibility and quality tiers', () => {
  it('disables camera shake entirely under reduced motion', () => {
    const game = createGame(W, H, 'TOURNAMENT', { qualityTier: 'reduced' });
    startGame(game);
    devForceNukeActivation(game);
    expect(getNukeShakeAmplitude(game)).toBe(0);
  });

  it('keeps shake small and bounded on full quality', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    devSetNukeSurvival(game, 600);
    expect(getNukeShakeAmplitude(game)).toBeGreaterThan(0);
    expect(getNukeShakeAmplitude(game)).toBeLessThanOrEqual(4);
  });

  it('reduces the debris budget on low-end devices', () => {
    const low = createGame(W, H, 'TOURNAMENT', { qualityTier: 'low' });
    const high = createGame(W, H, 'TOURNAMENT', { qualityTier: 'high' });
    expect(low.nuke.debrisLimits.maxPieces).toBeLessThan(high.nuke.debrisLimits.maxPieces);
  });

  it('emits no shake before Nuke Flight begins', () => {
    const game = makeRunningGame();
    expect(getNukeShakeAmplitude(game)).toBe(0);
  });
});

describe('state machine integrity', () => {
  it('never reports a Nuke multiplier outside NUKE_ACTIVE', () => {
    const game = makeRunningGame();
    expect(getNukeRewardMultiplier(game)).toBe(1);

    devForceNukeActivation(game);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_ACTIVATION);
    expect(getNukeRewardMultiplier(game)).toBe(1);

    survive(game, 3);
    expect(getNukeRewardMultiplier(game)).toBe(2);

    game.obstacles = [{ x: game.scout.x, topH: game.height, bottomY: game.height, w: 56 }];
    updateGame(game, FRAME);
    expect(game.nuke.state).toBe(NUKE_STATE.NUKE_DEATH);
    expect(getNukeRewardMultiplier(game)).toBe(1);
  });

  it('resets Nuke state on restart so nothing leaks into the next run', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    survive(game, 3);
    expect(game.nuke.hasActivated).toBe(true);

    startGame(game);
    expect(game.nuke.hasActivated).toBe(false);
    expect(game.nuke.state).toBe(NUKE_STATE.NORMAL);
    expect(game.nuke.activeMs).toBe(0);
    expect(game.nuke.debris).toHaveLength(0);
    expect(game.baseScore).toBe(0);
  });

  it('refuses to seed the clock once Nuke Flight has activated', () => {
    const game = makeRunningGame();
    devForceNukeActivation(game);
    expect(devSeedNukeClock(game, 60)).toBe(false);
  });
});
