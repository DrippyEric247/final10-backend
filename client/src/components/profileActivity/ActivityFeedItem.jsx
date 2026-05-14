import React from "react";

export function ActivityFeedItem({ item, formattedTime, interactive = false, onPress }) {
  const tc = `f10-pa-item--${item.type}`;
  const content = (
    <>
      <span className="f10-pa-item-icon" aria-hidden>
        {item.icon}
      </span>
      <div className="f10-pa-item-body">
        <p className="f10-pa-item-title">{item.title}</p>
        <p className="f10-pa-item-detail">{item.detail}</p>
      </div>
      <div className="f10-pa-item-meta">
        <span className="f10-pa-item-time">{formattedTime}</span>
        {item.rewardLabel ? (
          <span className="f10-pa-item-reward">{item.rewardLabel}</span>
        ) : null}
      </div>
    </>
  );

  if (interactive && onPress) {
    return (
      <button type="button" className={`f10-pa-item ${tc}`} onClick={onPress} role="listitem">
        {content}
      </button>
    );
  }

  return (
    <div className={`f10-pa-item ${tc}`} role="listitem">
      {content}
    </div>
  );
}
