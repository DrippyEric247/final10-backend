import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Flame, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getSubscriptionPlans,
  subscribeUser,
  trackSubscriptionMetric,
} from '../lib/api';
import { trackUpgradeClicked } from '../lib/analytics';
import { setCurrentSubscriptionTier } from '../lib/tierMultiplier';

const Premium = () => {
  const { user } = useAuth();
  const isFoundingTester = Boolean(user?.foundingTesterAccess || user?.betaTester || user?.foundingAccess);
  const [billing, setBilling] = useState('yearly');
  const [plans, setPlans] = useState([]);
  const [busyTier, setBusyTier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const response = await getSubscriptionPlans();
        setPlans(response?.plans || []);
      } catch (e) {
        setError('Failed to load plans');
      }
    };
    fetch();
  }, [user]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.monthlyPrice) - Number(b.monthlyPrice)),
    [plans]
  );

  const onSelectPlan = async (tierId) => {
    if (isFoundingTester) {
      setMessage("Founding Tester Access is active. Pricing is preview-only during beta. Coming after beta.");
      setError("");
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
        `Subscribed to ${result.subscription.tier} (${billing}). Multiplier now ${result.subscription.multiplier.toFixed(2)}x.`
      );
    } catch (e) {
      setError(e?.response?.data?.message || 'Subscription failed. Try again.');
    } finally {
      setBusyTier('');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 pt-20">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-300">
          Log in to upgrade.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white">Final10 Advantage Plans</h1>
            <p className="mt-2 text-gray-300">
              You are not paying, you are gaining an advantage.
            </p>
            {isFoundingTester ? (
              <div className="mt-3 inline-block rounded-lg border border-amber-300/45 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100">
                Founding Tester Access is active. Coming after beta.
              </div>
            ) : null}
            <div className="mt-4 inline-flex rounded-xl border border-gray-600 p-1">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-bold ${billing === 'monthly' ? 'bg-purple-500 text-white' : 'text-gray-300'}`}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-bold ${billing === 'yearly' ? 'bg-amber-400 text-gray-900' : 'text-gray-300'}`}
                onClick={() => setBilling('yearly')}
              >
                Yearly 🔥 BEST VALUE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedPlans.map((plan) => {
              const yearly = Number(plan.yearlyPrice);
              const monthly = Number(plan.monthlyPrice);
              const price = billing === 'yearly' ? yearly : monthly;
              const savings = Math.max(0, monthly * 12 - yearly);
              const isPopular = billing === 'yearly' && plan.id === 'pro';
              const isFullPower = billing === 'yearly' && plan.id === 'elite';
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-5 ${isPopular ? 'border-purple-400 bg-purple-500/10' : isFullPower ? 'border-amber-300 bg-amber-500/10' : 'border-gray-700 bg-gray-800/70'}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-extrabold text-white">{String(plan.label || plan.id).toUpperCase()}</h3>
                    {isPopular ? <span className="text-xs font-bold text-purple-200">🔥 MOST POPULAR</span> : null}
                    {isFullPower ? <span className="text-xs font-bold text-amber-200">⚡ FULL POWER</span> : null}
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">${price}</div>
                  <div className="text-xs text-gray-300">{billing === 'yearly' ? 'per year' : 'per month'}</div>
                  {billing === 'yearly' ? (
                    <div className="mt-2 text-xs font-semibold text-emerald-300">
                      Save ${savings} per year
                    </div>
                  ) : null}
                  <ul className="mt-3 space-y-1 text-sm text-gray-200">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" />{plan.multiplier}x multiplier</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" />Best Moves: {Number.isFinite(plan.bestMovesPerDay) ? plan.bestMovesPerDay : 'Unlimited'}</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" />Alerts: {Number.isFinite(plan.alertsMax) ? plan.alertsMax : 'Unlimited'} ({plan.alertsSpeed})</li>
                  </ul>
                  <button
                    type="button"
                    className={`mt-4 w-full rounded-lg px-4 py-2 font-bold ${isFullPower ? 'bg-amber-300 text-gray-900' : 'bg-purple-500 text-white'}`}
                    onClick={() => onSelectPlan(plan.id)}
                    disabled={busyTier === plan.id}
                  >
                    {busyTier === plan.id ? 'Processing...' : isFoundingTester ? 'Coming after beta' : `Upgrade to ${String(plan.label || plan.id).toUpperCase()}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-cyan-400/35 bg-cyan-500/10 p-5">
            <div className="text-lg font-extrabold text-white">Why upgrade?</div>
            <div className="mt-3 grid gap-2 text-sm text-cyan-100 md:grid-cols-2">
              <div className="flex items-center gap-2"><Zap className="h-4 w-4" />Earn more Savvy per action</div>
              <div className="flex items-center gap-2"><Crown className="h-4 w-4" />Unlock better deals faster</div>
              <div className="flex items-center gap-2"><Flame className="h-4 w-4" />Automated alerts</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" />Higher multipliers</div>
            </div>
            <div className="mt-3 text-sm font-semibold text-amber-200">
              Lock your price forever (early users only).
            </div>
            {billing === 'yearly' ? (
              <div className="mt-2 text-xs text-emerald-200">
                Yearly bonus: +1000 Savvy Points, +0.25 multiplier boost, Early Adopter badge.
              </div>
            ) : null}
          </div>

          {message ? <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-200">{message}</div> : null}
          {error ? <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200">{error}</div> : null}
        </motion.div>
      </div>
    </div>
  );
};

export default Premium;
