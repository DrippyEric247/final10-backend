/**
 * Savvy Universe soundtrack catalog — server source of truth.
 * Audio files are served only via authenticated soundtrack routes (never public URLs).
 */

const SOUNDTRACK_SOURCES = Object.freeze({
  battle_pass: 'battle_pass',
  beta_founder: 'beta_founder',
  event: 'event',
  season_reward: 'season_reward',
});

/** @type {Record<string, { id: string, title: string, description: string, source: string, fileKey: string, menuEligible: boolean, lockedTeaser: string, downloadFilename: string }>} */
const SOUNDTRACK_CATALOG = Object.freeze({
  final10_menu_theme_v1: Object.freeze({
    id: 'final10_menu_theme_v1',
    title: 'Final10 Menu Theme V1',
    description: 'The signature Savvy Universe home-screen theme — your operator HQ ambience.',
    source: SOUNDTRACK_SOURCES.battle_pass,
    fileKey: 'menu/final10-beta-theme.mp3',
    menuEligible: true,
    lockedTeaser: 'Unlock at Battle Pass Tier 5.',
    downloadFilename: 'Final10-Menu-Theme-V1.mp3',
  }),
  double_points_event_stinger: Object.freeze({
    id: 'double_points_event_stinger',
    title: 'Double Points Event Stinger',
    description: 'High-energy activation sting from the Double Points live event.',
    source: SOUNDTRACK_SOURCES.event,
    fileKey: 'events/double-points.mp3',
    menuEligible: false,
    lockedTeaser: 'Unlock at Battle Pass Tier 10.',
    downloadFilename: 'Double-Points-Event-Stinger.mp3',
  }),
  savvy_sale_event_stinger: Object.freeze({
    id: 'savvy_sale_event_stinger',
    title: 'Savvy Sale Event Stinger',
    description: 'Savvy Sale event fanfare — the sound of a smarter deal hunt.',
    source: SOUNDTRACK_SOURCES.event,
    fileKey: 'events/savvy-sale.mp3',
    menuEligible: false,
    lockedTeaser: 'Unlock at Battle Pass Tier 15.',
    downloadFilename: 'Savvy-Sale-Event-Stinger.mp3',
  }),
  perk_machine_theme: Object.freeze({
    id: 'perk_machine_theme',
    title: 'Perk Machine Theme',
    description: 'Reward chamber soundtrack from the Savvy Perk Machine.',
    source: SOUNDTRACK_SOURCES.season_reward,
    fileKey: 'music/perk-machine-theme.mp3',
    menuEligible: true,
    lockedTeaser: 'Unlock at Battle Pass Tier 20.',
    downloadFilename: 'Perk-Machine-Theme.mp3',
  }),
  scout_flight_theme: Object.freeze({
    id: 'scout_flight_theme',
    title: 'Scout Flight Theme',
    description: 'Flight-deck combat music from Scout Flight tournaments.',
    source: SOUNDTRACK_SOURCES.season_reward,
    fileKey: 'music/scout-flight-theme.mp3',
    menuEligible: true,
    lockedTeaser: 'Unlock at Battle Pass Tier 25.',
    downloadFilename: 'Scout-Flight-Theme.mp3',
  }),
  max_supply_drop_event_stinger: Object.freeze({
    id: 'max_supply_drop_event_stinger',
    title: 'Max Supply Drop Event Stinger',
    description: 'Supply drop activation audio from Max Supply Drop events.',
    source: SOUNDTRACK_SOURCES.event,
    fileKey: 'events/max-supply-drop.mp3',
    menuEligible: false,
    lockedTeaser: 'Unlock at Battle Pass Tier 30.',
    downloadFilename: 'Max-Supply-Drop-Event-Stinger.mp3',
  }),
  triple_points_event_stinger: Object.freeze({
    id: 'triple_points_event_stinger',
    title: 'Triple Points Event Stinger',
    description: 'Triple Points event sting — maximum multiplier energy.',
    source: SOUNDTRACK_SOURCES.event,
    fileKey: 'events/triple-points.mp3',
    menuEligible: false,
    lockedTeaser: 'Unlock at Battle Pass Tier 40.',
    downloadFilename: 'Triple-Points-Event-Stinger.mp3',
  }),
});

const BETA_SOUNDTRACK_PACK_IDS = Object.freeze([
  'final10_menu_theme_v1',
  'perk_machine_theme',
  'scout_flight_theme',
  'double_points_event_stinger',
  'savvy_sale_event_stinger',
  'max_supply_drop_event_stinger',
  'triple_points_event_stinger',
]);

const FOUNDER_SEASON_PACK_IDS = Object.freeze(Object.keys(SOUNDTRACK_CATALOG));

function getTrackById(trackId) {
  const id = String(trackId || '').trim();
  return SOUNDTRACK_CATALOG[id] || null;
}

function listAllTracks() {
  return Object.values(SOUNDTRACK_CATALOG);
}

function expandRewardTrackIds(reward) {
  if (!reward || reward.type !== 'soundtrack') return [];
  if (Array.isArray(reward.trackIds) && reward.trackIds.length) {
    if (reward.packKey === 'beta') return [...BETA_SOUNDTRACK_PACK_IDS];
    if (reward.packKey === 'founder_season') return [...FOUNDER_SEASON_PACK_IDS];
    return reward.trackIds.filter((id) => getTrackById(id));
  }
  const single = reward.trackId ? [reward.trackId] : [];
  return single.filter((id) => getTrackById(id));
}

module.exports = {
  SOUNDTRACK_SOURCES,
  SOUNDTRACK_CATALOG,
  BETA_SOUNDTRACK_PACK_IDS,
  FOUNDER_SEASON_PACK_IDS,
  getTrackById,
  listAllTracks,
  expandRewardTrackIds,
};
