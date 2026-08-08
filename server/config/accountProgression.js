/**
 * Account Progression — server mirror of @savvy/core/config/accountProgression.js
 * Keep formulas identical — client display and server grants must agree.
 */

const ACCOUNT_MAX_LEVEL = 55;
const ACCOUNT_MAX_PRESTIGE = 10;

const ACCOUNT_RANKS = Object.freeze([
  Object.freeze({ id: 'bronze', name: 'Bronze', minLevel: 1, color: '#cd7f32' }),
  Object.freeze({ id: 'silver', name: 'Silver', minLevel: 10, color: '#94a3b8' }),
  Object.freeze({ id: 'gold', name: 'Gold', minLevel: 20, color: '#fbbf24' }),
  Object.freeze({ id: 'platinum', name: 'Platinum', minLevel: 30, color: '#22d3ee' }),
  Object.freeze({ id: 'diamond', name: 'Diamond', minLevel: 40, color: '#dbeafe' }),
  Object.freeze({ id: 'legend', name: 'Legend', minLevel: 50, color: '#e879f9' }),
]);

function cumulativeXpForLevel(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  if (lvl <= 1) return 0;
  if (lvl <= 5) return Math.floor(50 * lvl ** 2 - 50 * lvl);
  return 1000 + (lvl - 6) * 500;
}

function xpPerPrestigeCycle() {
  return cumulativeXpForLevel(ACCOUNT_MAX_LEVEL + 1);
}

function getAccountRank(level) {
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

function deriveAccountProgression(lifetimeXp) {
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
    headline:
      prestige > 0
        ? `Prestige ${prestige} • Level ${level} / ${ACCOUNT_MAX_LEVEL}`
        : `${rank.name} • Level ${level} / ${ACCOUNT_MAX_LEVEL}`,
    headlineEmphasis:
      prestige > 0 ? `PRESTIGE ${prestige} • LEVEL ${level} / ${ACCOUNT_MAX_LEVEL}` : null,
  };
}

/** Sync stored fields on a UserLevel doc from lifetime XP (migration-safe). */
function applyAccountProgressionToDoc(userLevel) {
  const derived = deriveAccountProgression(userLevel.totalXP);
  userLevel.currentLevel = derived.level;
  userLevel.prestige = derived.prestige;
  userLevel.xpProgress = derived.xpProgress;
  userLevel.xpToNextLevel = derived.xpToNext;
  return derived;
}

module.exports = {
  ACCOUNT_MAX_LEVEL,
  ACCOUNT_MAX_PRESTIGE,
  ACCOUNT_RANKS,
  cumulativeXpForLevel,
  xpPerPrestigeCycle,
  getAccountRank,
  deriveAccountProgression,
  applyAccountProgressionToDoc,
};
