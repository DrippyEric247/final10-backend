import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Clock, ExternalLink, Sparkles } from 'lucide-react';
import { evaluateBestMove } from '../../lib/bestMoveEngine';
import type { BestMoveResult } from '../../types/bestMove';
import { evaluateTrustScore, getTrustSummary, trustScoreInputFromListing } from '../../lib/trustScoreEngine';
import type { TrustScoreResult } from '../../types/trustScore';
import SavvyTrustPanel from '../trust/SavvyTrustPanel';
import SavvyDealRewardsIntegration from '../rewards/SavvyDealRewardsIntegration';
import DualEarnChip from '../rewards/DualEarnChip';
import { emitBuyerEarnToast } from '../../lib/dualEarn';
import {
  FINAL10_DEV_OVERRIDE_EVENT,
  getDevFeatureTests,
  isDev,
} from '../../lib/devOverride';
import {
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  getEffectiveSubscriptionTier,
} from '../../lib/tierMultiplier';
import {
  getSavedPaymentMethods,
  getSavvyAiCapabilities,
  getSavvyAiRules,
  setSavvyAiRules,
  shouldTriggerReadyToBuy,
} from '../../lib/savvyAiSystem';
import '../../styles/DualEarnChip.css';
import { SCOUT_COPY, SAVVY_SCOUT } from '../../config/savvyScoutBranding';
import BestMoveDealCard from './BestMoveDealCard';
import AuctionOpportunityCard from './AuctionOpportunityCard';
import BuyNowDealCard from './BuyNowDealCard';
import WatchDealCard from './WatchDealCard';
import PassDealCard from './PassDealCard';
import SavvyAlertButton from '../alerts/SavvyAlertButton';
import ListingCardImage from '../listings/ListingCardImage';
import TrueMarketValueBlock from '../market/TrueMarketValueBlock';
import DealBadges from '../market/DealBadges';
import { getMarketValue, getSavings, type DealBadge } from '../../lib/marketValue';

export type DealListing = {
  itemId?: string;
  title?: string;
  imageUrl?: string;
  image?: unknown;
  images?: unknown;
  itemWebUrl?: string;
  source?: string;
  seller?: string;
  price?: number | string;
  currentBidPrice?: number | string;
  buyNowPrice?: number | string;
  marketValue?: number | string;
  bidCount?: number | string;
  secondsRemaining?: number | string;
  condition?: string;
  shippingCost?: number | string;
  currency?: string;
  isAuction?: boolean;
  isBuyNow?: boolean;
  dealScore?: number;
  recommendationType?: string;
  confidenceScore?: number;
  recommendationReason?: string;
  sellerFeedbackPercent?: number | string;
  sellerFeedbackCount?: number | string;
  sellerTopRated?: boolean | string;
  sellerAccountAgeDays?: number | string;
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low' | 'unverified';
  aiConfidence?: number | string;
  savvyWarningHeadline?: string | null;
  savvyVerifiedSeller?: boolean | string;
  safeToRecommend?: boolean;
  estimatedPointsEarned?: number | string;
  pointsMultiplier?: number | string;
  pointsTrackingLive?: boolean;
  // True Market Value enrichment from /api/ebay/* and /api/market-value
  marketStats?: {
    source: 'sold' | 'active';
    label: string;
    average: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    count: number;
    confidence: 'high' | 'medium' | 'low';
    coefficientOfVariation: number | null;
    sampledAt: number;
  } | null;
  marketConfidence?: 'high' | 'medium' | 'low' | string | null;
  marketLabel?: string | null;
  savings?: number | string | null;
  savingsPct?: number | string | null;
  dealBadges?: DealBadge[] | null;
};

export type DealCardProps = {
  item: DealListing;
  decision?: BestMoveResult;
  onMeaningfulView?: (item: DealListing, action: string) => void;
  hidePass?: boolean;
  boostedPower?: boolean;
  /** Quick Snipes / action-only surfaces: hide per-listing Create Alert. */
  hideCreateAlert?: boolean;
};

