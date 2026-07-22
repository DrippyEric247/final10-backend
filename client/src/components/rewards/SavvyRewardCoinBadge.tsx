import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { SavvyPointsIcon } from './SavvyPointsIcon';
import { useDealRewardEstimate } from '../../hooks/useDealRewardEstimate';
import { WALLET_AWARD_EVENT } from '../../lib/pointsEngine';
import '../../styles/SavvyRewardCoinBadge.css';

type ListingSnapshot = {
  itemId?: string;
  id?: string;
  price?: number | string | null;
  buyNowPrice?: number | string | null;
  currentBidPrice?: number | string | null;
  feedPrice?: number | string | null;
  savings?: number | string | null;
  savingsAmount?: number | string | null;
  feedSavings?: number | string | null;
  trustScore?: number;
  estimatedPointsEarned?: number;
  baseSavvy?: number;
  pointsMultiplier?: number;
};

export type SavvyRewardCoinBadgeProps = {
  listingId: string;
  listing?: ListingSnapshot;
  trustScore?: number;
  className?: string;
  onClickout?: () => void;
};

function formatSavvy(n: number) {
  return Math.max(0, Math.round(Number(n) || 0)).toLocaleString();
}

/** Premium top-right Savvy reward coin badge for eligible deal cards. */
export default function SavvyRewardCoinBadge({
  listingId,
  listing = {},
  trustScore,
  className = '',
  onClickout,
}: SavvyRewardCoinBadgeProps) {
  const reduceMotion = useReducedMotion();
  const tooltipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [claimAnim, setClaimAnim] = useState(false);
  const prevStateRef = useRef<string | null>(null);

  const snapshot = useMemo(
    () => ({
      listingId: String(listingId || listing.itemId || listing.id || ''),
      trustScore: Number(trustScore ?? listing.trustScore) || 0,
      price: listing.price ?? listing.buyNowPrice ?? listing.currentBidPrice ?? listing.feedPrice,
      savings: listing.savings ?? listing.savingsAmount ?? listing.feedSavings,
      estimatedPointsEarned: listing.estimatedPointsEarned ?? listing.baseSavvy,
    }),
    [listingId, listing, trustScore]
  );

  const { estimate, loading, refresh } = useDealRewardEstimate(snapshot);

  useEffect(() => {
    if (!estimate) return;
    if (prevStateRef.current !== 'claimed' && estimate.state === 'claimed') {
      setClaimAnim(true);
      const rect = rootRef.current?.getBoundingClientRect?.();
      window.dispatchEvent(
        new CustomEvent(WALLET_AWARD_EVENT, {
          detail: {
            amount: estimate.totalSavvy,
            type: 'deal_purchase',
            rarity: 'NORMAL',
            origin: rect
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : null,
          },
        })
      );
      window.setTimeout(() => setClaimAnim(false), 1200);
    }
    prevStateRef.current = estimate.state;
  }, [estimate]);

  const toggleTooltip = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTooltipOpen((v) => !v);
  }, []);

  useEffect(() => {
    if (!tooltipOpen) return undefined;
    const onDoc = (ev: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setTooltipOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [tooltipOpen]);

  if (loading && !estimate) return null;
  if (!estimate || estimate.state === 'not_eligible' || !estimate.eligible) return null;

  const isPending = estimate.state === 'pending';
  const isClaimed = estimate.state === 'claimed';
  const displayAmount = estimate.totalSavvy;

  const ariaLabel = isClaimed
    ? `Reward earned: ${formatSavvy(displayAmount)} Savvy from this transaction.`
    : isPending
      ? `Reward pending verification for an estimated ${formatSavvy(displayAmount)} Savvy.`
      : `Earn up to ${formatSavvy(displayAmount)} Savvy with this eligible transaction.`;

  const stateClass = isClaimed
    ? 'savvy-reward-coin-badge--claimed'
    : isPending
      ? 'savvy-reward-coin-badge--pending'
      : 'savvy-reward-coin-badge--eligible';

  return (
    <div
      ref={rootRef}
      className={`savvy-reward-coin-badge ${stateClass} ${claimAnim ? 'is-claim-burst' : ''} ${reduceMotion ? 'is-reduced-motion' : ''} ${className}`}
    >
      <button
        type="button"
        className="savvy-reward-coin-badge__hit"
        aria-label={ariaLabel}
        aria-expanded={tooltipOpen}
        aria-describedby={tooltipOpen ? tooltipId : undefined}
        onClick={toggleTooltip}
      >
        <span className="savvy-reward-coin-badge__sparkles" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className="savvy-reward-coin-badge__coin-wrap">
          <SavvyPointsIcon size={34} animated={!reduceMotion} glow />
          {isClaimed ? (
            <span className="savvy-reward-coin-badge__check" aria-hidden>
              ✓
            </span>
          ) : null}
        </span>
        <span className="savvy-reward-coin-badge__copy">
          <span className="savvy-reward-coin-badge__amount">+{formatSavvy(displayAmount)} SAVVY</span>
          <span className="savvy-reward-coin-badge__label">
            {isClaimed ? 'Reward earned' : isPending ? 'Reward pending' : 'Purchase Reward'}
          </span>
        </span>
      </button>

      {tooltipOpen ? (
        <div id={tooltipId} className="savvy-reward-coin-badge__tooltip" role="tooltip">
          <p className="savvy-reward-coin-badge__tooltip-lead">
            {isClaimed
              ? `You earned +${formatSavvy(displayAmount)} Savvy from this transaction.`
              : isPending
                ? `We're verifying your purchase. Estimated reward: +${formatSavvy(displayAmount)} Savvy.`
                : `Complete this eligible transaction to earn up to +${formatSavvy(displayAmount)} Savvy.`}
          </p>
          {!isClaimed ? (
            <p className="savvy-reward-coin-badge__tooltip-note">
              Rewards are estimated until purchase eligibility is confirmed.
            </p>
          ) : null}
          {estimate.showEventBreakdown ? (
            <ul className="savvy-reward-coin-badge__breakdown">
              <li>
                <span>Base</span>
                <strong>{formatSavvy(estimate.preEventTotal)} Savvy</strong>
              </li>
              <li>
                <span>{estimate.eventLabel || 'Event Bonus'}</span>
                <strong>+{formatSavvy(estimate.eventBonus)}</strong>
              </li>
              <li>
                <span>Total</span>
                <strong>{formatSavvy(estimate.totalSavvy)} Savvy</strong>
              </li>
            </ul>
          ) : null}
          <Link
            to="/profile#savvy-balance"
            className="savvy-reward-coin-badge__learn"
            onClick={() => setTooltipOpen(false)}
          >
            How rewards work
          </Link>
          {!isClaimed && onClickout ? (
            <button
              type="button"
              className="savvy-reward-coin-badge__clickout"
              onClick={(e) => {
                e.stopPropagation();
                onClickout();
                void refresh();
              }}
            >
              Track purchase
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
