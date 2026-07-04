/**
 * Final10 Live Event Activation — icon/audio keys and copy (server source of truth).
 */

const { utcDayKey } = require('./savvyRewards');

const ACTIVATION_EVENT_KEYS = Object.freeze({
  DOUBLE_POINTS: 'double_points',
  TRIPLE_POINTS: 'triple_points',
  SAVVY_SALE: 'savvy_sale',
  MAX_SUPPLY_DROP: 'max_supply_drop',
});

/** Display + audio metadata for login reveal and HUD bubbles. */
const ACTIVATION_EVENT_DEFS = Object.freeze({
  [ACTIVATION_EVENT_KEYS.DOUBLE_POINTS]: {
    eventKey: ACTIVATION_EVENT_KEYS.DOUBLE_POINTS,
    iconKey: 'double_points',
    audioKey: 'double_points',
    shortLabel: '2X',
    title: 'Double Points',
    subtitle: 'Earn 2× Savvy',
    detailTitle: 'Double Points',
    detailBody:
      'Earn 2× Savvy Points on eligible actions while this event is active.',
    theme: 'gold',
    sortOrder: 20,
  },
  [ACTIVATION_EVENT_KEYS.TRIPLE_POINTS]: {
    eventKey: ACTIVATION_EVENT_KEYS.TRIPLE_POINTS,
    iconKey: 'triple_points',
    audioKey: 'triple_points',
    shortLabel: '3X',
    title: 'Triple Points',
    subtitle: 'Earn 3× Savvy',
    detailTitle: 'Triple Points',
    detailBody:
      'Earn 3× Savvy Points on eligible actions for a limited time.',
    theme: 'purple',
    sortOrder: 10,
  },
  [ACTIVATION_EVENT_KEYS.SAVVY_SALE]: {
    eventKey: ACTIVATION_EVENT_KEYS.SAVVY_SALE,
    iconKey: 'savvy_sale',
    audioKey: 'savvy_sale',
    shortLabel: 'SALE',
    title: 'Savvy Sale',
    subtitle: 'Your Savvy goes further',
    detailTitle: 'Savvy Sale',
    detailBody:
      'During Savvy Sale, eligible Savvy point redemptions cost 50% less — including Perk Machine spins at 10 / 20 / 30 Savvy.',
    theme: 'red',
    sortOrder: 30,
  },
  [ACTIVATION_EVENT_KEYS.MAX_SUPPLY_DROP]: {
    eventKey: ACTIVATION_EVENT_KEYS.MAX_SUPPLY_DROP,
    iconKey: 'max_supply_drop',
    audioKey: 'max_supply_drop',
    shortLabel: 'DROP',
    title: 'Max Supply Drop',
    subtitle: 'Rare rewards available',
    detailTitle: 'Max Supply Drop',
    detailBody:
      'Special limited-time supply drops may appear with rare rewards, cosmetics, tickets, or bonuses.',
    theme: 'blue',
    sortOrder: 40,
  },
});

function getActivationDef(eventKey) {
  return ACTIVATION_EVENT_DEFS[eventKey] ? { ...ACTIVATION_EVENT_DEFS[eventKey] } : null;
}

function listActivationDefs() {
  return Object.values(ACTIVATION_EVENT_DEFS).map((d) => ({ ...d }));
}

function todayKey(date = new Date()) {
  return utcDayKey(date);
}

module.exports = {
  ACTIVATION_EVENT_KEYS,
  ACTIVATION_EVENT_DEFS,
  getActivationDef,
  listActivationDefs,
  todayKey,
};
