import React from 'react';

/** Lightweight animated voice waveform for Savvy Scout listening state. */
export default function SavvyScoutWaveform({ active = false }) {
  if (!active) return null;
  return (
    <div className="f10-scout-waveform" aria-hidden>
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} className="f10-scout-waveform__bar" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}
