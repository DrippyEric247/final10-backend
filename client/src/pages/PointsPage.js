// src/pages/PointsPage.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppConfig } from '../lib/useAppConfig';
import { useSavvyPoints } from '../store/savvyStore';
import { useAuth } from '../context/AuthContext';
import { SavvyPointsIcon } from '../components/rewards/SavvyPointsIcon';
import { formatDollarValue } from '../lib/savvyValue';
import {
  SAVVY_CREDIT_EVENT,
  SAVVY_STORE_ITEMS,
  convertPointsToCredits,
  getSavvyCreditState,
  redeemSavvyStoreItem,
} from '../lib/savvyCredits';
import { getLifetimeLeaderboard, getMyPoints, redeemPointsDiscount } from '../lib/api';
import { parseApiError } from '../lib/apiErrorParsing';
import LoadingState from '../components/ui/states/LoadingState';
import ErrorState from '../components/ui/states/ErrorState';
import EmptyState from '../components/ui/states/EmptyState';

// tiny helpers
const fmt = n => (n ?? 0).toLocaleString();
const pct = n => `${Math.round((n ?? 0) * 100)}%`;

export default function PointsPage() {
  const { cfg, loading: configLoading, error: configError, reload: reloadConfig } = useAppConfig();               // trialDays, multipliers, badgeTiers, discountRatio, etc.
  const { refreshProfile } = useAuth();
  const { savvyPoints, spendPoints } = useSavvyPoints();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [lifetime, setLifetime] = useState(0);
  const [badges, setBadges] = useState([]);
  const [history, setHistory] = useState([]);
  const [trial, setTrial] = useState(null);

  // leaderboard preview
  const [leaders, setLeaders] = useState([]);

  // redeem UI
  const [redeemAmt, setRedeemAmt] = useState('');
  const [toast, setToast] = useState('');

  // countdown text
  const [countdown, setCountdown] = useState('');
  const [creditState, setCreditState] = useState(() => getSavvyCreditState());
  const [convertInput, setConvertInput] = useState('');
  const [coinPulse, setCoinPulse] = useState(false);
  const actionsToday = useMemo(
    () => history.filter(item => {
      const t = new Date(item.createdAt || 0).getTime();
      if (!t) return false;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return t >= start;
    }).length,
    [history]
  );

  const loadWallet = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const me = await getMyPoints();
      void refreshProfile();
      setLifetime(me.lifetimePointsEarned || 0);
      setBadges(me.badges || []);
      setHistory(me.recent || []);
      setTrial(me.trial || null);
      try {
        const list = await getLifetimeLeaderboard();
        setLeaders(Array.isArray(list) ? list.slice(0, 5) : []);
      } catch (leaderErr) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch leaderboard:', leaderErr);
        }
        setLeaders([]);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch points data:', error);
      }
      setFetchError(error);
      setLifetime(0);
      setBadges([]);
      setHistory([]);
      setTrial(null);
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  // trial countdown (minutes precision)
  useEffect(() => {
    if (!trial?.isActive || !trial?.endsAt) return;
    const tick = () => {
      const ms = new Date(trial.endsAt) - new Date();
      if (ms <= 0) { setCountdown('Expired'); return; }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setCountdown(`${d}d ${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [trial]);

  useEffect(() => {
    const onCredit = () => setCreditState(getSavvyCreditState());
    window.addEventListener(SAVVY_CREDIT_EVENT, onCredit);
    return () => window.removeEventListener(SAVVY_CREDIT_EVENT, onCredit);
  }, []);

  // derived: example discount preview
  const discountPreview = useMemo(() => {
    const pts = parseInt(redeemAmt || '0', 10);
    if (!Number.isFinite(pts) || !cfg?.discountRatio) return '$0.00';
    const usd = pts * cfg.discountRatio;
    return `$${usd.toFixed(2)}`;
  }, [redeemAmt, cfg]);

  const redeem = async () => {
    const amount = parseInt(redeemAmt || '0', 10);
    if (!amount || amount <= 0) return setToast('Enter a positive number of points.');
    if (amount > savvyPoints) return setToast('Not enough points to redeem.');

    const body = {
      amount,
      auctionId: window.__AUCTION_ID__ || 'demo-auction',
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const resp = await redeemPointsDiscount(body);

      if (resp?.ok) {
        setToast(`Redeemed ${fmt(amount)} points → ${resp.discountUSD ? `$${resp.discountUSD.toFixed(2)} off` : 'applied'}`);
        try {
          const me = await getMyPoints();
          await refreshProfile();
          setLifetime(me.lifetimePointsEarned || 0);
          setBadges(me.badges || []);
          setHistory(me.recent || []);
        } catch {
          /* refresh best-effort */
        }
        setRedeemAmt('');
      } else {
        setToast(resp?.error || 'Redeem failed');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('Redeem error:', error);
      }
      const parsed = parseApiError(error);
      const genericAxios =
        typeof parsed.message === 'string' &&
        /^Request failed with status code\b/i.test(parsed.message);
      setToast(
        parsed.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : genericAxios
            ? 'Could not redeem points. Please try again.'
            : parsed.message
      );
    }
    setTimeout(() => setToast(''), 2500);
  };

  const convertToCredits = () => {
    const pts = Math.max(0, Math.round(Number(convertInput) || 0));
    const ok = window.confirm(`Convert ${pts.toLocaleString()} Savvy to $${formatDollarValue(pts)} credit?`);
    if (!ok) return;
    const result = convertPointsToCredits(pts, savvyPoints);
    if (!result.ok) {
      setToast(result.reason || 'Could not convert points');
      setTimeout(() => setToast(''), 2800);
      return;
    }
    spendPoints(pts, 'Convert to credit');
    setCreditState(result.creditState);
    setConvertInput('');
    setCoinPulse(true);
    setTimeout(() => setCoinPulse(false), 1200);
    setToast(`Converted ${pts.toLocaleString()} Savvy → $${formatDollarValue(pts)} credit`);
    setTimeout(() => setToast(''), 2800);
  };

  const redeemStoreItem = (itemId) => {
    const item = SAVVY_STORE_ITEMS.find((x) => x.id === itemId);
    if (!item) return;
    const text = `Spend ${item.costSavvy.toLocaleString()} Savvy for ${item.label}?`;
    if (!window.confirm(text)) return;
    const result = redeemSavvyStoreItem(itemId, savvyPoints);
    if (!result.ok) {
      setToast(result.reason || 'Redemption failed');
      setTimeout(() => setToast(''), 2800);
      return;
    }
    spendPoints(item.costSavvy, item.label || 'Store redeem');
    setCreditState(result.creditState);
    setCoinPulse(true);
    setTimeout(() => setCoinPulse(false), 1300);
    setToast(`Redeemed: ${item.label}`);
    setTimeout(() => setToast(''), 2800);
  };

  if (configLoading || loading) {
    return (
      <div className="container" style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
        <LoadingState label={configLoading ? "Loading app config..." : "Loading Savvy wallet..."} />
      </div>
    );
  }

  if (configError || !cfg) {
    return (
      <div className="container" style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
        <ErrorState
          title="Couldn't load app configuration"
          description="Final10 couldn't reach the production API. Please verify API URL settings and try again."
          error={configError}
          onRetry={reloadConfig}
          retryLabel="Retry config load"
        />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="container" style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
        <ErrorState
          title="Couldn't load wallet"
          description="Your Savvy balance and activity couldn't be refreshed. Check your connection and try again."
          error={fetchError}
          onRetry={() => void loadWallet()}
          retryLabel="Retry"
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
      {toast && (
        <div style={{
          background: '#111', color: '#fff', padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          border: '1px solid #333'
        }}>{toast}</div>
      )}

      {/* Hero */}
      <section style={{ marginBottom: 24, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a' }}>
        <h2 style={{ margin: '0 0 6px' }}>Final10 is Live</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>Final10 is part of the Savvy Universe. More apps. More rewards. Same balance.</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <a className="btn" href="/auctions">Browse Auctions</a>
          <a className="btn btn-outline" href="/profile#savvy-balance">View Savvy Balance</a>
        </div>
      </section>

      {/* Trial banner */}
      {trial?.isActive ? (
        <section style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: '#0b2a12', color: '#c6ffd1', border: '1px solid #1f6f33' }}>
          <strong>Free Trial Active</strong> — {cfg.trialDays} days · Bonus {pct(cfg.trialBonusMultiplier)}
          {countdown && countdown !== 'Expired' ? <span style={{ marginLeft: 8, opacity: 0.9 }}>• Ends in {countdown}</span> : null}
          <button
            onClick={() => (window.location = '/premium')}
            style={{ marginLeft: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #2da160', background: '#1a7f43', color: '#fff' }}
          >
            Keep the Boost
          </button>
        </section>
      ) : (
        <section style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: '#2a1a1a', color: '#ffd5d5', border: '1px solid #6f2a2a' }}>
          <strong>Trial Ended</strong> — Upgrade to keep accelerated earnings.
          <button
            onClick={() => (window.location = '/premium')}
            style={{ marginLeft: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #b54', background: '#a33', color: '#fff' }}
          >
            Get Premium (+{pct(cfg.premiumBonusMultiplier)})
          </button>
        </section>
      )}

      {/* Free vs Premium Quick Comparison */}
      <section style={{ marginBottom: 24, padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Free vs Premium</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Free Tier */}
          <div style={{ padding: 16, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <h4 style={{ margin: '0 0 12px', color: '#60a5fa' }}>Free Tier</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ 5 searches per day</li>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Basic auction browsing</li>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Daily tasks & points</li>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Community features</li>
            </ul>
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 'bold', color: '#60a5fa' }}>$0/month</div>
          </div>

          {/* Premium Tier */}
          <div style={{ padding: 16, borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <h4 style={{ margin: '0 0 12px', color: '#a855f7' }}>Premium</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Unlimited searches</li>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Premium auction access</li>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Advanced filters & AI</li>
              <li style={{ marginBottom: 8, fontSize: 14, color: '#d1d5db' }}>✓ Priority support</li>
            </ul>
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 'bold', color: '#a855f7' }}>$7/month</div>
          </div>
        </div>
        
        {/* Multi-App Future */}
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>🚀</span>
            <strong style={{ color: '#22c55e' }}>Coming Soon: Multi-App Subscription</strong>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#d1d5db' }}>
            One plan, multiple industries: E-commerce, Real Estate, Automotive, and more. 
            Shared points system across all platforms!
          </p>
          <a 
            href="/pricing" 
            style={{ 
              color: '#22c55e', 
              textDecoration: 'none', 
              fontSize: 14, 
              fontWeight: '500' 
            }}
          >
            View detailed pricing →
          </a>
        </div>
      </section>

      {/* Balance & Redeem */}
      <section className="card" style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <SavvyPointsIcon size={18} glow animated={coinPulse} />
          Savvy Balance
        </h3>
        <div style={{ marginTop: -4, marginBottom: 12, fontSize: 13, color: '#93c5fd' }}>
          Savvy points carry across the ecosystem.
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ opacity: 0.8 }}>Position Balance</div>
            <div style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <SavvyPointsIcon size={16} glow animated={coinPulse} />
              {fmt(savvyPoints)} Savvy
            </div>
            <div
              style={{ marginTop: 3, fontSize: 13, color: '#fcd34d' }}
              title="Savvy value can be used for rewards and discounts across supported experiences."
            >
              ≈ ${formatDollarValue(savvyPoints)} value
            </div>
          </div>
          <div>
            <div style={{ opacity: 0.8 }}>Lifetime Stacked</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{fmt(lifetime)}</div>
          </div>
          <div>
            <div style={{ opacity: 0.8 }}>Badges</div>
            <div>
              {badges?.length
                ? badges.map(b => (
                    <span key={b.name} style={{ padding: '2px 8px', border: '1px solid #333', borderRadius: 999, marginRight: 6 }}>
                      {b.name}
                    </span>
                  ))
                : <span style={{ opacity: 0.7 }}>None yet</span>}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            value={redeemAmt}
            onChange={e => setRedeemAmt(e.target.value)}
            placeholder="Enter points to redeem"
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #444', minWidth: 220 }}
          />
          <button onClick={redeem} className="btn" disabled={!redeemAmt}>
            Redeem → ({discountPreview} off)
          </button>
          <div style={{ opacity: 0.8 }}>Your Savvy balance is persistent across the Savvy Universe.</div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0 }}>Savvy Credits</h3>
        <div style={{ color: '#d1d5db', fontSize: 14, marginBottom: 10 }}>
          Credit balance: <strong style={{ color: '#fef3c7' }}>${formatDollarValue(creditState.creditCents / 100, true)}</strong>
          {creditState.premiumDays > 0 ? (
            <span style={{ marginLeft: 8, color: '#a5f3fc' }}>• Premium days: {creditState.premiumDays}</span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="number"
            min="0"
            value={convertInput}
            onChange={(e) => setConvertInput(e.target.value)}
            placeholder="Convert Savvy to credit"
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #444', minWidth: 220 }}
          />
          <button onClick={convertToCredits} className="btn" disabled={!convertInput}>
            Convert ({convertInput ? `$${formatDollarValue(convertInput)}` : '$0.00'})
          </button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0 }}>Savvy Store</h3>
        <p style={{ marginTop: 0, color: '#9ca3af', fontSize: 13 }}>
          Safe redemption only. No direct cash-outs.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {SAVVY_STORE_ITEMS.map((item) => (
            <div key={item.id} style={{ border: '1px solid #374151', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#f3f4f6' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.costSavvy.toLocaleString()} Savvy required</div>
              </div>
              <button className="btn btn-outline" onClick={() => redeemStoreItem(item.id)} disabled={savvyPoints < item.costSavvy}>
                Redeem
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0 }}>This Week Snapshot</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Top users this week</div>
            <div style={{ marginTop: 4, fontWeight: 700, color: '#e2e8f0' }}>{leaders.length ? `${leaders.length} active leaders tracked` : 'Leaderboard warming up'}</div>
          </div>
          <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Actions completed today</div>
            <div style={{ marginTop: 4, fontWeight: 700, color: '#fef3c7' }}>{actionsToday}</div>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="card" style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
        {history?.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.map((item, index) => (
              <li key={`history-${item._id || index}-${index}`} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 999,
                  border: '1px solid #333', textTransform: 'capitalize'
                }}>
                  {item.type.replace('_',' ')}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {(item.type === 'redeem' || item.type === 'transfer_out' ? '-' : '+')}{fmt(item.amount)}
                </span>
                <span style={{ opacity: 0.7 }}>{new Date(item.createdAt).toLocaleString()}</span>
                {item.source ? <span style={{ opacity: 0.7 }}>• {item.source}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No activity yet"
            description="Earn Savvy from auctions, tasks, and streaks — it will show up here."
            className="f10-state--inline text-left items-stretch max-w-none"
          />
        )}
      </section>

      {/* Leaderboard preview */}
      <section className="card" style={{ marginBottom: 32, padding: 16, borderRadius: 12, border: '1px solid #2a2a2a' }}>
        <h3 style={{ marginTop: 0 }}>Top Earners — Lifetime (Top 5)</h3>
        {leaders?.length ? (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {leaders.map((u, i) => (
              <li key={`leader-${u._id || u.username || i}-${i}`} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>@{u.username}</span>
                <span style={{ fontWeight: 600 }}>{fmt(u.lifetimePointsEarned)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title="Leaderboard warming up"
            description="Top lifetime earners will appear here once rankings sync."
            action={
              <button type="button" className="f10-state__retry" onClick={() => void loadWallet()}>
                Refresh
              </button>
            }
            className="f10-state--inline text-left items-stretch max-w-none"
          />
        )}
        <div style={{ marginTop: 10 }}>
          <a className="btn btn-outline" href="/leaderboard">View Full Leaderboard</a>
        </div>
      </section>

      <footer style={{ opacity: 0.7, textAlign: 'center', padding: '24px 0' }}>
        © {new Date().getFullYear()} Final10 · Stay Earning. Stay Savvy.
      </footer>
    </div>
  );
}









