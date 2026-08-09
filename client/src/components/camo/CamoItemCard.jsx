import React from 'react';
import { Lock } from 'lucide-react';
import CamoImage from './CamoImage';

function formatSerial(serial) {
  if (serial == null) return null;
  return `#${String(serial).padStart(6, '0')}`;
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * One camo/apparel reward card. Locked cards stay visible and readable — dimmed
 * art, full requirement copy, and a PREVIEW affordance. Locked cards never
 * expose equip/claim controls.
 *
 * @param {object} props
 * @param {object} props.item merged catalog + server row
 * @param {(item: object) => void} props.onOpenDetail
 * @param {(item: object) => void} props.onPreview
 * @param {boolean} [props.showCategory] label the category (BY CAMO view)
 */
export default function CamoItemCard({ item, onOpenDetail, onPreview, showCategory = false }) {
  const unlocked = Boolean(item.unlocked);
  const serial = formatSerial(item.serialNumber);
  const unlockDate = formatDate(item.unlockedAt);

  return (
    <div
      className={`f10-camo-card f10-camo-card--${item.rarity} ${
        unlocked ? 'f10-camo-card--unlocked' : 'f10-camo-card--locked'
      }`}
      style={{ '--camo-accent': item.accentColor, '--camo-accent-alt': item.accentColorAlt }}
    >
      <button
        type="button"
        className="f10-camo-card__art"
        onClick={() => onOpenDetail?.(item)}
        aria-label={`${item.name} — ${unlocked ? 'unlocked' : 'locked'}`}
      >
        <CamoImage
          src={item.imageUrl}
          alt={item.name}
          accentColor={item.accentColor}
          dimmed={!unlocked}
        />

        {unlocked ? (
          <span className="f10-camo-card__badge f10-camo-card__badge--unlocked">UNLOCKED</span>
        ) : (
          <span className="f10-camo-card__badge f10-camo-card__badge--locked">
            <Lock size={11} strokeWidth={2.5} aria-hidden /> LOCKED
          </span>
        )}

        {item.isNew && unlocked ? (
          <span className="f10-camo-card__badge f10-camo-card__badge--new">NEW</span>
        ) : null}

        {item.privateReward ? (
          <span className="f10-camo-card__badge f10-camo-card__badge--private">
            PRIVATE / ADMIN ONLY
          </span>
        ) : null}
      </button>

      <div className="f10-camo-card__body">
        <div className="f10-camo-card__rarity">{item.rarityLabel}</div>
        <div className="f10-camo-card__name">{item.camoName}</div>
        <div className="f10-camo-card__type">
          {showCategory ? `${item.categoryName} · ` : ''}
          {item.rewardTypeName}
        </div>

        {unlocked ? (
          <div className="f10-camo-card__meta">
            {serial ? <span className="f10-camo-card__serial">Serial {serial}</span> : null}
            {unlockDate ? <span className="f10-camo-card__date">Earned {unlockDate}</span> : null}
          </div>
        ) : (
          <>
            <div className="f10-camo-card__track" role="presentation">
              <div
                className="f10-camo-card__fill"
                style={{ width: `${Math.min(100, item.progress)}%` }}
              />
            </div>
            <div className="f10-camo-card__req">
              {item.current.toLocaleString()} / {item.target.toLocaleString()}{' '}
              {item.categoryName} Deals
            </div>
          </>
        )}
      </div>

      <div className="f10-camo-card__actions">
        {unlocked ? (
          <button
            type="button"
            className="f10-camo-btn f10-camo-btn--primary"
            onClick={() => onOpenDetail?.(item)}
          >
            VIEW ITEM
          </button>
        ) : (
          <button
            type="button"
            className="f10-camo-btn f10-camo-btn--ghost"
            onClick={() => onPreview?.(item)}
          >
            PREVIEW
          </button>
        )}
      </div>
    </div>
  );
}
