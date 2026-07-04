/**
 * Scout Flight World Championship — monthly seasons, themes, and reward tables.
 */

const { isBetaMode } = require('./betaMode');

const SEASON_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ENDED: 'ended',
  FINALIZED: 'finalized',
});

const SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS = Object.freeze({
  betaChampionCard: 'card_scout_flight_beta_champion',
  betaChampionEmblem: 'sigil_scout_flight_beta_champion',
  betaSilverEmblem: 'sigil_scout_flight_beta_silver',
  betaBronzeEmblem: 'sigil_scout_flight_beta_bronze',
  betaTop10Emblem: 'sigil_scout_flight_beta_top10',
  monthlyChampionCard: 'card_scout_flight_monthly_champion',
  monthlyTop10Card: 'card_scout_flight_seasonal_top10',
  monthlySilverEmblem: 'sigil_scout_flight_silver',
  monthlyBronzeEmblem: 'sigil_scout_flight_bronze',
  monthlyTop10Emblem: 'sigil_scout_flight_top10',
});

const SCOUT_FLIGHT_CHAMPIONSHIP_BADGES = Object.freeze({
  betaParticipation: 'badge_scout_flight_beta_participation',
  participation: 'badge_scout_flight_participation',
});

/** Optional monthly theme metadata (banner, art keys, palette). */
const SEASON_THEMES = Object.freeze({
  beta_season_1: {
    themeKey: 'beta_season_1',
    bannerTitle: 'Beta Flight Championship',
    backgroundArtKey: 'scout_flight_beta_s1',
    musicKey: 'scout_flight_championship_beta',
    callingCardStyle: 'beta_champion',
    eventColor: '#fcd34d',
  },
  founder_flight: {
    themeKey: 'founder_flight',
    bannerTitle: 'Founder Flight',
    backgroundArtKey: 'scout_flight_founder',
    musicKey: 'scout_flight_championship',
    callingCardStyle: 'founder',
    eventColor: '#a855f7',
  },
  independence_hunt: {
    themeKey: 'independence_hunt',
    bannerTitle: 'Independence Hunt',
    backgroundArtKey: 'scout_flight_independence',
    musicKey: 'scout_flight_championship',
    callingCardStyle: 'patriot',
    eventColor: '#ef4444',
  },
  haunted_flight: {
    themeKey: 'haunted_flight',
    bannerTitle: 'Haunted Flight',
    backgroundArtKey: 'scout_flight_haunted',
    musicKey: 'scout_flight_championship_spooky',
    callingCardStyle: 'haunted',
    eventColor: '#7c3aed',
  },
  holiday_supply_run: {
    themeKey: 'holiday_supply_run',
    bannerTitle: 'Holiday Supply Run',
    backgroundArtKey: 'scout_flight_holiday',
    musicKey: 'scout_flight_championship_holiday',
    callingCardStyle: 'holiday',
    eventColor: '#22c55e',
  },
  anniversary_flight: {
    themeKey: 'anniversary_flight',
    bannerTitle: 'Anniversary Flight',
    backgroundArtKey: 'scout_flight_anniversary',
    musicKey: 'scout_flight_championship',
    callingCardStyle: 'anniversary',
    eventColor: '#f59e0b',
  },
  default: {
    themeKey: 'default',
    bannerTitle: 'Scout Flight World Championship',
    backgroundArtKey: 'scout_flight_championship',
    musicKey: 'scout_flight_championship',
    callingCardStyle: 'champion',
    eventColor: '#818cf8',
  },
});

const MONTH_THEME_OVERRIDES = Object.freeze({
  '2026-07': 'beta_season_1',
  '2026-11': 'holiday_supply_run',
  '2026-10': 'haunted_flight',
  '2026-07-04': 'independence_hunt',
});

const BETA_REWARD_TIERS = Object.freeze([
  {
    minRank: 1,
    maxRank: 1,
    label: '1st Place',
    savvy: 10000,
    callingCardId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.betaChampionCard,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.betaChampionEmblem,
    title: 'Beta Flight Champion',
    hallEntry: true,
  },
  {
    minRank: 2,
    maxRank: 2,
    label: '2nd Place',
    savvy: 5000,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.betaSilverEmblem,
    title: 'Beta Silver Pilot',
  },
  {
    minRank: 3,
    maxRank: 3,
    label: '3rd Place',
    savvy: 2500,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.betaBronzeEmblem,
    title: 'Beta Bronze Pilot',
  },
  {
    minRank: 4,
    maxRank: 10,
    label: 'Top 10',
    savvy: 0,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.betaTop10Emblem,
    title: 'Beta Top 10',
  },
  {
    minRank: 11,
    maxRank: 100,
    label: 'Top 100',
    savvy: 0,
    badgeId: SCOUT_FLIGHT_CHAMPIONSHIP_BADGES.betaParticipation,
    title: 'Beta Participant',
  },
]);

