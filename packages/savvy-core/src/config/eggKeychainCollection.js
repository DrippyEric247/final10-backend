/**
 * Egg Keychain Collection — premium physical/digital egg collectibles.
 * Separate from Egg Camo mastery and Mythic Egg hatch reward pools.
 *
 * Server mirror: `server/config/eggKeychainCollection.js`
 *
 * @module @savvy/core/config/eggKeychainCollection
 */

/** Bump when items or unlock rules change. */
export const EGG_KEYCHAIN_COLLECTION_VERSION = 3;

export const EGG_KEYCHAIN_COLLECTION_ID = 'egg-keychains';

export const EGG_KEYCHAIN_DISPLAY_NAME = 'EGG KEYCHAINS';

/** Internal cosmetic IDs use prefix `keychain_`. Slugs use kebab-case for assets. */
export const EGG_KEYCHAIN_ID_PREFIX = 'keychain';

/** Fields snapshotted at unlock into CosmeticInventory.camoUnlocks. */
export const EGG_KEYCHAIN_CAPTURE_FIELDS = Object.freeze([
  'serialNumber',
  'profileLevel',
  'prestige',
  'emblemId',
  'callingCardId',
  'unlockedAt',
  'userId',
  'username',
  'source',
]);

/** Associated collectible concepts shown on reference artwork. */
export const MYTHIC_EGG_KEYCHAIN_ASSOCIATED_REWARDS = Object.freeze([
  Object.freeze({ slot: 'profileLevel', label: 'Level 100 Icon', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'emblemId', label: 'Emblem', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'callingCardId', label: 'Calling Card', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'serialNumber', label: 'Serial Number', note: 'Unique to you. One of one.' }),
]);

/**
 * Unlock rule — first legitimate Mythic Egg acquisition (Egg Camo countable sources).
 * Does NOT auto-grant Mythic hatch pool rewards.
 */
export const MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE = Object.freeze({
  id: 'first_mythic_egg_acquired',
  description: 'Acquire your first Mythic Egg through legitimate Savvy ecosystem sources.',
  lockedRequirementLabel: 'Acquire your first Mythic Egg through legitimate Savvy ecosystem sources.',
  eggTier: 'mythic',
  minLifetimeCount: 1,
});

/**
 * Unlock rule — first Perk Machine Nuke Event activation (authoritative Nuke Egg rewards path).
 * Does NOT merge with Mythic or Quantum egg tiers.
 */
export const NUKE_EGG_KEYCHAIN_UNLOCK_RULE = Object.freeze({
  id: 'nuke_event_first_activation',
  description: 'Earned through Nuke Egg rewards.',
  lockedRequirementLabel: 'EARNED THROUGH NUKE EGG REWARDS',
  minNukeEventsTriggered: 1,
});

export const NUKE_EGG_KEYCHAIN_ASSOCIATED_REWARDS = Object.freeze([
  Object.freeze({ slot: 'serialNumber', label: 'Serial Number', note: 'Unique to you. One of one.' }),
  Object.freeze({ slot: 'profileLevel', label: 'Level at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'prestige', label: 'Prestige at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'source', label: 'Nuke Reward Source', note: 'Captured at unlock.' }),
]);

/**
 * Quantum unlock — tied to universal Quantum Legacy (secret deal streak).
 * Target is NOT exposed in this config to clients; see quantumEgg module server-side.
 */
export const QUANTUM_EGG_KEYCHAIN_UNLOCK_RULE = Object.freeze({
  id: 'quantum_legacy_secret_streak',
  description: 'Quantum Legacy achievement.',
  lockedRequirementLabel: 'HIDDEN LEGACY',
  classifiedLabel: 'UNKNOWN REQUIREMENT',
});

export const QUANTUM_EGG_KEYCHAIN_ASSOCIATED_REWARDS = Object.freeze([
  Object.freeze({ slot: 'serialNumber', label: 'Serial Number', note: 'Universal. One of one.' }),
  Object.freeze({ slot: 'profileLevel', label: 'Level at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'prestige', label: 'Prestige at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'achievementId', label: 'Quantum Achievement', note: 'Captured at unlock.' }),
]);

