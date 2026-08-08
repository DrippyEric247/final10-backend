/**
 * Account Progression — universal COD-style level/prestige system.
 *
 * Levels 1–55 per prestige cycle. After level 55, the player can prestige
 * (up to Prestige 10). Lifetime XP is never lost — prestige + visible level
 * are derived from total XP.
 *
 * Server mirror: `server/config/accountProgression.js`
 *
 * @module @savvy/core/config/accountProgression
 */

export const ACCOUNT_MAX_LEVEL = 55;
export const ACCOUNT_MAX_PRESTIGE = 10;

/**
 * Savvy rank titles derived from visible account level (within the current cycle).
 * Not a separate currency — purely display.
 */
export const ACCOUNT_RANKS = Object.freeze([
  Object.freeze({ id: 'bronze', name: 'Bronze', minLevel: 1, color: '#cd7f32', tw: 'text-amber-600' }),
  Object.freeze({ id: 'silver', name: 'Silver', minLevel: 10, color: '#94a3b8', tw: 'text-slate-300' }),
  Object.freeze({ id: 'gold', name: 'Gold', minLevel: 20, color: '#fbbf24', tw: 'text-yellow-400' }),
  Object.freeze({ id: 'platinum', name: 'Platinum', minLevel: 30, color: '#22d3ee', tw: 'text-cyan-300' }),
  Object.freeze({ id: 'diamond', name: 'Diamond', minLevel: 40, color: '#dbeafe', tw: 'text-sky-200' }),
  Object.freeze({ id: 'legend', name: 'Legend', minLevel: 50, color: '#e879f9', tw: 'text-fuchsia-400' }),
]);

/** Cumulative lifetime XP required to *start* a given level (level 1 => 0). */
export function cumulativeXpForLevel(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  if (lvl <= 1) return 0;
  if (lvl <= 5) return Math.floor(50 * lvl ** 2 - 50 * lvl);
  return 1000 + (lvl - 6) * 500;
}

/** XP required to complete one full prestige cycle (level 1 → 55 bar full). */
export function xpPerPrestigeCycle() {
  return cumulativeXpForLevel(ACCOUNT_MAX_LEVEL + 1);
}

/** @param {number} level visible account level 1–55 */
export function getAccountRank(level) {
  const lvl = Math.max(1, Math.min(ACCOUNT_MAX_LEVEL, Number(level) || 1));
  let rank = ACCOUNT_RANKS[0];
  for (const candidate of ACCOUNT_RANKS) {
    if (lvl >= candidate.minLevel) rank = candidate;
  }
  return rank;
}

function clampPercent(progress, range) {
  const r = Math.max(1, Number(range) || 1);
  const p = Math.max(0, Number(progress) || 0);
  return Math.max(0, Math.min(100, Math.round((p / r) * 100)));
}

/**
 * Derive prestige, visible level, and bar progress from lifetime profile XP.
 * Safe for legacy users whose stored level exceeded 55 — total XP is preserved.
 *
 * @param {number} lifetimeXp
 */
export function deriveAccountProgression(lifetimeXp) {
  const lifetime = Math.max(0, Math.round(Number(lifetimeXp) || 0));
  const cycleXp = xpPerPrestigeCycle();
  let pool = lifetime;
  let prestige = 0;

  while (prestige < ACCOUNT_MAX_PRESTIGE && pool >= cycleXp) {
    pool -= cycleXp;
    prestige += 1;
  }

  if (prestige >= ACCOUNT_MAX_PRESTIGE) {
    pool = Math.min(pool, Math.max(0, cycleXp - 1));
  }

  let level = 1;
  while (level < ACCOUNT_MAX_LEVEL && pool >= cumulativeXpForLevel(level + 1)) {
    level += 1;
  }

  const levelStart = cumulativeXpForLevel(level);
  const nextStart = level < ACCOUNT_MAX_LEVEL ? cumulativeXpForLevel(level + 1) : cycleXp;
  const xpProgress = Math.max(0, pool - levelStart);
  const xpRange = Math.max(1, nextStart - levelStart);
  const xpToNext = Math.max(0, nextStart - pool);
  const rank = getAccountRank(level);
  const atMaxLevel = level >= ACCOUNT_MAX_LEVEL;
  const atMaxPrestige = prestige >= ACCOUNT_MAX_PRESTIGE;
  const barFull = xpToNext <= 0;
  const canPrestige = atMaxLevel && barFull && !atMaxPrestige;

  let nextLabel = '';
  if (canPrestige) nextLabel = `Prestige ${prestige + 1}`;
  else if (atMaxLevel && atMaxPrestige) nextLabel = 'Max Prestige';
  else if (atMaxLevel && !barFull) nextLabel = `Level ${ACCOUNT_MAX_LEVEL}`;
  else nextLabel = `Level ${level + 1}`;

  const prestigeHint =
    prestige === 0 && !atMaxPrestige
      ? `Reach Level ${ACCOUNT_MAX_LEVEL} to Prestige`
      : atMaxPrestige
      ? 'Maximum Prestige reached'
      : canPrestige
      ? 'Ready to Prestige'
      : atMaxLevel
      ? `Fill the bar to enter Prestige ${prestige + 1}`
      : null;

  return {
    prestige,
    level,
    maxLevel: ACCOUNT_MAX_LEVEL,
    maxPrestige: ACCOUNT_MAX_PRESTIGE,
    lifetimeProfileXp: lifetime,
    xpProgress,
    xpRange,
    xpToNext,
    xpPercent: clampPercent(xpProgress, xpRange),
    rank,
    rankName: rank.name,
    rankColor: rank.color,
    isMaxLevel: atMaxLevel,
    isMaxPrestige: atMaxPrestige,
    canPrestige,
    nextLabel,
    prestigeHint,
    /** Header line: "Gold • Level 9 / 55" or "PRESTIGE 3 • LEVEL 27 / 55" */
    headline:
      prestige > 0
        ? `Prestige ${prestige} • Level ${level} / ${ACCOUNT_MAX_LEVEL}`
        : `${rank.name} • Level ${level} / ${ACCOUNT_MAX_LEVEL}`,
    /** Uppercase prestige-forward headline when P > 0 */
    headlineEmphasis:
      prestige > 0 ? `PRESTIGE ${prestige} • LEVEL ${level} / ${ACCOUNT_MAX_LEVEL}` : null,
  };
}

/** Build API-friendly snapshot from raw level doc fields. */
export function buildAccountProgressionView(lifetimeXp) {
  return deriveAccountProgression(lifetimeXp);
}