const PERMANENT_REWARD_TIERS = Object.freeze([
  {
    minRank: 1,
    maxRank: 1,
    label: '1st Place',
    savvy: 5000,
    callingCardId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.monthlyChampionCard,
    title: 'Scout Flight Champion',
    hallEntry: true,
  },
  {
    minRank: 2,
    maxRank: 2,
    label: '2nd Place',
    savvy: 2500,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.monthlySilverEmblem,
    title: 'Silver Pilot',
  },
  {
    minRank: 3,
    maxRank: 3,
    label: '3rd Place',
    savvy: 1000,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.monthlyBronzeEmblem,
    title: 'Bronze Pilot',
  },
  {
    minRank: 4,
    maxRank: 10,
    label: 'Top 10',
    savvy: 0,
    callingCardId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.monthlyTop10Card,
    emblemId: SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS.monthlyTop10Emblem,
    title: 'Seasonal Ace',
  },
  {
    minRank: 11,
    maxRank: 100,
    label: 'Top 100',
    savvy: 0,
    badgeId: SCOUT_FLIGHT_CHAMPIONSHIP_BADGES.participation,
    title: 'Championship Participant',
  },
]);

function getSeasonId(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getUtcMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function getUtcMonthEnd(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function formatSeasonName(seasonId, { isBetaSeason = false } = {}) {
  const [year, month] = String(seasonId || '').split('-').map(Number);
  if (!year || !month) return 'Scout Flight Championship';
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  if (isBetaSeason) return `${monthName} ${year} — Beta Flight Champion`;
  return `${monthName} ${year} Championship`;
}

function resolveThemeKey(seasonId, isBetaSeason = false) {
  if (MONTH_THEME_OVERRIDES[seasonId]) return MONTH_THEME_OVERRIDES[seasonId];
  if (isBetaSeason) return 'beta_season_1';
  return 'default';
}

function getTheme(themeKey) {
  return { ...(SEASON_THEMES[themeKey] || SEASON_THEMES.default) };
}

function getRewardTiers(isBetaSeason = isBetaMode()) {
  return (isBetaSeason ? BETA_REWARD_TIERS : PERMANENT_REWARD_TIERS).map((t) => ({ ...t }));
}

function resolveRewardTierForRank(rank, isBetaSeason = isBetaMode()) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return null;
  const tiers = isBetaSeason ? BETA_REWARD_TIERS : PERMANENT_REWARD_TIERS;
  return tiers.find((t) => n >= t.minRank && n <= t.maxRank) || null;
}

function getPrizePoolSavvy(isBetaSeason = isBetaMode()) {
  const tiers = isBetaSeason ? BETA_REWARD_TIERS : PERMANENT_REWARD_TIERS;
  return tiers.reduce((sum, t) => sum + (Number(t.savvy) || 0), 0);
}

function getChampionshipMessaging(isBetaSeason = isBetaMode()) {
  if (isBetaSeason) {
    return {
      headline: 'Beta rewards are boosted',
      body: 'Higher rewards during beta to thank Founding Testers for helping build Final10.',
      permanentNote:
        'After beta, Scout Flight World Championship continues every month with balanced rewards.',
      ticketNote: 'Use Scout Flight Tickets to compete in official monthly seasons.',
    };
  }
  return {
    headline: 'Monthly World Championship',
    body: 'Scout Flight World Championship continues every month with balanced rewards.',
    permanentNote: 'Season resets on the 1st of every month (UTC).',
    ticketNote: 'Use Scout Flight Tickets to compete in official monthly seasons.',
  };
}

module.exports = {
  SEASON_STATUSES,
  SCOUT_FLIGHT_CHAMPIONSHIP_COSMETICS,
  SCOUT_FLIGHT_CHAMPIONSHIP_BADGES,
  SEASON_THEMES,
  BETA_REWARD_TIERS,
  PERMANENT_REWARD_TIERS,
  getSeasonId,
  getUtcMonthStart,
  getUtcMonthEnd,
  formatSeasonName,
  resolveThemeKey,
  getTheme,
  getRewardTiers,
  resolveRewardTierForRank,
  getPrizePoolSavvy,
  getChampionshipMessaging,
  isBetaMode,
};
