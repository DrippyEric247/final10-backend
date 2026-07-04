/** My Savvy Shop vision page — beta preview copy. */

export const SAVVY_SHOP_VISION_HERO = {
  title: '🛍️ Welcome to My Savvy Shop',
  subtitle: 'The future home of AI-powered shopping across the Savvy Universe.',
  body:
    'Final10 helps you discover incredible deals on both used and new items. My Savvy Shop is where trusted stores, businesses, creators, and eventually anyone can open a shop connected directly to the Savvy Universe.',
};

export const SAVVY_SHOP_VISION_CARDS = [
  {
    id: 'brand_new',
    emoji: '🆕',
    title: 'Brand-New Shopping',
    bullets: [
      'Purchase new products from trusted retailers.',
      'Earn Savvy Points on eligible purchases.',
      'AI compares prices before you buy.',
    ],
    tone: 'emerald',
  },
  {
    id: 'merchant',
    emoji: '🏪',
    title: 'Future Merchant Platform',
    body:
      "One day businesses of every size will be able to launch their own Savvy Shop. Whether you're a local store, creator, pawn shop, reseller, or national retailer, you'll be able to connect your inventory to the Savvy Universe.",
    tone: 'violet',
  },
  {
    id: 'assistant',
    emoji: '🔍',
    title: 'AI Shopping Assistant',
    intro: 'Savvy Scout will automatically compare:',
    bullets: ['Price', 'Value', 'Trust', 'Competition', 'Market trends'],
    outro: 'before recommending what to buy.',
    tone: 'gold',
  },
  {
    id: 'connected',
    emoji: '🌎',
    title: 'Connected Across the Universe',
    bullets: [
      'Every purchase can contribute to your universal Savvy account.',
      'Earn points.',
      'Unlock rewards.',
      'Increase your rank.',
      'Carry your progress across future Savvy apps.',
    ],
    tone: 'sky',
  },
];

export const SAVVY_SHOP_WHERE_TO_SHOP = [
  {
    id: 'final10',
    emoji: '🎯',
    title: 'Final10',
    bestForLabel: 'Best for:',
    bullets: [
      'Used deals',
      'Auctions',
      'Low competition finds',
      'Last-minute bargains',
      'Hidden gems',
    ],
    cta: 'Explore Final10 Deals',
    to: '/local-deals',
    tone: 'final10',
  },
  {
    id: 'savvy_shop',
    emoji: '🛍️',
    title: 'My Savvy Shop',
    bestForLabel: 'Best for:',
    bullets: [
      'Brand-new products',
      'Trusted retailers',
      'Verified stores',
      'Everyday shopping',
      'Savvy rewards',
    ],
    cta: 'Browse Shops',
    scrollTo: 'savvy-shop-partners',
    tone: 'shop',
  },
  {
    id: 'life_optimizer',
    emoji: '🤖',
    title: 'Life Optimizer',
    bestForLabel: 'Best for:',
    intro: 'Not sure which option is the better value?',
    compareLabel: 'Life Optimizer compares:',
    bullets: ['Used vs New', 'Warranty', 'Shipping', 'Savings', 'Long-term value'],
    outro: 'and recommends the smartest purchase.',
    cta: 'Ask Life Optimizer',
    to: '/business-offers',
    tone: 'optimizer',
  },
];

export const SAVVY_SHOP_FUTURE_PARTNERS = [
  { emoji: '🏪', label: 'Local Shops' },
  { emoji: '🎮', label: 'Gaming Stores' },
  { emoji: '👟', label: 'Sneaker Stores' },
  { emoji: '💻', label: 'Electronics' },
  { emoji: '🧰', label: 'Tool Stores' },
  { emoji: '💎', label: 'Luxury' },
  { emoji: '📷', label: 'Camera Stores' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🏦', label: 'Pawn Shops' },
];

export const SAVVY_SHOP_CLOSING_LINES = [
  'Want the best used deal?',
  'Go to Final10.',
  'Want to buy brand new?',
  'Go to My Savvy Shop.',
  'Not sure which is the better value?',
  'Let Life Optimizer decide.',
];

export const SAVVY_SHOP_SCOUT_LINES = [
  'Operator — tell us which stores should join the Savvy Universe first.',
  'Your votes shape which retailers we onboard before public launch.',
  'Founding Testers are designing the merchant platform with us.',
];
