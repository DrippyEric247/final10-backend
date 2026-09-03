import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitSavvyPrediction, getSavvyPredictions } from '../lib/api';

function formatCountdown(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function PredictionCard({ prediction, eventSlug, token, onUpdate, busy, setBusy, setError }) {
  const [countdown, setCountdown] = useState(prediction.secondsUntilLock ?? 0);

  useEffect(() => {
    setCountdown(prediction.secondsUntilLock ?? 0);
    if (prediction.status !== 'open') return undefined;
    const id = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [prediction.secondsUntilLock, prediction.status, prediction.predictionId]);

  const locked = prediction.status === 'locked' || countdown <= 0;
  const resolved = prediction.status === 'resolved';
  const voided = prediction.status === 'void';

  const userPick = prediction.userEntry?.selectedOptionId;
  const userPickLabel = (prediction.options || []).find((o) => o.optionId === userPick)?.label;
  const isCorrect = prediction.userEntry?.outcome === 'correct';
  const isIncorrect = prediction.userEntry?.outcome === 'incorrect';

  const submitPick = async (optionId) => {
    if (!token || locked) return;
    setBusy(true);
    setError('');
    try {
      await submitSavvyPrediction(eventSlug, prediction.predictionId, optionId);
      await onUpdate();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Could not submit prediction.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sw-prediction-card">
      <div className="sw-pred-badge">SAVVY PREDICTION {locked && !resolved ? 'LOCKED' : resolved ? 'RESULT' : 'LIVE'}</div>
      <h3>{prediction.title}</h3>
      {prediction.matchup?.sideA && prediction.matchup?.sideB && (
        <p className="sw-pred-matchup">{prediction.matchup.sideA} vs {prediction.matchup.sideB}</p>
      )}
      <p className="sw-muted">{prediction.description}</p>

      {!locked && !resolved && !voided && (
        <p className="sw-pred-timer">Pick closes in: <strong>{formatCountdown(countdown)}</strong></p>
      )}

      {locked && !resolved && !voided && (
        <p className="sw-pred-locked">PREDICTIONS LOCKED</p>
      )}

      {!resolved && !voided && (
        <>
          <p className="sw-pred-reward">Possible reward: +{prediction.rewardConfig?.correctSavvy ?? 10} Savvy (free entry)</p>
          <div className="sw-pred-options">
            {(prediction.options || []).map((opt) => (
              <button
                key={opt.optionId}
                type="button"
                className={`sw-pred-opt ${userPick === opt.optionId ? 'selected' : ''}`}
                disabled={busy || locked || !token}
                onClick={() => submitPick(opt.optionId)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {userPickLabel && (
            <p className="sw-pred-your-pick">Your pick: <strong>{userPickLabel}</strong></p>
          )}
        </>
      )}

      {resolved && prediction.officialResult && (
        <div className="sw-pred-result">
          <p className="sw-pred-official">OFFICIAL RESULT</p>
          <p className="sw-pred-official-value">{prediction.officialResult.label}</p>
          {prediction.officialResult.numericValue != null && (
            <p className="sw-muted">Recorded: {prediction.officialResult.numericValue} ({prediction.officialResult.source || 'host_entered'})</p>
          )}
          {isCorrect && (
            <p className="sw-pred-correct">CORRECT! +{prediction.userEntry?.rewardAmount ?? prediction.rewardConfig?.correctSavvy ?? 10} SAVVY</p>
          )}
          {isIncorrect && (
            <p className="sw-pred-incorrect">Not this time. Official result: {prediction.officialResult.label}</p>
          )}
          {prediction.resolution?.correctPercent != null && (
            <p className="sw-muted">{prediction.resolution.correctPercent}% called it</p>
          )}
        </div>
      )}

      {voided && <p className="sw-muted">This prediction was voided. No rewards were paid.</p>}

      {prediction.distribution?.distribution?.length > 0 && (
        <ul className="sw-pred-dist">
          {prediction.distribution.distribution.map((d) => {
            const label = (prediction.options || []).find((o) => o.optionId === d.optionId)?.label;
            return (
              <li key={d.optionId}>{label} — {d.percent}%</li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SavvyPredictionsSection({ eventSlug, predictions: initial = [], token, featureEnabled }) {
  const [predictions, setPredictions] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPredictions(initial);
  }, [initial]);

  const refresh = useCallback(async () => {
    if (!featureEnabled) return;
    try {
      const data = await getSavvyPredictions(eventSlug);
      setPredictions(data.predictions || []);
    } catch {
      /* non-blocking */
    }
  }, [eventSlug, featureEnabled]);

  useEffect(() => {
    if (!featureEnabled) return undefined;
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [featureEnabled, refresh]);

  if (!featureEnabled) return null;

  const openPredictions = predictions.filter((p) => ['open', 'locked'].includes(p.status));
  const resolvedPredictions = predictions.filter((p) => ['resolved', 'void'].includes(p.status));

  return (
    <section className="sw-card sw-predictions">
      <h2>Live Predictions</h2>
      <p className="sw-muted">Free to enter — no Savvy stakes. Correct picks earn fixed rewards.</p>
      {error && <div className="sw-alert">{error}</div>}

      {openPredictions.length === 0 && resolvedPredictions.length === 0 && (
        <p className="sw-muted">No live predictions right now.</p>
      )}

      {openPredictions.map((p) => (
        <PredictionCard
          key={p.predictionId}
          prediction={p}
          eventSlug={eventSlug}
          token={token}
          onUpdate={refresh}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      ))}

      {resolvedPredictions.length > 0 && (
        <>
          <h3 className="sw-pred-resolved-heading">Recent Results</h3>
          {resolvedPredictions.map((p) => (
            <PredictionCard
              key={p.predictionId}
              prediction={p}
              eventSlug={eventSlug}
              token={token}
              onUpdate={refresh}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
            />
          ))}
        </>
      )}

      {token && (
        <Link className="sw-overlay-link" to="/savvy-predictions/history">
          Savvy Prediction History
        </Link>
      )}
    </section>
  );
}
