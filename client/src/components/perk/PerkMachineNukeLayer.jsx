import React, { useEffect, useRef } from 'react';

const ACTIVATION_LINES = [
  { delay: 0, text: null, phase: 'freeze' },
  { delay: 800, text: null, phase: 'blackout' },
  { delay: 1600, text: '☢ PERK MACHINE NUKE ☢', phase: 'title' },
  { delay: 2800, text: '3,000 SPINS COMPLETED', phase: 'subtitle' },
  { delay: 4200, text: 'ENTERING NUKE MODE…', phase: 'enter' },
];

export function PerkMachineNukeActivation({ open, onComplete }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    timerRef.current = window.setTimeout(() => {
      onComplete?.();
    }, 5200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="perk-nuke-activation" role="dialog" aria-modal="true" aria-label="Nuke activation">
      <div className="perk-nuke-activation__veil" aria-hidden />
      <div className="perk-nuke-activation__content">
        {ACTIVATION_LINES.map((line) => (
          <div
            key={line.phase}
            className={`perk-nuke-activation__line perk-nuke-activation__line--${line.phase}`}
            style={{ animationDelay: `${line.delay}ms` }}
          >
            {line.text}
          </div>
        ))}
        <div className="perk-nuke-activation__rad" aria-hidden>
          ☢
        </div>
      </div>
    </div>
  );
}

export function PerkMachineNukeEndSequence({ open, onComplete }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    timerRef.current = window.setTimeout(() => {
      onComplete?.();
    }, 3800);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="perk-nuke-end-sequence" role="presentation" aria-hidden>
      <div className="perk-nuke-end-sequence__flash" />
      <div className="perk-nuke-end-sequence__countdown">00:00</div>
      <div className="perk-nuke-end-sequence__overload">CORE OVERLOAD</div>
      <div className="perk-nuke-end-sequence__shockwave" />
      <div className="perk-nuke-end-sequence__impact" />
    </div>
  );
}

export function PerkMachineNukeEndSummary({ summary, onDismiss }) {
  if (!summary) return null;

  return (
    <div className="perk-nuke-end" role="dialog" aria-modal="true" aria-label="Nuke event complete">
      <div className="perk-nuke-end__card">
        <h2 className="perk-nuke-end__title">NUKE EVENT COMPLETE</h2>
        <p className="perk-nuke-end__subtitle">NUKE RUN COMPLETE</p>
        <ul className="perk-nuke-end__stats">
          <li>
            <span>Spins during Nuke</span>
            <strong>{summary.spinsDuringEvent ?? 0}</strong>
          </li>
          <li>
            <span>Savvy spent</span>
            <strong>{summary.savvySpent ?? 0}</strong>
          </li>
          <li>
            <span>Base rewards earned</span>
            <strong>{summary.baseSavvyEarned ?? 0}</strong>
          </li>
          <li>
            <span>Nuke bonus earned</span>
            <strong>{summary.nukeBonusEarned ?? 0}</strong>
          </li>
          <li>
            <span>Total Savvy earned</span>
            <strong>{summary.totalSavvyEarned ?? 0}</strong>
          </li>
          <li>
            <span>Highest multiplier</span>
            <strong>{summary.highestCombinedMultiplier ?? summary.multiplier ?? 1}×</strong>
          </li>
          {summary.bestRewardLabel ? (
            <li>
              <span>Best reward</span>
              <strong>{summary.bestRewardLabel}</strong>
            </li>
          ) : null}
        </ul>
        <button type="button" className="perk-nuke-end__dismiss" onClick={onDismiss}>
          Return to Machine
        </button>
      </div>
    </div>
  );
}

export function PerkMachineNukeMilestoneFlash({ milestone, onDone }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!milestone) return undefined;
    timerRef.current = window.setTimeout(() => onDone?.(), 2400);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [milestone, onDone]);

  if (!milestone) return null;

  return (
    <div
      className={`perk-nuke-milestone perk-nuke-milestone--${milestone.id}`}
      role="status"
      aria-live="assertive"
    >
      {milestone.message ? (
        <span className="perk-nuke-milestone__text">{milestone.message}</span>
      ) : (
        <span className="perk-nuke-milestone__glyph" aria-hidden>
          ☢
        </span>
      )}
    </div>
  );
}

export function PerkMachineNukeAmbient({ nuke, reducedMotion }) {
  const active = Boolean(nuke?.active);
  if (!active || reducedMotion) return null;

  const urgency = nuke.active.urgencyPhase || 'early';

  return (
    <div className={`perk-nuke-ambient perk-nuke-ambient--${urgency}`} aria-hidden>
      <div className="perk-nuke-ambient__strobe" />
      <div className="perk-nuke-ambient__sparks" />
      <div className="perk-nuke-ambient__smoke" />
    </div>
  );
}
