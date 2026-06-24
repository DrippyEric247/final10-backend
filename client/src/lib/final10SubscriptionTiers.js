export const FINAL10_TIERS = Object.freeze([
  {
    id: 'free',
    name: 'FREE',
    priceLabel: '$0',
    subLabel: 'Always available',
    description: 'Everything you need to hunt smart from day one.',
    monthlyPrice: 0,
    bestMovesLabel: '5 / day',
    features: [
      '5 Best Moves per day',
      'Daily Login Streaks',
      'Free Battle Pass Track',
      'Basic Deal Alerts',
      'Savvy Points',
      'Calling Cards & Emblems',
      'Egg Collection',
      'Watchlist',
      'Referral Rewards',
      'Standard event multipliers',
    ],
    ctaLabel: 'Keep Using Free',
    ctaPath: '/auctions',
  },
  {
    id: 'core',
    name: 'PREMIUM',
    priceLabel: '$7/mo',
    subLabel: '$70/yr — save $14',
    description: 'Faster alerts, premium rewards, and more daily Best Moves.',
    monthlyPrice: 7,
    yearlyPrice: 70,
    bestMovesLabel: '10 / day',
    eventBonus: 'Double 2.2× · Triple 3.3×',
    features: [
      '10 Best Moves per day',
      'Faster Alert Notifications',
      'Premium Battle Pass Track',
      'Premium Egg Drops',
      'Extra Watchlist Capacity',
      'Priority Deal Discovery',
      'Premium Calling Cards & Emblems',
      '+10% bonus during Double Points and Triple Points events',
    ],
    ctaLabel: 'Upgrade to Premium',
    ctaPath: '/premium?tier=core',
  },
  {
    id: 'pro',
    name: 'PRO',
    priceLabel: '$14/mo',
    subLabel: '$140/yr — save $28',
    description: 'Unlimited Best Moves, voice features, and maximum advantage.',
    monthlyPrice: 14,
    yearlyPrice: 140,
    bestMovesLabel: 'Unlimited',
    eventBonus: 'Double 2.5× · Triple 3.75×',
    features: [
      'Unlimited Best Moves',
      'Fastest Alert Notifications',
      'Highest Alert Priority',
      'Voice Features',
      'Early Access Features',
      'Pro Profile Badge',
      'Exclusive Mythic Reward Opportunities',
      'Increased Egg Drop Chances',
      '+25% bonus during Double Points and Triple Points events',
    ],
    ctaLabel: 'Upgrade to Pro',
    ctaPath: '/premium?tier=pro',
  },
]);

export function getMostPopularTierId() {
  const allowed = new Set(['core', 'pro']);
  if (typeof window !== 'undefined') {
    const qs = new URLSearchParams(window.location.search || '');
    const fromUrl = String(qs.get('popular') || '').toLowerCase();
    if (allowed.has(fromUrl)) return fromUrl;
  }
  const fromEnv = String(process.env.REACT_APP_FINAL10_MOST_POPULAR_TIER || '').toLowerCase();
  return allowed.has(fromEnv) ? fromEnv : 'core';
}

export function getTierById(id) {
  return FINAL10_TIERS.find((t) => t.id === id) || FINAL10_TIERS[0];
}
