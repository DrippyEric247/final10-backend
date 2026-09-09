import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasAdminRole } from '../lib/adminAccess';
import {
  getSavvyWatchEvent,
  getSavvyWatchSession,
  joinSavvyWatchEvent,
  recordSavvyWatchQrVisit,
  claimSavvyWatchLiveWelcomeBonus,
  getSavvyWatchLiveWelcomeBonusStatus,
  savvyWatchHeartbeat,
  claimSavvyWatchCheckpoint,
  redeemSavvyWatchLiveCode,
  getSavvyWatchCompetitionEntries,
  voteSavvyWatchEntry,
} from '../lib/api';
import SavvyPredictionsSection from '../components/SavvyPredictionsSection';
import SavvyWatchStartingSoonRoom from '../components/SavvyWatchStartingSoonRoom';
import SavvyWatchEndedRoom from '../components/SavvyWatchEndedRoom';
import '../styles/SavvyWatch.css';

function formatMinutes(seconds) {
  const m = Math.floor(Number(seconds || 0) / 60);
  return `${m} MIN`;
}

function YouTubeEmbed({ videoId }) {
  if (!videoId) {
    return (
      <div className="sw-stream-placeholder">
        <p>Stream embed unavailable — open the YouTube link below.</p>
      </div>
    );
  }
  const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=0&rel=0`;
  return (
    <div className="sw-stream-wrap">
      <iframe
        title="Savvy Watch Live"
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export default function SavvyWatchEventPage() {
  const { eventSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [page, setPage] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [liveCodeInput, setLiveCodeInput] = useState('');
  const [selectedComp, setSelectedComp] = useState(null);
  const [entries, setEntries] = useState([]);
  const [welcome, setWelcome] = useState(false);
  const [liveWelcomeBonus, setLiveWelcomeBonus] = useState(null);
  const [bonusStatus, setBonusStatus] = useState(null);
  const [liveTransition, setLiveTransition] = useState(null);
  const heartbeatRef = useRef(null);
  const qrFlowRef = useRef(false);
  const liveJoinRef = useRef(false);
  const pollRef = useRef(null);

  const joinSource = searchParams.get('src') || searchParams.get('source') || 'direct';
  const streamQr = joinSource === 'stream-qr';
  const homepageLive = joinSource === 'homepage-live';
  const returnPath = `/watch/${eventSlug}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const lifecyclePhase = page?.lifecyclePhase || page?.event?.lifecyclePhase;

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await getSavvyWatchEvent(eventSlug);
      setPage(data);
      if (token) {
        const sess = await getSavvyWatchSession(eventSlug);
        setSession(sess);
        if (streamQr) {
          try {
            const status = await getSavvyWatchLiveWelcomeBonusStatus(eventSlug);
            setBonusStatus(status);
          } catch {
            setBonusStatus(null);
          }
        }
      } else {
        setSession(null);
        setBonusStatus(null);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load Savvy Watch event.');
      setPage(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [eventSlug, token, streamQr]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('welcome') === '1') setWelcome(true);
  }, [searchParams]);

  useEffect(() => {
    if (!streamQr || !eventSlug) return undefined;
    recordSavvyWatchQrVisit(eventSlug, { source: 'stream-qr' }).catch(() => {});
    return undefined;
  }, [eventSlug, streamQr]);

  useEffect(() => {
    if (!token || !page?.event || !streamQr || qrFlowRef.current || loading) return undefined;
    if (lifecyclePhase === 'ended') return undefined;

    qrFlowRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        if (lifecyclePhase === 'live' && !session?.joined) {
          await joinSavvyWatchEvent(eventSlug, { source: 'stream-qr' });
        }
        const bonus = await claimSavvyWatchLiveWelcomeBonus(eventSlug, { source: 'stream-qr' });
        if (cancelled) return;
        if (bonus.awarded) {
          setLiveWelcomeBonus(bonus);
          setWelcome(true);
        } else if (bonus.alreadyClaimed) {
          setLiveWelcomeBonus(bonus);
        } else if (bonus.reason === 'EVENT_ENDED') {
          setLiveWelcomeBonus(bonus);
        }
        await refresh({ silent: true });
      } catch (e) {
        if (!cancelled) {
          qrFlowRef.current = false;
          if (lifecyclePhase !== 'starting_soon') {
            setError(e?.response?.data?.message || e.message || 'Could not complete live welcome flow.');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, page?.event, session?.joined, streamQr, eventSlug, loading, lifecyclePhase, refresh]);

  useEffect(() => {
    if (!token || !page?.event || lifecyclePhase !== 'live' || session?.joined || loading) return undefined;
    if (streamQr || !homepageLive) return undefined;
    if (page?.featureFlags?.adminOnly && user && !hasAdminRole(user)) return undefined;
    if (liveJoinRef.current) return undefined;

    liveJoinRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        await joinSavvyWatchEvent(eventSlug, { source: 'homepage-live' });
        if (cancelled) return;
        await refresh({ silent: true });
      } catch (e) {
        if (!cancelled) {
          liveJoinRef.current = false;
          setError(e?.response?.data?.message || e.message || 'Could not join Savvy Watch event.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    page?.event,
    page?.featureFlags?.adminOnly,
    session?.joined,
    streamQr,
    homepageLive,
    eventSlug,
    loading,
    lifecyclePhase,
    user,
    refresh,
  ]);

  useEffect(() => {
    if (lifecyclePhase !== 'starting_soon') {
      if (pollRef.current) clearInterval(pollRef.current);
      return undefined;
    }

    const poll = async () => {
      try {
        const data = await getSavvyWatchEvent(eventSlug);
        const nextPhase = data.lifecyclePhase || data.event?.lifecyclePhase;
        if (nextPhase === 'live') {
          setPage(data);
          setLiveTransition({ active: true, countdown: 3 });
        }
      } catch {
        /* non-blocking */
      }
    };

    pollRef.current = setInterval(poll, 15000);
    return () => clearInterval(pollRef.current);
  }, [lifecyclePhase, eventSlug]);

  const enterLiveEvent = useCallback(async () => {
    setLiveTransition(null);
    setLoading(true);
    try {
      if (token && streamQr && !session?.joined) {
        await joinSavvyWatchEvent(eventSlug, { source: 'stream-qr' });
      }
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Could not enter live event.');
      setLoading(false);
    }
  }, [token, streamQr, session?.joined, eventSlug, refresh]);

  const handleJoin = async () => {
    if (!token) {
      navigate('/login', { state: { returnTo: returnPath } });
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await joinSavvyWatchEvent(eventSlug, { source: joinSource });
      const sess = await getSavvyWatchSession(eventSlug);
      setSession({ ...sess, joined: true, ...result });
      if (result?.joinReward?.savvyAmount) setWelcome(true);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Could not join event.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!token || !session?.joined || page?.event?.status !== 'live') {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return undefined;
    }

    const tick = async () => {
      try {
        const visible = document.visibilityState === 'visible';
        const result = await savvyWatchHeartbeat(eventSlug, { visible, interacted: false });
        setSession((prev) => ({
          ...prev,
          ...result,
          joined: true,
          verifiedActiveSeconds: result.verifiedActiveSeconds,
          savvyEarned: result.savvyEarned,
          checkpoints: result.checkpoints,
        }));
      } catch {
        /* non-blocking */
      }
    };

    tick();
    heartbeatRef.current = setInterval(tick, 45000);
    return () => clearInterval(heartbeatRef.current);
  }, [token, session?.joined, page?.event?.status, eventSlug]);

  const claimCheckpoint = async (checkpointId) => {
    setBusy(true);
    try {
      await claimSavvyWatchCheckpoint(eventSlug, checkpointId);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Claim failed.');
    } finally {
      setBusy(false);
    }
  };

  const redeemCode = async () => {
    setBusy(true);
    try {
      await redeemSavvyWatchLiveCode(eventSlug, liveCodeInput.trim());
      setLiveCodeInput('');
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Code redemption failed.');
    } finally {
      setBusy(false);
    }
  };

  const openCompetition = async (comp) => {
    setSelectedComp(comp);
    try {
      const data = await getSavvyWatchCompetitionEntries(eventSlug, comp.slug);
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    }
  };

  const voteEntry = async (entryId) => {
    if (!selectedComp) return;
    setBusy(true);
    try {
      await voteSavvyWatchEntry(eventSlug, selectedComp.slug, entryId);
      await openCompetition(selectedComp);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Vote failed.');
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = useMemo(() => `${window.location.origin}/watch/${eventSlug}`, [eventSlug]);

  const shareEvent = async () => {
    const text = 'Car meet is live. Join Savvy Watch, participate, vote, and earn Savvy.';
    if (navigator.share) {
      try {
        await navigator.share({ title: page?.event?.title || 'Savvy Watch', text, url: shareUrl });
        return;
      } catch {
        /* fallback */
      }
    }
    await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
  };

  if (loading && !page) {
    return <div className="sw-page sw-loading">Loading Savvy Watch…</div>;
  }

  if (!page?.event) {
    return <div className="sw-page sw-error">{error || 'Savvy Watch event not found.'}</div>;
  }

  const { event, competitions = [], predictions = [], featureFlags = {} } = page;

  if (lifecyclePhase === 'starting_soon') {
    return (
      <SavvyWatchStartingSoonRoom
        event={event}
        token={token}
        user={user}
        returnPath={returnPath}
        streamQr={streamQr}
        liveWelcomeBonus={liveWelcomeBonus}
        bonusStatus={bonusStatus}
        liveTransition={liveTransition}
        onEnterLive={enterLiveEvent}
      />
    );
  }

  if (lifecyclePhase === 'ended') {
    return (
      <SavvyWatchEndedRoom
        event={event}
        competitions={competitions}
        predictions={predictions}
      />
    );
  }

  const checkpoints = session?.checkpoints || [];
  const nextCheckpoint = checkpoints.find((c) => !c.claimed && c.eligible && c.kind === 'presence');
  const adminPreviewMode = Boolean(featureFlags.adminOnly) && token && user && !hasAdminRole(user);

  return (
    <div className="sw-page">
      <header className="sw-header">
        <div className="sw-badge">SAVVY WATCH LIVE</div>
        <h1>{event.title}</h1>
        {event.hostDisplayName && <p className="sw-host">Host: {event.hostDisplayName}</p>}
        <p className="sw-status">Status: {event.status.toUpperCase()}</p>
        <p className="sw-participants">
          {event.savvyWatchParticipants ?? 0} {event.participationMetricLabel || 'Savvy Watch Participants'}
        </p>
      </header>

      {liveWelcomeBonus?.awarded && (
        <section className="sw-live-bonus">
          <div className="sw-live-bonus-badge">+500 SAVVY — LIVE WELCOME BONUS</div>
          <p>You&apos;re ready to vote and make predictions.</p>
          {liveWelcomeBonus.newBalance != null ? (
            <p className="sw-muted">Balance: <strong>{liveWelcomeBonus.newBalance} Savvy</strong></p>
          ) : null}
        </section>
      )}

      {welcome && !liveWelcomeBonus?.awarded && (
        <section className="sw-welcome">
          <h2>Welcome to Savvy Universe</h2>
          <p>You joined through: {event.title}</p>
        </section>
      )}

      {liveWelcomeBonus?.alreadyClaimed && !liveWelcomeBonus?.awarded && streamQr && (
        <section className="sw-welcome sw-welcome-muted">
          <p>Live welcome bonus already claimed for this account.</p>
        </section>
      )}

      {adminPreviewMode && (
        <div className="sw-alert">
          Savvy Watch is in admin preview mode. Public participation is not open yet for this account.
        </div>
      )}

      {error && !adminPreviewMode && <div className="sw-alert">{error}</div>}

      <YouTubeEmbed videoId={event.youtubeVideoId} />
      {event.platformUrl && (
        <a className="sw-yt-link" href={event.platformUrl} target="_blank" rel="noreferrer">
          Open on YouTube
        </a>
      )}

      {!session?.joined ? (
        <section className="sw-card">
          <h2>{token ? 'Join Event' : 'Join Savvy Watch'}</h2>
          <p>
            Watch the stream, vote, make free-entry predictions, enter competitions, redeem Savvy Check codes,
            and earn eligible Savvy rewards through verified participation.
          </p>
          <button
            type="button"
            className="sw-btn sw-btn-primary"
            disabled={busy || adminPreviewMode}
            onClick={handleJoin}
          >
            {token ? 'JOIN EVENT' : 'SIGN IN TO JOIN'}
          </button>
          {!token && (
            <p className="sw-muted">
              New here? <Link to="/register" state={{ returnTo: returnPath }}>Create account</Link>
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="sw-card sw-progress">
            <h2>Verified Event Participation</h2>
            <div className="sw-stat-big">{formatMinutes(session.verifiedActiveSeconds)}</div>
            <p className="sw-earned">Current Savvy earned: <strong>{session.savvyEarned ?? 0} Savvy</strong></p>
            {nextCheckpoint && (
              <p className="sw-next">Next checkpoint: {nextCheckpoint.label}</p>
            )}
            <ul className="sw-checkpoints">
              {checkpoints.map((cp) => (
                <li key={cp.id} className={cp.claimed ? 'claimed' : cp.eligible ? 'eligible' : ''}>
                  <span>{cp.label} (+{cp.savvyReward})</span>
                  {cp.claimed ? (
                    <span className="sw-tag">Claimed</span>
                  ) : cp.eligible ? (
                    <button type="button" className="sw-btn sw-btn-sm" disabled={busy} onClick={() => claimCheckpoint(cp.id)}>
                      Claim
                    </button>
                  ) : (
                    <span className="sw-tag muted">Locked</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="sw-card">
            <h2>SAVVY CHECK</h2>
            <p>Enter the live code announced during the stream.</p>
            <div className="sw-code-row">
              <input
                value={liveCodeInput}
                onChange={(e) => setLiveCodeInput(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={12}
              />
              <button type="button" className="sw-btn" disabled={busy || !liveCodeInput.trim()} onClick={redeemCode}>
                Redeem
              </button>
            </div>
          </section>
        </>
      )}

      <SavvyPredictionsSection
        eventSlug={eventSlug}
        predictions={predictions}
        token={token}
        featureEnabled={featureFlags.predictionsEnabled}
      />

      <section className="sw-card">
        <h2>Live Competitions</h2>
        <div className="sw-comp-list">
          {competitions.map((comp) => (
            <button key={comp.competitionId || comp.slug} type="button" className="sw-comp-chip" onClick={() => openCompetition(comp)}>
              {comp.title}
            </button>
          ))}
        </div>
        {selectedComp && (
          <div className="sw-comp-detail">
            <h3>{selectedComp.title}</h3>
            <p>{selectedComp.description}</p>
            {selectedComp.status === 'voting_open' ? (
              <ul className="sw-entries">
                {entries.map((entry) => (
                  <li key={entry.entryId}>
                    <strong>{entry.displayName}</strong>
                    {entry.vehicleName && <span> — {entry.vehicleName}</span>}
                    <button type="button" className="sw-btn sw-btn-sm" disabled={busy} onClick={() => voteEntry(entry.entryId)}>
                      Vote ({entry.voteCount || 0})
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sw-muted">Voting status: {selectedComp.status}</p>
            )}
          </div>
        )}
      </section>

      <section className="sw-card sw-share">
        <button type="button" className="sw-btn sw-btn-primary" onClick={shareEvent}>
          Share Savvy Watch
        </button>
        {token && (
          <Link className="sw-overlay-link" to="/savvy-watch/history">
            Savvy Watch History
          </Link>
        )}
        <Link className="sw-overlay-link" to={`/watch/${eventSlug}/overlay/predictions`}>
          Predictions Overlay
        </Link>
        <Link className="sw-overlay-link" to={`/watch/${eventSlug}/overlay`}>
          OBS Overlay
        </Link>
      </section>

      <p className="sw-disclaimer">
        Rewards reflect verified Savvy Watch event participation on Final10. We do not claim to verify exact YouTube watch time.
      </p>
    </div>
  );
}
