import React from 'react';
import { Eye } from 'lucide-react';

/**
 * Admin-only Classified Master piece card — visual inspection only.
 * @param {{ item: object, onPreview: (item: object) => void }} props
 */
export default function ClassifiedAdminPreviewCard({ item, onPreview }) {
  return (
    <div className="f10-classified-admin-card">
      <div className="f10-classified-admin-card__thumb">
        {item?.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="f10-classified-admin-card__img"
            loading="lazy"
          />
        ) : (
          <div className="f10-classified-admin-card__missing" aria-hidden>
            ?
          </div>
        )}
      </div>
      <div className="f10-classified-admin-card__body">
        <div className="f10-classified-admin-card__name">{item?.name}</div>
        <div className="f10-classified-admin-card__type">{item?.rewardTypeName}</div>
        <div className="f10-classified-admin-card__labels">
          <span>CLASSIFIED MASTER</span>
          <span>ADMIN PREVIEW</span>
        </div>
        <button
          type="button"
          className="f10-camo-btn--ghost f10-classified-admin-card__preview"
          onClick={() => onPreview?.(item)}
        >
          <Eye size={13} strokeWidth={2.4} aria-hidden /> PREVIEW
        </button>
      </div>
    </div>
  );
}
