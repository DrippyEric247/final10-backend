import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/PerkMachineEnvironment.css';

const SCAN_LINES = [
  'Scanning Deals...',
  'Preparing Rewards...',
  'Analyzing Marketplace...',
  'Calibrating Reward Probability...',
  'Indexing Savvy Universe...',
  'Compiling Drop Tables...',
];

const AMBIENT_EVENTS = ['drone', 'warning', 'steam', 'arm', 'belt', 'holo'];

function buildList(n) {
  return Array.from({ length: n }, (_, i) => i);
}

export default function PerkMachineEnvironment({
  phase = 'idle',
  hovering = false,
  eggsWaiting = 0,
  operatorLevel = 'Founding Tester',
  multiplier = '1.50x',
  currentEvent = '🔥 Double Points Weekend',
}) {
  const [scanIndex, setScanIndex] = useState(0);
  const [ambient, setAmbient] = useState(null);
  const ambientTimer = useRef(null);

  const spinning = phase === 'spinning' || phase === 'revealing';

  const particles = useMemo(() => buildList(22), []);
  const sparks = useMemo(() => buildList(6), []);
  const beltEggs = useMemo(() => buildList(5), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setScanIndex((i) => (i + 1) % SCAN_LINES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  // Ambient life: trigger a discrete event every 10-20s.
  useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      const delay = 10000 + Math.random() * 10000;
      ambientTimer.current = window.setTimeout(() => {
        if (cancelled) return;
        const next = AMBIENT_EVENTS[Math.floor(Math.random() * AMBIENT_EVENTS.length)];
        setAmbient({ type: next, id: Date.now() });
        window.setTimeout(() => !cancelled && setAmbient(null), 4200);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (ambientTimer.current) window.clearTimeout(ambientTimer.current);
    };
  }, []);

  const rootClass = [
    'perk-env',
    spinning ? 'perk-env--spinning' : '',
    phase === 'revealing' ? 'perk-env--revealing' : '',
    hovering ? 'perk-env--hover' : '',
    ambient ? `perk-env--ambient-${ambient.type}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} aria-hidden>
      {/* Deep room gradient + neon floor reflection */}
      <div className="perk-env__room" />
      <div className="perk-env__floor" />
      <div className="perk-env__floor-grid" />

      {/* Purple fog drifting across the floor */}
      <div className="perk-env__fog perk-env__fog--a" />
      <div className="perk-env__fog perk-env__fog--b" />

      {/* Massive glowing reactor behind the machine */}
      <div className="perk-env__reactor">
        <div className="perk-env__reactor-core" />
        <div className="perk-env__reactor-ring perk-env__reactor-ring--1" />
        <div className="perk-env__reactor-ring perk-env__reactor-ring--2" />
        <div className="perk-env__reactor-ring perk-env__reactor-ring--3" />
        <div className="perk-env__reactor-glow" />
      </div>

      {/* Glowing energy pipes */}
      <div className="perk-env__pipes" aria-hidden>
        <span className="perk-env__pipe perk-env__pipe--l1" />
        <span className="perk-env__pipe perk-env__pipe--l2" />
        <span className="perk-env__pipe perk-env__pipe--r1" />
        <span className="perk-env__pipe perk-env__pipe--r2" />
      </div>

      {/* Glowing server racks */}
      <div className="perk-env__racks perk-env__racks--left">
        {buildList(4).map((i) => (
          <div key={i} className="perk-env__rack">
            {buildList(5).map((j) => (
              <span key={j} className="perk-env__rack-led" style={{ animationDelay: `${(i + j) * 0.4}s` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="perk-env__racks perk-env__racks--right">
        {buildList(4).map((i) => (
          <div key={i} className="perk-env__rack">
            {buildList(5).map((j) => (
              <span key={j} className="perk-env__rack-led" style={{ animationDelay: `${(i + j) * 0.35}s` }} />
            ))}
          </div>
        ))}
      </div>

      {/* Massive vault door */}
      <div className="perk-env__vault">
        <div className="perk-env__vault-wheel" />
        <div className="perk-env__vault-label">SAVVY REWARD VAULT</div>
        <div className="perk-env__vault-bolts">
          {buildList(8).map((i) => (
            <span key={i} className="perk-env__vault-bolt" style={{ '--i': i }} />
          ))}
        </div>
      </div>

      {/* Branding: logo + neon sign + coin case */}
      <div className="perk-env__brand-logo">SAVVY UNIVERSE</div>
      <div className="perk-env__neon-sign">FINAL10</div>
      <div className="perk-env__coin-case">
        <div className="perk-env__coin">S</div>
        <span className="perk-env__coin-glass" />
      </div>

      {/* Floating holographic data screens */}
      <div className="perk-env__holo perk-env__holo--scan">
        <span className="perk-env__holo-bar" />
        <span className="perk-env__holo-line">{SCAN_LINES[scanIndex]}</span>
        <span className="perk-env__holo-progress" />
      </div>

      <div className="perk-env__holo perk-env__holo--event">
        <span className="perk-env__holo-tag">Current Event</span>
        <span className="perk-env__holo-value">{currentEvent}</span>
      </div>

      <div className="perk-env__holo perk-env__holo--stats">
        <div className="perk-env__holo-stat">
          <span className="perk-env__holo-tag">Operator Level</span>
          <span className="perk-env__holo-value">{operatorLevel}</span>
        </div>
        <div className="perk-env__holo-stat">
          <span className="perk-env__holo-tag">Current Multiplier</span>
          <span className="perk-env__holo-value">{multiplier}</span>
        </div>
        <div className="perk-env__holo-stat">
          <span className="perk-env__holo-tag">Eggs Waiting</span>
          <span className="perk-env__holo-value perk-env__holo-value--accent">{eggsWaiting}</span>
        </div>
      </div>

      {/* Robotic maintenance arms */}
      <div className="perk-env__arm perk-env__arm--left">
        <span className="perk-env__arm-base" />
        <span className="perk-env__arm-segment" />
        <span className="perk-env__arm-claw" />
      </div>
      <div className="perk-env__arm perk-env__arm--right">
        <span className="perk-env__arm-base" />
        <span className="perk-env__arm-segment" />
        <span className="perk-env__arm-claw" />
      </div>

      {/* Conveyor belt carrying eggs */}
      <div className="perk-env__conveyor">
        <div className="perk-env__conveyor-belt" />
        {beltEggs.map((i) => (
          <span
            key={i}
            className="perk-env__conveyor-egg"
            style={{ animationDelay: `${i * 2.6}s` }}
          >
            🥚
          </span>
        ))}
      </div>

      {/* Steam vents */}
      <span className="perk-env__steam perk-env__steam--1" />
      <span className="perk-env__steam perk-env__steam--2" />
      <span className="perk-env__steam perk-env__steam--3" />

      {/* Electrical sparks around cables */}
      <div className="perk-env__sparks">
        {sparks.map((i) => (
          <span
            key={i}
            className="perk-env__spark"
            style={{ '--i': i, animationDelay: `${i * 0.9}s` }}
          />
        ))}
      </div>

      {/* Drones flying across the room */}
      <span className="perk-env__drone perk-env__drone--a">
        <span className="perk-env__drone-body" />
        <span className="perk-env__drone-beam" />
      </span>
      <span className="perk-env__drone perk-env__drone--b">
        <span className="perk-env__drone-body" />
        <span className="perk-env__drone-beam" />
      </span>

      {/* Ambient floating particles */}
      <div className="perk-env__particles">
        {particles.map((i) => (
          <span
            key={i}
            className="perk-env__particle"
            style={{
              left: `${(i * 4.5) % 100}%`,
              animationDelay: `${(i % 8) * 1.3}s`,
              animationDuration: `${9 + (i % 6) * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Warning lights (flash during spin + ambient warning event) */}
      <span className="perk-env__warning perk-env__warning--l" />
      <span className="perk-env__warning perk-env__warning--r" />

      {/* Spin-time vignette / power surge */}
      <div className="perk-env__surge" />
    </div>
  );
}
