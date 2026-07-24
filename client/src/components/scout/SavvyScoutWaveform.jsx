import React from 'react';

/** Animated voice waveform for Savvy Scout listening / speaking states. */
export default function SavvyScoutWaveform({ active = false, speaking = false }) {
  if (!active) return null;
  return (
    <div
      className={`f10-scout-waveform${speaking ? ' f10-scout-waveform--speaking' : ''}`}
      aria-hidden
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className="f10-scout-waveform__bar"
          style={{ animationDelay: `${i * (speaking ? 0.06 : 0.08)}s` }}
        />
      ))}
    </div>
  );
}
