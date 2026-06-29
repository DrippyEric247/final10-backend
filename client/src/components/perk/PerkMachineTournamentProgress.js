import React from 'react';

/**
 * Perk Machine progress toward Scout Flight Tournament Tickets.
 * @param {{ progress?: { current: number, required: number, spinsRemaining: number, ticketsOwned: number, progressPct?: number }, pulse?: boolean }} props
 */
export default function PerkMachineTournamentProgress({ progress, pulse = false }) {
  if (!progress) return null;

  const { current = 0, required = 10, spinsRemaining = required, ticketsOwned = 0 } = progress;
  const pct =
    progress.progressPct != null
      ? progress.progressPct
      : required > 0
        ? Math.min(100, Math.round((current / required) * 100))
        : 100;

  return (
    <section
      className={`perk-ticket-progress${pulse ? ' perk-ticket-progress--pulse' : ''}`}
      aria-labelledby="perk-ticket-progress-heading"
    >
      <div className="perk-ticket-progress__header">
        <span id="perk-ticket-progress-heading" className="perk-ticket-progress__title">
          🏆 Tournament Ticket Progress
        </span>
        {ticketsOwned > 0 ? (
          <span className="perk-ticket-progress__owned">{ticketsOwned} ticket{ticketsOwned === 1 ? '' : 's'}</span>
        ) : null}
      </div>
      <div
        className="perk-ticket-progress__bar"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-label={`${current} of ${required} spins until Tournament Ticket`}
      >
        <div className="perk-ticket-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="perk-ticket-progress__label">
        <strong>{current}</strong> of <strong>{required}</strong> Spins Until Tournament Ticket
      </p>
      {spinsRemaining > 0 && spinsRemaining < required ? (
        <p className="perk-ticket-progress__hint">{spinsRemaining} spin{spinsRemaining === 1 ? '' : 's'} to go</p>
      ) : null}
    </section>
  );
}
