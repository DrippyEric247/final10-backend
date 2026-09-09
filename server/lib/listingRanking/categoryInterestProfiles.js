/**
 * Configurable Best Move category interest profiles.
 * Guides popularity/relevance scoring — not a static product allowlist.
 *
 * Signals derived from these profiles are INFERRED from title/query match.
 * Marketplace activity (bidCount) is OBSERVED separately in popularityScoreEngine.
 */

const LOW_INTEREST_PATTERNS = Object.freeze([
  /\b(cable|adapter|charger)\s+only\b/i,
  /\b(manual|box|case)\s+only\b/i,
  /\b(replacement|part|parts)\s+only\b/i,
  /\b(controller|skin|decal|sticker)\s+only\b/i,
  /\b(cable|adapter|charger|skin|decal|sticker|case|manual)\b.*\bonly\b/i,
  /\bfor\s+parts\b/i,
  /\bbroken\b/i,
  /\bempty\s+box\b/i,
  /\b(sticker|decal|skin)\s+only\b/i,
  /\busb[\s-]?c?\s+cable\b/i,
  /\bjoystick\s+module\b/i,
  /\bfight\s+stick\b/i,
  /\bmouse\s+pad\b/i,
  /\blaces?\s+replacement\b/i,
]);

const PROFILES = Object.freeze({
  gaming: Object.freeze({
    label: 'Gaming',
    brands: Object.freeze([
      'playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch', 'steam deck',
      'nvidia', 'geforce', 'rtx', 'amd', 'radeon', 'logitech', 'razer', 'steelseries',
    ]),
    productFamilies: Object.freeze([
      'console', 'gaming pc', 'gpu', 'graphics card', 'gaming monitor', 'controller',
      'headset', 'gaming keyboard', 'gaming mouse', 'vr headset',
    ]),
    keywords: Object.freeze([
      'playstation 5', 'xbox series', 'nintendo switch', 'gaming monitor', 'wireless headset',
    ]),
  }),
  electronics: Object.freeze({
    label: 'Electronics',
    brands: Object.freeze([
      'apple', 'iphone', 'ipad', 'macbook', 'airpods', 'samsung', 'galaxy', 'google pixel',
      'sony', 'lg', 'dell', 'hp', 'lenovo', 'bose', 'beats', 'canon', 'nikon',
    ]),
    productFamilies: Object.freeze([
      'smartphone', 'laptop', 'tablet', 'earbuds', 'headphones', 'smartwatch', 'monitor',
      'tv', 'television', 'camera', 'drone', 'speaker', 'pc', 'desktop',
    ]),
    keywords: Object.freeze([
      'airpods pro', 'iphone', 'macbook', 'samsung galaxy', '4k monitor', 'apple watch',
    ]),
  }),
  tech: Object.freeze({
    label: 'Tech',
    brands: Object.freeze([
      'apple', 'iphone', 'ipad', 'macbook', 'airpods', 'samsung', 'galaxy', 'google pixel',
      'sony', 'lg', 'dell', 'hp', 'lenovo', 'bose', 'beats', 'canon', 'nikon',
    ]),
    productFamilies: Object.freeze([
      'smartphone', 'laptop', 'tablet', 'earbuds', 'headphones', 'smartwatch', 'monitor',
      'tv', 'television', 'camera', 'drone', 'speaker', 'pc', 'desktop',
    ]),
    keywords: Object.freeze([
      'airpods pro', 'iphone', 'macbook', 'samsung galaxy', '4k monitor', 'apple watch',
    ]),
  }),
  sneakers: Object.freeze({
    label: 'Sneakers',
    brands: Object.freeze([
      'nike', 'jordan', 'air jordan', 'adidas', 'yeezy', 'new balance', 'asics', 'puma',
      'converse', 'vans', 'reebok', 'salomon', 'hoka',
    ]),
    productFamilies: Object.freeze([
      'sneakers', 'running shoes', 'basketball shoes', 'retro', 'dunk', 'air max',
    ]),
    keywords: Object.freeze([
      'air jordan', 'nike dunk', 'new balance 550', 'yeezy', 'running sneakers',
    ]),
  }),
  fashion: Object.freeze({
    label: 'Fashion',
    brands: Object.freeze([
      'nike', 'adidas', 'north face', 'patagonia', 'carhartt', 'levis', 'gucci', 'prada',
      'lululemon', 'supreme', 'off-white', 'coach', 'michael kors', 'tommy hilfiger',
    ]),
    productFamilies: Object.freeze([
      'hoodie', 'jacket', 'coat', 'jeans', 'sneakers', 'boots', 'handbag', 'backpack',
      'sunglasses', 'watch', 'streetwear', 'designer',
    ]),
    keywords: Object.freeze([
      'designer hoodie', 'north face jacket', 'levis jeans', 'luxury bag', 'streetwear',
    ]),
  }),
  collectibles: Object.freeze({
    label: 'Collectibles',
    brands: Object.freeze([
      'pokemon', 'magic the gathering', 'mtg', 'yugioh', 'topps', 'panini', 'funko',
      'lego', 'hasbro', 'bandai', 'marvel', 'star wars', 'disney', 'nintendo',
    ]),
    productFamilies: Object.freeze([
      'booster box', 'trading card', 'graded card', 'sports card', 'funko pop',
      'action figure', 'memorabilia', 'comic book', 'elite trainer box', 'sealed product',
    ]),
    keywords: Object.freeze([
      'pokemon booster', 'graded psa', 'sports card', 'funko pop chase', 'comic key issue',
    ]),
  }),
  home: Object.freeze({
    label: 'Home',
    brands: Object.freeze([
      'dyson', 'roomba', 'irobot', 'nest', 'ecobee', 'kitchenaid', 'instant pot',
      'samsung', 'lg', 'shark', 'bissell', 'herman miller', 'secretlab',
    ]),
    productFamilies: Object.freeze([
      'robot vacuum', 'air purifier', 'desk chair', 'office chair', 'smart thermostat',
      'coffee maker', 'mattress', 'sofa', 'dining set', 'power tool', 'smart home',
    ]),
    keywords: Object.freeze([
      'ergonomic chair', 'robot vacuum', 'air purifier hepa', 'smart thermostat', 'standing desk',
    ]),
  }),
  auto: Object.freeze({
    label: 'Automotive',
    brands: Object.freeze([
      'bmw', 'mercedes', 'mercedes-benz', 'audi', 'porsche', 'chevrolet', 'ford', 'dodge',
      'toyota', 'honda', 'snap-on', 'milwaukee', 'dewalt', 'makita', 'obdlink',
    ]),
    productFamilies: Object.freeze([
      'obd2 scanner', 'diagnostic scanner', 'floor jack', 'impact wrench', 'socket set',
      'brake pads', 'exhaust', 'turbo', 'wheel', 'tire', 'car audio', 'dash cam',
    ]),
    keywords: Object.freeze([
      'obd2 scanner', 'impact wrench', 'floor jack', 'bmw parts', 'performance exhaust',
    ]),
  }),
  luxury: Object.freeze({
    label: 'Luxury',
    brands: Object.freeze([
      'rolex', 'omega', 'tag heuer', 'cartier', 'louis vuitton', 'gucci', 'prada',
      'chanel', 'hermes', 'tiffany', 'burberry', 'dior',
    ]),
    productFamilies: Object.freeze([
      'luxury watch', 'designer bag', 'designer handbag', 'luxury sunglasses', 'gold jewelry',
      'diamond', 'luxury wallet',
    ]),
    keywords: Object.freeze([
      'rolex', 'omega seamaster', 'designer bag authentic', 'luxury watch', 'gold bracelet',
    ]),
  }),
});

const CATEGORY_ALIASES = Object.freeze({
  tech: 'electronics',
  pc: 'gaming',
  'pc-builds': 'gaming',
  'bmw-parts': 'auto',
  'home-tech': 'home',
  audio: 'electronics',
  cameras: 'electronics',
  watches: 'luxury',
  automotive: 'auto',
  vehicles: 'auto',
});

function normalizeInterestCategory(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key || key === 'all') return '';
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  if (PROFILES[key]) return key;
  return key;
}

function getCategoryInterestProfile(category) {
  const normalized = normalizeInterestCategory(category);
  return PROFILES[normalized] || PROFILES[normalized === 'tech' ? 'electronics' : normalized] || null;
}

function listBestMoveInterestCategories() {
  return Object.keys(PROFILES).filter((k) => k !== 'tech');
}

module.exports = {
  LOW_INTEREST_PATTERNS,
  PROFILES,
  CATEGORY_ALIASES,
  normalizeInterestCategory,
  getCategoryInterestProfile,
  listBestMoveInterestCategories,
};
