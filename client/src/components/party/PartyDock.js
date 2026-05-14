import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useParty } from '../../context/PartyContext';
import '../../styles/PartySystem.css';

/**
 * PartyDock — compact floating widget showing Squad Sync status.
 * Hidden when the user isn't in a party.
 */
export default function PartyDock() {
  const { party, members } = useParty();
  const [collapsed, setCollapsed] = useState(false);

  if (!party) return null;

  const status = party.status; // idle | active | cooldown | ended
  const active = status === 'active';
  const cooldown = status === 'cooldown';
  const energyPct = Math.round((party.energyPct || 0) * 100);
  const boost = Number(party.currentPartyBoost) || 0;
  const boostLabel = boost > 0 ? `+${boost.toFixed(2)}x` : '—';
  const activeCount = party.activeCount || 0;

  if (collapsed) {
    return (
      <div className="sq-dock sq-dock--collapsed" role="status" aria-label="Squad Sync">
        <div className="sq-dock__head" style={{ margin: 0 }}>
          <span className="sq-dock__title">
            <span
              className={`sq-dock__dot ${
                active ? 'sq-dock__dot--active' : cooldown ? 'sq-dock__dot--cooldown' : ''
              }`}
            />
            Squad {boostLabel}
          </span>
          <button
            type="button"
            className="sq-dock__open"
            onClick={() => setCollapsed(false)}
            aria-label="Expand squad dock"
          >
            ▲
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sq-dock" role="status" aria-label="Squad Sync dock">
      <div className="sq-dock__head">
        <span className="sq-dock__title">
          <span
            className={`sq-dock__dot ${
              active ? 'sq-dock__dot--active' : cooldown ? 'sq-dock__dot--cooldown' : ''
            }`}
          />
          Squad Sync
        </span>
        <button
          type="button"
          className="sq-dock__close"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse squad dock"
        >
          ▼
        </button>
      </div>

      <div className="sq-dock__row">
        <span>Status</span>
        <strong>
          {status === 'active'
            ? 'Live'
            : status === 'cooldown'
            ? 'Cooling down'
            : status === 'ended'
            ? 'Ended'
            : 'Ready'}
        </strong>
      </div>

      <div className="sq-dock__row">
        <span>Members</span>
        <strong>
          {members.length} / {party.maxMembers}
        </strong>
      </div>

      {active ? (
        <>
          <div className="sq-dock__row">
            <span>Active</span>
            <strong>{activeCount} online</strong>
          </div>
          <div className="sq-dock__row sq-dock__row--boost">
            <span>Squad Boost</span>
            <strong>{boostLabel}</strong>
          </div>

          <div className="sq-energy">
            <div className="sq-energy__label">
              <span>Sync Energy</span>
              <span>{energyPct}%</span>
            </div>
            <div className="sq-energy__bar">
              <div className="sq-energy__fill" style={{ width: `${energyPct}%` }} />
            </div>
          </div>

          {activeCount < 2 ? (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f59e0b' }}>
              Need 2 active friends for the boost
            </p>
          ) : null}
        </>
      ) : cooldown ? (
        <div className="sq-dock__row">
          <span>Next session</span>
          <strong>{formatCountdown(party.cooldownMsLeft)}</strong>
        </div>
      ) : (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#a1a1aa' }}>
          Build Sync Energy to raise your boost
        </p>
      )}

      <Link to="/party" className="sq-dock__cta">
        Open Squad →
      </Link>
    </div>
  );
}

function formatCountdown(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}
