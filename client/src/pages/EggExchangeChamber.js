import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEggExchangeStatus, performEggExchange } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SAVVY_AUTH_REFRESH_REQUEST, useSavvyPoints } from '../store/savvyStore';
import { isRateLimitError } from '../lib/apiErrorParsing';
import { shouldShowAdminNav } from '../lib/adminAccess';
import LoadingState from '../components/ui/states/LoadingState';
import EggExchangeAdminPanel from '../components/perk/EggExchangeAdminPanel';
import '../styles/EggExchange.css';

const SCOUT_IMG = '/assets/perk-machine/savvy-scout-alive.png';

const TIER_CLASS = {
  rare: 'egg-exchange-card--rare',
  epic: 'egg-exchange-card--epic',
  legendary: 'egg-exchange-card--legendary',
  mythic: 'egg-exchange-card--mythic',
};

function ExchangeCard({ option, onExchange, exchanging, successId, savvyBalance }) {
  const tierClass = TIER_CLASS[option.toTier] || '';
  const busy = exchanging === option.exchangeType;
  const justSucceeded = successId === option.exchangeType;
  const savvyDisplay = savvyBalance != null ? savvyBalance : option.savvyBalance;

  return (
    <article className={`egg-exchange-card ${tierClass} ${justSucceeded ? 'egg-exchange-card--success' : ''}`}>
      <header className="egg-exchange-card__head">
        <span className="egg-exchange-card__tier">{option.title}</span>
        <span className="egg-exchange-card__output">→ 1 {option.outputLabel}</span>
      </header>

      <div className="egg-exchange-card__stats">
        <div className="egg-exchange-card__stat">
          <span className="egg-exchange-card__label">{option.fromTier} eggs</span>
          <strong>
            {option.eggsOwned} / {option.eggsRequired}
          </strong>
        </div>
        <div className="egg-exchange-card__stat">
          <span className="egg-exchange-card__label">Savvy</span>
          <strong>
            {Number(savvyDisplay).toLocaleString()} / {option.savvyRequired.toLocaleString()}
          </strong>
        </div>
      </div>

      <div className="egg-exchange-card__bar" aria-hidden>
        <div className="egg-exchange-card__fill" style={{ width: `${option.progressPercent}%` }} />
      </div>
      <p className="egg-exchange-card__progress">{option.progressPercent}% fusion ready</p>

      <button
        type="button"
        className="egg-exchange-card__btn"
        disabled={!option.canExchange || busy}
        onClick={() => onExchange(option.exchangeType)}
      >
        {busy ? 'Fusing…' : option.canExchange ? 'Exchange' : 'Requirements not met'}
      </button>

      {!option.canExchange ? (
        <p className="egg-exchange-card__hint">
          {option.missingEggs > 0 ? `Need ${option.missingEggs} more ${option.fromTier} eggs. ` : ''}
          {option.missingSavvy > 0 ? `Need ${option.missingSavvy.toLocaleString()} more Savvy.` : ''}
        </p>
      ) : null}

      {justSucceeded ? (
        <div className="egg-exchange-card__burst" aria-live="polite">
          ✨ Fused into {option.outputLabel}!
        </div>
      ) : null}
    </article>
  );
}

