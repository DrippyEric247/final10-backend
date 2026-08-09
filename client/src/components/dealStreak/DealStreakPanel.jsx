import React from 'react';

/**
 * General account deal streak — category-flexible, neutral progress copy.
 * @param {{ status: object|null }} props
 */
export default function DealStreakPanel({ status }) {
  if (!status) return null;

  const streak = Number(status.currentDealStreak) || 0;
  const total = Number(status.totalQualifiedDeals) || 0;

  return (
    <section className="f10-deal-streak-panel" aria-labelledby="deal-streak-heading">
      <div className="f10-deal-streak-panel__header">
        <span id="deal-streak-heading" className="f10-deal-streak-panel__title">
          DEAL STREAK
        </span>
        <span className="f10-deal-streak-panel__count">{streak}</span>
      </div>
      <p className="f10-deal-streak-panel__sub">
        {total} qualifying Final10 deal{total === 1 ? '' : 's'}
      </p>
      <p className="f10-deal-streak-panel__note">
        Any category counts toward your general streak. Progress is tracked from verified wins and
        purchases.
      </p>
      {status.longestDealStreak > streak ? (
        <p className="f10-deal-streak-panel__meta">Personal best: {status.longestDealStreak}</p>
      ) : null}
    </section>
  );
}
