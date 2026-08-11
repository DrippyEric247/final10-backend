/**
 * Server mirror — Nuke category camo challenges derived from camo catalog.
 */

const { CAMO_ITEMS } = require('./camoLocker');
const { NUKE_CATEGORY_CONSECUTIVE_TARGET } = require('./dealStreak');

function getNukeChallengeItemForCategory(categoryId) {
  const category = String(categoryId || '').trim();
  const nukeItems = CAMO_ITEMS.filter((item) => item.camo === 'nukeStreak' && item.category === category);
  if (!nukeItems.length) return null;
  return nukeItems.find((item) => item.nukeCategoryChallenge) || nukeItems[0];
}

function buildNukeCategoryChallenges(requiredConsecutiveDeals = NUKE_CATEGORY_CONSECUTIVE_TARGET) {
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

const NUKE_CATEGORY_CHALLENGES = buildNukeCategoryChallenges();

const BY_ID = Object.freeze(
  NUKE_CATEGORY_CHALLENGES.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {})
);

const BY_CATEGORY = Object.freeze(
  NUKE_CATEGORY_CHALLENGES.reduce((acc, c) => {
    acc[c.category] = c;
    return acc;
  }, {})
);

function getNukeCategoryChallenge(challengeId) {
  return BY_ID[String(challengeId || '').trim()] || null;
}

function getNukeCategoryChallengeByCategory(categoryId) {
  return BY_CATEGORY[String(categoryId || '').trim()] || null;
}

function listNukeCategoryChallengeCategories() {
  return NUKE_CATEGORY_CHALLENGES.map((c) => c.category);
}

module.exports = {
  NUKE_CATEGORY_CHALLENGES,
  buildNukeCategoryChallenges,
  getNukeChallengeItemForCategory,
  getNukeCategoryChallenge,
  getNukeCategoryChallengeByCategory,
  listNukeCategoryChallengeCategories,
};
