/**
 * Egg Keychain Collection — server mirror of @savvy/core config.
 * SOURCE OF TRUTH: packages/savvy-core/src/config/eggKeychainCollection.js
 */

const EGG_KEYCHAIN_COLLECTION_VERSION = 3;
const EGG_KEYCHAIN_COLLECTION_ID = 'egg-keychains';
const EGG_KEYCHAIN_DISPLAY_NAME = 'EGG KEYCHAINS';

const EGG_KEYCHAIN_CAPTURE_FIELDS = Object.freeze([
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

const MYTHIC_EGG_KEYCHAIN_ASSOCIATED_REWARDS = Object.freeze([
  Object.freeze({ slot: 'profileLevel', label: 'Level 100 Icon', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'emblemId', label: 'Emblem', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'callingCardId', label: 'Calling Card', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'serialNumber', label: 'Serial Number', note: 'Unique to you. One of one.' }),
]);

const MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE = Object.freeze({
  id: 'first_mythic_egg_acquired',
  description: 'Acquire your first Mythic Egg through legitimate Savvy ecosystem sources.',
  lockedRequirementLabel: 'Acquire your first Mythic Egg through legitimate Savvy ecosystem sources.',
  eggTier: 'mythic',
  minLifetimeCount: 1,
});

const NUKE_EGG_KEYCHAIN_UNLOCK_RULE = Object.freeze({
  id: 'nuke_event_first_activation',
  description: 'Earned through Nuke Egg rewards.',
  lockedRequirementLabel: 'EARNED THROUGH NUKE EGG REWARDS',
  minNukeEventsTriggered: 1,
});

const NUKE_EGG_KEYCHAIN_ASSOCIATED_REWARDS = Object.freeze([
  Object.freeze({ slot: 'serialNumber', label: 'Serial Number', note: 'Unique to you. One of one.' }),
  Object.freeze({ slot: 'profileLevel', label: 'Level at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'prestige', label: 'Prestige at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'source', label: 'Nuke Reward Source', note: 'Captured at unlock.' }),
]);

const QUANTUM_EGG_KEYCHAIN_UNLOCK_RULE = Object.freeze({
  id: 'quantum_legacy_secret_streak',
  description: 'Quantum Legacy achievement.',
  lockedRequirementLabel: 'HIDDEN LEGACY',
  classifiedLabel: 'UNKNOWN REQUIREMENT',
});

const QUANTUM_EGG_KEYCHAIN_ASSOCIATED_REWARDS = Object.freeze([
  Object.freeze({ slot: 'serialNumber', label: 'Serial Number', note: 'Universal. One of one.' }),
  Object.freeze({ slot: 'profileLevel', label: 'Level at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'prestige', label: 'Prestige at Unlock', note: 'Captured at unlock.' }),
  Object.freeze({ slot: 'achievementId', label: 'Quantum Achievement', note: 'Captured at unlock.' }),
]);

const EGG_KEYCHAIN_COLLECTION = Object.freeze({
  id: EGG_KEYCHAIN_COLLECTION_ID,
  name: EGG_KEYCHAIN_DISPLAY_NAME,
  icon: '🔑',
  accentColor: '#a855f7',
  accentColorAlt: '#fbbf24',
  blurb: 'Premium egg collectibles for the Savvy ecosystem — digital ownership with physical redemption paths.',
  tagline: 'STAY SAVVY. STAY SMART. THE BEST DEALS FROM THE START.',
});

const MYTHIC_EGG_KEYCHAIN_ITEM_ID = 'keychain_mythic_egg';
const NUKE_EGG_KEYCHAIN_ITEM_ID = 'keychain_nuke_egg';
const QUANTUM_EGG_KEYCHAIN_ITEM_ID = 'keychain_quantum_egg';

const EGG_KEYCHAIN_ITEMS = Object.freeze([
  Object.freeze({
    id: MYTHIC_EGG_KEYCHAIN_ITEM_ID,
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
    id: NUKE_EGG_KEYCHAIN_ITEM_ID,
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
    id: QUANTUM_EGG_KEYCHAIN_ITEM_ID,
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

const EGG_KEYCHAIN_ITEM_IDS = Object.freeze(EGG_KEYCHAIN_ITEMS.map((i) => i.id));

const ITEMS_BY_ID = Object.freeze(
  EGG_KEYCHAIN_ITEMS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {})
);

function getEggKeychainItem(itemId) {
  return ITEMS_BY_ID[String(itemId || '').trim()] || null;
}

function isEggKeychainItemId(itemId) {
  return typeof itemId === 'string' && Boolean(ITEMS_BY_ID[itemId]);
}

function getMythicEggKeychainItem() {
  return getEggKeychainItem(MYTHIC_EGG_KEYCHAIN_ITEM_ID);
}

function getNukeEggKeychainItem() {
  return getEggKeychainItem(NUKE_EGG_KEYCHAIN_ITEM_ID);
}

function getQuantumEggKeychainItem() {
  return getEggKeychainItem(QUANTUM_EGG_KEYCHAIN_ITEM_ID);
}

function isMythicEggKeychainEligible(lifetimeCollected) {
  const count = Math.max(0, Number(lifetimeCollected?.mythic) || 0);
  return count >= MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE.minLifetimeCount;
}

function isNukeEggKeychainEligible(nukeDoc) {
  const triggered = Math.max(0, Number(nukeDoc?.nukeEventsTriggered) || 0);
  return triggered >= NUKE_EGG_KEYCHAIN_UNLOCK_RULE.minNukeEventsTriggered;
}

function formatKeychainSerial(serialNumber) {
  if (serialNumber == null || Number.isNaN(Number(serialNumber))) return null;
  return String(Math.max(1, Number(serialNumber))).padStart(4, '0');
}

module.exports = {
  EGG_KEYCHAIN_COLLECTION_VERSION,
  EGG_KEYCHAIN_COLLECTION_ID,
  EGG_KEYCHAIN_DISPLAY_NAME,
  EGG_KEYCHAIN_COLLECTION,
  EGG_KEYCHAIN_ITEMS,
  EGG_KEYCHAIN_ITEM_IDS,
  MYTHIC_EGG_KEYCHAIN_ITEM_ID,
  NUKE_EGG_KEYCHAIN_ITEM_ID,
  QUANTUM_EGG_KEYCHAIN_ITEM_ID,
  MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE,
  NUKE_EGG_KEYCHAIN_UNLOCK_RULE,
  QUANTUM_EGG_KEYCHAIN_UNLOCK_RULE,
  MYTHIC_EGG_KEYCHAIN_ASSOCIATED_REWARDS,
  NUKE_EGG_KEYCHAIN_ASSOCIATED_REWARDS,
  QUANTUM_EGG_KEYCHAIN_ASSOCIATED_REWARDS,
  getEggKeychainItem,
  isEggKeychainItemId,
  getMythicEggKeychainItem,
  getNukeEggKeychainItem,
  getQuantumEggKeychainItem,
  isMythicEggKeychainEligible,
  isNukeEggKeychainEligible,
  formatKeychainSerial,
};
