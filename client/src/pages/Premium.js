import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSubscriptionPlans,
  subscribeUser,
  trackSubscriptionMetric,
} from '../lib/api';
import { trackUpgradeClicked } from '../lib/analytics';
import {
  getEffectiveSubscriptionTier,
  setCurrentSubscriptionTier,
} from '../lib/tierMultiplier';
import { FINAL10_TIERS, getTierById } from '../lib/final10SubscriptionTiers';
import {
  formatBestMoveUsageLine,
  subscribeBestMoveUsage,
} from '../lib/bestMoveUsage';
import Final10Slogan from '../components/branding/Final10Slogan';
import LoadingState from '../components/ui/states/LoadingState';
import EmptyState from '../components/ui/states/EmptyState';
import { Link } from 'react-router-dom';
import '../styles/subscriptionPlans.css';

const PAID_TIER_IDS = new Set(['core', 'pro']);

function mergePlanWithMarketing(apiPlan) {
  const marketing = getTierById(apiPlan.id);
  return {
    ...marketing,
    ...apiPlan,
    label: apiPlan.label || marketing.name,
    features: apiPlan.features?.length ? apiPlan.features : marketing.features,
    bestMovesLabel: Number.isFinite(apiPlan.bestMovesPerDay)
      ? `${apiPlan.bestMovesPerDay} / day`
      : 'Unlimited',
  };
}

