import React, { useEffect, useState } from 'react';

function formatHeatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Perk Machine Spin Heat indicator — server-authoritative pricing tier.
 * @param {{ spinHeat: object|null, increaseFlash: object|null }} props
 */
export default function SpinHeatIndicator({ spinHeat, increaseFlash }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!spinHeat?.cooldownActive) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [spinHeat?.cooldownActive]);

  if (!spinHeat) return null;

  const multiplier = Number(spinHeat.multiplier) || 1;
  const isMax = Boolean(spinHeat.isMax);
  const cooldownActive = Boolean(spinHeat.cooldownActive);
  const cooldownUntil = spinHeat.cooldownUntil ? new Date(spinHeat.cooldownUntil).getTime() : 0;
  const msRemaining =
    cooldownActive && cooldownUntil
      ? Math.max(0, cooldownUntil - now)
      : Number(spinHeat.msUntilReset) || 0;

  const label =
    isMax && cooldownActive
      ? `MAX HEAT — Resets in ${formatHeatCountdown(msRemaining)}`
      : isMax
        ? `MAX SPIN HEAT — ${multiplier}x`
        : `SPIN HEAT — ${multiplier}x`;

  return (
    <div
      className={`perk-spin-heat ${isMax ? 'perk-spin-heat--max' : ''} ${
        cooldownActive ? 'perk-spin-heat--cooldown' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="perk-spin-heat__label">{label}</span>
      {isMax && !cooldownActive ? (
        <span className="perk-spin-heat__note">Maximum heat pricing — spins remain available.</span>
      ) : null}
      {increaseFlash?.increased ? (
        <div className="perk-spin-heat__flash" aria-live="assertive">
          <span>SPIN HEAT INCREASED</span>
          <strong>
            {increaseFlash.previousMultiplier}x → {increaseFlash.currentMultiplier}x
          </strong>
        </div>
      ) : null}
    </div>
  );
}
