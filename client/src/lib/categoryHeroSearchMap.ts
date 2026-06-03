/**
 * High-wow default hero searches for first Best Move onboarding.
 * Each selected category maps to recognizable products — not broad/random queries.
 */

import type { InterestId } from "./onboardingPreferences";

/** Extended keys for future onboarding categories. */
export type HeroCategoryKey =
  | InterestId
  | "travel"
  | "fitness"
  | "family"
  | "grocery";

/**
 * Ordered hero queries per category. The engine tries each query until it finds
 * a strong trusted listing, then falls back to the interest's broad query.
 */
export const categoryHeroSearchMap: Readonly<
  Record<HeroCategoryKey, readonly string[]>
> = {
  gaming: ["Sony PlayStation 5 console"],
  auto: ["OBD2 scanner", "automotive tool kit"],
  home: ["desk chair", "modern furniture"],
  tech: ["Apple AirPods Pro", "MacBook"],
  fashion: ["Nike sneakers"],
  sneakers: ["Nike sneakers"],
  collectibles: ["pokemon booster box", "trading card elite trainer box"],
  travel: ["carry on luggage"],
  fitness: ["adjustable dumbbells"],
  family: ["kids tablet"],
  grocery: ["bulk household essentials"],
};

const LOW_WOW_TITLE_PATTERNS: readonly RegExp[] = [
  /\barcade\s+stick\b/i,
  /\bfight\s+stick\b/i,
  /\bjoystick\s+module\b/i,
  /\breplacement\s+(part|shell|cover)\b/i,
  /\badapter\s+cable\b/i,
  /\busb\s+cable\s+only\b/i,
  /\bempty\s+box\b/i,
  /\bmanual\s+only\b/i,
  /\bfor\s+parts\b/i,
  /\bparts\s+only\b/i,
  /\bbroken\b/i,
  /\bdecal\s+only\b/i,
  /\bsticker\s+only\b/i,
  /\bcontroller\s+skin\b/i,
  /\bgame\s+case\s+only\b/i,
];

const HERO_KEYWORD_HINTS: Partial<Record<HeroCategoryKey, readonly RegExp[]>> = {
  gaming: [/playstation\s*5|\bps5\b/i, /console/i],
  auto: [/obd2|scanner|automotive|tool\s+kit/i],
  home: [/desk\s+chair|chair|furniture/i],
  tech: [/airpods|macbook|apple/i],
  fashion: [/nike|sneaker/i],
  sneakers: [/nike|sneaker|jordan/i],
  collectibles: [/pokemon|booster|trading\s+card/i],
  travel: [/carry[\s-]?on|luggage/i],
  fitness: [/dumbbell/i],
  family: [/kids?\s+tablet|tablet/i],
  grocery: [/bulk|household|essentials/i],
};

export function getHeroSearchQueriesForInterest(
  interest: InterestId
): readonly string[] {
  return categoryHeroSearchMap[interest] ?? [];
}

export function isLowWowOnboardingTitle(title: string): boolean {
  const t = String(title || "").trim();
  if (t.length < 4) return true;
  return LOW_WOW_TITLE_PATTERNS.some((pat) => pat.test(t));
}

export function titleMatchesHeroIntent(
  interest: InterestId,
  title: string
): boolean {
  const hints = HERO_KEYWORD_HINTS[interest];
  if (!hints?.length) return true;
  const t = String(title || "");
  return hints.some((pat) => pat.test(t));
}
