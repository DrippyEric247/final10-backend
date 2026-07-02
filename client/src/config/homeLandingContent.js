/** Static copy for Home landing sections — edit here to rebalance messaging. */

export const HOME_HERO = Object.freeze({
  title: 'Welcome to Final10',
  subtitle:
    'The smartest place to buy because it helps you catch better deals before anyone else.',
});

export const HOME_MISSION = Object.freeze({
  title: 'Our Mission',
  body:
    'Our mission is to help people spend less, save more, and make smarter buying decisions by finding the best deals before everyone else.',
});

export const HOME_VISION = Object.freeze({
  title: 'Our Vision',
  body:
    'We are starting with eBay, but our mission is much bigger: to help users find the best deals no matter where they are listed.',
});

export const MARKETPLACE_ROADMAP = Object.freeze([
  { name: 'eBay', status: 'live', label: 'Live / Beta' },
  { name: 'Mercari', status: 'planned', label: 'Planned' },
  { name: 'Facebook Marketplace', status: 'planned', label: 'Planned' },
  { name: 'OfferUp', status: 'planned', label: 'Planned' },
  { name: 'Whatnot', status: 'planned', label: 'Planned' },
  { name: 'StockX', status: 'planned', label: 'Planned' },
  { name: 'GOAT', status: 'planned', label: 'Planned' },
  { name: 'More to come', status: 'planned', label: 'Planned' },
]);

export const MEET_SAVVY_SCOUT = Object.freeze({
  title: 'Meet Savvy Scout',
  body:
    'Savvy Scout is your deal-hunting companion, helping you discover better opportunities, understand trust signals, and make smarter buying decisions.',
});

export const WHY_FINAL10 = Object.freeze([
  'AI-powered deal discovery',
  'Final-minute auction opportunities',
  'Smart alerts',
  'Seller Trust Scores',
  'Battle Pass rewards',
  'Login streaks',
  'Scout Flight',
  'Perk Machine',
  'Community-driven roadmap',
]);

export const HOME_CLOSING_LINE =
  'Every feature we build moves us closer to making Final10 the smartest shopping platform in the Savvy Universe.';

/** Savvy Universe app ecosystem roadmap — one account, one balance across apps. */
export const SAVVY_UNIVERSE_ROADMAP = Object.freeze({
  title: '🌌 The Savvy Universe Roadmap',
  subtitle:
    'Final10 is just the beginning. One account, one Savvy balance, and a growing ecosystem of apps built to help you save more, earn more, and make smarter decisions.',
  coreMessage: Object.freeze({
    title: 'One Savvy Balance',
    lead: 'Every Savvy Point you earn in Final10 stays with you as the Savvy Universe expands.',
    highlight: 'Earn in one app. Carry it everywhere.',
    tomorrow:
      'Today you can earn Savvy Points through Final10. Tomorrow, those same points will follow you into travel, food, gaming, shopping, AI tools, and more.',
  }),
  closing:
    'You are joining while the Savvy Universe is still young. As new apps launch, your Savvy account becomes more valuable.',
  slogan: 'Stay Savvy. Stay Smart. The best deals from the start.',
});

export const SAVVY_UNIVERSE_PROGRESS = Object.freeze({
  title: '🌌 Universe Progress',
  stats: Object.freeze([
    { id: 'apps', label: 'Apps Released', value: '1 / 30+' },
    { id: 'marketplaces', label: 'Marketplaces Connected', value: '1 / 15+' },
    { id: 'balance', label: 'Shared Savvy Balance', value: 'In Progress' },
    {
      id: 'mission',
      label: 'Mission',
      value: 'Help millions save money and make smarter decisions.',
    },
  ]),
});

