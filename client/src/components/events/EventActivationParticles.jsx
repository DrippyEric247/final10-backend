import React, { useMemo } from 'react';

const COIN_COUNT = 14;
const LIGHTNING_COUNT = 18;

function buildCoinParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    kind: 'coin',
    angle: (360 / count) * i + (i % 3) * 8,
    delay: (i % 5) * 0.04,
    dist: 48 + (i % 4) * 18,
    size: 6 + (i % 3) * 3,
  }));
}

function buildLightningParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    kind: 'bolt',
    angle: (360 / count) * i + (i % 2) * 14,
    delay: (i % 4) * 0.035,
    dist: 56 + (i % 5) * 22,
    size: 10 + (i % 3) * 4,
    spin: (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 8),
  }));
}

export function EventActivationParticles({ active, particleClass = 'gold', effect = 'coin' }) {
  const particles = useMemo(() => {
    if (effect === 'lightning') return buildLightningParticles(LIGHTNING_COUNT);
    return buildCoinParticles(COIN_COUNT);
  }, [effect]);

  if (!active) return null;

  const rootClass = [
    'f10-event-particles',
    `f10-event-particles--${particleClass}`,
    effect === 'lightning' ? 'f10-event-particles--lightning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} aria-hidden>
      {particles.map((p) =>
        p.kind === 'bolt' ? (
          <span
            key={p.id}
            className="f10-event-particles__bolt"
            style={{
              '--p-angle': `${p.angle}deg`,
              '--p-dist': `${p.dist}px`,
              '--p-delay': `${p.delay}s`,
              '--p-size': `${p.size}px`,
              '--p-spin': `${p.spin}deg`,
            }}
          />
        ) : (
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
        )
      )}
    </div>
  );
}
