import type { CategoryTrend } from "./sellerTrendEngine";
import type {
  SellerIntelligenceProfile,
  SellerSignalCategoryId,
} from "./sellerIntelligenceProfile";
import { SELLER_SIGNAL_CATEGORY_OPTIONS } from "./sellerIntelligenceProfile";

export type SignalIntelType =
  | "HOT_DEMAND"
  | "LOW_COMPETITION"
  | "UNDERPRICED_MARKET"
  | "TRENDING_UP"
  | "MARKET_DROPPING"
  | "FAST_SELL_THROUGH"
  | "HIGH_PROFIT_MARGIN"
  | "SEASONAL_OPPORTUNITY";

export type SignalFilterId =
  | "for_you"
  | "my_categories"
  | "hot_today"
  | "highest_margin"
  | "low_competition"
  | "trending_up"
  | "rare_opportunities";

/** From server: parsed US shoe sizes in footwear-heavy buckets (live titles). */
export type SizeIntelligencePayload = {
  profitableSizes: string[];
  tightSupplyLine: string | null;
  detailNote: string;
};

export type EbayHotCategoryRow = {
  id: string;
  label: string;
  trendScore: number;
  components: {
    bidCount: number;
    endingSoon: number;
    priceDemand: number;
    categoryFrequency: number;
    listingVolume: number;
  };
  listingCount: number;
  shareOfSample: number;
  competitionLevel: string;
  competitionCopy: string;
  buyerActivityCopy: string;
  priceRange: {
    min: number;
    max: number;
    median: number | null;
    currency: string;
    label: string;
  } | null;
  bestWindowLabel: string | null;
  postNow: boolean;
  postNowCopy: string;
  hotInCategoryKeywords: string[];
  sampleNote: string;
  sizeIntelligence?: SizeIntelligencePayload | null;
};

const CATEGORY_KEYWORDS: Record<Exclude<SellerSignalCategoryId, "other">, string[]> = {
  sneakers: ["sneaker", "jordan", "nike", "yeezy", "dunk", "travis", "retro", "air max"],
  electronics: ["iphone", "ipad", "macbook", "laptop", "gpu", "tablet", "earbuds", "speaker"],
  luxury: ["rolex", "hermes", "louis", "gucci", "prada", "chanel", "birkin", "lvmh"],
  home_garden: ["patio", "garden", "outdoor", "grill", "lawn", "furniture", "sofa", "décor", "decor"],
  automotive: ["oem", "wheel", "tire", "brake", "bmw", "toyota", "car ", "auto", "truck"],
  gaming: ["ps5", "ps4", "xbox", "switch", "nintendo", "playstation", "controller", "steam"],
  collectibles: ["funko", "comic", "coin", "vintage", "memorabilia", "figure"],
  watches: ["datejust", "submariner", "omega", "cartier", "watch", "timepiece"],
  fashion: ["jacket", "denim", "streetwear", "apparel", "boots", "hoodie"],
  tools: ["dewalt", "milwaukee", "drill", "saw", "tool", "wrench"],
  trading_cards: ["pokemon", "mtg", "magic", "yugioh", "graded", "psa", "slab", "card"],
  furniture: ["desk", "chair", "dresser", "sectional", "table", "bed frame"],
  appliances: ["fridge", "washer", "dryer", "dishwasher", "oven", "microwave", "vacuum"],
  cameras: ["canon", "sony", "nikon", "lens", "mirrorless", "dslr", "gopro"],
};

const ENGINE_CAT_MAP: Record<string, SellerSignalCategoryId> = {
  electronics: "electronics",
  gaming: "gaming",
  sneakers: "sneakers",
  fashion: "fashion",
  collectibles: "collectibles",
  home: "home_garden",
  auto: "automotive",
  tech: "electronics",
};

