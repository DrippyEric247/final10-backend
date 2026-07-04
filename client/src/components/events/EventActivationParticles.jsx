import React, { useMemo } from 'react';

const PARTICLE_COUNT = 14;

export function EventActivationParticles({ active, particleClass = 'gold' }) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        angle: (360 / PARTICLE_COUNT) * i + (i % 3) * 8,
        delay: (i % 5) * 0.04,
        dist: 48 + (i % 4) * 18,
        size: 6 + (i % 3) * 3,
      })),
    []
  );

  if (!active) return null;

  return (
    <div className={`f10-event-particles f10-event-particles--${particleClass}`} aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="f10-event-particles__coin"
          style={{
            '--p-angle': `${p.angle}deg`,
            '--p-dist': `${p.dist}px`,
            '--p-delay': `${p.delay}s`,
            '--p-size': `${p.size}px`,
          }}
        />
      ))}
    </div>
  );
}
