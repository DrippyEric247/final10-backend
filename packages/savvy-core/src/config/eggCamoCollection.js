/**
 * Egg Camo Collection — lifetime Egg rarity mastery progression.
 *
 * Pure data + helpers. Server mirror: `server/config/eggCamoCollection.js`
 *
 * @module @savvy/core/config/eggCamoCollection
 */

/** Bump when requirements or camo roster changes. */
export const EGG_CAMO_COLLECTION_VERSION = 1;

/** Hatchable perk-machine egg tiers that count toward mastery. */
export const EGG_CAMO_HATCHABLE_TIERS = Object.freeze([
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
]);

/** Standard public Egg Camos — secret/Nuke tiers are intentionally absent. */
export const EGG_CAMO_IDS = Object.freeze([
  'woodland',
  'tiger',
  'arctic',
  'gold',
  'diamond',
  'darkNebula',
]);

/**
 * Configurable per-camo requirements. `required` is the lifetime collection target.
 * Dark Nebula uses mythic eggs but requires all prior standard camos unlocked first.
 */
export const EGG_CAMO_REQUIREMENTS = Object.freeze({
  woodland: Object.freeze({
    eggTier: 'common',
    required: 30,
    displayName: 'Woodland Egg',
    masteryLabel: 'Common Mastery',
    eggRarityLabel: 'Common',
  }),
  tiger: Object.freeze({
    eggTier: 'rare',
    required: 30,
    displayName: 'Tiger Egg',
    masteryLabel: 'Rare Mastery',
    eggRarityLabel: 'Rare',
  }),
  arctic: Object.freeze({
    eggTier: 'epic',
    required: 30,
    displayName: 'Arctic Egg',
    masteryLabel: 'Epic Mastery',
    eggRarityLabel: 'Epic',
  }),
  gold: Object.freeze({
    eggTier: 'legendary',
    required: 30,
    displayName: 'Gold Egg',
    masteryLabel: 'Legendary Mastery',
    eggRarityLabel: 'Legendary',
  }),
  diamond: Object.freeze({
    eggTier: 'mythic',
    required: 30,
    displayName: 'Diamond Egg',
    masteryLabel: 'Mythic Mastery',
    eggRarityLabel: 'Mythic',
  }),
  darkNebula: Object.freeze({
    eggTier: 'mythic',
    required: 30,
    requiresAllPriorCamos: true,
    displayName: 'Dark Nebula Egg',
    masteryLabel: 'Final Egg Mastery',
    eggRarityLabel: 'Mythic',
  }),
});

/** Visual accents aligned with Savvy Camo Locker tiers. */
export const EGG_CAMO_VISUALS = Object.freeze({
  woodland: Object.freeze({
    rarity: 'common',
    accentColor: '#6b8f3f',
    accentColorAlt: '#3f5622',
  }),
  tiger: Object.freeze({
    rarity: 'uncommon',
    accentColor: '#ff7a00',
    accentColorAlt: '#1a1a1a',
  }),
  arctic: Object.freeze({
    rarity: 'rare',
    accentColor: '#38bdf8',
    accentColorAlt: '#0c4a6e',
  }),
  gold: Object.freeze({
    rarity: 'epic',
    accentColor: '#fbbf24',
    accentColorAlt: '#92400e',
  }),
  diamond: Object.freeze({
    rarity: 'legendary',
    accentColor: '#e2e8f0',
    accentColorAlt: '#64748b',
  }),
  darkNebula: Object.freeze({
    rarity: 'mythic',
    accentColor: '#a855f7',
    accentColorAlt: '#4c1d95',
  }),
});

/** Internal hook event — future secret progression attaches here. */
export const EGG_CAMO_COLLECTION_MASTERED_EVENT = 'eggCamoCollectionMastered';

/** Sources that increment lifetime Egg Camo progression. */
export const EGG_CAMO_COUNTABLE_SOURCES = Object.freeze([
  'perk_machine',
  'perk_machine_hatch',
  'battle_pass',
  'supply_drop',
  'event_reward',
  'egg_exchange',
]);

export function isHatchableEggTier(tier) {
  return EGG_CAMO_HATCHABLE_TIERS.includes(String(tier || '').trim());
}

export function isEggCamoId(id) {
  return EGG_CAMO_IDS.includes(String(id || '').trim());
}

export function getEggCamoRequirement(camoId) {
  return EGG_CAMO_REQUIREMENTS[camoId] || null;
}

