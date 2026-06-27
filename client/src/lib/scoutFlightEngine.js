/**
 * Savvy Scout Flight — local-score mini-game engine (v1).
 * Side-scroller: obstacles move right→left; tap/click applies upward impulse.
 */

export const PHASE = Object.freeze({
  IDLE: 'idle',
  PLAYING: 'playing',
  GAMEOVER: 'gameover',
});

export const COIN_TYPES = Object.freeze([
  { key: 'penny', value: 1, color: '#b87333', glow: '#cd7f32', weight: 40 },
  { key: 'nickel', value: 5, color: '#c0c0c0', glow: '#e8e8e8', weight: 30 },
  { key: 'dime', value: 10, color: '#d4d4d8', glow: '#f4f4f5', weight: 18 },
  { key: 'quarter', value: 25, color: '#a1a1aa', glow: '#fde047', weight: 10 },
  { key: 'gold', value: 100, color: '#eab308', glow: '#fcd34d', weight: 2 },
]);

const GRAVITY = 0.42;
const FLAP_VELOCITY = -8.2;
const MAX_VY = 9;
const SCOUT_W = 52;
const SCOUT_H = 52;
const OBstacle_W = 56;
const GAP_MIN = 118;
const GAP_MAX = 168;
const SPAWN_MS = 2200;
const COIN_R = 14;
const HIT_PAD = 6;

function pickCoinType() {
  const total = COIN_TYPES.reduce((s, c) => s + c.weight, 0);
  let roll = Math.random() * total;
  for (const c of COIN_TYPES) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return COIN_TYPES[0];
}

function loadBest() {
  try {
    return Math.max(0, Number(localStorage.getItem('f10_scout_flight_best')) || 0);
  } catch {
    return 0;
  }
}

function saveBest(n) {
  try {
    localStorage.setItem('f10_scout_flight_best', String(Math.max(0, Math.round(n))));
  } catch {
    /* ignore */
  }
}

export function createGame(width, height) {
  const groundH = Math.max(36, Math.round(height * 0.08));
  const scoutX = Math.round(width * 0.22);

  return {
    width,
    height,
    groundH,
    scoutX,
    phase: PHASE.IDLE,
    score: 0,
    best: loadBest(),
    scout: { x: scoutX, y: height / 2 - SCOUT_H / 2, vy: 0, w: SCOUT_W, h: SCOUT_H, rot: 0 },
    obstacles: [],
    coins: [],
    particles: [],
    lastSpawn: 0,
    elapsed: 0,
    speed: Math.max(2.8, width * 0.0045),
    coinPopups: [],
  };
}

export function resetGame(game) {
  const fresh = createGame(game.width, game.height);
  fresh.best = Math.max(game.best, loadBest());
  return fresh;
}

export function startGame(game) {
  game.phase = PHASE.PLAYING;
  game.score = 0;
  game.scout.y = game.height / 2 - SCOUT_H / 2;
  game.scout.vy = 0;
  game.obstacles = [];
  game.coins = [];
  game.particles = [];
  game.coinPopups = [];
  game.lastSpawn = game.elapsed;
}

export function flap(game) {
  if (game.phase === PHASE.IDLE) {
    startGame(game);
    game.scout.vy = FLAP_VELOCITY;
    return;
  }
  if (game.phase === PHASE.PLAYING) {
    game.scout.vy = FLAP_VELOCITY;
  }
}

function spawnObstacle(game) {
  const playable = game.height - game.groundH - 40;
  const gap = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
  const topMax = playable - gap - 40;
  const topH = 40 + Math.random() * Math.max(20, topMax);
  const bottomY = topH + gap;
  game.obstacles.push({
    x: game.width + 20,
    topH,
    bottomY,
    w: OBstacle_W,
    scored: false,
  });
  const coinY = topH + gap / 2;
  const coinX = game.width + 20 + OBstacle_W / 2;
  const type = pickCoinType();
  game.coins.push({
    x: coinX,
    y: coinY,
    r: COIN_R,
    value: type.value,
    type,
    collected: false,
  });
}

function circleRectHit(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function scoutHitsObstacle(game) {
  const s = game.scout;
  const pad = HIT_PAD;
  for (const o of game.obstacles) {
    if (
      circleRectHit(s.x + s.w / 2, s.y + s.h / 2, s.w / 2 - pad, o.x, 0, o.w, o.topH) ||
      circleRectHit(
        s.x + s.w / 2,
        s.y + s.h / 2,
        s.w / 2 - pad,
        o.x,
        o.bottomY,
        o.w,
        game.height - game.groundH - o.bottomY
      )
    ) {
      return true;
    }
  }
  return false;
}

function endGame(game) {
  game.phase = PHASE.GAMEOVER;
  if (game.score > game.best) {
    game.best = game.score;
    saveBest(game.best);
  }
}

export function updateGame(game, dtMs) {
  if (game.phase !== PHASE.PLAYING) return;

  game.elapsed += dtMs;
  const s = game.scout;
  s.vy = Math.min(MAX_VY, s.vy + GRAVITY);
  s.y += s.vy;
  s.rot = Math.max(-0.35, Math.min(0.55, s.vy * 0.04));

  const floor = game.height - game.groundH - s.h;
  if (s.y >= floor) {
    s.y = floor;
    endGame(game);
    return;
  }
  if (s.y <= 0) {
    s.y = 0;
    s.vy = 0;
  }

  const speed = game.speed;
  if (game.elapsed - game.lastSpawn >= SPAWN_MS) {
    spawnObstacle(game);
    game.lastSpawn = game.elapsed;
  }

  for (const o of game.obstacles) o.x -= speed;
  for (const c of game.coins) if (!c.collected) c.x -= speed;

  game.obstacles = game.obstacles.filter((o) => o.x + o.w > -40);
  game.coins = game.coins.filter((c) => !c.collected || c.x + c.r > -40);

  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  for (const c of game.coins) {
    if (c.collected) continue;
    const dx = cx - c.x;
    const dy = cy - c.y;
    if (dx * dx + dy * dy < (c.r + s.w * 0.35) ** 2) {
      c.collected = true;
      game.score += c.value;
      game.coinPopups.push({ x: c.x, y: c.y, value: c.value, life: 900 });
    }
  }

  game.coinPopups = game.coinPopups
    .map((p) => ({ ...p, life: p.life - dtMs, y: p.y - dtMs * 0.03 }))
    .filter((p) => p.life > 0);

  if (scoutHitsObstacle(game)) {
    endGame(game);
  }
}

export function restartGame(game) {
  const best = game.best;
  const next = createGame(game.width, game.height);
  next.best = best;
  startGame(next);
  return next;
}
