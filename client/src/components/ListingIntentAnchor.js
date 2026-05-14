import { useEffect, useRef } from "react";
import {
  addListingDwell,
  getListingSnapshot,
  onListingBecameVisible,
  onListingLeftView,
} from "../lib/intentTracker";
import { tryIntentMomentNudge } from "../lib/intentOptimizer";

const DWELL_THRESHOLD_MS = 6500;

/**
 * Tracks viewport dwell + return visits; when the user is clearly “studying” a listing,
 * may surface one valuable optimization toast (gated + deduped in intentOptimizer).
 */
export default function ListingIntentAnchor({
  item,
  isSaved,
  coachCtxRef,
  children,
}) {
  const rootRef = useRef(null);
  const visibleRef = useRef(false);
  const firedRef = useRef(false);
  const id = String(item?.id || "");

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !id) return undefined;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        const hit = Boolean(e?.isIntersecting && e.intersectionRatio >= 0.22);
        if (hit && !visibleRef.current) {
          onListingBecameVisible(id);
        }
        if (!hit && visibleRef.current) {
          onListingLeftView(id);
        }
        visibleRef.current = hit;
      },
      { threshold: [0, 0.22, 0.45] }
    );
    obs.observe(el);

    const tick = window.setInterval(() => {
      if (!visibleRef.current) return;
      addListingDwell(id, 1000);
      if (firedRef.current) return;
      const snap = getListingSnapshot(id);
      const engaged =
        snap.dwellMs >= DWELL_THRESHOLD_MS || snap.returnVisits >= 1;
      if (!engaged) return;
      const base = coachCtxRef?.current;
      if (!base) return;
      const ok = tryIntentMomentNudge(item, {
        ...base,
        isSaved: Boolean(isSaved),
      });
      if (ok) {
        firedRef.current = true;
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      obs.disconnect();
    };
  }, [id, item, isSaved, coachCtxRef]);

  return (
    <div
      ref={rootRef}
      className="f10-listing-intent-anchor"
      style={{ width: "100%" }}
    >
      {children}
    </div>
  );
}
