import React, { useEffect, useState } from "react";
import {
  attributionBannerDismissed,
  getAttribution,
  markAttributionBannerDismissed,
} from "../../lib/attribution";
import "../../styles/AttributionBanner.css";

type AttributionBannerProps = {
  /** Authenticated user — if missing, banner suppresses itself. */
  user?: { id?: string; _id?: string; attributedTo?: string | null } | null;
};

/**
 * Persistent (but dismissible) banner shown after signup that confirms
 * "You joined through @creator" and surfaces the auto-applied creator code.
 */
export default function AttributionBanner({ user }: AttributionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<ReturnType<typeof getAttribution>>(null);

  useEffect(() => {
    if (!user) {
      setVisible(false);
      return;
    }
    const a = getAttribution();
    if (!a || !a.creatorHandle) {
      setVisible(false);
      return;
    }
    if (attributionBannerDismissed()) {
      setVisible(false);
      return;
    }
    setData(a);
    setVisible(true);
  }, [user]);

  if (!visible || !data || !data.creatorHandle) return null;

  const dismiss = () => {
    markAttributionBannerDismissed();
    setVisible(false);
  };

  return (
    <div className="attribution-banner" role="status">
      <div className="attribution-banner-inner">
        <div className="attribution-banner-icon" aria-hidden>
          ⭐
        </div>
        <div className="attribution-banner-copy">
          <div className="attribution-banner-title">
            You joined through{" "}
            <span className="attribution-banner-handle">
              @{data.creatorHandle}
            </span>
          </div>
          {data.creatorCode ? (
            <div className="attribution-banner-sub">
              Code{" "}
              <span className="attribution-banner-code">
                {data.creatorCode}
              </span>{" "}
              was auto-applied to your account.
            </div>
          ) : (
            <div className="attribution-banner-sub">
              Their picks and recommendations will be highlighted in your feed.
            </div>
          )}
        </div>
        <button
          type="button"
          className="attribution-banner-dismiss"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