export const EGG_KEYCHAIN_COLLECTION = Object.freeze({
  id: EGG_KEYCHAIN_COLLECTION_ID,
  name: EGG_KEYCHAIN_DISPLAY_NAME,
  icon: '🔑',
  accentColor: '#a855f7',
  accentColorAlt: '#fbbf24',
  blurb: 'Premium egg collectibles for the Savvy ecosystem — digital ownership with physical redemption paths.',
  tagline: 'STAY SAVVY. STAY SMART. THE BEST DEALS FROM THE START.',
});

/**
 * @typedef {object} EggKeychainItem
 * @property {string} id cosmetic inventory id (keychain_mythic_egg)
 * @property {string} slug asset slug (mythic-egg-keychain)
 * @property {string} name display name
 * @property {string} rarity internal rarity (mythic)
 * @property {string} collection collection id
 * @property {string} assetPath public URL
 * @property {boolean} physicalCollectible
 * @property {boolean} serialNumberSupported
 * @property {boolean} streamHouseEligible
 * @property {string} streamHouseRarity
 * @property {boolean} previewWhenLocked
 * @property {ReadonlyArray<object>} associatedRewards
 */

/** @type {readonly EggKeychainItem[]} */
export const EGG_KEYCHAIN_ITEMS = Object.freeze([
  Object.freeze({
    id: 'keychain_mythic_egg',
    slug: 'mythic-egg-keychain',
    name: 'MYTHICAL EGG KEYCHAIN',
    displayName: 'Mythical Egg Keychain',
    rarity: 'mythic',
    tier: 'mythic',
    collection: EGG_KEYCHAIN_COLLECTION_ID,
    assetPath: '/assets/egg-keychains/mythic-egg-keychain.jpeg',
    physicalCollectible: true,
    serialNumberSupported: true,
    streamHouseEligible: true,
    streamHouseRarity: 'mythic',
    streamHouseTier: 'mythic',
    previewWhenLocked: true,
    earnedNotBought: true,
    purchasable: false,
    unlockRule: MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE,
    associatedRewards: MYTHIC_EGG_KEYCHAIN_ASSOCIATED_REWARDS,
    captureAtUnlock: EGG_KEYCHAIN_CAPTURE_FIELDS,
    acquiredLabel: 'MYTHICAL EGG KEYCHAIN ACQUIRED',
    tagline: 'STAY SAVVY. STAY SMART. THE BEST DEALS FROM THE START.',
  }),
  Object.freeze({
    id: 'keychain_nuke_egg',
    slug: 'nuke-egg-keychain',
    name: 'NUKE EGG KEYCHAIN',
    displayName: 'Nuke Egg Keychain',
    rarity: 'nuke',
    tier: 'nuke',
    collection: EGG_KEYCHAIN_COLLECTION_ID,
    nukeCollection: true,
    assetPath: '/assets/egg-keychains/nuke-egg-keychain.jpeg',
    physicalCollectible: true,
    serialNumberSupported: true,
    streamHouseEligible: true,
    streamHouseRarity: 'nuke',
    streamHouseTier: 'nuke',
    previewWhenLocked: true,
    earnedNotBought: true,
    earnedOnly: true,
    purchasable: false,
    unlockRule: NUKE_EGG_KEYCHAIN_UNLOCK_RULE,
    associatedRewards: NUKE_EGG_KEYCHAIN_ASSOCIATED_REWARDS,
    captureAtUnlock: EGG_KEYCHAIN_CAPTURE_FIELDS,
    acquiredLabel: 'NUKE EGG KEYCHAIN ACQUIRED',
    tagline: 'YOU EARNED IT. NOW CARRY THE BLAST.',
    secondaryTagline: 'FEW WILL EARN IT. LEGENDS WILL CARRY IT.',
    lockedPreviewNote:
      'Premium preview — digital collectible earned through Nuke Egg rewards. Not purchasable.',
    collectionLabel: 'NUKE COLLECTION',
  }),
  Object.freeze({
    id: 'keychain_quantum_egg',
    slug: 'quantum-egg-keychain',
    name: 'QUANTUM EGG KEYCHAIN',
    displayName: 'Quantum Egg Keychain',
    rarity: 'quantum',
    tier: 'quantum',
    collection: EGG_KEYCHAIN_COLLECTION_ID,
    quantumLegacy: true,
    universal: true,
    crossApp: true,
    assetPath: '/assets/egg-keychains/quantum-egg-keychain.jpeg',
    physicalCollectible: true,
    serialNumberSupported: true,
    streamHouseEligible: true,
    streamHouseRarity: 'quantum',
    streamHouseTier: 'quantum',
    previewWhenLocked: false,
    hiddenUntilDiscovered: true,
    earnedNotBought: true,
    earnedOnly: true,
    purchasable: false,
    unlockRule: QUANTUM_EGG_KEYCHAIN_UNLOCK_RULE,
    associatedRewards: QUANTUM_EGG_KEYCHAIN_ASSOCIATED_REWARDS,
    captureAtUnlock: EGG_KEYCHAIN_CAPTURE_FIELDS,
    acquiredLabel: 'QUANTUM EGG KEYCHAIN ACQUIRED',
    tagline: 'BEYOND MYTHIC. ACROSS THE UNIVERSE.',
    secondaryTagline: 'ONE EGG. EVERY WORLD. ENDLESS POSSIBILITIES.',
    collectionLabel: 'QUANTUM LEGACY',
    classifiedUi: Object.freeze({
      name: '???',
      displayName: 'CLASSIFIED',
      badge: 'CLASSIFIED',
      lockedRequirementLabel: 'HIDDEN LEGACY',
    }),
  }),
]);

