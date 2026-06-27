/**
 * Scout Flight difficulty presets — hitbox-only tuning.
 * Add new presets here; set `selectable: true` when ready to ship.
 */

export const SCOUT_FLIGHT_DIFFICULTY = Object.freeze({
  NORMAL: Object.freeze({
    id: 'NORMAL',
    label: 'Normal',
    emoji: '🟢',
    hitboxW: 47,
    hitboxH: 47,
    description: 'Balanced experience. Recommended.',
    selectable: true,
  }),
  TOURNAMENT: Object.freeze({
    id: 'TOURNAMENT',
    label: 'Tournament',
    emoji: '🔴',
    hitboxW: 52,
    hitboxH: 52,
    description: 'Original competitive hitbox. Highest skill.',
    selectable: true,
  }),
  /** Placeholder — not selectable yet */
  CASUAL: Object.freeze({
    id: 'CASUAL',
    label: 'Casual',
    emoji: '🔵',
    hitboxW: 50,
    hitboxH: 50,
    description: 'Coming soon.',
    selectable: false,
  }),
  /** Placeholder — not selectable yet */
  VETERAN: Object.freeze({
    id: 'VETERAN',
    label: 'Veteran',
    emoji: '🟣',
    hitboxW: 44,
    hitboxH: 44,
    description: 'Coming soon.',
    selectable: false,
  }),
  /** Placeholder — not selectable yet */
  MYTHIC_CHALLENGE: Object.freeze({
    id: 'MYTHIC_CHALLENGE',
    label: 'Mythic Challenge',
    emoji: '✨',
    hitboxW: 42,
    hitboxH: 42,
    description: 'Coming soon.',
    selectable: false,
  }),
  /** Placeholder — not selectable yet */
  DAILY_CHALLENGE: Object.freeze({
    id: 'DAILY_CHALLENGE',
    label: 'Daily Challenge',
    emoji: '📅',
    hitboxW: 47,
    hitboxH: 47,
    description: 'Coming soon.',
    selectable: false,
  }),
});

export const DEFAULT_DIFFICULTY_ID = 'NORMAL';

const STORAGE_KEY = 'f10_scout_flight_difficulty';

export function getDifficultyConfig(id) {
  const key = String(id || '').toUpperCase();
  const config = SCOUT_FLIGHT_DIFFICULTY[key];
  if (config?.selectable) return config;
  return SCOUT_FLIGHT_DIFFICULTY.NORMAL;
}

export function getSelectableDifficulties() {
  return Object.values(SCOUT_FLIGHT_DIFFICULTY).filter((d) => d.selectable);
}

export function loadSavedDifficulty() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const config = SCOUT_FLIGHT_DIFFICULTY[String(raw || '').toUpperCase()];
    if (config?.selectable) return config.id;
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

/** Apply hitbox dimensions; keeps scout centered on its collision box. */
export function applyDifficultyToScout(game, difficultyId, { recenter = true } = {}) {
  if (!game?.scout) return DEFAULT_DIFFICULTY_ID;
  const config = getDifficultyConfig(difficultyId);
  const s = game.scout;
  const centerY = s.y + s.h / 2;

  game.difficultyId = config.id;
  s.w = config.hitboxW;
  s.h = config.hitboxH;

  if (recenter) {
    s.y = (game.phase === 'idle' ? game.height / 2 : centerY) - s.h / 2;
  }

  return config.id;
}
