import React, { useEffect, useMemo, useState } from 'react';
import { useParty } from '../../context/PartyContext';
import { useAuth } from '../../context/AuthContext';
import '../../styles/PartySystem.css';

/**
 * PartyPanel — the full Squad Sync page content:
 *   • Create / join / leave controls
 *   • Invite by userId (real "friends picker" is plugged in later — this
 *     UI already accepts a follower userId and validates eligibility)
 *   • Start / end session
 *   • Live session widgets: team average, boost, energy, members, feed
 *   • Post-session summary
 */
export default function PartyPanel() {
  const { user } = useAuth();
  const {
    party,
    members,
    summary,
    loading,
    error,
    createParty,
    leaveParty,
    startSession,
    endSession,
    loadSummary,
    invite,
    refresh,
  } = useParty();

  const [busy, setBusy] = useState('');
  const [localError, setLocalError] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [partyName, setPartyName] = useState('Squad');

  const isHost = useMemo(
    () => party && user && String(party.hostUserId) === String(user._id || user.id),
    [party, user]
  );

  useEffect(() => {
    if (party?.status === 'cooldown' || party?.status === 'ended') {
      loadSummary().catch(() => {});
    }
  }, [party?.status, loadSummary]);

  const run = async (label, fn) => {
    setBusy(label);
    setLocalError('');
    try {
      await fn();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Something went wrong';
      setLocalError(msg);
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="sq-panel">
        <p>Loading Squad Sync…</p>
      </div>
    );
  }

  // ---- No party: create screen -----------------------------------------
  if (!party) {
    return (
      <div className="sq-panel">
        <div className="sq-hero">
          <h1>Squad Sync</h1>
          <p>
            Earn together. Build <strong>Sync Energy</strong> with your friends
            to unlock a shared Squad Boost — live for 30 minutes per session.
          </p>
        </div>

        <div className="sq-card">
          <h3>Create your squad</h3>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            Max 5 members. You can invite anyone who follows you back.
          </p>
          <input
            className="sq-invite__input"
            placeholder="Squad name (e.g. Closer Crew)"
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            maxLength={40}
          />
          <div className="sq-actions">
            <button
              className="sq-btn sq-btn--primary"
              disabled={!!busy}
              onClick={() => run('create', () => createParty(partyName || 'Squad'))}
            >
              {busy === 'create' ? 'Creating…' : 'Create Squad'}
            </button>
          </div>
          {localError ? <div className="sq-warn">{localError}</div> : null}
        </div>
      </div>
    );
  }

  // ---- Has party: live view --------------------------------------------
  const boost = Number(party.currentPartyBoost) || 0;
  const formulaBoost = Number(party.formulaBoost) || 0;
  const energyCap = Number(party.energyBoostCap) || 0;
  const energyPct = Math.round((party.energyPct || 0) * 100);
  const activeSet = new Set((party.activeMemberIds || []).map(String));

  return (
    <div className="sq-panel">
      <div className="sq-hero">
        <h1>{party.name || 'Squad Sync'}</h1>
        <p>
          {party.status === 'active'
            ? `Live session — ${formatCountdown(party.sessionMsLeft)} remaining`
            : party.status === 'cooldown'
            ? `Cooling down — new session in ${formatCountdown(party.cooldownMsLeft)}`
            : 'Ready when you are. Start a session to unlock Squad Boost.'}
        </p>
      </div>

      {party.boostDisabled ? (
        <div className="sq-warn">
          ⚠ Squad Boost disabled this session
          {party.boostDisabledReason ? ` (${party.boostDisabledReason.replace(/_/g, ' ')})` : ''}.
          Wait for the next session.
        </div>
      ) : null}

      <div className="sq-grid">
        {/* Members */}
        <div className="sq-card">
          <h3>Members ({members.length}/{party.maxMembers})</h3>
          <div className="sq-members">
            {members.map((m) => (
              <div className="sq-member" key={m.id}>
                <div className="sq-member__left">
                  <span className="sq-avatar">
                    {(m.firstName || m.username || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span>{m.firstName || m.username || 'Member'}</span>
                  {String(m.id) === String(party.hostUserId) ? (
                    <span className="sq-member__host">HOST</span>
                  ) : null}
                </div>
                <span
                  className={
                    activeSet.has(String(m.id))
                      ? 'sq-member__active'
                      : 'sq-member__inactive'
                  }
                  title={activeSet.has(String(m.id)) ? 'Active' : 'Idle'}
                />
              </div>
            ))}
          </div>

          <div className="sq-actions">
            {isHost && party.status === 'idle' ? (
              <button
                className="sq-btn sq-btn--primary"
                disabled={!!busy || members.length < 2}
                onClick={() => run('start', startSession)}
              >
                {busy === 'start' ? 'Starting…' : 'Start Session'}
              </button>
            ) : null}

            {isHost && party.status === 'active' ? (
              <button
                className="sq-btn sq-btn--danger"
                disabled={!!busy}
                onClick={() => run('end', endSession)}
              >
                {busy === 'end' ? 'Ending…' : 'End Session'}
              </button>
            ) : null}

            <button
              className="sq-btn sq-btn--ghost"
              disabled={!!busy}
              onClick={() => run('leave', leaveParty)}
            >
              {busy === 'leave' ? 'Leaving…' : 'Leave Squad'}
            </button>

            <button
              className="sq-btn sq-btn--ghost"
              disabled={!!busy}
              onClick={() => run('refresh', refresh)}
            >
              Refresh
            </button>
          </div>

          {localError ? <div className="sq-warn">{localError}</div> : null}
        </div>

        {/* Live stats */}
        <div className="sq-card">
          <h3>Live Stats</h3>
          <div className="sq-stat">
            <span>Team average</span>
            <strong>{(Number(party.teamAverage) || 1).toFixed(2)}x</strong>
          </div>
          <div className="sq-stat">
            <span>{party.activeCount || 0} friends active</span>
            <strong>{activeSet.size ? `${activeSet.size}/${members.length}` : '—'}</strong>
          </div>
          <div className="sq-stat">
            <span>Formula boost</span>
            <strong>+{formulaBoost.toFixed(2)}x</strong>
          </div>
          <div className="sq-stat">
            <span>Energy cap</span>
            <strong>+{energyCap.toFixed(2)}x</strong>
          </div>
          <div className="sq-stat">
            <span>Squad Boost</span>
            <strong style={{ color: '#facc15' }}>
              {boost > 0 ? `+${boost.toFixed(2)}x` : '—'}
            </strong>
          </div>

          <div className="sq-energy" style={{ marginTop: 10 }}>
            <div className="sq-energy__label">
              <span>Sync Energy</span>
              <span>{energyPct}%</span>
            </div>
            <div className="sq-energy__bar">
              <div
                className="sq-energy__fill"
                style={{ width: `${energyPct}%` }}
              />
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              Build Sync Energy to raise your boost
            </p>
          </div>
        </div>

        {/* Invite */}
        {isHost ? (
          <div className="sq-card">
            <h3>Invite a friend</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>
              Only mutual followers with a 24h+ account can join.
            </p>
            <input
              className="sq-invite__input"
              placeholder="Friend user ID"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
            />
            <div className="sq-actions">
              <button
                className="sq-btn sq-btn--primary"
                disabled={!!busy || !inviteId.trim()}
                onClick={() =>
                  run('invite', async () => {
                    const res = await invite(inviteId.trim());
                    setInviteResult(res);
                  })
                }
              >
                {busy === 'invite' ? 'Checking…' : 'Check Invite'}
              </button>
            </div>

            {inviteResult?.ok ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: 'rgba(34, 211, 238, 0.08)',
                  border: '1px solid rgba(34, 211, 238, 0.35)',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                ✓ {inviteResult.invitee?.firstName || inviteResult.invitee?.username} can join.
                Send them the squad link: <code>/party/{party.partyId}</code>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Recent party actions */}
        {party.status === 'active' ? (
          <div className="sq-card">
            <h3>Recent Squad Actions</h3>
            <div className="sq-feed">
              {(party.recentEvents || []).length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>
                  No actions yet. Save, share, or purchase deals to build Sync Energy.
                </p>
              ) : (
                (party.recentEvents || []).map((ev, idx) => (
                  <div className="sq-feed__row" key={idx}>
                    <span>
                      <em>{memberNameById(members, ev.userId)}</em>{' '}
                      {prettyEvent(ev.eventType)}
                    </span>
                    <span>
                      +{ev.savvyEarned || 0} savvy · ⚡{ev.energyGranted || 0}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* Post-session summary */}
        {(party.status === 'cooldown' || party.status === 'ended') && summary ? (
          <div className="sq-card">
            <h3>Session Summary</h3>
            <div className="sq-summary__grid">
              <div className="sq-summary__tile">
                <small>Total squad savvy</small>
                <strong>{summary.totalSavvy || 0}</strong>
              </div>
              <div className="sq-summary__tile">
                <small>Top contributor</small>
                <strong>
                  {summary.topContributor
                    ? memberNameById(members, summary.topContributor.userId)
                    : '—'}
                </strong>
              </div>
              <div className="sq-summary__tile">
                <small>Best deal</small>
                <strong>
                  {summary.bestDealRefId
                    ? String(summary.bestDealRefId).slice(0, 18)
                    : '—'}
                </strong>
              </div>
              <div className="sq-summary__tile">
                <small>Peak boost</small>
                <strong>
                  {summary.peakBoost
                    ? `+${Number(summary.peakBoost).toFixed(2)}x`
                    : '—'}
                </strong>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <div className="sq-warn" style={{ marginTop: 12 }}>{error}</div> : null}
    </div>
  );
}

function memberNameById(members, id) {
  const m = (members || []).find((x) => String(x.id) === String(id));
  return m?.firstName || m?.username || 'Member';
}

function prettyEvent(t) {
  switch (t) {
    case 'save_deal': return 'saved a deal';
    case 'share_deal': return 'shared a deal';
    case 'purchase_clickout': return 'clicked through to buy';
    case 'verified_reward': return 'completed a verified reward';
    default: return t;
  }
}

function formatCountdown(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}
