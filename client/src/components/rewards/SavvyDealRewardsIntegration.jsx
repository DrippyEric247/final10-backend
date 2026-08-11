import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeSavvyReward } from './SavvyRewardBadge';
import { useSavvyMultiplier } from '../../hooks/useSavvyMultiplier';
import {
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  getEffectiveSubscriptionTier,
} from '../../lib/tierMultiplier';
import {
  buildMockSavvyBreakdown,
  readMockStreak,
  readMockWalletBalance,
} from '../../lib/mockSavvyDealRewards';
import { applyBetaRewardUnlock, getBetaRewardsActiveLabel } from '../../lib/betaRewardsDisplay';
import { SAVVY_SCOUT } from '../../config/savvyScoutBranding';
import '../../styles/savvy-deal-rewards.css';
import WhyPickedPanel from '../ai/WhyPickedPanel';
import SavvyMultiplierBreakdown from '../wallet/SavvyMultiplierBreakdown';

function useTweenTo(target, startVal, durationMs = 640) {
  const safe = Number.isFinite(target) ? Math.max(0, Math.round(target)) : 0;
  const [v, setV] = useState(() =>
    Number.isFinite(startVal) ? Math.max(0, Math.round(startVal)) : safe
  );
  const vRef = useRef(v);
  vRef.current = v;
  const raf = useRef(0);

  useEffect(() => {
    const from = vRef.current;
    if (safe === from) return;
    const begin = performance.now();
    const d = safe - from;
    const step = (now) => {
      const t = Math.min(1, (now - begin) / Math.max(1, durationMs));
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + d * eased);
      setV(next);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [safe, durationMs]);

  return v;
}

function formatSavvy(n) {
  return `+${Math.max(0, Math.round(n)).toLocaleString()} SAVVY`;
}

function toneClass(tone) {
  if (tone === 'blue') return 'sdr-line--blue';
  if (tone === 'green') return 'sdr-line--green';
  if (tone === 'cyan') return 'sdr-line--cyan';
  if (tone === 'gold') return 'sdr-line--gold';
  return 'sdr-line--purple';
}

function hashStr(s) {
  const str = String(s || '');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Full Savvy Points + progression UI for Final10 deal cards.
 * Mock breakdown: `lib/mockSavvyDealRewards.ts`. Totals align with `computeSavvyReward`.
 */
export default function SavvyDealRewardsIntegration({
  item,
  trustResult,
  decision,
  basePoints,
  listingMultiplierOverride,
  effectiveSavings,
  formatPrice,
  currency = 'USD',
  hideWhyPickedPanel = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [tierTick, setTierTick] = useState(0);
  useEffect(() => {
    const bump = () => setTierTick((n) => n + 1);
    window.addEventListener('f10:subscription-tier-updated', bump);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    return () => {
      window.removeEventListener('f10:subscription-tier-updated', bump);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    };
  }, []);
  void tierTick;

  const subscriptionTier = getEffectiveSubscriptionTier();
  const isElite = subscriptionTier === 'elite';

  const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price) || undefined;
  const savings = Number(effectiveSavings ?? decision?.estimatedSavings) || undefined;
  const trustScore = Number(trustResult.trustScore) || 0;
  const bidCount = Number(item.bidCount) || 0;
  const marketValue = Number(item.marketValue) || 0;
  const confidenceScore = Number(item.confidenceScore ?? decision?.confidenceScore) || 0;
  const aiConfidence = Number(item.aiConfidence ?? trustResult.aiConfidence) || trustScore;

  const savvyMultiplier = useSavvyMultiplier();
  const listingMult =
    listingMultiplierOverride != null && Number.isFinite(Number(listingMultiplierOverride))
      ? Math.max(0, Number(listingMultiplierOverride))
      : undefined;

  const mockModel = useMemo(() => {
    const pre = computeSavvyReward({
      baseSavvy: basePoints,
      trustScore,
      price,
      savings,
      multiplier: 1,
    });
    return buildMockSavvyBreakdown({
      baseAfterTrust: pre.baseAfterTrust,
      trustScore,
      bidCount,
      marketValue,
      price: price || 0,
      savings: savings || 0,
      confidenceScore,
      aiConfidence,
      safeToRecommend: trustResult.safeToRecommend,
      savvyVerifiedSeller: Boolean(item.savvyVerifiedSeller),
      title: item.title,
      itemId: item.itemId != null ? String(item.itemId) : undefined,
      subscriptionTier,
    });
  }, [
    basePoints,
    trustScore,
    bidCount,
    marketValue,
    price,
    savings,
    confidenceScore,
    aiConfidence,
    trustResult.safeToRecommend,
    item.savvyVerifiedSeller,
    item.title,
    item.itemId,
    subscriptionTier,
  ]);

  const effectiveMult = listingMult ?? savvyMultiplier.effectiveMultiplier;

  const rawReward = useMemo(
    () =>
      computeSavvyReward({
        baseSavvy: basePoints,
        trustScore,
        price,
        savings,
        multiplier: effectiveMult,
      }),
    [basePoints, trustScore, price, savings, effectiveMult]
  );

  const { reward, rewardsLocked, betaUnlocked, betaLabel } = useMemo(() => {
    const resolved = applyBetaRewardUnlock({
      reward: rawReward,
      baseSavvy: basePoints,
      trustScore,
      price,
      savings,
      multiplier: effectiveMult,
    });
    return {
      reward: resolved.reward,
      rewardsLocked: resolved.rewardsLocked,
      betaUnlocked: resolved.betaUnlocked,
      betaLabel: resolved.betaLabel,
    };
  }, [rawReward, basePoints, trustScore, price, savings, effectiveMult]);

  const betaRewardsLabel = betaLabel || getBetaRewardsActiveLabel();

  const walletBefore = readMockWalletBalance();
  const walletAfter = walletBefore + reward.boosted;
  const tweenWallet = useTweenTo(walletAfter, walletBefore);

  const streak = readMockStreak();
  const savingsLabel =
    savings != null && savings > 0 && formatPrice
      ? `🔥 SAVE ${formatPrice(savings, currency)}`
      : savings != null && savings > 0
        ? `🔥 SAVE $${Math.round(savings).toLocaleString()}`
        : null;

  const multLabel = `${effectiveMult.toFixed(effectiveMult >= 10 ? 0 : 1)}×`;
  const eliteNextPct = 35 + ((hashStr(item.itemId) + hashStr(item.title)) % 55);

  return (
    <div
      className={`sdr-root ${isElite ? 'sdr-root--elite' : ''} ${mockModel.ecosystemActive ? 'sdr-root--eco' : ''}`}
    >
      <div className="sdr-headline">
        <div className="sdr-headline__row">
          {savingsLabel ? <span className="sdr-save">{savingsLabel}</span> : <span className="sdr-save sdr-save--muted">Savvy rewards</span>}
          {!rewardsLocked ? (
            <span className={`sdr-savvy-amt sdr-glow-pulse${betaUnlocked ? ' sdr-savvy-amt--beta' : ''}`}>
              {betaUnlocked ? `✨ ${betaRewardsLabel}` : `💎 ${formatSavvy(reward.boosted)}`}
            </span>
          ) : (
            <span className="sdr-savvy-amt sdr-savvy-amt--locked">💎 Rewards locked</span>
          )}
          {!rewardsLocked && betaUnlocked ? (
            <span className="sdr-savvy-amt sdr-savvy-amt--beta-est">{formatSavvy(reward.boosted)}</span>
          ) : null}
          {!rewardsLocked && effectiveMult > 1.02 ? (
            <span
              className="sdr-mult sdr-mult-shimmer"
              title="Server-authoritative final Savvy earnings multiplier"
            >
              ⚡ {multLabel} FINAL MULTIPLIER
            </span>
          ) : null}
        </div>

        {mockModel.statusTags.length ? (
          <div className="sdr-tags">
            {mockModel.statusTags.map((t) => (
              <span key={t.key} className="sdr-tag">
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
        ) : null}

        {savvyMultiplier.additiveBonuses?.some((b) => b.type === 'ecosystem') ? (
          <div className="sdr-eco sdr-eco-glow">
            <span className="sdr-eco__icon" aria-hidden>
              🌐
            </span>
            <span className="sdr-eco__text">SAVVY ECOSYSTEM BONUS ACTIVE</span>
            <span className="sdr-eco__mult">
              +
              {savvyMultiplier.additiveBonuses
                .find((b) => b.type === 'ecosystem')
                ?.amount.toFixed(2)}
              × to core earnings
            </span>
          </div>
        ) : null}
      </div>

      {!rewardsLocked ? (
        <div className="sdr-wallet">
          <span className="sdr-wallet__label">Wallet after purchase</span>
          <span className="sdr-wallet__nums">
            <span className="sdr-wallet__from">{walletBefore.toLocaleString()}</span>
            <span className="sdr-wallet__arrow">→</span>
            <span className="sdr-wallet__to sdr-live-counter">{tweenWallet.toLocaleString()}</span>
            <span className="sdr-wallet__unit">Savvy</span>
          </span>
        </div>
      ) : null}

      {isElite ? (
        <div className="sdr-elite">
          <div className="sdr-elite__row">
            <span className="sdr-streak">
              <span className="sdr-streak__flame" aria-hidden>
                🔥
              </span>
              Streak {Math.max(streak, 1)} deals scanned
            </span>
            <span className="sdr-tier-label">Next reward tier</span>
          </div>
          <div className="sdr-tier-bar">
            <div className="sdr-tier-bar__fill" style={{ width: `${eliteNextPct}%` }} />
          </div>
          <div className="sdr-bonus-chain">Bonus chain +{12 + (eliteNextPct % 18)}% until next unlock</div>
        </div>
      ) : null}

      <div className="sdr-scores">
        <div className="sdr-scores__title">Best move signals</div>
        <div className="sdr-scores__grid">
          <div>
            <span>Trust</span>
            <strong>{mockModel.trustScore}</strong>
          </div>
          <div>
            <span>Competition</span>
            <strong>{mockModel.competitionScore}</strong>
          </div>
          <div>
            <span>Market fit</span>
            <strong>{mockModel.marketFitScore}</strong>
          </div>
          <div>
            <span>{SAVVY_SCOUT.shortTitle}</span>
            <strong>{mockModel.savvyAiScore}</strong>
          </div>
          <div className="sdr-scores__reward">
            <span>Reward confidence</span>
            <strong>{mockModel.rewardConfidence}</strong>
          </div>
        </div>
      </div>

      <button type="button" className="sdr-expand-btn" aria-expanded={expanded} onClick={() => setExpanded((x) => !x)}>
        {expanded ? '▼ Hide reward breakdown' : '▶ Estimated rewards'}
      </button>

      {expanded ? (
        <div className="sdr-breakdown">
          <div className="sdr-breakdown__title">Estimated rewards</div>
          <ul className="sdr-breakdown__list">
            {mockModel.breakdown.map((row) => (
              <li key={row.key} className={`sdr-breakdown__line ${toneClass(row.tone)}`}>
                <span>{row.label}</span>
                <span>+{row.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="sdr-breakdown__subtotal">
            <span>Trust-adjusted pool</span>
            <span>{mockModel.subtotalAdditive.toLocaleString()} Savvy</span>
          </div>
          <SavvyMultiplierBreakdown compact className="sdr-breakdown__mult-panel" />
          <div className="sdr-breakdown__note">Reward uses the same server multiplier as your wallet and payout.</div>
        </div>
      ) : null}

      {hideWhyPickedPanel ? null : (
        <WhyPickedPanel
          item={item}
          trustResult={trustResult}
          decision={decision}
          effectiveSavings={Number(effectiveSavings ?? decision?.estimatedSavings) || 0}
        />
      )}
    </div>
  );
}
