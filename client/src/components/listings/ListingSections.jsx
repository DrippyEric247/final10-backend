import React from "react";
import { MOVE_SECTION_META, MOVE_TIER_LABEL } from "../../lib/listingSectionsEngine";
import "../../styles/ListingSections.css";

const SECTION_ORDER = ["bestMove", "worthWatching", "risky"];

/**
 * Shared "Best Move" section renderer.
 *
 * Usage:
 *   <ListingSections
 *     groups={moveGroups}
 *     renderItem={(entry, idx) => <DealCard item={entry.item} ... />}
 *     gridClassName="grid grid-cols-1 lg:grid-cols-2 gap-6"
 *   />
 *
 * Pass `emptyState` to render a fallback when every group is empty.
 */
/**
 * @typedef {{ title?: string; subtitle?: string; tone?: string }} SectionMetaPatch
 */

export default function ListingSections({
  groups,
  renderItem,
  gridClassName = "",
  sectionKeys = SECTION_ORDER,
  emptyState = null,
  showEmptySections = false,
  /** Per-section title/subtitle overrides (merged onto MOVE_SECTION_META). */
  sectionMetaOverride = null,
}) {
  if (!groups) return null;

  const totalVisible = sectionKeys.reduce(
    (n, key) => n + (Array.isArray(groups[key]) ? groups[key].length : 0),
    0
  );
  if (totalVisible === 0) return emptyState;

  return (
    <div className="f10-best-sections">
      {sectionKeys.map((key) => {
        const section = groups[key];
        const base = MOVE_SECTION_META[key];
        const patch = sectionMetaOverride && sectionMetaOverride[key] ? sectionMetaOverride[key] : null;
        const meta = base && patch ? { ...base, ...patch } : base || patch;
        const hasItems = Array.isArray(section) && section.length > 0;
        if (!hasItems && !showEmptySections) return null;
        if (!meta || !meta.title) return null;

        return (
          <section
            key={key}
            className={`f10-best-section f10-best-section--${key}`}
            aria-labelledby={`f10-best-sec-${key}`}
          >
            <header className="f10-best-section__hd">
              <h3 id={`f10-best-sec-${key}`} className="f10-best-section__title">
                {meta.title}
              </h3>
              <p className="f10-best-section__sub">{meta.subtitle}</p>
            </header>
            {hasItems ? (
              <div className={gridClassName || "f10-best-section__grid"}>
                {section.map((entry, idx) => (
                  <React.Fragment key={`${key}-${entry.item?.id || entry.item?.itemId || idx}`}>
                    {renderItem(entry, idx, key)}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="f10-best-section__empty">Nothing in this tier right now.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Small chip badge rendered on each card.
 *
 *   🟢 Safest Win  /  🟡 Calculated Play  /  🔴 Risky
 */
export function MoveTierBadge({ tier, className = "", score }) {
  if (!tier) return null;
  const label = MOVE_TIER_LABEL[tier] || MOVE_TIER_LABEL.medium;
  return (
    <span
      className={`f10-move-tier f10-move-tier--${tier} ${className}`.trim()}
      title={Number.isFinite(score) ? `Best Move score ${score}/100` : undefined}
    >
      {label}
    </span>
  );
}
