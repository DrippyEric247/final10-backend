import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import { emitPowerToast } from "../../lib/final10PowerFeedback";
import {
  TOUR_ACTION_EVENT,
  hasBeenRewarded,
  hasSeenTutorial,
  markRewarded,
  markTutorialSeen,
  trackTourEvent,
  type TutorialKey,
} from "../../lib/tourGuide";
import "../../styles/TourGuide.css";

export type TourPlacement = "top" | "bottom" | "auto";

export type TourDefinition = {
  id: TutorialKey;
  title: string;
  body: string;
  primaryLabel: string;
  /** CSS selector (e.g. '[data-tour="quick-snipes-search"]') for the UI element to spotlight. */
  anchorSelector: string;
  /** Fallback placement when auto-placement has no room. */
  placement?: TourPlacement;
  /** Optional demo node rendered inside the card (Quick Snipes uses this). */
  demo?: React.ReactNode;
  /** Called when the user clicks the primary CTA. */
  onPrimary?: (anchor: HTMLElement | null) => void;
  /** Savvy awarded on first real interaction. Default: 10. */
  reward?: number;
};

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
} | null;

const ANCHOR_POLL_MS = 160;
const ANCHOR_MAX_WAIT_MS = 6000;
const CARD_GAP = 14;
const CARD_MAX_WIDTH = 360;

