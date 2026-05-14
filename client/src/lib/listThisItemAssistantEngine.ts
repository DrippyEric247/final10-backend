/**
 * Deterministic listing draft helpers for Seller Trends / Flip context.
 * No external AI — copy and numbers derive from real trend payloads.
 */

import type { CategoryTrend } from "./sellerTrendEngine";

/** Mirrors `AutoFlipSuggestion` — defined here so `lib` does not import `components`. */
export type FlipForAssistant = {
  itemId: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  buyPrice: number;
  estimatedResellPrice: number;
  profitPct: number;
  bidCount: number;
  competitionLevel: string;
  competitionCopy: string;
  currency: string;
  flipScore?: number;
  flipScoreTier?: "elite" | "strong" | "risky" | "avoid";
  flipScoreLabel?: string;
  flipScoreWhy?: string;
};

export type EbayTrendForAssistant = {
  id: string;
  label: string;
  trendScore: number;
  listingCount: number;
  competitionLevel: string;
  buyerActivityCopy: string;
  priceRange: {
    min: number;
    max: number;
    median: number | null;
    currency: string;
  } | null;
  hotInCategoryKeywords: string[];
  postNow: boolean;
};

export type ListAssistantSeed =
  | { kind: "flip"; flip: FlipForAssistant }
  | { kind: "ebay"; row: EbayTrendForAssistant }
  | { kind: "local"; trend: CategoryTrend };

const EBAY_SEED_TO_PROMOTE: Record<string, string> = {
  electronics: "electronics",
  furniture: "home",
  vehicles: "auto",
  fashion: "fashion",
  tools: "home",
  toys: "collectibles",
  books: "collectibles",
  collectibles: "collectibles",
  home: "home",
  sports: "home",
};

const PROMOTE_CATEGORIES = new Set([
  "all",
  "electronics",
  "gaming",
  "tech",
  "sneakers",
  "fashion",
  "collectibles",
  "home",
  "auto",
]);

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function mapLocalCategory(cat: string): string {
  const c = cat.toLowerCase();
  return PROMOTE_CATEGORIES.has(c) ? c : "all";
}

function mapEbaySeed(id: string): string {
  return EBAY_SEED_TO_PROMOTE[id] ?? "all";
}

function estimateDemandDays(opts: {
  trendScore: number;
  trending?: boolean;
  competitionLevel: string;
  listingCount?: number;
  bidLean?: boolean;
}): number {
  let d = 16 - Math.round((clamp(opts.trendScore, 0, 100) - 45) / 12);
  if (opts.trending) d -= 4;
  if (opts.competitionLevel === "low") d -= 3;
  if (opts.competitionLevel === "high") d += 7;
  if (opts.competitionLevel === "unknown") d += 2;
  if (opts.listingCount != null) d += Math.floor(opts.listingCount / 100);
  if (opts.bidLean) d -= 2;
  return clamp(d, 3, 42);
}

function uniqueTags(parts: (string | undefined | null)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    const t = p.trim();
    if (t.length < 2) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t.length > 24 ? `${t.slice(0, 21)}…` : t);
    if (out.length >= 8) break;
  }
  return out;
}

