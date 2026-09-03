import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSavvyWatchOverlay } from '../lib/api';
import '../styles/SavvyWatch.css';

export default function SavvyWatchOverlayPage() {
  const { eventSlug } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const overlay = await getSavvyWatchOverlay(eventSlug);
        if (alive) setData(overlay);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [eventSlug]);

  const qrSrc = useMemo(() => {
    const url = `${window.location.origin}/watch/${eventSlug}?src=stream-qr`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  }, [eventSlug]);

  if (!data?.event) {
    return <div className="sw-overlay sw-overlay-loading">Savvy Watch…</div>;
  }

  const activeCode = data.liveCodes?.[0];

  return (
    <div className="sw-overlay">
      <div className="sw-overlay-panel">
        <div className="sw-overlay-title">SAVVY WATCH LIVE</div>
        <div className="sw-overlay-event">{data.event.title}</div>
        <img className="sw-overlay-qr" src={qrSrc} alt="Join Savvy Watch QR code" />
        <div className="sw-overlay-stat">
          {data.savvyWatchParticipants} Savvy Watch Participants
        </div>
        {activeCode && (
          <div className="sw-overlay-code">
            <div className="sw-overlay-code-label">{activeCode.label || 'SAVVY CHECK'}</div>
            <div className="sw-overlay-code-reward">+{activeCode.reward} Savvy</div>
          </div>
        )}
        {data.openCompetition && (
          <div className="sw-overlay-comp">
            Now Open: {data.openCompetition.title}
          </div>
        )}
      </div>
    </div>
  );
}
