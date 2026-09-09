import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function SavvyWatchStartingSoonRoom({
  event,
  token,
  user,
  returnPath,
  streamQr,
  liveWelcomeBonus,
  bonusStatus,
  onEnterLive,
  liveTransition,
}) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(liveTransition?.countdown ?? null);

  useEffect(() => {
    if (!liveTransition?.active) return undefined;
    setCountdown(liveTransition.countdown ?? 3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timer);
          onEnterLive?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [liveTransition?.active, liveTransition?.countdown, onEnterLive]);

  const titleUpper = String(event?.title || 'Savvy Watch Event').toUpperCase();
  const savvyBalance = Math.round(Number(user?.savvyPoints) || 0);
  const bonusClaimed = Boolean(liveWelcomeBonus?.awarded || liveWelcomeBonus?.alreadyClaimed || bonusStatus?.claimed);
  const bonusAwarded = Boolean(liveWelcomeBonus?.awarded);

  const handleAuth = () => {
    navigate('/login', { state: { returnTo: returnPath } });
  };

  if (liveTransition?.active) {
    return (
      <div className="sw-page sw-lifecycle sw-live-transition">
        <section className="sw-lifecycle-card sw-live-flash">
          <div className="sw-live-dot" aria-hidden>🔴</div>
          <h1>WE&apos;RE LIVE</h1>
          <p>Savvy Watch is open.</p>
          {countdown > 0 ? (
            <p className="sw-countdown">Entering live event in {countdown}…</p>
          ) : (
            <button type="button" className="sw-btn sw-btn-primary" onClick={onEnterLive}>
              ENTER LIVE EVENT
            </button>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="sw-page sw-lifecycle sw-starting-soon">
      <header className="sw-lifecycle-header">
        <div className="sw-badge">SAVVY WATCH</div>
        <h1 className="sw-event-title">{titleUpper}</h1>
        <div className="sw-status-pill sw-status-soon">STARTING SOON</div>
      </header>

      <section className="sw-lifecycle-card">
        <p className="sw-lifecycle-lead">THE MEET IS ABOUT TO GO LIVE.</p>

        <div className="sw-reward-callout">
          <span className="sw-reward-icon" aria-hidden>🎁</span>
          <strong>500 SAVVY LIVE JOIN BONUS</strong>
        </div>

        <p className="sw-lifecycle-copy">
          Join Final10 now and get ready to vote, predict, and participate when the event goes live.
        </p>

        {bonusAwarded ? (
          <div className="sw-live-bonus">
            <div className="sw-live-bonus-badge">+500 SAVVY — LIVE WELCOME BONUS</div>
            <p>You&apos;re ready to vote and make predictions.</p>
          </div>
        ) : bonusClaimed ? (
          <p className="sw-ready-note">Live welcome bonus already claimed for this account.</p>
        ) : streamQr && token ? (
          <p className="sw-ready-note">500 Savvy will be awarded when you claim your live welcome bonus.</p>
        ) : streamQr ? (
          <p className="sw-ready-note">500 Savvy ready to claim after you join.</p>
        ) : null}

        {!token ? (
          <>
            <button type="button" className="sw-btn sw-btn-primary sw-btn-hero" onClick={handleAuth}>
              JOIN + GET 500 SAVVY
            </button>
            <p className="sw-muted sw-auth-hint">
              New here?{' '}
              <Link to="/register" state={{ returnTo: returnPath }}>
                Create account
              </Link>
            </p>
          </>
        ) : (
          <div className="sw-ready-panel">
            <div className="sw-ready-check">✓ YOU&apos;RE READY</div>
            <p className="sw-balance-line">
              Current balance: <strong>{savvyBalance} Savvy</strong>
            </p>
            <p className="sw-muted">We&apos;ll notify you here when the stream goes live — no rescan needed.</p>
          </div>
        )}
      </section>

      <p className="sw-scout-brand">Powered by Savvy Scout · Final10</p>
    </div>
  );
}
