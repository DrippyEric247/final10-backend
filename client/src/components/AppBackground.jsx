import React from "react";
import { useLocation } from "react-router-dom";
import "../styles/AppBackground.css";
import "../styles/CardSurface.css";

/**
 * Global app background + overlay.
 *
 * Two fixed, pointer-events:none layers live behind every page:
 *
 *   1. `.f10-app-bg`        — faint Final10 brand mark (variant-sized)
 *   2. `.f10-app-overlay`   — dark gradient that protects legibility and
 *                              gives the UI a premium, cinematic feel
 *
 * Route variants:
 *
 *   - feature  : Home + landing surfaces. Strongest, most visible mark.
 *   - universe : profile / leaderboard / battle-pass / customization —
 *                rendered with the "Savvy Universe" artwork so identity
 *                tabs feel continuous across the Savvy ecosystem.
 *   - default  : everything else (Auctions, etc.) — faded logo.
 *   - dense    : listing-heavy grids (Trending, Quick Snipes, offers) —
 *                minimal mark so content has maximum clarity.
 */

const PUBLIC = process.env.PUBLIC_URL || "";
const LOGO_URL = `${PUBLIC}/assets/final10-logo.png`;
const UNIVERSE_URL = `${PUBLIC}/assets/savvy-universe.png`;

// "Savvy Universe" identity tabs — shared across the full Savvy ecosystem.
const UNIVERSE_ROUTES = [
  "/profile",
  "/leaderboard",
  "/battle-pass",
  "/customization",
];

// Feature surfaces where we want the brand strongest.
const FEATURE_ROUTES = ["/", "/home", "/dashboard"];

// Listing-heavy pages where we want minimal visual noise behind the grid.
const DENSE_ROUTES = [
  "/product-feed",
  "/feed",
  "/trending",
  "/local-deals",
  "/quick-snipes",
  "/deals",
  "/savvy-offers",
  "/offers",
];

function matchesAny(pathname, routes) {
  return routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function resolveVariant(pathname) {
  if (matchesAny(pathname, UNIVERSE_ROUTES)) return "universe";
  if (matchesAny(pathname, DENSE_ROUTES)) return "dense";
  if (matchesAny(pathname, FEATURE_ROUTES)) return "feature";
  return "default";
}

export default function AppBackground() {
  const { pathname } = useLocation();
  const variant = resolveVariant(pathname);
  const url = variant === "universe" ? UNIVERSE_URL : LOGO_URL;
  const style = { backgroundImage: `url("${url}")` };

  return (
    <>
      <div
        className={`f10-app-bg f10-app-bg--${variant}`}
        style={style}
        aria-hidden="true"
      />
      <div className="f10-app-overlay" aria-hidden="true" />
    </>
  );
}