type DealCardShellProps = {
  item: DealListing;
  decision: BestMoveResult;
  trustResult: TrustScoreResult;
  chipText: string;
  chipTone: string;
  cardTone: string;
  typeTone?: string;
  emphasize?: boolean;
  boostedPower?: boolean;
  hideCreateAlert?: boolean;
  onMeaningfulView?: (item: DealListing, action: string) => void;
};

export function formatPrice(value: number | string | null | undefined, currency = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function formatTime(seconds: number | string | undefined) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 'Ended';
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

export function sourceLabel(source: string | undefined) {
  if (!source) return 'Market';
  const lower = source.toLowerCase();
  if (lower === 'ebay') return 'eBay';
  return source;
}

export function confidenceLabel(confidence: BestMoveResult['confidence']) {
  if (confidence === 'high') return 'High';
  if (confidence === 'medium') return 'Medium';
  return 'Low';
}

export function confidenceTone(confidence: BestMoveResult['confidence']) {
  if (confidence === 'high') return 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200';
  if (confidence === 'medium') return 'bg-amber-500/20 border-amber-400/40 text-amber-200';
  return 'bg-gray-700 border-gray-500/40 text-gray-300';
}

function listingTypeLabel(item: DealListing) {
  if (item.isAuction && item.isBuyNow) return 'Both';
  if (item.isAuction) return 'Auction';
  if (item.isBuyNow) return 'Buy Now';
  return 'Listing';
}

function compactReason(reason: string | undefined) {
  const base = String(reason || '').trim();
  if (!base) return 'Best Move engine found this as your clearest next action.';
  return base.length > 84 ? `${base.slice(0, 81)}...` : base;
}

function toNum(value: number | string | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toComparableSpend(item: DealListing): number | null {
  return toNum(item.buyNowPrice) ?? toNum(item.currentBidPrice) ?? toNum(item.price);
}

export function toEstimatedPoints(item: DealListing): number {
  const explicit = toNum(item.estimatedPointsEarned);
  if (explicit != null && explicit >= 0) return Math.round(explicit);
  const spend = toComparableSpend(item) ?? toNum(item.marketValue);
  if (spend == null || spend <= 0) return 0;
  return Math.max(1, Math.round(spend));
}

type CarContext = {
  isAutomotive: boolean;
  modelLabel: string;
  mileage: number | null;
  maintenanceStage: 'early' | 'mid' | 'high';
  carType: 'suv' | 'truck' | 'performance' | 'electric' | 'luxury' | 'standard';
};

type OwnershipRec = {
  id: string;
  name: string;
  estPrice: number;
  trustScore: number;
  query: string;
  timing: string;
};

function parseMileageFromText(text: string): number | null {
  const m = text.match(/(\d{2,3}[,\s]?\d{3})\s*(miles?|mi)\b/i);
  if (!m) return null;
  const raw = m[1].replace(/[,\s]/g, '');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectCarContext(item: DealListing): CarContext {
  const title = String(item.title || '').toLowerCase();
  const condition = String(item.condition || '').toLowerCase();
  const combined = `${title} ${condition}`.trim();
  const isAutomotive =
    /\b(car|sedan|coupe|hatchback|suv|truck|pickup|vehicle|toyota|honda|ford|bmw|mercedes|tesla|hyundai|kia|nissan|chevy|chevrolet|audi)\b/i.test(
      combined
    );
  const mileage = parseMileageFromText(combined);
  const maintenanceStage = mileage == null ? 'mid' : mileage < 40000 ? 'early' : mileage < 90000 ? 'mid' : 'high';
  const carType: CarContext['carType'] = /\b(ev|electric|tesla|hybrid|ioniq|leaf|bolt)\b/i.test(combined)
    ? 'electric'
    : /\b(suv|crossover)\b/i.test(combined)
      ? 'suv'
      : /\b(truck|pickup|f-150|silverado|ram)\b/i.test(combined)
        ? 'truck'
        : /\b(m3|m4|amg|type r|sti|hellcat|performance|sport)\b/i.test(combined)
          ? 'performance'
          : /\b(lexus|bmw|mercedes|audi|porsche|acura|infiniti)\b/i.test(combined)
            ? 'luxury'
            : 'standard';
  const modelGuess = String(item.title || '').trim().split(/\s+/).slice(0, 3).join(' ');
  return {
    isAutomotive,
    modelLabel: modelGuess || 'your car',
    mileage,
    maintenanceStage,
    carType,
  };
}

function buildOwnershipRecommendations(ctx: CarContext): OwnershipRec[] {
  const base: OwnershipRec[] = [
    { id: 'oil', name: 'Oil change kit', estPrice: 49, trustScore: 91, query: 'full synthetic oil change kit', timing: 'Now' },
    { id: 'brakes', name: 'Brake pads set', estPrice: 89, trustScore: 90, query: 'ceramic brake pads', timing: 'Next service window' },
    { id: 'filters', name: 'Engine + cabin filters', estPrice: 35, trustScore: 92, query: 'engine cabin air filter set', timing: 'This month' },
    { id: 'tools', name: 'Maintenance tool kit', estPrice: 65, trustScore: 87, query: 'car maintenance tools torque wrench', timing: 'Before next DIY job' },
  ];
  const tireRec: OwnershipRec = {
    id: 'tires',
    name: ctx.carType === 'truck' || ctx.carType === 'suv' ? 'All-season tire set' : 'Performance tire set',
    estPrice: ctx.carType === 'truck' ? 620 : ctx.carType === 'performance' ? 780 : 560,
    trustScore: 89,
    query: ctx.carType === 'truck' ? 'truck all season tires set' : 'car tires set',
    timing: ctx.maintenanceStage === 'high' ? 'Priority soon' : 'Plan ahead',
  };
  const electricAddon: OwnershipRec | null =
    ctx.carType === 'electric'
      ? {
          id: 'ev-care',
          name: 'EV care + charging accessories',
          estPrice: 79,
          trustScore: 90,
          query: 'ev charging cable accessories kit',
          timing: 'Useful now',
        }
      : null;
  const stageAdjusted = base.map((r) =>
    r.id === 'brakes' && ctx.maintenanceStage === 'high'
      ? { ...r, timing: 'Priority soon', estPrice: 109 }
      : r.id === 'oil' && ctx.maintenanceStage === 'early'
        ? { ...r, timing: 'Plan your next service' }
        : r
  );
  return [stageAdjusted[0], stageAdjusted[1], tireRec, stageAdjusted[2], stageAdjusted[3], electricAddon].filter(Boolean) as OwnershipRec[];
}

export function DealCardShell({
  item,
  decision,
  trustResult,
  chipText,
  chipTone,
  cardTone,
  typeTone = 'bg-black/55 border-white/20 text-white',
  emphasize = false,
  boostedPower = false,
  hideCreateAlert = false,
  onMeaningfulView,
}: DealCardShellProps) {
  const title = item.title || 'Listing';
  const currentBid = formatPrice(item.currentBidPrice, item.currency || 'USD');
  const buyNow = formatPrice(item.buyNowPrice, item.currency || 'USD');
  // Prefer the True Market Value engine's savings (real comp data) over the
  // best-move engine's heuristic estimate. Fall back to the heuristic so
  // surfaces without server enrichment still show a sane number.
  const marketSavings = getSavings(item);
  const trueMarketValue = getMarketValue(item);
  const effectiveSavings =
    marketSavings.amount != null && marketSavings.amount > 0
      ? marketSavings.amount
      : decision.estimatedSavings;
  const savings = formatPrice(effectiveSavings, item.currency || 'USD');
  const source = sourceLabel(item.source);
  const typeLabel = listingTypeLabel(item);
  const confidence = confidenceLabel(decision.confidence);
  const confidenceClasses = confidenceTone(decision.confidence);
  const reason = compactReason(item.recommendationReason || decision.reason);
  const trustSummary = compactReason(getTrustSummary(item, trustResult));
  const basePoints = toEstimatedPoints(item);
  // Only forward an explicit per-listing multiplier override (e.g. a promoted
  // bonus). Otherwise SavvyRewardBadge reads the user's live Savvy
  // multiplier from Final10PowerContext so every card stays in sync.
  const listingMultiplierOverride = useMemo(() => {
    const raw = Number(item.pointsMultiplier);
    return Number.isFinite(raw) && raw > 1 ? raw : undefined;
  }, [item.pointsMultiplier]);
  const cautionLabel =
    trustResult.sellerTrustBand === 'low'
      ? trustResult.riskFlags.includes('new_seller')
        ? 'Low seller history'
        : 'Use caution on seller'
      : trustResult.trustLevel === 'unverified'
        ? 'Thin seller profile'
        : null;
  const recommendationLine = useMemo(() => {
    if (decision.bestMove === 'bid') return 'Bid now';
    if (decision.bestMove === 'buy_now') return 'Buy now';
    if (decision.bestMove === 'watch') return 'Watch and wait';
    return 'Skip for now';
  }, [decision.bestMove]);
  const secondsRemaining = Number(item.secondsRemaining);
  const isGoneDeal = Number.isFinite(secondsRemaining) && secondsRemaining <= 0;
  const [, bumpAiCaps] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const bump = () => bumpAiCaps();
    window.addEventListener("f10:subscription-tier-updated", bump);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, bump);
    return () => {
      window.removeEventListener("f10:subscription-tier-updated", bump);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
      window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, bump);
    };
  }, []);
  const aiCaps = getSavvyAiCapabilities(getEffectiveSubscriptionTier());
  const [aiRules, setAiRules] = useState(() => getSavvyAiRules());
  const [confirming, setConfirming] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const paymentMethods = useMemo(() => getSavedPaymentMethods(), []);
  const hasSavedPaymentMethod = paymentMethods.length > 0;
  const carContext = useMemo(() => detectCarContext(item), [item]);
  const ownershipRecs = useMemo(() => buildOwnershipRecommendations(carContext), [carContext]);
  const tier = aiCaps.tier;
  let isPaidTier = tier === 'core' || tier === 'pro' || tier === 'elite';
  let isProTier = tier === 'pro' || tier === 'elite';
  if (isDev && getDevFeatureTests().premiumDealReveal && tier === 'free') {
    isPaidTier = true;
    isProTier = true;
  }
  const readyToBuyEligible =
    aiCaps.hasReadyToBuyFlow &&
    shouldTriggerReadyToBuy({ item, trustScore: trustResult.trustScore, rules: aiRules });

  const startConfirmCountdown = useCallback(() => {
    setConfirming(true);
    setCountdown(8);
  }, []);

  const cancelConfirmCountdown = useCallback(() => {
    setConfirming(false);
    setCountdown(8);
  }, []);

  useEffect(() => {
    if (!confirming) return undefined;
    if (countdown <= 0) {
      setConfirming(false);
      if (item.itemWebUrl) {
        window.open(item.itemWebUrl, '_blank', 'noopener,noreferrer');
      }
      return undefined;
    }
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [confirming, countdown, item.itemWebUrl]);

  useEffect(() => {
    if (
      !readyToBuyEligible ||
      !aiCaps.hasAutoConfirmRules ||
      !hasSavedPaymentMethod ||
      !aiRules.enabled ||
      confirming
    ) {
      return;
    }
    startConfirmCountdown();
  }, [
    readyToBuyEligible,
    aiCaps.hasAutoConfirmRules,
    hasSavedPaymentMethod,
    aiRules.enabled,
    confirming,
    startConfirmCountdown,
  ]);

  return (
    <article
      className={`deal-card card f10-listing-surface rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl ${cardTone}`}
    >
      <div className="relative bg-gray-800">
        <ListingCardImage item={item} alt={title} aspectRatio="4 / 3" borderRadius="0" frameClassName="bg-gray-800" />
        <span className="absolute top-3 left-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-white/95 bg-black/60 border-black/20">
          {source}
        </span>
        <span className={`absolute top-3 right-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${typeTone}`}>
          {typeLabel}
        </span>
        <div className={`absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-extrabold tracking-tight shadow-lg backdrop-blur-sm ${chipTone} ${emphasize ? 'animate-pulse' : ''}`}>
          <Sparkles className="h-4 w-4" />
          {chipText}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="line-clamp-2 text-lg sm:text-xl font-semibold text-white leading-tight">{title}</h3>
        <div className="mt-1 text-xs text-gray-400 line-clamp-1">
          {[item.condition, item.seller].filter(Boolean).join(' • ') || 'Marketplace listing'}
        </div>
        <p className="mt-2 text-sm font-semibold text-gray-100">{recommendationLine}</p>

        <div className="deal-price">
          <span className="current">{item.isAuction ? currentBid : formatPrice(item.price, item.currency || 'USD')}</span>
          <span className={effectiveSavings > 0 ? 'savings' : 'savings savings--muted'}>
            {effectiveSavings > 0 ? `Save ${savings}` : 'Save —'}
          </span>
        </div>
        {item.buyNowPrice != null ? (
          <div className="mt-1 text-xs font-semibold text-amber-200/90">
            Buy now {buyNow}
          </div>
        ) : null}

        {trueMarketValue != null ? (
          <TrueMarketValueBlock
            item={item}
            currency={item.currency || 'USD'}
            className="mt-3"
          />
        ) : null}

        <DealBadges item={item} className="mt-3" />

        <SavvyDealRewardsIntegration
          item={item}
          trustResult={trustResult}
          decision={decision}
          basePoints={basePoints}
          listingMultiplierOverride={listingMultiplierOverride}
          effectiveSavings={effectiveSavings}
          formatPrice={formatPrice}
          currency={item.currency || 'USD'}
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          {item.isAuction ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
              <Clock className="h-3.5 w-3.5" />
              Ends in {formatTime(item.secondsRemaining)}
            </div>
          ) : (
            <span />
          )}
          <div className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${confidenceClasses}`}>
            {confidence} confidence
          </div>
        </div>

        <div className="trust-score">
          Seller trust: {trustResult.sellerTrustScore}/100
          {cautionLabel ? <span className="ml-2 text-xs font-semibold text-rose-300">({cautionLabel})</span> : null}
        </div>
        {trustResult.dealWarningHeadline ? (
          <div className="text-xs font-semibold text-amber-200/90 mt-1">
            Deal: {trustResult.dealWarningHeadline}
          </div>
        ) : null}

        <SavvyTrustPanel trust={trustResult} className="mt-3" />

        <div className="deal-actions">
          {item.itemWebUrl ? (
            <a
              href={item.itemWebUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                onMeaningfulView?.(item, 'open_listing');
                if (decision.bestMove !== 'pass') {
                  const action =
                    decision.bestMove === 'bid'
                      ? 'bid'
                      : decision.bestMove === 'watch'
                        ? 'watch'
                        : 'smart_buy';
                  emitBuyerEarnToast(basePoints, action);
                }
              }}
              className={`best-move ${emphasize ? 'best-move--hot' : ''} ${boostedPower ? 'ring-2 ring-yellow-300/60 animate-pulse' : ''}`}
            >
              {decision.bestMove === 'pass' ? 'View Deal' : 'Best Move'}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <span className="best-move" aria-disabled="true">
              {decision.bestMove === 'pass' ? 'View Deal' : 'Best Move'}
            </span>
          )}
          {!hideCreateAlert ? (
            <SavvyAlertButton
              className="alert-btn"
              label="🔔 Create Alert"
              payload={{
                name: `${title} • best move watch`,
                keywords: [title.slice(0, 40)],
                maxPrice: Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price) || undefined,
                minConfidence: Math.round((Number(item.confidenceScore) || 0) * 100) || 75,
                persona: 'buyer',
                kind: 'best_move_high_conf',
                context: { source: 'deal_card', itemId: String(item.itemId || '') },
              }}
            />
          ) : null}
        </div>

        {isGoneDeal ? (
          <div className="mt-3 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-3">
            <div className="text-sm font-extrabold text-rose-200">Sold 2 minutes ago</div>
            <div className="mt-1 text-sm font-semibold text-amber-200">
              ⚡ Premium alerts would&apos;ve caught this instantly
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href="/premium?trigger=missed_deal&popular=savvy_pro"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 to-orange-400 px-3 py-1.5 text-xs font-extrabold text-gray-900"
              >
                Upgrade to Pro
              </a>
              <span className="text-xs font-semibold text-gray-300">Never miss again</span>
            </div>
          </div>
        ) : null}

        {readyToBuyEligible ? (
          <div className="mt-3 rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                {SCOUT_COPY.dealCard.scoutActive}
              </span>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-bold text-cyan-100">
                {SCOUT_COPY.dealCard.monitoring}
              </span>
            </div>
            <div className="mt-2 text-sm font-extrabold text-white">Perfect match found</div>
            <div className="text-xs text-cyan-100">Confirm to secure deal</div>
            <div className="mt-2 text-xs text-gray-200">
              Smart filters: trust {`>=${aiRules.minTrust}`}, price {`<=${formatPrice(aiRules.maxPrice, item.currency || 'USD')}`}, valid condition.
            </div>
            <div className="mt-1 text-xs text-gray-300">
              Payment method: {paymentMethods[0]?.label || 'No saved method'}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!confirming ? (
                <button
                  type="button"
                  className="rounded-lg bg-gradient-to-r from-cyan-300 to-blue-400 px-3 py-1.5 text-xs font-extrabold text-gray-900"
                  onClick={startConfirmCountdown}
                >
                  Confirm to secure deal
                </button>
              ) : (
                <>
                  <div className="rounded-lg border border-yellow-300/45 bg-yellow-300/10 px-2 py-1 text-xs font-bold text-yellow-100">
                    Deal locked — confirm now ({countdown}s)
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-500 px-2 py-1 text-xs font-semibold text-gray-200"
                    onClick={cancelConfirmCountdown}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-200">
              <input
                type="checkbox"
                disabled={!aiCaps.hasAutoConfirmRules}
                checked={aiRules.enabled}
                onChange={(e) => {
                  const next = setSavvyAiRules({
                    ...aiRules,
                    enabled: e.target.checked,
                  });
                  setAiRules(next);
                }}
              />
              Enable auto-confirm rules (countdown + cancel safety)
            </label>
            {!hasSavedPaymentMethod ? (
              <div className="mt-1 text-[11px] text-yellow-200">
                Add a saved payment method to unlock countdown-confirm safety.
              </div>
            ) : null}
            <div className="mt-1 text-[11px] text-gray-400">
              Safeguard: no blind purchase or auto-charge; you always get countdown control.
            </div>
          </div>
        ) : aiCaps.hasReadyToBuyFlow ? null : (
          <div className="mt-3 rounded-xl border border-purple-400/25 bg-purple-500/8 px-3 py-2 text-xs text-purple-100">
            {SAVVY_SCOUT.shortTitle} Active — execution unlocks on Savvy Pro.
          </div>
        )}

        {carContext.isAutomotive ? (
          <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3">
            <div className="text-sm font-extrabold text-emerald-100">Next Moves (Based on Your Car)</div>
            <div className="mt-1 text-xs text-emerald-200">
              After {carContext.modelLabel}, here&apos;s what you likely need next
              {carContext.mileage != null ? ` (${carContext.mileage.toLocaleString()} mi)` : ''}.
            </div>
            <div className="mt-2 space-y-2">
              {ownershipRecs.slice(0, 4).map((rec) => {
                const searchQuery = `${carContext.modelLabel} ${rec.query}`.trim();
                const buyHref = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}`;
                return (
                  <div key={rec.id} className="rounded-lg border border-gray-700/70 bg-black/25 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">{rec.name}</div>
                        <div className="text-[11px] text-gray-300">
                          {formatPrice(rec.estPrice, item.currency || 'USD')} • Trust {rec.trustScore} • {rec.timing}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a
                        href={buyHref}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-emerald-300 px-2 py-1 text-[11px] font-extrabold text-gray-900"
                      >
                        Buy Now
                      </a>
                      <SavvyAlertButton
                        className="inline-block"
                        label="Track Price"
                        payload={{
                          name: `${carContext.modelLabel} • ${rec.name} price track`,
                          keywords: [carContext.modelLabel, rec.name].filter(Boolean),
                          maxPrice: rec.estPrice,
                          minConfidence: 70,
                          persona: 'buyer',
                          kind: 'ownership_track_price',
                          context: { source: 'savvy_ownership', itemId: String(item.itemId || '') },
                        }}
                      />
                      <SavvyAlertButton
                        className="inline-block"
                        label="Create Alert"
                        payload={{
                          name: `${carContext.modelLabel} • ${rec.name} alert`,
                          keywords: [carContext.modelLabel, rec.query].filter(Boolean),
                          maxPrice: Math.round(rec.estPrice * 1.05),
                          minConfidence: 72,
                          persona: 'buyer',
                          kind: 'ownership_maintenance',
                          context: { source: 'savvy_ownership', itemId: String(item.itemId || ''), trustTarget: rec.trustScore },
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {isPaidTier ? (
              <div className="mt-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-2 text-[11px] text-cyan-100">
                Premium active: predictive alerts + smarter timing windows enabled.
                {isProTier ? ' Pro reward boost active for ownership actions.' : ' Upgrade to Pro for max Savvy rewards.'}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-amber-300/35 bg-amber-400/10 px-2 py-2 text-[11px] text-amber-100">
                Upgrade for predictive maintenance alerts, smarter buy timing, and higher Savvy rewards.
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-3 rounded-lg border border-gray-700/80 bg-black/30 px-3 py-2">
          <p className="text-xs text-gray-200 line-clamp-1">{reason}</p>
          <p className="mt-1 text-xs text-gray-300 line-clamp-1">{trustSummary}</p>
        </div>

        <DualEarnChip
          price={Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price) || undefined}
          marketValue={Number(item.marketValue) || undefined}
          savings={Number(decision.estimatedSavings) || undefined}
          trustScore={trustResult.trustScore}
          buyerBase={basePoints}
        />
      </div>
    </article>
  );
}

export function DealCard({
  item,
  decision,
  onMeaningfulView,
  hidePass = false,
  boostedPower = false,
  hideCreateAlert = false,
}: DealCardProps) {
  const trustResult: TrustScoreResult = evaluateTrustScore(
    trustScoreInputFromListing(item as unknown as Record<string, unknown>),
  );

  const computed =
    decision ||
    evaluateBestMove({
      currentBid: item.currentBidPrice,
      buyNowPrice: item.buyNowPrice,
      marketValue: item.marketValue,
      marketConfidence: item.marketConfidence,
      trustScore: trustResult.trustScore,
      bidCount: item.bidCount,
      secondsRemaining: item.secondsRemaining,
      condition: item.condition,
      shippingCost: item.shippingCost,
      isAuction: item.isAuction,
      isBuyNow: item.isBuyNow,
    });

  if (hidePass && computed.bestMove === 'pass') return null;

  if (computed.cardVariant === 'best_move') {
    return (
      <BestMoveDealCard
        item={item}
        decision={computed}
        trustResult={trustResult}
        onMeaningfulView={onMeaningfulView}
        boostedPower={boostedPower}
        hideCreateAlert={hideCreateAlert}
      />
    );
  }
  if (computed.cardVariant === 'auction_opportunity') {
    return (
      <AuctionOpportunityCard
        item={item}
        decision={computed}
        trustResult={trustResult}
        onMeaningfulView={onMeaningfulView}
        boostedPower={boostedPower}
        hideCreateAlert={hideCreateAlert}
      />
    );
  }
  if (computed.cardVariant === 'buy_now') {
    return (
      <BuyNowDealCard
        item={item}
        decision={computed}
        trustResult={trustResult}
        onMeaningfulView={onMeaningfulView}
        boostedPower={boostedPower}
        hideCreateAlert={hideCreateAlert}
      />
    );
  }
  if (computed.cardVariant === 'watch') {
    return (
      <WatchDealCard
        item={item}
        decision={computed}
        trustResult={trustResult}
        onMeaningfulView={onMeaningfulView}
        boostedPower={boostedPower}
        hideCreateAlert={hideCreateAlert}
      />
    );
  }
  return (
    <PassDealCard
      item={item}
      decision={computed}
      trustResult={trustResult}
      onMeaningfulView={onMeaningfulView}
      boostedPower={boostedPower}
      hideCreateAlert={hideCreateAlert}
    />
  );
}

export default DealCard;

