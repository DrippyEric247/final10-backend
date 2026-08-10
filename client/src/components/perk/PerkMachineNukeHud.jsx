import React, { useEffect, useMemo, useState } from 'react';

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

export default function PerkMachineNukeHud({ nuke, spinHeat }) {
  const active = Boolean(nuke?.active);
  const [remaining, setRemaining] = useState(() => formatNukeRemaining(nuke?.active?.expiresAt));

  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setRemaining(formatNukeRemaining(nuke.active.expiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, nuke?.active?.expiresAt]);

  const urgency = useMemo(() => {
    if (!nuke?.active?.expiresAt) return 'idle';
    const ms = new Date(nuke.active.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    if (ms <= 60_000) return 'final60';
    if (ms <= 5 * 60_000) return 'final5min';
    return nuke.active.urgencyPhase || 'early';
  }, [nuke?.active?.expiresAt, nuke?.active?.urgencyPhase, remaining]);

  if (!active) return null;

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