export function buildEggCamoCatalogItems() {
  return EGG_CAMO_IDS.map((id, index) => {
    const req = EGG_CAMO_REQUIREMENTS[id];
    const visuals = EGG_CAMO_VISUALS[id];
    return Object.freeze({
      id,
      order: index + 1,
      name: req.displayName,
      masteryLabel: req.masteryLabel,
      eggTier: req.eggTier,
      eggRarityLabel: req.eggRarityLabel,
      required: req.required,
      requiresAllPriorCamos: Boolean(req.requiresAllPriorCamos),
      ...visuals,
      requirementText: req.requiresAllPriorCamos
        ? `Collect ${req.required} Mythic Eggs and master all prior Egg Camos`
        : `Collect ${req.required} ${req.eggRarityLabel} Eggs`,
    });
  });
}

export const EGG_CAMO_CATALOG_ITEMS = Object.freeze(buildEggCamoCatalogItems());

function priorCamoIds(camoId) {
  const idx = EGG_CAMO_IDS.indexOf(camoId);
  if (idx <= 0) return [];
  return EGG_CAMO_IDS.slice(0, idx);
}

/**
 * Evaluate whether a camo is unlocked given lifetime counts + prior unlocks.
 * @param {string} camoId
 * @param {Record<string, number>} lifetimeCollected
 * @param {Record<string, boolean>} unlockedCamos
 */
export function evaluateEggCamoUnlock(camoId, lifetimeCollected, unlockedCamos = {}) {
  const req = getEggCamoRequirement(camoId);
  if (!req) return { unlocked: false, current: 0, target: 0, progress: 0, gatesMet: false };

  const current = Math.max(0, Number(lifetimeCollected?.[req.eggTier]) || 0);
  const target = Math.max(1, Number(req.required) || 1);
  const progress = Math.max(0, Math.min(100, Math.round((current / target) * 100)));

  let gatesMet = true;
  if (req.requiresAllPriorCamos) {
    gatesMet = priorCamoIds(camoId).every((id) => Boolean(unlockedCamos?.[id]));
  }

  const unlocked = current >= target && gatesMet;
  return { unlocked, current: Math.min(current, target), target, progress, gatesMet, rawCurrent: current };
}

/**
 * Build client-facing rows from persisted progress.
 * @param {object} progress normalized eggCamoProgress
 */
export function buildEggCamoRows(progress = {}) {
  const lifetime = progress.lifetimeCollected || {};
  const unlockedCamos = progress.unlockedCamos || {};
  const unlockHistory = progress.unlockHistory || {};

  return EGG_CAMO_CATALOG_ITEMS.map((item) => {
    const evalResult = evaluateEggCamoUnlock(item.id, lifetime, unlockedCamos);
    const persistedUnlock = Boolean(unlockedCamos[item.id]);
    const unlocked = persistedUnlock || evalResult.unlocked;
    const history = unlockHistory[item.id] || null;
    return {
      ...item,
      current: evalResult.rawCurrent,
      displayCurrent: evalResult.current,
      target: evalResult.target,
      progress: evalResult.progress,
      gatesMet: evalResult.gatesMet,
      unlocked,
      unlockedAt: history?.unlockedAt || null,
      accountLevelAtUnlock: history?.accountLevelAtUnlock ?? null,
      prestigeAtUnlock: history?.prestigeAtUnlock ?? null,
      rarityCountAtUnlock: history?.rarityCountAtUnlock ?? null,
      unlockSource: history?.source || null,
    };
  });
}

export function summarizeEggCamoCollection(rows) {
  const total = rows.length;
  const unlocked = rows.filter((r) => r.unlocked).length;
  const percent = total ? Math.round((unlocked / total) * 100) : 0;
  const mastered = unlocked >= total;
  return { total, unlocked, percent, mastered };
}

/**
 * Closest camo by remaining eggs; ties favor lower mastery tier (lower order).
 * @param {ReturnType<typeof buildEggCamoRows>} rows
 */
export function getClosestEggCamo(rows) {
  const candidates = rows
    .filter((r) => !r.unlocked)
    .map((r) => ({
      ...r,
      remaining: Math.max(0, r.target - r.current),
    }))
    .filter((r) => r.gatesMet !== false);

  if (!candidates.length) return null;

  return candidates.sort((a, b) => {
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return a.order - b.order;
  })[0];
}

export function emptyEggCamoLifetimeCollected() {
  return Object.freeze({
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  });
}

export function emptyEggCamoUnlockMap() {
  return Object.freeze(
    EGG_CAMO_IDS.reduce((acc, id) => {
      acc[id] = false;
      return acc;
    }, /** @type {Record<string, boolean>} */ ({}))
  );
}
