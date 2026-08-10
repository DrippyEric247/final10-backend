import React, { useEffect, useState } from 'react';

function formatNukeRemaining(expiresAt) {
  if (!expiresAt) return '--:--';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function resolveUrgency(expiresAt, fallbackPhase) {
  if (!expiresAt) return 'idle';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  if (ms <= 60_000) return 'final60';
  if (ms <= 5 * 60_000) return 'final5min';
  return fallbackPhase || 'early';
}

/** Remaining time and urgency both read the wall clock, so they advance together. */
function readNukeClock(active) {
  return {
    remaining: formatNukeRemaining(active?.expiresAt),
    urgency: resolveUrgency(active?.expiresAt, active?.urgencyPhase),
  };
}

export default function PerkMachineNukeHud({ nuke, spinHeat }) {
  const active = Boolean(nuke?.active);
  const [clock, setClock] = useState(() => readNukeClock(nuke?.active));

  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setClock(readNukeClock(nuke.active));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, nuke?.active, nuke?.active?.expiresAt, nuke?.active?.urgencyPhase]);

  if (!active) return null;

  const { remaining, urgency } = clock;

  const mult = nuke.active.multiplier || 3;

  return (
    <div
      className={`perk-nuke-hud perk-nuke-hud--${urgency}`}
      role="status"
      aria-live="polite"
      aria-label="Nuke event active"
    >
      <div className="perk-nuke-hud__banner">☢ NUKE EVENT ACTIVE ☢</div>
      <div className="perk-nuke-hud__grid">
        <span className="perk-nuke-hud__mult">{mult}× NUKE MULTIPLIER</span>
        <span className="perk-nuke-hud__stability">CORE STABILITY: CRITICAL</span>
        {urgency === 'final5min' ? (
          <span className="perk-nuke-hud__warning">CORE FAILURE IMMINENT</span>
        ) : null}
        <span className={`perk-nuke-hud__timer ${urgency === 'final60' ? 'perk-nuke-hud__timer--dominant' : ''}`}>
          {urgency === 'final60' ? `☢ ${remaining} ☢` : `${remaining} REMAINING`}
        </span>
      </div>
      {spinHeat ? (
        <div className="perk-nuke-hud__heat">
          SPIN HEAT: {spinHeat.multiplier || spinHeat.currentMultiplier || 1}×
        </div>
      ) : null}
    </div>
  );
}