function titleCaseWords(s: string) {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

export type ListingAssistantDraft = {
  sourceLabel: string;
  titleOptimized: string;
  categoryLabel: string;
  targetCategory: string;
  tags: string[];
  priceFast: number;
  priceMax: number;
  currency: string;
  description: string;
  demandDaysEstimate: number;
  heatHint: string;
};

export function buildListingDraft(seed: ListAssistantSeed): ListingAssistantDraft {
  if (seed.kind === "flip") {
    const f = seed.flip;
    const kws = uniqueTags([
      f.categoryLabel,
      ...f.title.split(/\s+/).slice(0, 4),
      f.competitionLevel === "low" ? "rare ask" : null,
      f.bidCount > 0 ? "bid heat" : null,
    ]);
    const baseTitle = titleCaseWords(f.title.replace(/\s+/g, " ").slice(0, 72));
    const titleOptimized = `${baseTitle} · ${f.categoryLabel} · ${kws.slice(0, 2).join(" · ")}`;
    const target = mapEbaySeed(f.categoryId);
    const mid = (f.estimatedResellPrice + f.buyPrice) / 2;
    const priceFast = Math.round(Math.min(f.estimatedResellPrice * 0.94, mid) * 100) / 100;
    const priceMax = Math.round(f.estimatedResellPrice * 1.05 * 100) / 100;
    const days = estimateDemandDays({
      trendScore: clamp(40 + f.profitPct * 1.2 + f.bidCount * 3, 0, 100),
      competitionLevel: f.competitionLevel,
      bidLean: f.bidCount > 0,
    });
    const description = [
      `Strong ${f.categoryLabel} angle — asks in this lane cluster where you're aiming to exit.`,
      f.competitionCopy ? `Edge read: ${f.competitionCopy}.` : "",
      "Ship fast, shoot honest photos, reply quick — that trio closes deals.",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      sourceLabel: "Flip lane",
      titleOptimized: titleOptimized.slice(0, 130),
      categoryLabel: f.categoryLabel,
      targetCategory: target,
      tags: kws,
      priceFast,
      priceMax,
      currency: f.currency || "USD",
      description,
      demandDaysEstimate: days,
      heatHint: f.bidCount > 0 ? "Bidders are already circling similar asks" : "Spread says there's oxygen on the ask side",
    };
  }

  if (seed.kind === "ebay") {
    const r = seed.row;
    const pr = r.priceRange;
    const mid =
      pr != null
        ? pr.median ?? (pr.min + pr.max) / 2
        : Math.max(29, 40 + r.trendScore / 3);
    const priceFast =
      pr != null ? Math.round((pr.min * 0.92 + mid * 0.08) * 100) / 100 : Math.round(mid * 0.9 * 100) / 100;
    const priceMax =
      pr != null ? Math.round((pr.max * 0.97 + mid * 0.03) * 100) / 100 : Math.round(mid * 1.08 * 100) / 100;
    const kws = uniqueTags([r.label, ...r.hotInCategoryKeywords, r.buyerActivityCopy.split(/\s+/).slice(0, 2).join(" ")]);
    const titleOptimized = `${r.label} — ${kws.slice(0, 3).join(" · ")} · ships quick`.slice(0, 130);
    const target = mapEbaySeed(r.id);
    const days = estimateDemandDays({
      trendScore: r.trendScore,
      competitionLevel: r.competitionLevel,
      listingCount: r.listingCount,
      trending: r.postNow,
    });
    const description = [
      `You're stepping into a live ${r.label} window — asks are moving in this scan.`,
      r.buyerActivityCopy ? `Crowd read: ${r.buyerActivityCopy}.` : "",
      r.postNow
        ? "Clock's on your side — get the hero shot live while eyeballs are here."
        : "Anchor price near what buyers already pay so you earn the click.",
    ].join("\n\n");

    return {
      sourceLabel: "Market pulse",
      titleOptimized,
      categoryLabel: r.label,
      targetCategory: target,
      tags: kws,
      priceFast,
      priceMax,
      currency: pr?.currency ?? "USD",
      description,
      demandDaysEstimate: days,
      heatHint: r.postNow ? "Strike-now energy in this lane" : "Demand hums — price for the win",
    };
  }

  const t = seed.trend;
  const human = t.category.charAt(0).toUpperCase() + t.category.slice(1);
  const anchor = t.recommendedItems[0] ?? `${human} trending picks`;
  const kws = uniqueTags([human, ...t.recommendedItems.slice(0, 3), "trending", "final10"]);
  const titleOptimized = titleCaseWords(`${anchor} · ${human} · in-demand now`).slice(0, 130);
  const mid = 48 + t.trendScore * 1.4;
  const priceFast = Math.round(mid * 0.92 * 100) / 100;
  const priceMax = Math.round(mid * 1.1 * 100) / 100;
  const days = estimateDemandDays({
    trendScore: clamp(t.trendScore * 8, 0, 100),
    trending: t.isTrending,
    competitionLevel: t.competitionLevel,
    listingCount: t.viewCount + t.saveCount * 3,
  });
  const description = [
    `Forged from your ${human} moves on Final10 — saves and hunts are leaning your way.`,
    t.callToAction ? `Timing cue: ${t.callToAction}` : "",
    "Lead with a killer photo and first line — scrollers pay you seconds, not minutes.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    sourceLabel: "Your hustle",
    titleOptimized,
    categoryLabel: human,
    targetCategory: mapLocalCategory(t.category),
    tags: kws,
    priceFast,
    priceMax,
    currency: "USD",
    description,
    demandDaysEstimate: days,
    heatHint: t.isTrending ? "This lane is loud on Final10 right now" : "Momentum is stacking — stay ready",
  };
}

/** Carried to Promote / flip-rewards register when the user lists from Seller Trends. */
export type FlipRewardHandoffContext = {
  dealItemId?: string;
  buyPrice: number;
  suggestedSellMin: number;
  suggestedSellMax: number;
  predictedDaysToSell: number;
  flipScore?: number;
  /** True when the handoff came from an Auto Flip suggestion row. */
  fromAiSuggestion: boolean;
};

export type AssistantHandoff = {
  title: string;
  description: string;
  targetCategory: string;
  targetKeywords: string[];
  suggestedPriceFast: number;
  suggestedPriceMax: number;
  currency: string;
  demandDaysEstimate: number;
  fastSale: boolean;
  flipRewardContext?: FlipRewardHandoffContext;
};

export function buildAssistantHandoff(fields: {
  title: string;
  description: string;
  targetCategory: string;
  tags: string[];
  priceFast: number;
  priceMax: number;
  currency: string;
  demandDaysEstimate: number;
  fastSale: boolean;
  flipRewardContext?: FlipRewardHandoffContext;
}): AssistantHandoff {
  return {
    title: fields.title,
    description: fields.description,
    targetCategory: fields.targetCategory,
    targetKeywords: fields.tags,
    suggestedPriceFast: fields.priceFast,
    suggestedPriceMax: fields.priceMax,
    currency: fields.currency,
    demandDaysEstimate: fields.demandDaysEstimate,
    fastSale: fields.fastSale,
    flipRewardContext: fields.flipRewardContext,
  };
}

export const LISTING_ASSISTANT_STORAGE_KEY = "f10_listing_assistant_handoff_v1";
