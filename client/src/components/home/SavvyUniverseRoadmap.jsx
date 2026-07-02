import React, { useMemo } from 'react';
import {
  SAVVY_UNIVERSE_ROADMAP,
  SAVVY_UNIVERSE_PROGRESS,
  SAVVY_UNIVERSE_APPS,
  SAVVY_UNIVERSE_PHASE_LABELS,
} from '../../config/homeLandingContent';

const PHASE_ORDER = ['current', 'next', 'upcoming'];

function StatusPill({ status, label }) {
  return (
    <span className={`home-universe-pill home-universe-pill--${status}`}>
      {label}
    </span>
  );
}

export default function SavvyUniverseRoadmap() {
  const groupedApps = useMemo(() => {
    const groups = PHASE_ORDER.map((phase) => ({
      phase,
      label: SAVVY_UNIVERSE_PHASE_LABELS[phase],
      apps: SAVVY_UNIVERSE_APPS.filter((app) => app.phase === phase),
    }));
    return groups.filter((g) => g.apps.length > 0);
  }, []);

  const { coreMessage } = SAVVY_UNIVERSE_ROADMAP;

  return (
    <section className="home-universe" aria-labelledby="home-universe-title">
      <div className="home-universe__glow" aria-hidden />

      <header className="home-universe__header">
        <h2 id="home-universe-title" className="home-universe__title">
          {SAVVY_UNIVERSE_ROADMAP.title}
        </h2>
        <p className="home-universe__subtitle">{SAVVY_UNIVERSE_ROADMAP.subtitle}</p>
      </header>

      <div className="home-universe__balance-card">
        <div className="home-universe__balance-icon" aria-hidden>
          🪙
        </div>
        <div className="home-universe__balance-body">
          <h3 className="home-universe__balance-title">{coreMessage.title}</h3>
          <p className="home-universe__balance-lead">{coreMessage.lead}</p>
          <p className="home-universe__balance-highlight">{coreMessage.highlight}</p>
          <p className="home-universe__balance-tomorrow">{coreMessage.tomorrow}</p>
        </div>
      </div>

      <div className="home-universe__timeline" role="list">
        {groupedApps.map((group) => (
          <div key={group.phase} className="home-universe__phase" role="presentation">
            <div className="home-universe__phase-label">{group.label}</div>
            <ul className="home-universe__apps">
              {group.apps.map((app) => (
                <li key={app.id} className="home-universe__app">
                  <div className="home-universe__app-marker" aria-hidden>
                    <span className="home-universe__app-order">{app.order}</span>
                  </div>
                  <article
                    className={`home-universe__app-card${app.phase === 'current' ? ' is-current' : ''}`}
                  >
                    <div className="home-universe__app-head">
                      <h4 className="home-universe__app-name">{app.name}</h4>
                      <StatusPill status={app.status} label={app.statusLabel} />
                    </div>
                    <p className="home-universe__app-desc">{app.description}</p>
                    {app.tagline ? (
                      <p className="home-universe__app-tagline">{app.tagline}</p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <aside className="home-universe__progress" aria-labelledby="home-universe-progress-title">
        <h3 id="home-universe-progress-title" className="home-universe__progress-title">
          {SAVVY_UNIVERSE_PROGRESS.title}
        </h3>
        <dl className="home-universe__progress-stats">
          {SAVVY_UNIVERSE_PROGRESS.stats.map((stat) => (
            <div key={stat.id} className="home-universe__progress-stat">
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <footer className="home-universe__footer">
        <p className="home-universe__closing">{SAVVY_UNIVERSE_ROADMAP.closing}</p>
        <p className="home-universe__slogan">{SAVVY_UNIVERSE_ROADMAP.slogan}</p>
      </footer>
    </section>
  );
}
