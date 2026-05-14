import type { InterestId } from "./onboardingPreferences";

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

export const INTERESTS: ReadonlyArray<InterestConfig> = [
  {
    id: "gaming",
    label: "Gaming",
    emoji: "🎮",
    query: "playstation xbox nintendo switch console",
    neighbors: ["tech", "collectibles"],
    accent: "#a78bfa",
  },
  {
    id: "tech",
    label: "Tech",
    emoji: "💻",
    query: "iphone macbook airpods laptop",
    neighbors: ["gaming", "home"],
    accent: "#22d3ee",
  },
  {
    id: "sneakers",
    label: "Sneakers",
    emoji: "👟",
    query: "jordan nike sneakers yeezy",
    neighbors: ["fashion", "collectibles"],
    accent: "#f472b6",
  },
  {
    id: "fashion",
    label: "Fashion",
    emoji: "👗",
    query: "designer handbag jacket watch",
    neighbors: ["sneakers"],
    accent: "#fb7185",
  },
  {
    id: "collectibles",
    label: "Collectibles",
    emoji: "🎴",
    query: "pokemon cards trading cards funko",
    neighbors: ["gaming", "sneakers"],
    accent: "#facc15",
  },
  {
    id: "home",
    label: "Home",
    emoji: "🏡",
    query: "dyson kitchenaid vitamix robot vacuum",
    neighbors: ["tech"],
    accent: "#34d399",
  },
  {
    id: "auto",
    label: "Auto",
    emoji: "🚗",
    query: "wheels car parts dash cam",
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