export const EGG_KEYCHAIN_ITEM_IDS = Object.freeze(EGG_KEYCHAIN_ITEMS.map((i) => i.id));

const ITEMS_BY_ID = Object.freeze(
  EGG_KEYCHAIN_ITEMS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, /** @type {Record<string, typeof EGG_KEYCHAIN_ITEMS[number]>} */ ({}))
);

export function getEggKeychainItem(itemId) {
  return ITEMS_BY_ID[String(itemId || '').trim()] || null;
}

export function isEggKeychainItemId(itemId) {
  return typeof itemId === 'string' && Boolean(ITEMS_BY_ID[itemId]);
}

export function getMythicEggKeychainItem() {
  return getEggKeychainItem('keychain_mythic_egg');
}

export function getNukeEggKeychainItem() {
  return getEggKeychainItem('keychain_nuke_egg');
}

export function getQuantumEggKeychainItem() {
  return getEggKeychainItem('keychain_quantum_egg');
}

/**
 * Whether lifetime mythic egg count satisfies the keychain unlock rule.
 * @param {Record<string, number>} lifetimeCollected
 */
export function isMythicEggKeychainEligible(lifetimeCollected) {
  const count = Math.max(0, Number(lifetimeCollected?.mythic) || 0);
  return count >= MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE.minLifetimeCount;
}

/**
 * Whether Perk Machine Nuke Event progression satisfies the Nuke keychain rule.
 * @param {{ nukeEventsTriggered?: number }|null|undefined} nukeDoc
 */
export function isNukeEggKeychainEligible(nukeDoc) {
  const triggered = Math.max(0, Number(nukeDoc?.nukeEventsTriggered) || 0);
  return triggered >= NUKE_EGG_KEYCHAIN_UNLOCK_RULE.minNukeEventsTriggered;
}

export function formatKeychainSerial(serialNumber) {
  if (serialNumber == null || Number.isNaN(Number(serialNumber))) return null;
  return String(Math.max(1, Number(serialNumber))).padStart(4, '0');
}
