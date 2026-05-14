/**
 * Dual-sided Savvy earning model.
 *
 * Final10 pays BOTH sides of a deal:
 *   - Buyers earn Savvy when they make smart purchases.
 *   - Sellers earn Savvy when their listings attract attention or sell.
 *
 * This module is the single source of truth for the dollar/trust → Savvy
 * conversions used on deal cards, toasts, and microcopy. Keeping it pure
 * lets every surface — DealCard, OnboardingBestMove, PromoteListing —
 * show identical numbers, which is critical for trust.
 *
 * Why we don't reuse SavvyRewardBadge's internals directly: that component
 * is the authoritative "what will the buyer take home?" widget. Here we
 * want a light-weight estimate that also quotes the seller's side, so
 * users at a glance understand the market is two-sided.
 */

import { emitPowerToast } from "./final10PowerFeedback";
import { applyTierMultiplier } from "./tierMultiplier";

/** The product's guiding tagline — surfaces under dual-earn chips. */
export const DUAL_EARN_TAGLINE = "Every move earns. Smart moves earn more.";

export type DualEarnInput = {
  /** Buy-now price (preferred) or spend proxy. */
  price?: number | string | null;
  /** Market/comp value — used as a seller-attention proxy. */
  marketValue?: number | string | null;
  /** Buyer savings vs market — rewards smart buys more. */
  savings?: number | string | null;
  /** 0–100. Low-trust listings drop buyer rewards to 0. */
  trustScore?: number | string | null;
  /** Optional explicit overrides (for cards that already computed a number). */
  buyerBase?: number | string | null;
  sellerBase?: number | string | null;
};

export type DualEarnEstimate = {
  /** Savvy the buyer is estimated to earn on action. */
  buyer: number;
  /** Savvy the seller is estimated to earn when the listing sells. */
  seller: number;
  /** Same tier model as SavvyRewardBadge (high/medium/low). */
  tier: "high" | "medium" | "low";
};

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify trust identically to SavvyRewardBadge so the numbers line up
 * across the UI. If `trustScore` is missing we assume medium — the same
 * safe default the badge uses.
 */
export function classifyTrust(
  trustScore?: number | string | null
): "high" | "medium" | "low" {
  const score = toFiniteNumber(trustScore);
  if (score == null) return "medium";
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

/**
 * Buyer earn — mirrors SavvyRewardBadge's base derivation
 * (80% of savings + 20% of price, with a 40 floor) and applies the same
 * trust-tier multiplier (high 1.0, medium 0.6, low 0).
 */
function estimateBuyerBase({
  price,
  savings,
  buyerBase,
}: Pick<DualEarnInput, "price" | "savings" | "buyerBase">): number {
  const override = toFiniteNumber(buyerBase);
  if (override != null && override >= 0) return Math.round(override);
  const p = toFiniteNumber(price) ?? 0;
  const s = toFiniteNumber(savings) ?? 0;
  const savingsPortion = s > 0 ? s * 0.8 : 0;
  const pricePortion = p > 0 ? p * 0.2 : 0;
  const derived = Math.round(savingsPortion + pricePortion);
  return Math.max(40, derived);
}

/**
 * Seller earn — rewards attention + successful sale. We deliberately
 * under-pay relative to the buyer to keep the marketplace economy sane:
 * sellers already monetize via the sale itself.
 *
 * Formula (transparent, so we can tune it from one place):
 *   base = max(25, round(market * 0.08 + price * 0.04))
 * Sellers aren't gated by trust tier the same way buyers are — every
 * listing earns SOME Savvy for attention — but we still reduce the
 * payout on low-trust listings to discourage spammy listings.
 */
function estimateSellerBase({
  price,
  marketValue,
  sellerBase,
}: Pick<DualEarnInput, "price" | "marketValue" | "sellerBase">): number {
  const override = toFiniteNumber(sellerBase);
  if (override != null && override >= 0) return Math.round(override);
  const p = toFiniteNumber(price) ?? 0;
  const m = toFiniteNumber(marketValue) ?? p;
  const attentionPortion = m > 0 ? m * 0.08 : 0;
  const pricePortion = p > 0 ? p * 0.04 : 0;
  const derived = Math.round(attentionPortion + pricePortion);
  return Math.max(25, derived);
}

const TRUST_BUYER_MULT = { high: 1.0, medium: 0.6, low: 0 } as const;
const TRUST_SELLER_MULT = { high: 1.0, medium: 0.85, low: 0.5 } as const;

export function computeDualEarn(input: DualEarnInput = {}): DualEarnEstimate {
  const tier = classifyTrust(input.trustScore);
  const rawBuyer = estimateBuyerBase(input);
  const rawSeller = estimateSellerBase(input);
  return {
    buyer: Math.max(0, Math.round(rawBuyer * TRUST_BUYER_MULT[tier])),
    seller: Math.max(0, Math.round(rawSeller * TRUST_SELLER_MULT[tier])),
    tier,
  };
}

/* ---------------- Action feedback ---------------- */

export type BuyerAction = "smart_buy" | "watch" | "bid";
export type SellerAction = "listing_activity" | "sale_completed";

const BUYER_PRAISE: Record<BuyerAction, string> = {
  smart_buy: "smart buy",
  watch: "savvy watch",
  bid: "strong bid",
};

const SELLER_PRAISE: Record<SellerAction, string> = {
  listing_activity: "listing activity",
  sale_completed: "sale completed",
};

/**
 * Fires a "+X Savvy — smart buy" style toast. Noops on non-positive
 * values so callers can pass raw estimates without guard-clausing.
 */
export function emitBuyerEarnToast(
  points: number | string | null | undefined,
  action: BuyerAction = "smart_buy"
): void {
  const n = toFiniteNumber(points);
  if (n == null || n <= 0) return;
  emitPowerToast(applyTierMultiplier(Math.round(n)), BUYER_PRAISE[action]);
}

export function emitSellerEarnToast(
  points: number | string | null | undefined,
  action: SellerAction = "listing_activity"
): void {
  const n = toFiniteNumber(points);
  if (n == null || n <= 0) return;
  emitPowerToast(applyTierMultiplier(Math.round(n)), SELLER_PRAISE[action]);
}
