// src/pages/PointsPage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useAppConfig } from '../lib/useAppConfig';

// tiny helpers
const fmt = n => (n ?? 0).toLocaleString();
const pct = n => `${Math.round((n ?? 0) * 100)}%`;

export default function PointsPage() {
  const cfg = useAppConfig();               // trialDays, multipliers, badgeTiers, discountRatio, etc.
  const [loading, setLoading] = useState(true);

  // user data
  const [balance, setBalance] = useState(0);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = localStorage.getItem('f10_token');
        const response = await fetch('http://localhost:5000/api/points/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            console.warn('Rate limited, will retry later');
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const me = await response.json();
        if (!mounted) return;
        setBalance(me.pointsBalance || 0);
        setLifetime(me.lifetimePointsEarned || 0);
        setBadges(me.badges || []);
        setHistory(me.recent || []);
        setTrial(me.trial || null);
      } catch (error) {
        console.error('Failed to fetch points data:', error);
        if (!mounted) return;
        // Set default values on error
        setBalance(0);
        setLifetime(0);
        setBadges([]);
        setHistory([]);
        setTrial(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // leaderboard preview (top 5) - with error handling
    fetch('http://localhost:5000/api/leaderboard/lifetime')
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 429) {
            console.warn('Rate limited on leaderboard, will retry later');
            return [];
          }
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
      })
      .then(list => setLeaders(Array.isArray(list) ? list.slice(0, 5) : []))
      .catch(error => {
        console.error('Failed to fetch leaderboard:', error);
        setLeaders([]);
      });

    return () => { mounted = false; };
  }, []);

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
    if (amount > balance) return setToast('Not enough points to redeem.');

    const body = {
      amount,
      auctionId: window.__AUCTION_ID__ || 'demo-auction',
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const token = localStorage.getItem('f10_token');
      const response = await fetch('http://localhost:5000/api/points/redeem', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setToast('Too many requests. Please wait a moment and try again.');
          setTimeout(() => setToast(''), 2500);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resp = await response.json();

      if (resp?.ok) {
        setToast(`Redeemed ${fmt(amount)} points → ${resp.discountUSD ? `$${resp.discountUSD.toFixed(2)} off` : 'applied'}`);
        // refresh me
        const meResponse = await fetch('http://localhost:5000/api/points/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (meResponse.ok) {
          const me = await meResponse.json();
          setBalance(me.pointsBalance || 0);
          setLifetime(me.lifetimePointsEarned || 0);
          setBadges(me.badges || []);
          setHistory(me.recent || []);
        }
        setRedeemAmt('');
      } else {
        setToast(resp?.error || 'Redeem failed');
      }
    } catch (error) {
      console.error('Redeem error:', error);
      setToast('Network error. Please try again.');
    }
    setTimeout(() => setToast(''), 2500);
  };

  if (!cfg) return <div style={{ padding: 24 }}>Loading config…</div>;
  if (loading) return <div style={{ padding: 24 }}>Loading points…</div>;

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
        <p style={{ margin: 0, opacity: 0.9 }}>AI-powered auctions, SavvyPoints, and product-first social.</p>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <a className="btn" href="/auctions">Browse Auctions</a>
          <a className="btn btn-outline" href="/points">View Points</a>
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
        <h3 style={{ marginTop: 0 }}>Points</h3>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ opacity: 0.8 }}>Balance</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(balance)} SavvyPoints</div>
          </div>
          <div>
            <div style={{ opacity: 0.8 }}>Lifetime Earned</div>
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
          <div style={{ opacity: 0.8 }}>Redeemable on any Final10 auction.</div>
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
          <div style={{ opacity: 0.7 }}>No activity yet.</div>
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
          <div style={{ opacity: 0.7 }}>Leaderboard warming up…</div>
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









