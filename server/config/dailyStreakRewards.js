/**
 * Daily login streak milestones, comeback rewards, and hidden achievements.
 * Savvy grants use the wallet pipeline; eggs/shields/cosmetics are inventory unlocks.
 */

const STREAK_MILESTONES = Object.freeze([
  { day: 1, savvy: 5, label: 'Day 1 Operator' },
  { day: 3, savvy: 10, label: 'Day 3 Check-in' },
  {
    day: 7,
    savvy: 25,
    scoutEggs: { common: 1 },
    label: 'Week One',
  },
  {
    day: 14,
    savvy: 50,
    scoutEggs: { rare: 1 },
    label: 'Two Week Run',
  },
  {
    day: 30,
    savvy: 100,
    scoutEggs: { epic: 1 },
    callingCardId: 'card_streak_30',
    label: 'Monthly Operator',
  },
  {
    day: 60,
    savvy: 250,
    scoutShields: 1,
    label: 'Two Month Veteran',
  },
  {
    day: 100,
    savvy: 500,
    scoutEggs: { legendary: 1 },
    badgeId: '100_day_operator',
    label: '100 Day Operator',
  },
]);

const COMEBACK_REWARDS = Object.freeze([
  { inactiveDays: 7, savvy: 100, tierKey: '7', label: '7 Day Return' },
  {
    inactiveDays: 14,
    savvy: 250,
    scoutEggs: { rare: 1 },
    tierKey: '14',
    label: '14 Day Return',
  },
  {
    inactiveDays: 30,
    savvy: 500,
    scoutEggs: { epic: 1 },
    callingCardId: 'card_welcome_back',
    tierKey: '30',
    label: '30 Day Return',
  },
]);

const HIDDEN_ACHIEVEMENTS = Object.freeze([
  {
    id: 'legacy_loyalist',
    requiredStreakDay: 100,
    savvy: 5000,
    badgeId: 'legacy_loyalist',
    callingCardId: 'card_legacy_loyalist',
    label: 'Legacy Loyalist',
    hidden: true,
  },
]);

/** Calendar display — all milestone days shown in UI */
const CALENDAR_DAYS = Object.freeze([1, 3, 7, 14, 30, 60, 100]);

/** Admin testing — valid milestone set targets */
const ADMIN_MILESTONE_DAYS = CALENDAR_DAYS;

/** Future reward hooks (Battle Pass, Perk Machine, creator bonuses) */
const FUTURE_REWARD_SLOTS = Object.freeze({
  battlePassXpOnClaim: 25,
  perkMachineTokens: 0,
  creatorBonusSavvy: 0,
});

function findMilestoneForDay(day) {
  const d = Math.max(1, Math.floor(Number(day) || 0));
  return STREAK_MILESTONES.find((m) => m.day === d) || null;
}

function findNextMilestone(currentStreak) {
  const streak = Math.max(0, Math.floor(Number(currentStreak) || 0));
  return STREAK_MILESTONES.find((m) => m.day > streak) || null;
}

function findComebackTier(inactiveDays) {
  const days = Math.max(0, Math.floor(Number(inactiveDays) || 0));
  let match = null;
  for (const row of COMEBACK_REWARDS) {
    if (days >= row.inactiveDays) match = row;
  }
  return match;
}

function daysBetween(startDay, endDay) {
  if (!startDay || !endDay) return Number.POSITIVE_INFINITY;
  const a = new Date(`${startDay}T12:00:00.000Z`);
  const b = new Date(`${endDay}T12:00:00.000Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

module.exports = {
  STREAK_MILESTONES,
  COMEBACK_REWARDS,
  HIDDEN_ACHIEVEMENTS,
  CALENDAR_DAYS,
  ADMIN_MILESTONE_DAYS,
  FUTURE_REWARD_SLOTS,
  findMilestoneForDay,
  findNextMilestone,
  findComebackTier,
  daysBetween,
};