function readAnchorRect(selector: string): AnchorRect {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function getAnchorEl(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(selector) as HTMLElement | null;
}

/**
 * Waits for the anchor to appear in the DOM (up to ANCHOR_MAX_WAIT_MS)
 * and keeps the measured rect in sync with scroll/resize afterwards.
 */
function useAnchorRect(selector: string): AnchorRect {
  const [rect, setRect] = useState<AnchorRect>(() => readAnchorRect(selector));

  useLayoutEffect(() => {
    setRect(readAnchorRect(selector));
  }, [selector]);

  useEffect(() => {
    let cancelled = false;
    let elapsed = 0;

    const poll = () => {
      if (cancelled) return;
      const next = readAnchorRect(selector);
      setRect((prev) => {
        if (!prev && !next) return prev;
        if (!prev || !next) return next;
        if (
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
      if (!next && elapsed < ANCHOR_MAX_WAIT_MS) {
        elapsed += ANCHOR_POLL_MS;
        window.setTimeout(poll, ANCHOR_POLL_MS);
      }
    };

    poll();

    const onReflow = () => {
      if (cancelled) return;
      setRect(readAnchorRect(selector));
    };

    window.addEventListener("scroll", onReflow, { passive: true, capture: true });
    window.addEventListener("resize", onReflow);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onReflow, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onReflow);
    };
  }, [selector]);

  return rect;
}

type CardPosition = {
  top: number;
  left: number;
  placement: "top" | "bottom";
};

function computeCardPosition(
  rect: AnchorRect,
  cardSize: { width: number; height: number },
  viewport: { width: number; height: number },
  preferred: TourPlacement
): CardPosition {
  if (!rect) {
    return {
      top: Math.max(24, viewport.height / 2 - cardSize.height / 2),
      left: Math.max(16, viewport.width / 2 - cardSize.width / 2),
      placement: "bottom",
    };
  }

  const spaceBelow = viewport.height - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const needed = cardSize.height + CARD_GAP + 16;

  let placement: "top" | "bottom";
  if (preferred === "top" && spaceAbove >= needed) placement = "top";
  else if (preferred === "bottom" && spaceBelow >= needed) placement = "bottom";
  else placement = spaceBelow >= needed || spaceBelow >= spaceAbove ? "bottom" : "top";

  const anchorCenterX = rect.left + rect.width / 2;
  let left = anchorCenterX - cardSize.width / 2;
  left = Math.min(viewport.width - cardSize.width - 12, Math.max(12, left));

  const top =
    placement === "bottom"
      ? rect.top + rect.height + CARD_GAP
      : rect.top - cardSize.height - CARD_GAP;

  return { top: Math.max(12, top), left, placement };
}

export type TourOverlayProps = {
  tour: TourDefinition;
  /** Called when the overlay finishes (dismissed, primary, or reward applied). */
  onFinish: () => void;
};

export default function TourOverlay({ tour, onFinish }: TourOverlayProps) {
  const rect = useAnchorRect(tour.anchorSelector);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState({ width: CARD_MAX_WIDTH, height: 220 });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 720 : window.innerHeight,
  }));
  const [visible, setVisible] = useState(false);
  const finishedRef = useRef(false);

  // Measure the card after mount so auto-placement uses real dimensions.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const b = cardRef.current.getBoundingClientRect();
    if (b.height > 0) {
      setCardSize({
        width: Math.min(CARD_MAX_WIDTH, b.width || CARD_MAX_WIDTH),
        height: b.height,
      });
    }
  }, [tour.id]);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    trackTourEvent("tour_shown", tour.id, { hasDemo: Boolean(tour.demo) });
  }, [tour.id]);

  const finish = useCallback(
    (reason: "dismissed" | "primary" | "action") => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      markTutorialSeen(tour.id);
      if (reason === "dismissed") {
        trackTourEvent("tour_dismissed", tour.id);
      } else if (reason === "primary") {
        trackTourEvent("tour_primary_clicked", tour.id);
      }
      setVisible(false);
      window.setTimeout(onFinish, 200);
    },
    [onFinish, tour.id]
  );

  const handlePrimary = useCallback(() => {
    const anchor = getAnchorEl(tour.anchorSelector);
    try {
      tour.onPrimary?.(anchor);
    } catch {
      /* ignore */
    }
    finish("primary");
  }, [finish, tour]);

  const handleDismiss = useCallback(() => {
    finish("dismissed");
  }, [finish]);

  // Listen for the "real interaction" event and award the learn bonus once.
  useEffect(() => {
    const onAction = (evt: Event) => {
      const detail = (evt as CustomEvent<{ key?: TutorialKey }>).detail;
      if (!detail || detail.key !== tour.id) return;
      const reward = Math.max(0, tour.reward ?? 10);
      if (!hasBeenRewarded(tour.id) && reward > 0) {
        markRewarded(tour.id);
        try {
          emitPowerToast(reward, "Learned this feature");
        } catch {
          /* ignore */
        }
        trackTourEvent("tour_completed", tour.id, { reward });
      }
      finish("action");
    };
    window.addEventListener(TOUR_ACTION_EVENT, onAction);
    return () => window.removeEventListener(TOUR_ACTION_EVENT, onAction);
  }, [finish, tour.id, tour.reward]);

  // Escape closes the overlay (doesn't block underlying nav because
  // the whole host is pointer-events: none except for the card).
  useEffect(() => {
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDismiss]);

  const cardPosition = useMemo(
    () => computeCardPosition(rect, cardSize, viewport, tour.placement ?? "auto"),
    [cardSize, rect, tour.placement, viewport]
  );

  const spotlightStyle: React.CSSProperties | null = rect
    ? {
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : null;

  return (
    <div
      className={`tour-overlay ${visible ? "is-visible" : ""}`}
      role="region"
      aria-label={`${tour.title} feature tour`}
    >
      <div className="tour-backdrop" aria-hidden />
      {spotlightStyle ? (
        <div className="tour-spotlight" aria-hidden style={spotlightStyle} />
      ) : null}

      <div
        ref={cardRef}
        className={`tour-card tour-card--${cardPosition.placement}`}
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
          maxWidth: CARD_MAX_WIDTH,
        }}
        role="dialog"
        aria-labelledby={`tour-title-${tour.id}`}
      >
        <button
          type="button"
          className="tour-card-dismiss"
          aria-label="Dismiss tour"
          onClick={handleDismiss}
        >
          ×
        </button>

        <div className="tour-card-eyebrow">New here? · {stepLabel(tour.id)}</div>
        <h3 id={`tour-title-${tour.id}`} className="tour-card-title">
          {tour.title}
        </h3>
        <p className="tour-card-body">{tour.body}</p>

        {tour.demo ? (
          <div className="tour-card-demo" aria-label="Quick demo">
            {tour.demo}
          </div>
        ) : null}

        <div className="tour-card-reward-hint">
          <SavvyPointsIcon size={16} glow />
          <span>
            <strong>+{tour.reward ?? 10} Savvy</strong> after you try it
          </span>
        </div>

        <div className="tour-card-actions">
          <button
            type="button"
            className="tour-card-btn ghost"
            onClick={handleDismiss}
          >
            Skip
          </button>
          <button
            type="button"
            className="tour-card-btn primary"
            onClick={handlePrimary}
          >
            {tour.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Only enter the overlay cycle when the user has never seen this tour.
 * Centralizing this check here keeps the host loop tiny.
 */
export function shouldShowTour(id: TutorialKey): boolean {
  return !hasSeenTutorial(id);
}

function stepLabel(id: TutorialKey): string {
  switch (id) {
    case "quickSnipes":
      return "Quick Snipes";
    case "promote":
      return "Promote";
    case "offers":
      return "Savvy Offers";
    case "feed":
      return "Trending Feed";
    default:
      return "Tour";
  }
}
