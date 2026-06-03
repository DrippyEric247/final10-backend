import type { InterestId } from "./onboardingPreferences";
import { getHeroSearchQueriesForInterest } from "./categoryHeroSearchMap";

export type InterestConfig = {
  id: InterestId;
  label: string;
  emoji: string;
  /** eBay search query used by the Instant Best Move fetcher. */
  query: string;
  /** Neighbor categories used for fallback suggestions. */
  neighbors: InterestId[];
  /** Premium accent hue for selected chip glow. */
  accent: string;
};

function interestQuery(id: InterestId, fallback: string): string {
  return getHeroSearchQueriesForInterest(id)[0] || fallback;
}

export const INTERESTS: ReadonlyArray<InterestConfig> = [
  {
    id: "gaming",
    label: "Gaming",
    emoji: "🎮",
    query: interestQuery("gaming", "Sony PlayStation 5 console"),
    neighbors: ["tech", "collectibles"],
    accent: "#a78bfa",
  },
  {
    id: "tech",
    label: "Tech",
    emoji: "💻",
    query: interestQuery("tech", "Apple AirPods Pro"),
    neighbors: ["gaming", "home"],
    accent: "#22d3ee",
  },
  {
    id: "sneakers",
    label: "Sneakers",
    emoji: "👟",
    query: interestQuery("sneakers", "Nike sneakers"),
    neighbors: ["fashion", "collectibles"],
    accent: "#f472b6",
  },
  {
    id: "fashion",
    label: "Fashion",
    emoji: "👗",
    query: interestQuery("fashion", "Nike sneakers"),
    neighbors: ["sneakers"],
    accent: "#fb7185",
  },
  {
    id: "collectibles",
    label: "Collectibles",
    emoji: "🎴",
    query: interestQuery("collectibles", "pokemon booster box"),
    neighbors: ["gaming", "sneakers"],
    accent: "#facc15",
  },
  {
    id: "home",
    label: "Home",
    emoji: "🏡",
    query: interestQuery("home", "desk chair"),
    neighbors: ["tech"],
    accent: "#34d399",
  },
  {
    id: "auto",
    label: "Auto",
    emoji: "🚗",
    query: interestQuery("auto", "OBD2 scanner"),
    neighbors: ["tech", "collectibles"],
    accent: "#f59e0b",
  },
];

const BY_ID = new Map<InterestId, InterestConfig>(
  INTERESTS.map((i) => [i.id, i])
);

export function getInterestConfig(id: InterestId): InterestConfig | undefined {
  return BY_ID.get(id);
}

export function labelForInterest(id: InterestId): string {
  return BY_ID.get(id)?.label ?? id;
}
