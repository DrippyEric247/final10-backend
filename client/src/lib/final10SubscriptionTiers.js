export const FINAL10_TIERS = Object.freeze([
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    subLabel: "Always available",
    description: "Start smart, keep full control.",
    savvyMultiplier: "1.0x Savvy multiplier",
    features: [
      "Basic alerts (delayed)",
      "Text-based Savvy AI assistant",
      "AI alert suggestions + deal explanations",
      "Limited snipes per day",
      "1.0x Savvy multiplier",
    ],
    ctaLabel: "Keep Using Free",
    ctaPath: "/auctions",
  },
  {
    id: "core",
    name: "CORE",
    priceLabel: "$15/mo",
    subLabel: "$129/yr option",
    description: "Solid edge with faster alerts and better multipliers.",
    savvyMultiplier: "1.25x Savvy multiplier",
    features: [
      "Semi-fast alerts",
      "Best Moves: 5/day",
      "Alerts: 10 max",
      "Voice AI input (e.g. 'Find PS5 under $375')",
      "Voice-to-alert auto creation",
      "Basic smart suggestions",
      "1.25x Savvy multiplier",
      "Daily login bonus +0.75",
    ],
    ctaLabel: "Upgrade to CORE",
    ctaPath: "/premium?tier=core",
  },
  {
    id: "pro",
    name: "PRO",
    priceLabel: "$25/mo",
    subLabel: "$219/yr option",
    description: "Execution speed with real-time signals.",
    savvyMultiplier: "1.5x Savvy multiplier",
    features: [
      "Real-time alerts",
      "Best Moves: 15/day",
      "Alerts: 25 max",
      "Execution AI: Ready to Buy flow",
      "Smart filters (trust + price + condition)",
      "Optional auto-confirm rules (countdown + cancel)",
      "1.5x Savvy multiplier",
      "Daily login bonus +1.0",
    ],
    ctaLabel: "Upgrade to PRO",
    ctaPath: "/premium?tier=pro",
  },
  {
    id: "elite",
    name: "ELITE",
    priceLabel: "$35/mo",
    subLabel: "$299/yr option",
    description: "Full power with priority automation.",
    savvyMultiplier: "2.0x Savvy multiplier",
    features: [
      "Priority alerts (unlimited)",
      "Best Moves: unlimited",
      "Execution AI + priority timing",
      "2.0x Savvy multiplier",
      "Daily login bonus +1.25",
      "Highest Savvy rewards",
    ],
    ctaLabel: "Go ELITE",
    ctaPath: "/premium?tier=elite",
  },
]);

export function getMostPopularTierId() {
  const allowed = new Set(["core", "pro", "elite"]);
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search || "");
    const fromUrl = String(qs.get("popular") || "").toLowerCase();
    if (allowed.has(fromUrl)) return fromUrl;
  }
  const fromEnv = String(process.env.REACT_APP_FINAL10_MOST_POPULAR_TIER || "").toLowerCase();
  return allowed.has(fromEnv) ? fromEnv : "pro";
}
