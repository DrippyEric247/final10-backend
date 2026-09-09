/**
 * Client mirror of server category interest profiles for Best Move popularity scoring.
 * Keep in sync with server/lib/listingRanking/categoryInterestProfiles.js
 */

export type CategoryInterestProfile = {
  label: string;
  brands: readonly string[];
  productFamilies: readonly string[];
  keywords: readonly string[];
};

export const LOW_INTEREST_PATTERNS: readonly RegExp[] = [
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
];

export const CATEGORY_INTEREST_PROFILES: Readonly<
  Record<string, CategoryInterestProfile>
> = {
  gaming: {
    label: "Gaming",
    brands: [
      "playstation", "ps5", "ps4", "xbox", "nintendo", "switch", "steam deck",
      "nvidia", "geforce", "rtx", "amd", "radeon", "logitech", "razer", "steelseries",
    ],
    productFamilies: [
      "console", "gaming pc", "gpu", "graphics card", "gaming monitor", "controller",
      "headset", "gaming keyboard", "gaming mouse", "vr headset",
    ],
    keywords: [
      "playstation 5", "xbox series", "nintendo switch", "gaming monitor", "wireless headset",
    ],
  },
  electronics: {
    label: "Electronics",
    brands: [
      "apple", "iphone", "ipad", "macbook", "airpods", "samsung", "galaxy", "google pixel",
      "sony", "lg", "dell", "hp", "lenovo", "bose", "beats", "canon", "nikon",
    ],
    productFamilies: [
      "smartphone", "laptop", "tablet", "earbuds", "headphones", "smartwatch", "monitor",
      "tv", "television", "camera", "drone", "speaker", "pc", "desktop",
    ],
    keywords: [
      "airpods pro", "iphone", "macbook", "samsung galaxy", "4k monitor", "apple watch",
    ],
  },
  tech: {
    label: "Tech",
    brands: [
      "apple", "iphone", "ipad", "macbook", "airpods", "samsung", "galaxy", "google pixel",
      "sony", "lg", "dell", "hp", "lenovo", "bose", "beats", "canon", "nikon",
    ],
    productFamilies: [
      "smartphone", "laptop", "tablet", "earbuds", "headphones", "smartwatch", "monitor",
      "tv", "television", "camera", "drone", "speaker", "pc", "desktop",
    ],
    keywords: [
      "airpods pro", "iphone", "macbook", "samsung galaxy", "4k monitor", "apple watch",
    ],
  },
  sneakers: {
    label: "Sneakers",
    brands: [
      "nike", "jordan", "air jordan", "adidas", "yeezy", "new balance", "asics", "puma",
      "converse", "vans", "reebok", "salomon", "hoka",
    ],
    productFamilies: [
      "sneakers", "running shoes", "basketball shoes", "retro", "dunk", "air max",
    ],
    keywords: [
      "air jordan", "nike dunk", "new balance 550", "yeezy", "running sneakers",
    ],
  },
  fashion: {
    label: "Fashion",
    brands: [
      "nike", "adidas", "north face", "patagonia", "carhartt", "levis", "gucci", "prada",
      "lululemon", "supreme", "off-white", "coach", "michael kors", "tommy hilfiger",
    ],
    productFamilies: [
      "hoodie", "jacket", "coat", "jeans", "sneakers", "boots", "handbag", "backpack",
      "sunglasses", "watch", "streetwear", "designer",
    ],
    keywords: [
      "designer hoodie", "north face jacket", "levis jeans", "luxury bag", "streetwear",
    ],
  },
  collectibles: {
    label: "Collectibles",
    brands: [
      "pokemon", "magic the gathering", "mtg", "yugioh", "topps", "panini", "funko",
      "lego", "hasbro", "bandai", "marvel", "star wars", "disney", "nintendo",
    ],
    productFamilies: [
      "booster box", "trading card", "graded card", "sports card", "funko pop",
      "action figure", "memorabilia", "comic book", "elite trainer box", "sealed product",
    ],
    keywords: [
      "pokemon booster", "graded psa", "sports card", "funko pop chase", "comic key issue",
    ],
  },
  home: {
    label: "Home",
    brands: [
      "dyson", "roomba", "irobot", "nest", "ecobee", "kitchenaid", "instant pot",
      "samsung", "lg", "shark", "bissell", "herman miller", "secretlab",
    ],
    productFamilies: [
      "robot vacuum", "air purifier", "desk chair", "office chair", "smart thermostat",
      "coffee maker", "mattress", "sofa", "dining set", "power tool", "smart home",
    ],
    keywords: [
      "ergonomic chair", "robot vacuum", "air purifier hepa", "smart thermostat", "standing desk",
    ],
  },
  auto: {
    label: "Automotive",
    brands: [
      "bmw", "mercedes", "mercedes-benz", "audi", "porsche", "chevrolet", "ford", "dodge",
      "toyota", "honda", "snap-on", "milwaukee", "dewalt", "makita", "obdlink",
    ],
    productFamilies: [
      "obd2 scanner", "diagnostic scanner", "floor jack", "impact wrench", "socket set",
      "brake pads", "exhaust", "turbo", "wheel", "tire", "car audio", "dash cam",
    ],
    keywords: [
      "obd2 scanner", "impact wrench", "floor jack", "bmw parts", "performance exhaust",
    ],
  },
  luxury: {
    label: "Luxury",
    brands: [
      "rolex", "omega", "tag heuer", "cartier", "louis vuitton", "gucci", "prada",
      "chanel", "hermes", "tiffany", "burberry", "dior",
    ],
    productFamilies: [
      "luxury watch", "designer bag", "designer handbag", "luxury sunglasses", "gold jewelry",
      "diamond", "luxury wallet",
    ],
    keywords: [
      "rolex", "omega seamaster", "designer bag authentic", "luxury watch", "gold bracelet",
    ],
  },
};

const CATEGORY_ALIASES: Record<string, string> = {
  tech: "electronics",
  pc: "gaming",
  "pc-builds": "gaming",
  "bmw-parts": "auto",
  "home-tech": "home",
  audio: "electronics",
  cameras: "electronics",
  watches: "luxury",
  automotive: "auto",
  vehicles: "auto",
};

export function normalizeInterestCategory(raw: string): string {
  const key = String(raw || "").trim().toLowerCase();
  if (!key || key === "all") return "";
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  if (CATEGORY_INTEREST_PROFILES[key]) return key;
  return key;
}

export function getCategoryInterestProfile(
  category: string
): CategoryInterestProfile | null {
  const normalized = normalizeInterestCategory(category);
  return CATEGORY_INTEREST_PROFILES[normalized] || null;
}

export function listBestMoveInterestCategories(): string[] {
  return Object.keys(CATEGORY_INTEREST_PROFILES).filter((k) => k !== "tech");
}
