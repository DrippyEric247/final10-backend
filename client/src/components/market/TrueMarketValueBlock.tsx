import React, { useState } from 'react';
import { Info } from 'lucide-react';
import {
  TRUE_MARKET_VALUE_LABEL,
  TRUE_MARKET_VALUE_TOOLTIP,
  formatConfidenceLabel,
  formatConfidenceTone,
  getMarketConfidence,
  getMarketLabel,
  getMarketValue,
  getSampleSize,
  getSavings,
  type ListingForMarket,
} from '../../lib/marketValue';

type Props = {
  item: ListingForMarket;
  currency?: string;
  /** Compact = no body, just the headline row + badge. Used in dense lists. */
  compact?: boolean;
  className?: string;
};

function fmt(value: number | null | undefined, currency = 'USD'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

/**
 * The True Market Value display block. Replaces the legacy "Market Price"
 * label everywhere and exposes:
 *   - the engine's headline median value,
 *   - the data-source line ("Based on recent sold listings"),
 *   - a Market Confidence pill (High / Medium / Low),
 *   - a hover tooltip explaining the engine,
 *   - savings vs the live listing (positive = under market, negative = above market).
 */
export default function TrueMarketValueBlock({
  item,
  currency = 'USD',
  compact = false,
  className = '',
}: Props) {
  const [tipOpen, setTipOpen] = useState(false);
  const market = getMarketValue(item);
  const confidence = getMarketConfidence(item);
  const label = getMarketLabel(item);
  const sampleSize = getSampleSize(item);
  const { amount: savings, pct } = getSavings(item);

  if (market == null) return null;

  const confidenceLabel = formatConfidenceLabel(confidence);
  const confidenceTone = formatConfidenceTone(confidence);
  const aboveMarket = pct != null && pct < 0;
  const savingsTone = aboveMarket
    ? 'text-rose-300'
    : savings != null && savings > 0
      ? 'text-emerald-300'
      : 'text-gray-300';

  return (
    <div
      className={`rounded-xl border border-cyan-400/25 bg-cyan-500/5 px-3 py-2.5 text-sm ${className}`}
      data-testid="true-market-value-block"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-cyan-100">
          <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
            {TRUE_MARKET_VALUE_LABEL}
          </span>
          <button
            type="button"
            aria-label="What is True Market Value?"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-cyan-200/80 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            onFocus={() => setTipOpen(true)}
            onBlur={() => setTipOpen(false)}
            onClick={() => setTipOpen((v) => !v)}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-base font-extrabold text-white tabular-nums">{fmt(market, currency)}</span>
      </div>

      {tipOpen ? (
        <div
          role="tooltip"
          className="mt-2 rounded-lg border border-cyan-300/30 bg-black/70 px-2 py-1.5 text-xs text-cyan-100"
        >
          {TRUE_MARKET_VALUE_TOOLTIP}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
        <span>{label}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceTone}`}
          aria-label={`Market confidence: ${confidenceLabel}`}
        >
          Market Confidence: {confidenceLabel}
        </span>
      </div>

      {!compact ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span>Savings</span>
            <span className={`font-semibold tabular-nums ${savingsTone}`}>
              {savings == null
                ? '—'
                : aboveMarket
                  ? `+${fmt(Math.abs(savings), currency)}`
                  : fmt(savings, currency)}
              {pct != null ? (
                <span className="ml-1 text-[11px] opacity-80">
                  ({pct >= 0 ? '-' : '+'}
                  {Math.abs(pct).toFixed(0)}%)
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Comps</span>
            <span className="font-semibold text-gray-200 tabular-nums">{sampleSize}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