export default function EggExchangeChamber() {
  const { user, refreshProfile, loading: authLoading } = useAuth();
  const { savvyPoints: storeSavvyPoints } = useSavvyPoints();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exchanging, setExchanging] = useState(null);
  const [successId, setSuccessId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const exchangeLock = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await getEggExchangeStatus();
      setStatus(data);
      setError('');
      return data;
    } catch (e) {
      if (!isRateLimitError(e)) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load Egg Exchange.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!shouldShowAdminNav(user)) return;
    setShowAdmin(true);
  }, [user]);

  const handleExchange = useCallback(
    async (exchangeType) => {
      if (exchangeLock.current) return;
      exchangeLock.current = true;
      setExchanging(exchangeType);
      setError('');
      try {
        const result = await performEggExchange(exchangeType);
        setStatus(result.status || status);
        setSuccessId(exchangeType);
        window.dispatchEvent(new CustomEvent(SAVVY_AUTH_REFRESH_REQUEST));
        if (typeof refreshProfile === 'function') await refreshProfile();
        window.setTimeout(() => setSuccessId(null), 2800);
      } catch (e) {
        if (!isRateLimitError(e)) {
          setError(e?.response?.data?.message || e?.message || 'Exchange failed.');
        }
      } finally {
        setExchanging(null);
        window.setTimeout(() => {
          exchangeLock.current = false;
        }, 500);
      }
    },
    [refreshProfile, status]
  );

  /** Same source as floating Savvy HUD + Perk Machine balance pill. */
  const savvyBalance = useMemo(() => {
    if (authLoading || !user) return null;
    return Math.round(
      Number(
        (Number.isFinite(storeSavvyPoints) ? storeSavvyPoints : null) ??
          user?.savvyPoints ??
          0
      )
    );
  }, [authLoading, user, storeSavvyPoints]);

  const exchanges = useMemo(() => {
    const rows = status?.exchanges || [];
    if (savvyBalance == null) return rows;
    return rows.map((opt) => {
      const hasEggs = Number(opt.eggsOwned) >= Number(opt.eggsRequired);
      const hasSavvy = savvyBalance >= Number(opt.savvyRequired);
      const progressEggs = Math.min(100, Math.round((Number(opt.eggsOwned) / Number(opt.eggsRequired)) * 100));
      const progressSavvy = Math.min(
        100,
        Math.round((savvyBalance / Number(opt.savvyRequired)) * 100)
      );
      return {
        ...opt,
        savvyBalance,
        canExchange: hasEggs && hasSavvy,
        missingSavvy: Math.max(0, Number(opt.savvyRequired) - savvyBalance),
        progressPercent: Math.min(progressEggs, progressSavvy),
      };
    });
  }, [status?.exchanges, savvyBalance]);

  if (loading) {
    return (
      <div className="egg-exchange-page">
        <LoadingState message="Opening Egg Exchange Chamber…" />
      </div>
    );
  }

  const savvyHeaderLabel =
    savvyBalance == null ? 'Loading...' : savvyBalance.toLocaleString();

  return (
    <div className="egg-exchange-page">
      <div className="egg-exchange-page__glow" aria-hidden />

      <header className="egg-exchange-header">
        <div>
          <p className="egg-exchange-header__kicker">Final10 Perk Machine</p>
          <h1 className="egg-exchange-header__title">🧪 Egg Exchange Chamber</h1>
          <p className="egg-exchange-header__subtitle">Fuse your collection into higher-tier rewards.</p>
        </div>
        <div className="egg-exchange-header__balance">
          <span>Savvy Balance</span>
          <strong>{savvyHeaderLabel}</strong>
        </div>
      </header>

      <aside className="egg-exchange-scout">
        <img src={SCOUT_IMG} alt="" aria-hidden className="egg-exchange-scout__img" />
        <p className="egg-exchange-scout__line">
          &ldquo;Operator, every egg counts. Fuse enough and unlock something legendary.&rdquo;
        </p>
      </aside>

      {error ? (
        <div className="egg-exchange-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="egg-exchange-grid">
        {exchanges.map((option) => (
          <ExchangeCard
            key={option.exchangeType}
            option={option}
            savvyBalance={savvyBalance}
            onExchange={handleExchange}
            exchanging={exchanging}
            successId={successId}
          />
        ))}
      </div>

      {status?.recentHistory?.length ? (
        <section className="egg-exchange-history" aria-labelledby="egg-exchange-history-heading">
          <h2 id="egg-exchange-history-heading" className="egg-exchange-history__title">
            Exchange History
          </h2>
          <ul className="egg-exchange-history__list">
            {status.recentHistory.map((row) => (
              <li key={row.exchangeId}>
                <span>{row.outputLabel}</span>
                <span>
                  −{row.eggsSpent} {row.fromTier} · −{row.savvySpent.toLocaleString()} Savvy
                </span>
                <time>{new Date(row.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="egg-exchange-nav">
        <Link to="/perk-machine#egg-hatchery">← Back to Hatchery</Link>
        <Link to="/events">Events Hub</Link>
      </nav>

      {showAdmin ? <EggExchangeAdminPanel onRefresh={loadStatus} /> : null}
    </div>
  );
}
