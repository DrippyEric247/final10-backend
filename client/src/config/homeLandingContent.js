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
