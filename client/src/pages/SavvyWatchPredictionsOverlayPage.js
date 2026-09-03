import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSavvyPredictionsOverlay } from '../lib/api';
import '../styles/SavvyWatch.css';

function formatCountdown(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function SavvyWatchPredictionsOverlayPage() {
  const { eventSlug } = useParams();
  const [data, setData] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const overlay = await getSavvyPredictionsOverlay(eventSlug);
        if (alive) {
          setData(overlay);
          setCountdown(overlay?.activePrediction?.secondsUntilLock ?? 0);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [eventSlug]);

  useEffect(() => {
    const pred = data?.activePrediction;
    if (!pred || pred.status !== 'open') return undefined;
    const id = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [data?.activePrediction]);

  const pred = data?.activePrediction;
  const locked = useMemo(
    () => pred && (pred.status === 'locked' || countdown <= 0),
    [pred, countdown]
  );

  if (!pred) {
    return <div className="sw-overlay sw-overlay-loading">Savvy Predictions…</div>;
  }

  return (
    <div className="sw-overlay">
      <div className="sw-overlay-panel sw-overlay-predictions">
        {!locked && !pred.officialResult && (
          <>
            <div className="sw-overlay-code-label">SAVVY CHECK!</div>
            <div className="sw-overlay-title">PREDICTION OPEN</div>
          </>
        )}
        {locked && !pred.officialResult && (
          <div className="sw-overlay-title sw-pred-locked-banner">PREDICTIONS LOCKED</div>
        )}
        <div className="sw-overlay-event">{pred.title}</div>
        {pred.matchup?.sideA && pred.matchup?.sideB && (
          <div className="sw-pred-matchup">{pred.matchup.sideA} vs {pred.matchup.sideB}</div>
        )}
        {!locked && !pred.officialResult && (
          <div className="sw-overlay-pred-timer">{formatCountdown(countdown)}</div>
        )}
        {!locked && !pred.officialResult && (
          <div className="sw-overlay-comp">WHO YOU GOT?</div>
        )}
        {pred.distribution?.length > 0 && locked && (
          <ul className="sw-overlay-pred-dist">
            {pred.distribution.map((d) => {
              const label = (pred.options || []).find((o) => o.optionId === d.optionId)?.label;
              return <li key={d.optionId}>{label} — {d.percent}%</li>;
            })}
          </ul>
        )}
        {pred.officialResult && (
          <>
            <div className="sw-overlay-title">OFFICIAL RESULT</div>
            <div className="sw-overlay-event">{pred.officialResult.label}</div>
            {pred.officialResult.numericValue != null && (
              <div className="sw-overlay-stat">{pred.officialResult.numericValue} SEC</div>
            )}
            {pred.resolution?.correctPercent != null && (
              <div className="sw-overlay-stat">{pred.resolution.correctPercent}% CALLED IT</div>
            )}
            <div className="sw-overlay-code-reward">+10 SAVVY AWARDED</div>
          </>
        )}
        <div className="sw-overlay-stat">{pred.totalPicks ?? 0} Total Picks</div>
      </div>
    </div>
  );
}
