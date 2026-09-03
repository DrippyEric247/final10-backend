import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasAdminRole } from '../lib/adminAccess';
import {
  listSavvyWatchAdminEvents,
  createSavvyWatchGtaPreset,
  updateSavvyWatchEventStatus,
  createSavvyWatchLiveCode,
  updateSavvyWatchCompetitionStatus,
  lockSavvyWatchCompetition,
  awardSavvyWatchCompetition,
  getSavvyWatchEvent,
} from '../lib/api';
import '../styles/SavvyWatch.css';

const STATUS_ACTIONS = ['scheduled', 'live', 'ended', 'archived', 'cancelled'];
const COMP_STATUS_ACTIONS = ['entries_open', 'entries_closed', 'voting_open', 'voting_closed'];

export default function SavvyWatchAdminPage() {
  const { user, loading } = useAuth();
  const show = hasAdminRole(user);
  const [events, setEvents] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [presetForm, setPresetForm] = useState({
    slug: 'gta-car-meet-001',
    youtubeVideoId: '',
    platformUrl: '',
    hostDisplayName: '',
  });
  const [liveCodeForm, setLiveCodeForm] = useState({ reward: 10, maxClaims: 500, expiresInMinutes: 15 });

  const refreshEvents = useCallback(async () => {
    try {
      const data = await listSavvyWatchAdminEvents();
      setEvents(data.events || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load events.');
    }
  }, []);

  const loadDetail = useCallback(async (slug) => {
    if (!slug) return;
    try {
      const data = await getSavvyWatchEvent(slug);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  }, []);

  useEffect(() => {
    if (show) refreshEvents();
  }, [show, refreshEvents]);

  useEffect(() => {
    if (selectedSlug) loadDetail(selectedSlug);
  }, [selectedSlug, loadDetail]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      setMessage('Action completed.');
      await refreshEvents();
      if (selectedSlug) await loadDetail(selectedSlug);
      return result;
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Action failed.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createPreset = () =>
    run(() =>
      createSavvyWatchGtaPreset({
        slug: presetForm.slug.trim(),
        youtubeVideoId: presetForm.youtubeVideoId.trim() || undefined,
        platformUrl: presetForm.platformUrl.trim() || undefined,
        hostDisplayName: presetForm.hostDisplayName.trim() || undefined,
      })
    );

  const setEventStatus = (status) => run(() => updateSavvyWatchEventStatus(selectedSlug, status));

  const spawnLiveCode = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await createSavvyWatchLiveCode(selectedSlug, {
        reward: Number(liveCodeForm.reward) || 10,
        maxClaims: Number(liveCodeForm.maxClaims) || 500,
        durationMinutes: Number(liveCodeForm.expiresInMinutes) || 15,
        label: 'SAVVY CHECK',
      });
      const code = result?.liveCode?.code;
      setMessage(code ? `Live code created: ${code}` : 'Live code created.');
      await refreshEvents();
      if (selectedSlug) await loadDetail(selectedSlug);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="sw-page sw-loading">Loading…</div>;
  if (!show) {
    return (
      <div className="sw-page">
        <p>Admin access required.</p>
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.slug === selectedSlug);
  const competitions = detail?.competitions || [];

  return (
    <div className="sw-page sw-admin">
      <header className="sw-header">
        <div className="sw-badge">SAVVY WATCH ADMIN</div>
        <h1>Host Control Panel</h1>
        <p className="sw-muted">
          <Link to="/admin">← Admin Hub</Link>
        </p>
      </header>

      {error && <div className="sw-alert">{error}</div>}
      {message && <div className="sw-welcome">{message}</div>}

      <section className="sw-card">
        <h2>Create GTA Car Meet Preset</h2>
        <div className="sw-admin-form">
          <label>
            Slug
            <input value={presetForm.slug} onChange={(e) => setPresetForm({ ...presetForm, slug: e.target.value })} />
          </label>
          <label>
            YouTube Video ID
            <input
              value={presetForm.youtubeVideoId}
              onChange={(e) => setPresetForm({ ...presetForm, youtubeVideoId: e.target.value })}
            />
          </label>
          <label>
            YouTube URL
            <input
              value={presetForm.platformUrl}
              onChange={(e) => setPresetForm({ ...presetForm, platformUrl: e.target.value })}
            />
          </label>
          <label>
            Host display name
            <input
              value={presetForm.hostDisplayName}
              onChange={(e) => setPresetForm({ ...presetForm, hostDisplayName: e.target.value })}
            />
          </label>
        </div>
        <button type="button" className="sw-btn sw-btn-primary" disabled={busy} onClick={createPreset}>
          Create Event from Preset
        </button>
      </section>

      <section className="sw-card">
        <h2>Events</h2>
        <ul className="sw-admin-events">
          {events.map((ev) => (
            <li key={ev.eventId}>
              <button type="button" className={selectedSlug === ev.slug ? 'active' : ''} onClick={() => setSelectedSlug(ev.slug)}>
                {ev.title} — {ev.status}
              </button>
              <Link to={`/watch/${ev.slug}`} target="_blank" rel="noreferrer">
                Open
              </Link>
              <Link to={`/watch/${ev.slug}/overlay`} target="_blank" rel="noreferrer">
                Overlay
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {selectedEvent && (
        <>
          <section className="sw-card">
            <h2>{selectedEvent.title}</h2>
            <p>Status: {selectedEvent.status}</p>
            <p>
              Public URL:{' '}
              <a href={`/watch/${selectedEvent.slug}`} target="_blank" rel="noreferrer">
                /watch/{selectedEvent.slug}
              </a>
            </p>
            <p>QR resolves to: /watch/{selectedEvent.slug}?src=stream-qr</p>
            <div className="sw-admin-actions">
              {STATUS_ACTIONS.map((st) => (
                <button key={st} type="button" className="sw-btn sw-btn-sm" disabled={busy} onClick={() => setEventStatus(st)}>
                  {st}
                </button>
              ))}
            </div>
          </section>

          <section className="sw-card">
            <h2>Live Code — SAVVY CHECK</h2>
            <div className="sw-admin-form">
              <label>
                Reward
                <input
                  type="number"
                  value={liveCodeForm.reward}
                  onChange={(e) => setLiveCodeForm({ ...liveCodeForm, reward: e.target.value })}
                />
              </label>
              <label>
                Max claims
                <input
                  type="number"
                  value={liveCodeForm.maxClaims}
                  onChange={(e) => setLiveCodeForm({ ...liveCodeForm, maxClaims: e.target.value })}
                />
              </label>
              <label>
                Expires (minutes)
                <input
                  type="number"
                  value={liveCodeForm.expiresInMinutes}
                  onChange={(e) => setLiveCodeForm({ ...liveCodeForm, expiresInMinutes: e.target.value })}
                />
              </label>
            </div>
            <button type="button" className="sw-btn sw-btn-primary" disabled={busy} onClick={spawnLiveCode}>
              Generate Live Code
            </button>
          </section>

          <section className="sw-card">
            <h2>Competitions</h2>
            <ul className="sw-admin-comps">
              {competitions.map((comp) => (
                <li key={comp.competitionId}>
                  <strong>{comp.title}</strong> — {comp.status} ({comp.votingMode})
                  <div className="sw-admin-actions">
                    {COMP_STATUS_ACTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        className="sw-btn sw-btn-sm"
                        disabled={busy}
                        onClick={() => run(() => updateSavvyWatchCompetitionStatus(comp.competitionId, st))}
                      >
                        {st}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="sw-btn sw-btn-sm"
                      disabled={busy}
                      onClick={() => run(() => lockSavvyWatchCompetition(comp.competitionId))}
                    >
                      Lock results
                    </button>
                    <button
                      type="button"
                      className="sw-btn sw-btn-sm"
                      disabled={busy}
                      onClick={() => run(() => awardSavvyWatchCompetition(comp.competitionId))}
                    >
                      Award prizes
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
