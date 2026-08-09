import React, { useMemo } from 'react';

/**
 * Nuke Collection category-specific consecutive deal challenges.
 * @param {{ nuke: object|null }} props
 */
export default function NukeCategoryChallenges({ nuke }) {
  const challenges = useMemo(() => {
    const rows = nuke?.challenges || [];
    const active = rows.filter((c) => c.isActive && !c.isComplete);
    const incomplete = rows.filter((c) => !c.isComplete);
    const visible = active.length ? active : incomplete.slice(0, 4);
    return visible;
  }, [nuke?.challenges]);

  if (!challenges.length) return null;

  return (
    <section className="f10-nuke-challenges" aria-labelledby="nuke-challenges-heading">
      <h2 id="nuke-challenges-heading" className="f10-nuke-challenges__title">
        NUKE COLLECTION CHALLENGES
      </h2>
      <p className="f10-nuke-challenges__note">
        Separate from your general streak — each challenge requires consecutive deals in one category.
      </p>
      <div className="f10-nuke-challenges__grid">
        {challenges.map((c) => (
          <article
            key={c.id}
            className={`f10-nuke-challenge-card ${c.isComplete ? 'is-complete' : c.isActive ? 'is-active' : ''}`}
          >
            <div className="f10-nuke-challenge-card__head">
              <span className="f10-nuke-challenge-card__icon" aria-hidden>
                ☢️
              </span>
              <div>
                <h3>{c.title?.toUpperCase?.() || c.categoryName}</h3>
                <p>{c.progress} / {c.target}</p>
              </div>
            </div>
            <p className="f10-nuke-challenge-card__desc">
              Consecutive {c.categoryName} deals
            </p>
            {c.isComplete ? (
              <div className="f10-nuke-challenge-card__status is-complete">UNLOCKED</div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
