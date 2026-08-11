/**
 * Nuke Collection category-specific camo challenges — data-driven from camo catalog.
 * @module @savvy/core/config/nukeCategoryChallenges
 */

import { CAMO_ITEMS } from './camoLocker.js';
import { NUKE_CATEGORY_CONSECUTIVE_TARGET } from './dealStreak.js';

/**
 * Pick the challenge reward item for a category — prefers `nukeCategoryChallenge` items.
 * @param {string} categoryId
 * @returns {import('./camoLocker.js').CamoItemDefinition|null}
 */
export function getNukeChallengeItemForCategory(categoryId) {
  const category = String(categoryId || '').trim();
  const nukeItems = CAMO_ITEMS.filter((item) => item.camo === 'nukeStreak' && item.category === category);
  if (!nukeItems.length) return null;
  return nukeItems.find((item) => item.nukeCategoryChallenge) || nukeItems[0];
}

/**
 * Build challenges from catalog nukeStreak items (one per active category).
 * @returns {ReadonlyArray<object>}
 */
export function buildNukeCategoryChallenges(requiredConsecutiveDeals = NUKE_CATEGORY_CONSECUTIVE_TARGET) {
  const seen = new Set();
  const challenges = [];

  for (const item of CAMO_ITEMS) {
    if (item.camo !== 'nukeStreak') continue;
    if (seen.has(item.category)) continue;

    const challengeItem = getNukeChallengeItemForCategory(item.category);
    if (!challengeItem) continue;
    seen.add(item.category);

    challenges.push(
      Object.freeze({
        id: `${challengeItem.category}-nuke`,
        title: challengeItem.name || `${challengeItem.categoryName} Nuke`,
        category: challengeItem.category,
        categoryName: challengeItem.categoryName,
        requiredConsecutiveDeals,
        rewardType: 'camo',
        camoItemId: challengeItem.id,
        camoName: challengeItem.name,
        icon: '☢️',
      })
    );
  }

  return Object.freeze(
    challenges.sort((a, b) =>
      String(a.categoryName || a.category).localeCompare(String(b.categoryName || b.category))
    )
  );
}

export const NUKE_CATEGORY_CHALLENGES = buildNukeCategoryChallenges();

const BY_ID = Object.freeze(
  NUKE_CATEGORY_CHALLENGES.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, /** @type {Record<string, typeof NUKE_CATEGORY_CHALLENGES[number]>} */ ({}))
);

const BY_CATEGORY = Object.freeze(
  NUKE_CATEGORY_CHALLENGES.reduce((acc, c) => {
    acc[c.category] = c;
    return acc;
  }, /** @type {Record<string, typeof NUKE_CATEGORY_CHALLENGES[number]>} */ ({}))
);

export function getNukeCategoryChallenge(challengeId) {
  return BY_ID[String(challengeId || '').trim()] || null;
}

export function getNukeCategoryChallengeByCategory(categoryId) {
  return BY_CATEGORY[String(categoryId || '').trim()] || null;
}

export function listNukeCategoryChallengeCategories() {
  return NUKE_CATEGORY_CHALLENGES.map((c) => c.category);
}
