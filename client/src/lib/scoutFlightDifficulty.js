/**
 * Scout Flight difficulty presets — hitbox-only tuning.
 * Visual sprite size is fixed; only collision hitbox changes per preset.
 */

/** Fixed draw size (px) — unchanged across difficulties. */
export const SCOUT_SPRITE_SIZE = 47;

export const SCOUT_FLIGHT_DIFFICULTY = Object.freeze({
  PRACTICE: Object.freeze({
    id: 'PRACTICE',
    label: 'Practice',
    emoji: '🟦',
    hitboxW: 37,
    hitboxH: 37,
    hitPad: 8,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Most forgiving hitbox. Learn the skies.',
    selectable: true,
  }),
  NORMAL: Object.freeze({
    id: 'NORMAL',
    label: 'Normal',
    emoji: '🟢',
    hitboxW: 40,
    hitboxH: 40,
    hitPad: 7,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Forgiving but fair. Recommended.',
    selectable: true,
  }),
  TOURNAMENT: Object.freeze({
    id: 'TOURNAMENT',
    label: 'Tournament',
    emoji: '🔴',
    hitboxW: 43,
    hitboxH: 43,
    hitPad: 6,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Slightly stricter. Skill-focused.',
    selectable: true,
  }),
  /** Placeholder — not selectable yet */
  CASUAL: Object.freeze({
    id: 'CASUAL',
    label: 'Casual',
    emoji: '🔵',
    hitboxW: 40,
    hitboxH: 40,
    hitPad: 5,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Coming soon.',
    selectable: false,
  }),
  VETERAN: Object.freeze({
    id: 'VETERAN',
    label: 'Veteran',
    emoji: '🟣',
    hitboxW: 44,
    hitboxH: 44,
    hitPad: 7,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Coming soon.',
    selectable: false,
  }),
  MYTHIC_CHALLENGE: Object.freeze({
    id: 'MYTHIC_CHALLENGE',
    label: 'Mythic Challenge',
    emoji: '✨',
    hitboxW: 43,
    hitboxH: 43,
    hitPad: 7,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Coming soon.',
    selectable: false,
  }),
  DAILY_CHALLENGE: Object.freeze({
    id: 'DAILY_CHALLENGE',
    label: 'Daily Challenge',
    emoji: '📅',
    hitboxW: 42,
    hitboxH: 42,
    hitPad: 7,
    spriteW: SCOUT_SPRITE_SIZE,
    spriteH: SCOUT_SPRITE_SIZE,
    description: 'Coming soon.',
    selectable: false,
  }),
});

export const DEFAULT_DIFFICULTY_ID = 'NORMAL';

const STORAGE_KEY = 'f10_scout_flight_difficulty';
const DEBUG_HITBOX_KEY = 'f10_scout_flight_debug_hitbox';

/** Preset display order for UI. */
export const SELECTABLE_DIFFICULTY_ORDER = ['PRACTICE', 'NORMAL', 'TOURNAMENT'];

export function getDifficultyConfig(id) {
  const key = String(id || '').toUpperCase();
  const config = SCOUT_FLIGHT_DIFFICULTY[key];
  if (config?.selectable) return config;
  return SCOUT_FLIGHT_DIFFICULTY.NORMAL;
}

export function getSelectableDifficulties() {
  return SELECTABLE_DIFFICULTY_ORDER.map((id) => SCOUT_FLIGHT_DIFFICULTY[id]).filter(Boolean);
}

export function loadSavedDifficulty() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const config = SCOUT_FLIGHT_DIFFICULTY[String(raw || '').toUpperCase()];
    if (config?.selectable) return config.id;
    if (raw === 'TOURNAMENT' || raw === 'NORMAL') return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_DIFFICULTY_ID;
}

export function saveDifficulty(id) {
  const config = getDifficultyConfig(id);
  try {
    localStorage.setItem(STORAGE_KEY, config.id);
  } catch {
    /* ignore */
  }
  return config.id;
}

export function loadDebugHitboxEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEBUG_HITBOX_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDebugHitboxEnabled(on) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEBUG_HITBOX_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isDebugHitboxAllowed() {
  if (process.env.NODE_ENV !== 'production') return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('scoutDebug') === '1';
  } catch {
    return false;
  }
}

/** Apply hitbox + sprite; keeps scout centered on collision box. */
export function applyDifficultyToScout(game, difficultyId, { recenter = true } = {}) {
  if (!game?.scout) return DEFAULT_DIFFICULTY_ID;
  const config = getDifficultyConfig(difficultyId);
  const s = game.scout;
  const centerY = s.y + s.h / 2;

  game.difficultyId = config.id;
  game.hitPad = config.hitPad;
  s.w = config.hitboxW;
  s.h = config.hitboxH;
  s.spriteW = config.spriteW;
  s.spriteH = config.spriteH;

  if (recenter) {
    s.y = (game.phase === 'idle' ? game.height / 2 : centerY) - s.h / 2;
  }

  return config.id;
}
