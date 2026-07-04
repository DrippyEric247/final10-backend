/**
 * Perk Machine Reward Index — client copy (mirrors server REWARD_INDEX).
 */

export const PERK_REWARD_INDEX = [
  {
    id: 'savvy',
    icon: '🪙',
    title: 'Savvy Points',
    description: 'Earn Savvy Points added to your account balance.',
  },
  {
    id: 'egg',
    icon: '🥚',
    title: 'Eggs',
    description: 'Unlock temporary perks and bonuses.',
  },
  {
    id: 'scout_flight_ticket',
    icon: '🎟',
    title: 'Scout Flight Ticket',
    description:
      'Use this ticket to enter official Scout Flight Tournament Mode and compete for Savvy Points.',
  },
  {
    id: 'supply_drop',
    icon: '📦',
    title: 'Supply Drop',
    description: 'Receive a random bonus reward.',
  },
  {
    id: 'multiplier_2x',
    icon: '⭐',
    title: '2× Multiplier',
    description: 'Doubles every non-2× reward in the same spin.',
    examples: [
      '2× + 500 Savvy + Rare Egg = 1,000 Savvy + 2 Rare Eggs',
      '2× + 2× + 250 Savvy = 1,000 Savvy',
      'Three 2× tiles stack to 8× on all other rewards.',
    ],
  },
  {
    id: 'rarity_tiers',
    icon: '💎',
    title: 'Rare / Epic / Legendary Rewards',
    description: 'Higher rarity rewards have stronger effects or better cosmetic value.',
  },
];