/** phase: current | next | upcoming — drives timeline group headers */
export const SAVVY_UNIVERSE_APPS = Object.freeze([
  {
    id: 'final10',
    order: 1,
    name: 'Final10',
    phase: 'current',
    status: 'live_beta',
    statusLabel: 'Live Beta',
    description: 'Find better deals before anyone else.',
    tagline: 'Bring home the win with Final10.',
  },
  {
    id: 'savvytrip',
    order: 2,
    name: 'SavvyTrip',
    phase: 'next',
    status: 'coming_soon',
    statusLabel: 'Coming Soon',
    description: 'Travel smarter with the same Savvy account and Savvy balance.',
  },
  {
    id: 'bitesavvy',
    order: 3,
    name: 'BiteSavvy',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Restaurant rewards, food deals, and smarter dining.',
  },
  {
    id: 'ai-go',
    order: 4,
    name: 'AI-Go',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Your AI assistant for smarter everyday decisions.',
  },
  {
    id: 'ez-stay',
    order: 5,
    name: 'EZ Stay',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Hotel savings, travel stays, and smarter booking.',
  },
  {
    id: 'savvyshop',
    order: 6,
    name: 'SavvyShop',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Smarter shopping across more stores and marketplaces.',
  },
  {
    id: 'gamesavvy',
    order: 7,
    name: 'GameSavvy',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Gaming rewards, challenges, and player progression.',
  },
  {
    id: 'fitsavvy',
    order: 8,
    name: 'FitSavvy',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Fitness goals, wellness rewards, and healthy habits.',
  },
  {
    id: 'savvy-security',
    order: 9,
    name: 'Savvy Security',
    phase: 'upcoming',
    status: 'planned',
    statusLabel: 'Planned',
    description: 'Smarter home and business security tools.',
  },
  {
    id: 'savvytube',
    order: 10,
    name: 'SavvyTube / SavvySocial',
    phase: 'upcoming',
    status: 'future',
    statusLabel: 'Future',
    description: 'Creator content, social rewards, and community experiences.',
  },
  {
    id: 'savvyos',
    order: 11,
    name: 'SavvyOS',
    phase: 'upcoming',
    status: 'future',
    statusLabel: 'Future',
    description: 'The assistant layer that connects the entire Savvy Universe.',
  },
]);

export const SAVVY_UNIVERSE_PHASE_LABELS = Object.freeze({
  current: 'Current',
  next: 'Next',
  upcoming: 'Upcoming',
});

export const DONATION_COPY = Object.freeze({
  title: 'Support Final10',
  subtitle: 'Help us build the future of smarter shopping.',
  body:
    'Final10 Beta is completely free. If you have saved money, enjoy the app, or believe in our mission, you can optionally support development.',
  bodyExtra:
    'Every donation helps us improve alerts, expand to more marketplaces, and build the Savvy Universe.',
  freeNote: 'Donations are optional. Final10 Beta remains free.',
});

export const DONATION_IMPACT = Object.freeze([
  'Improve eBay deal discovery',
  'Add Mercari support',
  'Add Facebook Marketplace support',
  'Add OfferUp support',
  'Improve AI deal scoring',
  'Improve alert speed and reliability',
  'Improve Scout Flight',
  'Add new rewards and cosmetics',
  'Improve search and seller trust',
]);

export const DONATION_BUTTONS = Object.freeze([
  { id: 'coffee5', emoji: '☕', label: 'Buy Savvy Scout a Coffee', amount: '$5', linkKey: 'coffee5' },
  { id: 'support25', emoji: '🚀', label: 'Support Development', amount: '$25', linkKey: 'support25' },
  { id: 'legendary100', emoji: '💎', label: 'Legendary Supporter', amount: '$100', linkKey: 'legendary100' },
  { id: 'custom', emoji: '❤️', label: 'Choose Your Amount', amount: null, linkKey: 'custom' },
]);

export const SUPPORTER_REWARDS = Object.freeze({
  title: 'Beta Supporter Rewards',
  intro:
    'Supporters receive exclusive cosmetic thank-you rewards. These do not give faster alerts, better deals, extra Savvy Points, or gameplay advantages.',
  tiers: [
    {
      id: 'beta',
      min: '$5+',
      name: 'Beta Supporter',
      perks: ['Beta Supporter Badge'],
    },
    {
      id: 'founding',
      min: '$25+',
      name: 'Founding Supporter',
      perks: ['Founder Calling Card', 'Founder Profile Border', 'Optional name on Founding Supporters Wall'],
    },
    {
      id: 'legendary',
      min: '$100+',
      name: 'Legendary Supporter',
      perks: [
        'Animated Founder Emblem',
        'Gold Founder Name Accent',
        'Optional featured thank-you message',
      ],
    },
  ],
  disclaimer:
    'No gameplay advantages. No faster alerts. No exclusive deals. Just our appreciation.',
});

export const FEEDBACK_COPY = Object.freeze({
  label: 'Leave a Message',
  placeholder: 'Tell us what you love, what you want next, or how Final10 helped you save.',
  helper: 'Every message is read and helps shape the future of Final10.',
});
