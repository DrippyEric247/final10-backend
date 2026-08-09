/**
 * Universal Savvy Contracts registry — app-specific + cross-app definitions.
 *
 * @module @savvy/core/config/contracts
 */

import { FINAL10_CONTRACTS, FINAL10_CONTRACT_IDS } from './final10.js';
import { UNIVERSE_CONTRACTS, UNIVERSE_CONTRACT_IDS } from './universe.js';

export { FINAL10_CONTRACTS, FINAL10_CONTRACT_IDS } from './final10.js';
export { UNIVERSE_CONTRACTS, UNIVERSE_CONTRACT_IDS } from './universe.js';

/** Default app id when none is supplied (Final10 host). */
export const DEFAULT_CONTRACTS_APP_ID = 'final10';

/** @type {readonly import('./final10.js').ContractDefinition[]} */
export const ALL_CONTRACTS = Object.freeze([...FINAL10_CONTRACTS, ...UNIVERSE_CONTRACTS]);

const BY_ID = Object.freeze(
  ALL_CONTRACTS.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
  }, /** @type {Record<string, typeof ALL_CONTRACTS[number]>} */ ({}))
);

const BY_APP = Object.freeze(
  ALL_CONTRACTS.reduce((acc, def) => {
    const key = def.appId || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(def);
    return acc;
  }, /** @type {Record<string, typeof ALL_CONTRACTS>} */ ({}))
);

const BY_TRIGGER = Object.freeze(
  ALL_CONTRACTS.reduce((acc, def) => {
    if (!acc[def.trigger]) acc[def.trigger] = [];
    acc[def.trigger].push(def);
    return acc;
  }, /** @type {Record<string, typeof ALL_CONTRACTS>} */ ({}))
);

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function weekKey(date = new Date()) {
  const d = date;
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

/** Server-authoritative period keys — client-supplied keys are ignored. */
export function periodKeyForContract(contract, date = new Date()) {
  const type = contract.type;
  if (type === 'daily' || type === 'challenge') return utcDayKey(date);
  if (type === 'weekly' || type === 'universal') return weekKey(date);
  if (type === 'seasonal') return `season-${date.getFullYear()}`;
  if (type === 'event') return contract.eventKey || `event-${utcDayKey(date)}`;
  return 'once';
}

export function getContractById(contractId) {
  const id = String(contractId || '').trim();
  return BY_ID[id] || null;
}

export function getContractsForApp(appId) {
  const key = String(appId || DEFAULT_CONTRACTS_APP_ID).trim();
  return BY_APP[key] || [];
}

export function getUniverseContracts() {
  return UNIVERSE_CONTRACTS.slice();
}

export function getContractsForTrigger(trigger) {
  const t = String(trigger || '').trim();
  return BY_TRIGGER[t] || [];
}

export function listContractsForHub(appId = DEFAULT_CONTRACTS_APP_ID) {
  return {
    appContracts: getContractsForApp(appId),
    universeContracts: getUniverseContracts(),
  };
}

export const CONTRACT_APP_IDS = Object.freeze(Object.keys(BY_APP));
