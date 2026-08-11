const {
  EGG_KEYCHAIN_ITEM_IDS,
  EGG_KEYCHAIN_ITEMS,
  EGG_KEYCHAIN_COLLECTION_VERSION,
  MYTHIC_EGG_KEYCHAIN_ITEM_ID,
  NUKE_EGG_KEYCHAIN_ITEM_ID,
  QUANTUM_EGG_KEYCHAIN_ITEM_ID,
  MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE,
  NUKE_EGG_KEYCHAIN_UNLOCK_RULE,
  getMythicEggKeychainItem,
  getNukeEggKeychainItem,
  getQuantumEggKeychainItem,
  isEggKeychainItemId,
  isMythicEggKeychainEligible,
  isNukeEggKeychainEligible,
  formatKeychainSerial,
} = require('../config/eggKeychainCollection');
const { isKnownCosmeticId, EGG_KEYCHAIN_ITEM_IDS: COSMETIC_KEYCHAIN_IDS } = require('../data/cosmeticIds');

describe('Egg Keychain Collection', () => {
  test('registers mythic, nuke, and quantum egg keychain items', () => {
    expect(EGG_KEYCHAIN_ITEM_IDS).toContain(MYTHIC_EGG_KEYCHAIN_ITEM_ID);
    expect(EGG_KEYCHAIN_ITEM_IDS).toContain(NUKE_EGG_KEYCHAIN_ITEM_ID);
    expect(EGG_KEYCHAIN_ITEM_IDS).toContain(QUANTUM_EGG_KEYCHAIN_ITEM_ID);
    expect(EGG_KEYCHAIN_ITEM_IDS).toHaveLength(3);
    expect(EGG_KEYCHAIN_COLLECTION_VERSION).toBe(3);
  });

  test('mythic egg keychain metadata matches spec', () => {
    const item = getMythicEggKeychainItem();
    expect(item).toBeTruthy();
    expect(item.slug).toBe('mythic-egg-keychain');
    expect(item.name).toBe('MYTHICAL EGG KEYCHAIN');
    expect(item.rarity).toBe('mythic');
    expect(item.purchasable).toBe(false);
    expect(item.streamHouseTier).toBe('mythic');
  });

  test('nuke egg keychain metadata matches spec', () => {
    const item = getNukeEggKeychainItem();
    expect(item).toBeTruthy();
    expect(item.slug).toBe('nuke-egg-keychain');
    expect(item.name).toBe('NUKE EGG KEYCHAIN');
    expect(item.rarity).toBe('nuke');
    expect(item.tier).toBe('nuke');
    expect(item.nukeCollection).toBe(true);
    expect(item.assetPath).toBe('/assets/egg-keychains/nuke-egg-keychain.jpeg');
    expect(item.physicalCollectible).toBe(true);
    expect(item.serialNumberSupported).toBe(true);
    expect(item.streamHouseEligible).toBe(true);
    expect(item.streamHouseTier).toBe('nuke');
    expect(item.previewWhenLocked).toBe(true);
    expect(item.earnedOnly).toBe(true);
    expect(item.purchasable).toBe(false);
    expect(item.tagline).toBe('YOU EARNED IT. NOW CARRY THE BLAST.');
    expect(item.unlockRule.lockedRequirementLabel).toBe('EARNED THROUGH NUKE EGG REWARDS');
  });

  test('quantum egg keychain metadata matches spec', () => {
    const item = getQuantumEggKeychainItem();
    expect(item).toBeTruthy();
    expect(item.slug).toBe('quantum-egg-keychain');
    expect(item.rarity).toBe('quantum');
    expect(item.quantumLegacy).toBe(true);
    expect(item.universal).toBe(true);
    expect(item.hiddenUntilDiscovered).toBe(true);
    expect(item.previewWhenLocked).toBe(false);
    expect(item.purchasable).toBe(false);
    expect(item.streamHouseTier).toBe('quantum');
    expect(item.unlockRule.lockedRequirementLabel).toBe('HIDDEN LEGACY');
  });

  test('isEggKeychainItemId recognizes registered ids', () => {
    expect(isEggKeychainItemId(MYTHIC_EGG_KEYCHAIN_ITEM_ID)).toBe(true);
    expect(isEggKeychainItemId(NUKE_EGG_KEYCHAIN_ITEM_ID)).toBe(true);
    expect(isEggKeychainItemId(QUANTUM_EGG_KEYCHAIN_ITEM_ID)).toBe(true);
    expect(isEggKeychainItemId('unknown_keychain')).toBe(false);
  });

  test('mythic eligibility requires first mythic egg lifetime count', () => {
    expect(isMythicEggKeychainEligible({ mythic: 0 })).toBe(false);
    expect(isMythicEggKeychainEligible({ mythic: 1 })).toBe(true);
    expect(MYTHIC_EGG_KEYCHAIN_UNLOCK_RULE.eggTier).toBe('mythic');
  });

  test('nuke eligibility requires first nuke event activation', () => {
    expect(isNukeEggKeychainEligible({ nukeEventsTriggered: 0 })).toBe(false);
    expect(isNukeEggKeychainEligible({ nukeEventsTriggered: 1 })).toBe(true);
    expect(NUKE_EGG_KEYCHAIN_UNLOCK_RULE.minNukeEventsTriggered).toBe(1);
  });

  test('all three keychain tiers remain distinct', () => {
    const mythic = getMythicEggKeychainItem();
    const nuke = getNukeEggKeychainItem();
    const quantum = getQuantumEggKeychainItem();
    expect(new Set([mythic.id, nuke.id, quantum.id]).size).toBe(3);
    expect(new Set([mythic.rarity, nuke.rarity, quantum.rarity])).toEqual(
      new Set(['mythic', 'nuke', 'quantum'])
    );
  });

  test('nuke and mythic keychains are separate collectibles', () => {
    const mythic = getMythicEggKeychainItem();
    const nuke = getNukeEggKeychainItem();
    expect(mythic.id).not.toBe(nuke.id);
    expect(mythic.assetPath).not.toBe(nuke.assetPath);
    expect(mythic.rarity).not.toBe(nuke.rarity);
  });

  test('formatKeychainSerial pads to four digits', () => {
    expect(formatKeychainSerial(1)).toBe('0001');
    expect(formatKeychainSerial(127)).toBe('0127');
    expect(formatKeychainSerial(null)).toBeNull();
  });

  test('cosmetic registry includes egg keychain ids', () => {
    for (const id of EGG_KEYCHAIN_ITEM_IDS) {
      expect(COSMETIC_KEYCHAIN_IDS.has(id)).toBe(true);
      expect(isKnownCosmeticId(id)).toBe(true);
    }
  });

  test('associated rewards include capture-at-unlock slots', () => {
    const mythic = EGG_KEYCHAIN_ITEMS.find((i) => i.id === MYTHIC_EGG_KEYCHAIN_ITEM_ID);
    const nuke = EGG_KEYCHAIN_ITEMS.find((i) => i.id === NUKE_EGG_KEYCHAIN_ITEM_ID);
    expect(mythic.associatedRewards.map((r) => r.slot)).toEqual([
      'profileLevel',
      'emblemId',
      'callingCardId',
      'serialNumber',
    ]);
    expect(nuke.associatedRewards.map((r) => r.slot)).toEqual([
      'serialNumber',
      'profileLevel',
      'prestige',
      'source',
    ]);
  });
});
