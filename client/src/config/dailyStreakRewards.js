/** Client mirror of server/config/dailyStreakRewards.js — display only. */
export const STREAK_MILESTONES = Object.freeze([
  { day: 1, savvy: 5, label: 'Day 1 Operator' },
  { day: 3, savvy: 10, label: 'Day 3 Check-in' },
  { day: 7, savvy: 25, scoutEggs: { common: 1 }, label: 'Week One' },
  { day: 14, savvy: 50, scoutEggs: { rare: 1 }, label: 'Two Week Run' },
  {
    day: 30,
    savvy: 100,
    scoutEggs: { epic: 1 },
    callingCardId: 'card_streak_30',
    label: 'Monthly Operator',
  },
  { day: 60, savvy: 250, scoutShields: 1, label: 'Two Month Veteran' },
  {
    day: 100,
    savvy: 500,
    scoutEggs: { legendary: 1 },
    badgeId: '100_day_operator',
    label: '100 Day Operator',
  },
]);

export const COMEBACK_REWARDS = Object.freeze([
  { inactiveDays: 7, savvy: 100, label: '7 Day Return' },
  { inactiveDays: 14, savvy: 250, scoutEggs: { rare: 1 }, label: '14 Day Return' },
  {
    inactiveDays: 30,
    savvy: 500,
    scoutEggs: { epic: 1 },
    callingCardId: 'card_welcome_back',
    label: '30 Day Return',
  },
]);

export const CALENDAR_DAYS = Object.freeze([1, 3, 7, 14, 30, 60, 100]);

export function formatEggRewards(eggs) {
  if (!eggs) return null;
  return Object.entries(eggs)
    .filter(([, n]) => Number(n) > 0)
    .map(([tier, n]) => `${n} ${tier} Scout Egg${Number(n) > 1 ? 's' : ''}`)
    .join(' · ');
}

export function formatMilestoneRewards(milestone) {
  if (!milestone) return [];
  const parts = [];
  if (milestone.savvy) parts.push(`+${milestone.savvy} Savvy`);
  const eggs = formatEggRewards(milestone.scoutEggs);
  if (eggs) parts.push(eggs);
  if (milestone.scoutShields) parts.push(`+${milestone.scoutShields} Scout Shield`);
  if (milestone.callingCardId) parts.push('Exclusive Calling Card');
  if (milestone.badgeId) parts.push('Operator Badge');
  return parts;
}
