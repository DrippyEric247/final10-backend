/**
 * Normal Deal Streak egg reward ladder (category-independent).
 * Quantum @ 30 is handled separately by quantumEggService.
 */

const DEAL_STREAK_EGG_MILESTONES = Object.freeze([
  {
    streak: 3,
    eggTier: 'epic',
    milestoneKey: 'deal_streak_3',
    label: 'Deal Streak Epic Egg',
  },
  {
    streak: 6,
    eggTier: 'legendary',
    milestoneKey: 'deal_streak_6',
    label: 'Deal Streak Legendary Egg',
  },
  {
    streak: 8,
    eggTier: 'mythic',
    milestoneKey: 'deal_streak_8',
    label: 'Deal Streak Mythic Egg',
  },
]);

function getDealStreakEggMilestone(streak) {
  const n = Math.max(0, Math.round(Number(streak) || 0));
  return DEAL_STREAK_EGG_MILESTONES.find((m) => m.streak === n) || null;
}

module.exports = {
  DEAL_STREAK_EGG_MILESTONES,
  getDealStreakEggMilestone,
};
