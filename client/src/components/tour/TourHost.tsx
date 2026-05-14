import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import TourOverlay, { type TourDefinition, shouldShowTour } from "./TourOverlay";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import type { TutorialKey } from "../../lib/tourGuide";

/**
 * Maps first-visit routes to their tutorial key. Kept as a prefix match
 * so nested routes (e.g. `/feed?cat=tech`) still trigger.
 */
const ROUTE_TO_TOUR: ReadonlyArray<{ pattern: RegExp; id: TutorialKey }> = [
  { pattern: /^\/local-deals\b/, id: "quickSnipes" },
  { pattern: /^\/trending\b/, id: "promote" },
  { pattern: /^\/savvy-offers\b/, id: "offers" },
  { pattern: /^\/feed\b/, id: "feed" },
];

/** Microscopic fake deal used to show what Best Move looks like on Quick Snipes. */
function QuickSnipesDemo() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 420),
      window.setTimeout(() => setStep(2), 1080),
      window.setTimeout(() => setStep(3), 1700),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <div className="tour-demo-quick" aria-hidden>
      <div className={`tour-demo-card ${step >= 1 ? "is-live" : ""}`}>
        <div className="tour-demo-card-image">
          <span className="tour-demo-card-image-icon" aria-hidden>
            🎮
          </span>
          <span
            className={`tour-demo-card-flag ${step >= 1 ? "is-on" : ""}`}
            aria-hidden
          >
            −29%
          </span>
        </div>
        <div className="tour-demo-card-body">
          <div className="tour-demo-card-title">PS5 Slim — New in Box</div>
          <div className="tour-demo-card-prices">
            <span className="tour-demo-card-price">$389</span>
            <span className="tour-demo-card-market">$549</span>
          </div>
          <div
            className={`tour-demo-card-move ${step >= 2 ? "is-on" : ""}`}
            aria-hidden
          >
            ✓ Best Move: Buy Now
          </div>
        </div>
        <div
          className={`tour-demo-reward ${step >= 3 ? "is-on" : ""}`}
          aria-hidden
        >
          <SavvyPointsIcon size={14} glow />
          +5 Savvy
        </div>
      </div>
    </div>
  );
}

function focusAnchor(anchor: HTMLElement | null) {
  if (!anchor) return;
  const focusable = anchor.querySelector<HTMLElement>("input, textarea, button, a");
  const target = focusable ?? anchor;
  try {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focusable) focusable.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
}

const TOURS: Record<TutorialKey, TourDefinition> = {
  quickSnipes: {
    id: "quickSnipes",
    title: "Hunt live snipes fast",
    body:
      "Drop a search to surface fresh eBay listings — Quick Snipes scores each one with a Best Move so you don't have to.",
    primaryLabel: "Try a search",
    anchorSelector: '[data-tour="quick-snipes-search"]',
    placement: "bottom",
    reward: 10,
    onPrimary: focusAnchor,
    demo: <QuickSnipesDemo />,
  },
  promote: {
    id: "promote",
    title: "Boost what you're selling",
    body:
      "Promote a listing to jump the visibility lane. The more you promote, the more reach you unlock.",
    primaryLabel: "Promote a listing",
    anchorSelector: '[data-tour="promote-cta"]',
    placement: "top",
    reward: 10,
    onPrimary: (anchor) => {
      if (!anchor) return;
      try {
        anchor.click();
      } catch {
        /* ignore */
      }
    },
  },
  offers: {
    id: "offers",
    title: "Stack offers, earn Savvy",
    body:
      "Curated deals across eBay + promoted inventory. Redeeming offers grows your Savvy balance every time.",
    primaryLabel: "Browse offers",
    anchorSelector: '[data-tour="offers-header"]',
    placement: "bottom",
    reward: 10,
    onPrimary: focusAnchor,
  },
  feed: {
    id: "feed",
    title: "Trending across eBay",
    body:
      "Category-diverse discovery with momentum signals. Pick a chip to tune the feed.",
    primaryLabel: "Explore the feed",
    anchorSelector: '[data-tour="feed-categories"]',
    placement: "bottom",
    reward: 10,
    onPrimary: focusAnchor,
  },
};

/**
 * Route-aware host. One-shot: the overlay for a given tab shows on the
 * first visit, then never again (unless localStorage is reset).
 */
export default function TourHost() {
  const location = useLocation();
  const [activeId, setActiveId] = useState<TutorialKey | null>(null);

  const matchedId = useMemo<TutorialKey | null>(() => {
    for (const entry of ROUTE_TO_TOUR) {
      if (entry.pattern.test(location.pathname)) return entry.id;
    }
    return null;
  }, [location.pathname]);

  useEffect(() => {
    if (!matchedId) {
      setActiveId(null);
      return;
    }
    if (!shouldShowTour(matchedId)) {
      setActiveId(null);
      return;
    }
    // Small delay so the page's own entry animations settle first —
    // prevents the spotlight from measuring against an empty skeleton.
    const t = window.setTimeout(() => setActiveId(matchedId), 450);
    return () => window.clearTimeout(t);
  }, [matchedId]);

  if (!activeId) return null;
  const tour = TOURS[activeId];

  return <TourOverlay tour={tour} onFinish={() => setActiveId(null)} />;
}
