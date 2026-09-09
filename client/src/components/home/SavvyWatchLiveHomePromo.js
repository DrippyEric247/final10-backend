import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/SavvyWatchHomePromo.css';

function Thumbnail({ thumbnailUrl, title }) {
  return (
    <div className="sw-home-live-thumb" aria-hidden>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" loading="lazy" />
      ) : (
        <div className="sw-home-live-thumb-fallback">
          <span className="sw-home-live-thumb-mark">SAVVY WATCH</span>
        </div>
      )}
      <span className="sw-home-live-thumb-overlay">LIVE</span>
    </div>
  );
}

export default function SavvyWatchLiveHomePromo({ promo }) {
  const { primary, moreCount, eventsHubPath = '/events' } = promo || {};
  if (!primary) return null;

  const hostLine = primary.hostDisplayName
    ? `Hosted by ${primary.hostDisplayName}`
    : null;

  return (
    <section className="sw-home-live-promo" aria-label="Savvy Watch live event">
      <div className="sw-home-live-glow" aria-hidden />

      <div className="sw-home-live-inner">
        <Thumbnail thumbnailUrl={primary.thumbnailUrl} title={primary.title} />

        <div className="sw-home-live-copy">
          <div className="sw-home-live-now">
            <span className="sw-home-live-dot" aria-hidden />
            LIVE NOW
          </div>

          <div className="sw-home-live-brand">SAVVY WATCH</div>
          <h2 className="sw-home-live-title">{primary.title}</h2>

          {hostLine ? <p className="sw-home-live-host">{hostLine}</p> : null}

          <p className="sw-home-live-tagline">
            Don&apos;t just watch. Vote. Predict. Participate. Earn.
          </p>

          <div className="sw-home-live-actions">
            <Link to={primary.joinPath} className="sw-home-live-join">
              JOIN LIVE
            </Link>
            <Link to={eventsHubPath} className="sw-home-live-hub">
              Events Hub
            </Link>
          </div>

          {moreCount > 0 ? (
            <Link to={eventsHubPath} className="sw-home-live-more">
              + {moreCount} more live
            </Link>
          ) : null}

          <p className="sw-home-live-powered">Powered by the Savvy Universe</p>
        </div>
      </div>
    </section>
  );
}
