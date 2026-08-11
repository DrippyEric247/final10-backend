const {
  QUANTUM_EGG_VERSION,
  QUANTUM_EGG_RARITY,
  QUANTUM_NUKE_DEAL_STREAK_TARGET,
  QUANTUM_ACHIEVEMENT_ID,
  QUANTUM_KEYCHAIN_ITEM_ID,
  isQuantumDealStreakEligible,
  isQuantumLegacyUnlocked,
} = require('../config/quantumEgg');
const {
  buildQuantumPublicState,
  ensureQuantumLegacy,
} = require('../services/quantumEggService');

describe('Quantum Egg', () => {
  test('uses single quantum rarity tier', () => {
    expect(QUANTUM_EGG_RARITY).toBe('quantum');
    expect(QUANTUM_EGG_VERSION).toBe(1);
  });

  test('secret streak target is 30 qualifying deals', () => {
    expect(QUANTUM_NUKE_DEAL_STREAK_TARGET).toBe(30);
    expect(isQuantumDealStreakEligible(29)).toBe(false);
    expect(isQuantumDealStreakEligible(30)).toBe(true);
  });

  test('public state hides secret before unlock', () => {
    const user = { quantumLegacy: { unlocked: false }, dealStreak: { currentDealStreak: 25 } };
    const state = buildQuantumPublicState(user);
    expect(state.visible).toBe(false);
    expect(state.classified).toBe(true);
    expect(state.pendingReveal).toBe(false);
    expect(state.legacy).toBeUndefined();
  });

  test('public state does not expose remaining deal count', () => {
    const user = { quantumLegacy: { unlocked: false }, dealStreak: { currentDealStreak: 29 } };
    const state = buildQuantumPublicState(user);
    expect(JSON.stringify(state)).not.toContain('29');
    expect(JSON.stringify(state)).not.toContain('remaining');
  });

  test('public state reveals legacy only after unlock', () => {
    const user = {
      quantumLegacy: {
        unlocked: true,
        unlockedAt: new Date('2026-01-01'),
        achievementId: QUANTUM_ACHIEVEMENT_ID,
        originatingApp: 'final10',
        dealStreakAtUnlock: 30,
        profileLevelAtUnlock: 42,
        prestigeAtUnlock: 1,
        pendingReveal: false,
      },
    };
    const state = buildQuantumPublicState(user);
    expect(state.visible).toBe(true);
    expect(state.unlocked).toBe(true);
    expect(state.universal).toBe(true);
    expect(state.crossApp).toBe(true);
    expect(state.legacy.achievementId).toBe(QUANTUM_ACHIEVEMENT_ID);
    expect(state.legacy.dealStreakAtUnlock).toBe(30);
  });

  test('ensureQuantumLegacy initializes universal flags', () => {
    const user = {};
    const legacy = ensureQuantumLegacy(user);
    expect(legacy.universal).toBe(true);
    expect(legacy.crossApp).toBe(true);
    expect(legacy.unlocked).toBe(false);
  });
});

describe('Quantum Egg keychain registration', () => {
  test('registers keychain cosmetic id', () => {
    const { isKnownCosmeticId } = require('../data/cosmeticIds');
    expect(QUANTUM_KEYCHAIN_ITEM_ID).toBe('keychain_quantum_egg');
    expect(isKnownCosmeticId(QUANTUM_KEYCHAIN_ITEM_ID)).toBe(true);
  });

  test('isQuantumLegacyUnlocked reads account state', () => {
    expect(isQuantumLegacyUnlocked({ unlocked: false })).toBe(false);
    expect(isQuantumLegacyUnlocked({ unlocked: true })).toBe(true);
  });
});
