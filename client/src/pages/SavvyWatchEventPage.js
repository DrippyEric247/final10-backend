import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getSavvyWatchEvent,
  getSavvyWatchSession,
  joinSavvyWatchEvent,
  savvyWatchHeartbeat,
  claimSavvyWatchCheckpoint,
  redeemSavvyWatchLiveCode,
  getSavvyWatchCompetitionEntries,
  voteSavvyWatchEntry,
} from '../lib/api';
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
  const { token } = useAuth();
  const [page, setPage] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [liveCodeInput, setLiveCodeInput] = useState('');
  const [selectedComp, setSelectedComp] = useState(null);
  const [entries, setEntries] = useState([]);
  const [welcome, setWelcome] = useState(false);
  const heartbeatRef = useRef(null);

  const joinSource = searchParams.get('src') || 'direct';
  const returnPath = `/watch/${eventSlug}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSavvyWatchEvent(eventSlug);
      setPage(data);
      if (token) {
        const sess = await getSavvyWatchSession(eventSlug);
        setSession(sess);
      } else {
        setSession(null);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load Savvy Watch event.');
    } finally {
      setLoading(false);
    }
  }, [eventSlug, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('welcome') === '1') setWelcome(true);
  }, [searchParams]);

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
    return <div className="sw-page sw-error">{error || 'Event not found.'}</div>;
  }

  const { event, competitions = [] } = page;
  const checkpoints = session?.checkpoints || [];
  const nextCheckpoint = checkpoints.find((c) => !c.claimed && c.eligible && c.kind === 'presence');

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

      {welcome && (
        <section className="sw-welcome">
          <h2>Welcome to Savvy Universe</h2>
          <p>You joined through: {event.title}</p>
        </section>
      )}

      {error && <div className="sw-alert">{error}</div>}

      <YouTubeEmbed videoId={event.youtubeVideoId} />
      {event.platformUrl && (
        <a className="sw-yt-link" href={event.platformUrl} target="_blank" rel="noreferrer">
          Open on YouTube
        </a>
      )}

      {!session?.joined ? (
        <section className="sw-card">
          <h2>{token ? 'Join Event' : 'Join Savvy Watch'}</h2>
          <p>Earn Savvy through verified event participation — not guaranteed YouTube watch time.</p>
          <button type="button" className="sw-btn sw-btn-primary" disabled={busy} onClick={handleJoin}>
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
