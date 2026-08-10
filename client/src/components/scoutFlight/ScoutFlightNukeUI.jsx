/**
 * Savvy Scout Flight — Nuke Flight Streak UI.
 *
 * All gameplay-critical space stays clear: the HUD pins to the very top edge and
 * the activation/death banners are short-lived and vertically centred away from
 * the flight corridor.
 */

import React from 'react';
import { NUKE_STATE } from '../../lib/scoutFlightNukeConfig';

function formatClock(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Live Nuke HUD. Rendered only while Nuke Flight is running. */
export function ScoutFlightNukeHud({ nuke }) {
  if (!nuke) return null;
  const running = nuke.state === NUKE_STATE.NUKE_ACTIVATION || nuke.state === NUKE_STATE.NUKE_ACTIVE;
  if (!running) return null;

  return (
    <div className={`sf-nuke-hud sf-nuke-hud--${nuke.visualPhase}`} aria-live="off">
      <span className="sf-nuke-hud__title">☢ NUKE FLIGHT STREAK ☢</span>
      <span className="sf-nuke-hud__row">
        <span className="sf-nuke-hud__stat">
          NUKE MULTIPLIER: <strong>{nuke.multiplier}X</strong>
        </span>
        <span className="sf-nuke-hud__stat">
          NUKE SURVIVAL: <strong>{formatClock(nuke.nukeSurvivalMs)}</strong>
        </span>
      </span>
      {nuke.practice ? <span className="sf-nuke-hud__practice">PRACTICE — NO SAVVY</span> : null}
    </div>
  );
}

/**
 * Pre-Nuke anomaly indicator. Deliberately wordless so the 30-minute
 * requirement is never revealed.
 */
export function ScoutFlightNukeAnomaly({ nuke }) {
  if (!nuke || nuke.state !== NUKE_STATE.NUKE_WARNING || !nuke.warningStage) return null;
  const { intensity } = nuke.warningStage;
  return (
    <div
      className={`sf-nuke-anomaly sf-nuke-anomaly--${intensity}`}
      aria-hidden="true"
      data-stage={nuke.warningStage.id}
    >
      <span className="sf-nuke-anomaly__glyph">☢</span>
    </div>
  );
}

/** Activation cinematic overlay. Non-blocking: input passes straight through. */
export function ScoutFlightNukeActivation({ nuke }) {
  if (!nuke || nuke.state !== NUKE_STATE.NUKE_ACTIVATION) return null;
  return (
    <div className="sf-nuke-activation" aria-hidden="true">
      <div className="sf-nuke-activation__flash" />
      <p className="sf-nuke-activation__title">☢ NUKE FLIGHT STREAK ☢</p>
      <p className="sf-nuke-activation__sub">KEEP FLYING</p>
    </div>
  );
}

/** Death cinematic overlay shown before the results screen. */
export function ScoutFlightNukeDeathBanner({ nuke }) {
  if (!nuke || nuke.state !== NUKE_STATE.NUKE_DEATH) return null;
  return (
    <div className="sf-nuke-death" aria-hidden="true">
      <p className="sf-nuke-death__title">☢ NUKE FLIGHT ENDED ☢</p>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="sf-nuke-results__row">
      <span className="sf-nuke-results__label">{label}</span>
      <strong className="sf-nuke-results__value">{value}</strong>
    </div>
  );
}

/**
 * Nuke results section. Savvy figures come from the server; when they are absent
 * (practice, or a submission that has not returned) the rows are omitted rather
 * than guessed at.
 */
export function ScoutFlightNukeResults({ summary, verified }) {
  if (!summary?.triggered) return null;

  const savvy = verified?.nuke || null;
  const showSavvy = !summary.practice && savvy;

  return (
    <section className="sf-nuke-results" aria-label="Nuke Flight Streak results">
      <h3 className="sf-nuke-results__title">☢ NUKE FLIGHT STREAK ☢</h3>
      {summary.practice ? (
        <p className="sf-nuke-results__practice">
          Practice run — Nuke Flight experienced, no Savvy awarded.
        </p>
      ) : null}

      <div className="sf-nuke-results__grid">
        <StatRow label="Total Survival" value={formatClock(summary.totalSurvivalMs)} />
        <StatRow label="Nuke Survival" value={formatClock(summary.nukeSurvivalMs)} />
        <StatRow label="Highest Nuke Multiplier" value={`${summary.highestMultiplier}X`} />
        <StatRow label="Obstacles Escaped" value={summary.obstaclesEscaped.toLocaleString()} />
        <StatRow
          label="Structures Destroyed Behind You"
          value={summary.structuresDestroyed.toLocaleString()}
        />
        <StatRow label="Highest Score" value={summary.totalScore.toLocaleString()} />
        {showSavvy ? (
          <>
            <StatRow label="Base Savvy Earned" value={Number(savvy.baseSavvy || 0).toLocaleString()} />
            <StatRow label="Nuke Bonus" value={`+${Number(savvy.bonusSavvy || 0).toLocaleString()}`} />
            <StatRow
              label="Total Eligible Savvy"
              value={Number(savvy.totalSavvy || 0).toLocaleString()}
            />
          </>
        ) : null}
      </div>

      {!summary.practice && verified?.nuke?.rejected ? (
        <p className="sf-nuke-results__flag">
          Nuke bonus is under review for this run and was not awarded.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Dev/admin-only Nuke Flight test controls.
 *
 * Seeding the local clock cannot produce Savvy: the server recomputes Nuke
 * eligibility from its own run duration, so a seeded run always fails validation.
 */
export function ScoutFlightNukeDevPanel({
  onSeedClock,
  onForceActivate,
  onSetSurvival,
  onForceDeath,
  onStartTestRun,
  nuke,
}) {
  return (
    <div className="sf-nuke-dev" aria-label="Nuke Flight dev controls">
      <span className="sf-nuke-dev__title">☢ Nuke Lab (dev)</span>
      {onStartTestRun ? (
        <div className="sf-nuke-dev__row">
          <button type="button" onClick={() => onStartTestRun()}>
            Server Test Run
          </button>
        </div>
      ) : null}
      <div className="sf-nuke-dev__row">
        <button type="button" onClick={() => onSeedClock(29 * 60 + 50)}>
          29:50
        </button>
        <button type="button" onClick={() => onSeedClock(29 * 60 + 59)}>
          29:59
        </button>
        <button type="button" onClick={() => onForceActivate()}>
          Trigger Nuke
        </button>
      </div>
      <div className="sf-nuke-dev__row">
        <button type="button" onClick={() => onSetSurvival(0)}>
          P1
        </button>
        <button type="button" onClick={() => onSetSurvival(75)}>
          P2
        </button>
        <button type="button" onClick={() => onSetSurvival(200)}>
          P3
        </button>
        <button type="button" onClick={() => onSetSurvival(330)}>
          Extreme
        </button>
        <button type="button" onClick={() => onForceDeath()}>
          Death
        </button>
      </div>
      {nuke ? (
        <span className="sf-nuke-dev__state">
          {nuke.state} · {formatClock(nuke.activeMs)} · {nuke.multiplier}X
        </span>
      ) : null}
    </div>
  );
}