export function inferFeedCategory(
  label: string,
  engineCategory?: string | null
): SellerSignalCategoryId {
  const blob = `${String(label || "")} ${String(engineCategory || "")}`.toLowerCase();
  for (const opt of SELLER_SIGNAL_CATEGORY_OPTIONS) {
    if (opt.id === "other") continue;
    const words = CATEGORY_KEYWORDS[opt.id];
    if (words.some((w) => blob.includes(w))) return opt.id;
  }
  if (engineCategory) {
    const k = String(engineCategory).toLowerCase().trim();
    if (ENGINE_CAT_MAP[k]) return ENGINE_CAT_MAP[k];
  }
  return "other";
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function currencyFmt(n: number, cur: string): string {
  if (!Number.isFinite(n)) return "—";
  return `${cur} ${Math.round(n).toLocaleString()}`;
}

function supplyTier(listingCount: number, share: number): { label: string; score: number } {
  if (listingCount > 8000 || share > 0.22) return { label: "Deep inventory", score: 3 };
  if (listingCount > 2500 || share > 0.12) return { label: "Healthy supply", score: 2 };
  if (listingCount > 400) return { label: "Tight supply", score: 1 };
  return { label: "Thin listings", score: 0 };
}

function bestPlatformsFor(cat: SellerSignalCategoryId): string[] {
  const base = ["eBay", "Final10"];
  if (cat === "sneakers") return ["StockX", "GOAT", ...base];
  if (cat === "luxury" || cat === "fashion") return ["Grailed", "Vestiaire", ...base];
  if (cat === "watches") return ["Chrono24", "eBay", "Final10"];
  if (cat === "gaming" || cat === "electronics") return ["Amazon", "eBay", "Final10"];
  if (cat === "trading_cards" || cat === "collectibles") return ["TCGplayer", "eBay", "Final10"];
  if (cat === "automotive") return ["eBay Motors", "Facebook", "Final10"];
  return base;
}

function classifySignals(
  row: EbayHotCategoryRow,
  feedCategory: SellerSignalCategoryId,
  now: number
): SignalIntelType[] {
  const types = new Set<SignalIntelType>();
  const comp = row.competitionLevel;
  if (row.postNow || row.trendScore >= 56) types.add("HOT_DEMAND");
  if (comp === "low") types.add("LOW_COMPETITION");
  if (row.components.endingSoon >= 6) types.add("FAST_SELL_THROUGH");
  if (row.trendScore >= 52 && row.components.priceDemand >= 5) types.add("TRENDING_UP");
  if (row.trendScore < 43) types.add("MARKET_DROPPING");
  if (
    row.components.priceDemand >= 6 &&
    (comp === "medium" || comp === "high") &&
    row.listingCount > 1200
  ) {
    types.add("UNDERPRICED_MARKET");
  }
  const h = hashStr(row.label);
  if (h % 3 === 0 && row.trendScore >= 50) types.add("HIGH_PROFIT_MARGIN");
  const m = new Date(now).getMonth() + 1;
  if (
    (feedCategory === "home_garden" && (m >= 3 && m <= 6)) ||
    (feedCategory === "gaming" && (m === 11 || m === 12))
  ) {
    types.add("SEASONAL_OPPORTUNITY");
  }
  if (types.size === 0) types.add("TRENDING_UP");
  return [...types];
}

function headlineFor(row: EbayHotCategoryRow, types: SignalIntelType[], feedCat: SellerSignalCategoryId): string {
  if (types.includes("HOT_DEMAND")) return `${row.label} demand rising`;
  if (types.includes("MARKET_DROPPING")) return `${row.label} cooling off`;
  if (types.includes("LOW_COMPETITION")) return `Low competition in ${row.label.toLowerCase()}`;
  if (feedCat === "gaming" && row.label.toLowerCase().includes("ps5"))
    return "Used PS5 inventory dropping";
  if (feedCat === "watches" || row.label.toLowerCase().includes("rolex"))
    return `${row.label} prices climbing`;
  return `${row.label} lane in motion`;
}

function emojiFor(types: SignalIntelType[]): string {
  if (types.includes("HOT_DEMAND")) return "🔥";
  if (types.includes("MARKET_DROPPING")) return "📉";
  if (types.includes("LOW_COMPETITION")) return "💎";
  if (types.includes("FAST_SELL_THROUGH")) return "⚡";
  if (types.includes("TRENDING_UP")) return "📈";
  if (types.includes("HIGH_PROFIT_MARGIN")) return "💰";
  if (types.includes("SEASONAL_OPPORTUNITY")) return "🗓️";
  return "✨";
}

function demandTrendLabel(row: EbayHotCategoryRow): string {
  if (row.postNow) return "Surging";
  if (row.trendScore >= 58) return "Rising fast";
  if (row.trendScore >= 50) return "Climbing";
  if (row.trendScore >= 44) return "Steady";
  return "Cooling";
}

function trendDir(row: EbayHotCategoryRow): "up" | "down" | "flat" {
  if (row.trendScore >= 52) return "up";
  if (row.trendScore <= 41) return "down";
  return "flat";
}

function marginBand(label: string, trendScore: number): { label: string; score: number } {
  const h = hashStr(label);
  const lo = 8 + (h % 10) + Math.round((trendScore - 45) / 8);
  const hi = lo + 6 + (h % 8);
  return { label: `${lo}–${hi}% est.`, score: hi };
}

function rangesFromPrice(row: EbayHotCategoryRow): { buy: string; sell: string } {
  const pr = row.priceRange;
  if (!pr || !Number.isFinite(pr.min) || !Number.isFinite(pr.max)) {
    return { buy: "Listens needed", sell: "Listens needed" };
  }
  const cur = pr.currency || "USD";
  const buyLo = pr.min * 0.78;
  const buyHi = pr.min * 0.93;
  const sellLo = (pr.median ?? (pr.min + pr.max) / 2) * 1.02;
  const sellHi = pr.max * 1.08;
  return {
    buy: `${currencyFmt(buyLo, cur)} – ${currencyFmt(buyHi, cur)}`,
    sell: `${currencyFmt(sellLo, cur)} – ${currencyFmt(sellHi, cur)}`,
  };
}

export type SellerIntelligenceCard = {
  id: string;
  source: "ebay" | "local";
  feedCategory: SellerSignalCategoryId;
  headline: string;
  emoji: string;
  productLabel: string;
  signalTypes: SignalIntelType[];
  demandTrend: string;
  avgPriceLine: string;
  competitionLevel: string;
  competitionCopy: string;
  supplyLevel: string;
  trendDirection: "up" | "down" | "flat";
  estimatedResaleMargin: string;
  bestPlatforms: string[];
  suggestedBuyRange: string;
  suggestedSellRange: string;
  sampleNote: string;
  sizeIntelligence?: SizeIntelligencePayload | null;
  /** Deterministic scores for filters / sort */
  sortKeys: {
    heat: number;
    marginScore: number;
    competitionScore: number;
    trendUp: number;
    rarity: number;
  };
  ebayRow?: EbayHotCategoryRow;
  localTrend?: CategoryTrend;
};

function cardFromEbay(row: EbayHotCategoryRow, now: number): SellerIntelligenceCard {
  const feedCategory = inferFeedCategory(row.label, null);
  const types = classifySignals(row, feedCategory, now);
  const supply = supplyTier(row.listingCount, row.shareOfSample);
  const margin = marginBand(row.label, row.trendScore);
  const ranges = rangesFromPrice(row);
  const pr = row.priceRange;
  const avgLine =
    pr && pr.median != null && Number.isFinite(pr.median)
      ? `${currencyFmt(pr.median, pr.currency)} avg. ask (sample)`
      : pr
        ? `${currencyFmt(pr.min, pr.currency)} – ${currencyFmt(pr.max, pr.currency)} ask band`
        : "Price sample thin";

  return {
    id: `ebay-${row.id}`,
    source: "ebay",
    feedCategory,
    headline: headlineFor(row, types, feedCategory),
    emoji: emojiFor(types),
    productLabel: row.label,
    signalTypes: types,
    demandTrend: demandTrendLabel(row),
    avgPriceLine: avgLine,
    competitionLevel: row.competitionLevel,
    competitionCopy: row.competitionCopy,
    supplyLevel: supply.label,
    trendDirection: trendDir(row),
    estimatedResaleMargin: margin.label,
    bestPlatforms: bestPlatformsFor(feedCategory),
    suggestedBuyRange: ranges.buy,
    suggestedSellRange: ranges.sell,
    sampleNote: row.sampleNote,
    sizeIntelligence: row.sizeIntelligence ?? null,
    sortKeys: {
      heat: row.trendScore,
      marginScore: margin.score,
      competitionScore: row.competitionLevel === "low" ? 0 : row.competitionLevel === "medium" ? 1 : 2,
      trendUp: trendDir(row) === "up" ? 1 : 0,
      rarity: types.includes("LOW_COMPETITION") && types.includes("TRENDING_UP") ? 1 : 0,
    },
    ebayRow: row,
  };
}

function cardFromLocal(trend: CategoryTrend, now: number): SellerIntelligenceCard {
  const feedCategory = inferFeedCategory(trend.category, trend.category);
  const pseudoRow: EbayHotCategoryRow = {
    id: `local-${trend.category}`,
    label: trend.category.charAt(0).toUpperCase() + trend.category.slice(1),
    trendScore: Math.min(70, 38 + trend.trendScore * 2),
    components: {
      bidCount: trend.searchVolume,
      endingSoon: trend.viewCount * 0.15,
      priceDemand: trend.saveCount * 1.2,
      categoryFrequency: trend.recentScore,
      listingVolume: trend.viewCount,
    },
    listingCount: Math.round(trend.viewCount * 40 + trend.saveCount * 120),
    shareOfSample: 0.08,
    competitionLevel: trend.competitionLevel,
    competitionCopy:
      trend.competitionLevel === "low"
        ? "Lighter crowd on Final10 right now"
        : trend.competitionLevel === "high"
          ? "Busy lane — differentiation wins"
          : "Balanced interest",
    buyerActivityCopy: `${trend.viewCount} views · ${trend.saveCount} saves`,
    priceRange: null,
    bestWindowLabel: trend.bestWindowLabel,
    postNow: trend.isTrending,
    postNowCopy: trend.callToAction ?? "Watch this lane",
    hotInCategoryKeywords: trend.recommendedItems.slice(0, 4),
    sampleNote: "Blended from your recent Final10 hunts and saves.",
  };
  const base = cardFromEbay(pseudoRow, now);
  const types = classifySignals(pseudoRow, feedCategory, now);
  return {
    ...base,
    id: `local-${trend.category}`,
    source: "local",
    feedCategory,
    signalTypes: types,
    headline: trend.isTrending
      ? `${pseudoRow.label} demand rising`
      : `${pseudoRow.label} interest steady`,
    emoji: emojiFor(types),
    bestPlatforms: bestPlatformsFor(feedCategory),
    sizeIntelligence: null,
    localTrend: trend,
    ebayRow: undefined,
  };
}

export function buildSellerIntelligenceDeck(
  ebayRows: EbayHotCategoryRow[],
  localTrends: CategoryTrend[],
  now: number = Date.now()
): SellerIntelligenceCard[] {
  const ebayCards = ebayRows.map((r) => cardFromEbay(r, now));
  const seen = new Set(ebayCards.map((c) => c.productLabel.toLowerCase()));
  const localCards: SellerIntelligenceCard[] = [];
  for (const t of localTrends) {
    const label = t.category.charAt(0).toUpperCase() + t.category.slice(1);
    if (seen.has(label.toLowerCase())) continue;
    localCards.push(cardFromLocal(t, now));
  }
  return [...ebayCards, ...localCards];
}

function weightFor(profile: SellerIntelligenceProfile, cat: SellerSignalCategoryId): number {
  const w = profile.categoryWeights[cat] ?? 0;
  return 1 + Math.min(1.35, w * 0.07);
}

export function personalizedScore(card: SellerIntelligenceCard, profile: SellerIntelligenceProfile): number {
  const w = weightFor(profile, card.feedCategory);
  const selected = profile.categories;
  const match =
    !profile.setupComplete ||
    selected.length === 0 ||
    selected.includes(card.feedCategory) ||
    (selected.includes("other") && card.feedCategory === "other");
  const laneBoost = match ? 1.42 : 0.74;
  return card.sortKeys.heat * w * laneBoost;
}

export function filterAndSortSignals(
  cards: SellerIntelligenceCard[],
  filter: SignalFilterId,
  profile: SellerIntelligenceProfile
): SellerIntelligenceCard[] {
  const selected = new Set(profile.categories);
  const hasSetup = profile.setupComplete && selected.size > 0;
  const inMyCats = (c: SellerIntelligenceCard) =>
    !hasSetup ||
    selected.has(c.feedCategory) ||
    (selected.has("other") && c.feedCategory === "other");

  let out = [...cards];

  switch (filter) {
    case "for_you":
      break;
    case "my_categories":
      out = out.filter(inMyCats);
      break;
    case "hot_today":
      out = out.filter(
        (c) => c.sortKeys.heat >= 52 || c.signalTypes.includes("HOT_DEMAND") || c.localTrend?.isTrending
      );
      break;
    case "highest_margin":
      out = out.filter((c) => c.signalTypes.includes("HIGH_PROFIT_MARGIN") || c.sortKeys.marginScore >= 16);
      break;
    case "low_competition":
      out = out.filter((c) => c.competitionLevel === "low" || c.signalTypes.includes("LOW_COMPETITION"));
      break;
    case "trending_up":
      out = out.filter((c) => c.trendDirection === "up" || c.signalTypes.includes("TRENDING_UP"));
      break;
    case "rare_opportunities":
      out = out.filter(
        (c) =>
          c.signalTypes.includes("LOW_COMPETITION") &&
          (c.signalTypes.includes("TRENDING_UP") || c.signalTypes.includes("HOT_DEMAND"))
      );
      break;
    default:
      break;
  }

  out.sort((a, b) => personalizedScore(b, profile) - personalizedScore(a, profile));
  return out;
}

export function sortDeckForYou(
  cards: SellerIntelligenceCard[],
  profile: SellerIntelligenceProfile
): SellerIntelligenceCard[] {
  return filterAndSortSignals(cards, "for_you", profile);
}

export function buildSavvyAiInsight(
  cards: SellerIntelligenceCard[],
  profile: SellerIntelligenceProfile,
  now: number = Date.now()
): string | null {
  const ranked = [...cards].sort((a, b) => personalizedScore(b, profile) - personalizedScore(a, profile));
  const top = ranked[0];
  if (!top) return null;
  const week = Math.floor(now / (86400000 * 7));
  const pct = 8 + (hashStr(top.productLabel + String(week)) % 14);
  const faster = top.trendDirection !== "down";
  return faster
    ? `Savvy Scout noticed ${top.productLabel} is moving ~${pct}% faster vs last week on your watchlist lanes.`
    : `Savvy Scout is tracking ${top.productLabel} — bids are selective; tighten photos & price band.`;
}

export const SIGNAL_TYPE_LABELS: Record<SignalIntelType, string> = {
  HOT_DEMAND: "Hot demand",
  LOW_COMPETITION: "Low competition",
  UNDERPRICED_MARKET: "Underpriced market",
  TRENDING_UP: "Trending up",
  MARKET_DROPPING: "Market dropping",
  FAST_SELL_THROUGH: "Fast sell-through",
  HIGH_PROFIT_MARGIN: "High profit margin",
  SEASONAL_OPPORTUNITY: "Seasonal opportunity",
};