const Premium = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFoundingTester = Boolean(user?.foundingTesterAccess || user?.betaTester || user?.foundingAccess);
  const [billing, setBilling] = useState('monthly');
  const [apiPlans, setApiPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [busyTier, setBusyTier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usageLine, setUsageLine] = useState(() => formatBestMoveUsageLine());

  const currentTier = getEffectiveSubscriptionTier();

  useEffect(() => subscribeBestMoveUsage(() => {
    setUsageLine(formatBestMoveUsageLine());
  }), []);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setPlansLoading(true);
      setError('');
      try {
        const response = await getSubscriptionPlans();
        setApiPlans(response?.plans || []);
      } catch {
        setError('Failed to load plans');
      } finally {
        setPlansLoading(false);
      }
    };
    fetch();
  }, [user]);

  const displayTiers = useMemo(() => {
    const freeTier = FINAL10_TIERS[0];
    const paidFromApi = apiPlans
      .filter((p) => PAID_TIER_IDS.has(p.id))
      .map(mergePlanWithMarketing);
    const paidFallback = FINAL10_TIERS.filter((t) => PAID_TIER_IDS.has(t.id));
    const paid = paidFromApi.length ? paidFromApi : paidFallback;
    return [freeTier, ...paid];
  }, [apiPlans]);

  const onSelectPlan = async (tierId) => {
    if (tierId === 'free') {
      navigate('/auctions');
      return;
    }
    if (isFoundingTester) {
      setMessage('Founding Tester Access is active. Pricing is preview-only during beta.');
      setError('');
      return;
    }
    setBusyTier(tierId);
    setError('');
    setMessage('');
    try {
      trackUpgradeClicked('premium_page_cta', { tierId, billing });
      await trackSubscriptionMetric('upgrade_click', tierId, billing, { source: 'premium_page' });
      if (billing === 'yearly') {
        await trackSubscriptionMetric('yearly_selected', tierId, billing, {});
      }
      const result = await subscribeUser(tierId, billing);
      if (result?.bonusGranted) {
        await trackSubscriptionMetric('bonus_claimed', tierId, billing, { bonus: 'yearly' });
      }
      await trackSubscriptionMetric('conversion_rate', tierId, billing, { converted: true });
      setCurrentSubscriptionTier(String(tierId || '').toLowerCase());
      setMessage(
        `Subscribed to ${result.subscription.tier} (${billing}). Multiplier now ${Number(result.subscription.multiplier).toFixed(2)}×.`
      );
    } catch (e) {
      setError(e?.response?.data?.message || 'Subscription failed. Try again.');
    } finally {
      setBusyTier('');
    }
  };

  if (!user) {
    return (
      <div className="f10-subscription-page">
        <div className="f10-subscription-inner">
          <EmptyState
            className="f10-subscription-guest-gate"
            title="Sign in to upgrade"
            description="Choose a plan that matches your hunt — more Best Moves, faster alerts, and bigger event bonuses."
            action={
              <div className="f10-subscription-guest-actions">
                <Link to="/login" className="btn btn-primary">Log in</Link>
                <Link to="/pricing" className="btn btn-ghost">Compare plans</Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="f10-subscription-page">
      <div className="f10-subscription-inner">
        <div className="f10-subscription-hero">
          <h1>Final10 Membership</h1>
          <p>Choose the plan that matches your hunt. Upgrade for more Best Moves, faster alerts, and bigger event bonuses.</p>
          <Final10Slogan variant="section" as="p" className="f10-subscription-slogan" />
          {isFoundingTester ? (
            <div className="f10-subscription-beta">Founding Tester Access is active. Coming after beta.</div>
          ) : null}
          <div className="f10-subscription-billing" role="group" aria-label="Billing period">
            <button
              type="button"
              className={billing === 'monthly' ? 'is-active-monthly' : ''}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'yearly' ? 'is-active-yearly' : ''}
              onClick={() => setBilling('yearly')}
            >
              Yearly — best value
            </button>
          </div>
        </div>

        <div className="f10-subscription-usage" aria-live="polite">
          {usageLine}
        </div>

        <div className="f10-subscription-grid">
          {plansLoading
            ? [0, 1, 2].map((i) => (
                <article key={`skeleton-${i}`} className="f10-subscription-card f10-subscription-card--skeleton" aria-hidden>
                  <div className="f10-subscription-skeleton-line f10-subscription-skeleton-line--title" />
                  <div className="f10-subscription-skeleton-line" />
                  <div className="f10-subscription-skeleton-line f10-subscription-skeleton-line--price" />
                  <div className="f10-subscription-skeleton-line" />
                  <div className="f10-subscription-skeleton-line" />
                  <div className="f10-subscription-skeleton-cta" />
                </article>
              ))
            : displayTiers.map((tier) => {
            const isFree = tier.id === 'free';
            const isPremium = tier.id === 'core';
            const isPro = tier.id === 'pro';
            const yearly = Number(tier.yearlyPrice || 0);
            const monthly = Number(tier.monthlyPrice || 0);
            const price = billing === 'yearly' && !isFree ? yearly : monthly;
            const savings = Math.max(0, monthly * 12 - yearly);
            const isCurrent = currentTier === tier.id || (isPro && currentTier === 'elite');
            const cardClass = isFree
              ? 'f10-subscription-card--free'
              : isPremium
              ? 'f10-subscription-card--premium is-popular'
              : 'f10-subscription-card--pro';

            return (
              <article
                key={tier.id}
                className={`f10-subscription-card ${cardClass}`}
                aria-label={`${tier.name} plan`}
              >
                {isPremium ? (
                  <span className="f10-subscription-badge f10-subscription-badge--popular">Most popular</span>
                ) : null}
                {isPro ? (
                  <span className="f10-subscription-badge f10-subscription-badge--pro">Full power</span>
                ) : null}
                <header className="f10-subscription-card-hd">
                  <h2 className="f10-subscription-card-name">{tier.name}</h2>
                  <p className="f10-subscription-card-desc">{tier.description}</p>
                </header>
                <div className="f10-subscription-price">
                  {isFree ? '$0' : `$${price}`}
                </div>
                <div className="f10-subscription-price-sub">
                  {isFree ? 'Always available' : billing === 'yearly' ? 'per year' : 'per month'}
                </div>
                {!isFree && billing === 'yearly' && savings > 0 ? (
                  <div className="f10-subscription-savings">Save ${savings} per year</div>
                ) : null}
                <div className="f10-subscription-bestmoves">
                  Best Moves: {tier.bestMovesLabel || (isFree ? '5 / day' : '—')}
                </div>
                {tier.eventBonus ? (
                  <div className="f10-subscription-event">Event bonus: {tier.eventBonus}</div>
                ) : null}
                <ul className="f10-subscription-features">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`f10-subscription-cta ${
                    isFree
                      ? 'f10-subscription-cta--free'
                      : isPremium
                      ? 'f10-subscription-cta--premium'
                      : 'f10-subscription-cta--pro'
                  }`}
                  onClick={() => onSelectPlan(tier.id)}
                  disabled={busyTier === tier.id || (isCurrent && !isFree)}
                >
                  {busyTier === tier.id
                    ? 'Processing…'
                    : isCurrent && !isFree
                    ? 'Current plan'
                    : isFoundingTester && !isFree
                    ? 'Coming after beta'
                    : isFree
                    ? 'Continue free'
                    : `Upgrade to ${tier.name}`}
                </button>
              </article>
            );
          })}
        </div>

        <div className="f10-subscription-footnote">
          <h2>Double &amp; Triple Points</h2>
          <p>
            Free members earn standard event multipliers. Premium adds +10% (2.2× / 3.3×). Pro adds +25% (2.5× / 3.75×) during active events.
          </p>
        </div>

        {message ? <div className="f10-subscription-msg f10-subscription-msg--ok">{message}</div> : null}
        {error ? <div className="f10-subscription-msg f10-subscription-msg--err">{error}</div> : null}
      </div>
    </div>
  );
};

export default Premium;
