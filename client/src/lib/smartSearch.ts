/**
 * Global Smart Search engine.
 *
 * The engine is intentionally pure / dependency-free so the same logic can
 * run in tests, on every tab (Trending, Auctions, Quick Snipes, Savvy
 * Offers), and inside the Savvy AI clarification flow.
 *
 * It does four things:
 *   1. Parse a user query string into a structured `SearchIntent`.
 *   2. Detect vague queries and emit a Savvy AI clarification prompt.
 *   3. Filter an arbitrary array of items against the intent given a small
 *      field map describing how the items expose title/category/etc.
 *   4. Provide a catalog of one-tap quick suggestions and "intent presets".
 */

export type TrustLevel = "high" | "medium" | "low" | "unverified";
export type BestMoveTag = "safest" | "balanced" | "risky";
export type CategoryTag =
  | "gaming"
  | "phones"
  | "electronics"
  | "fashion"
  | "home"
  | "auto"
  | "collectibles"
  | "tools"
  | "sneakers"
  | "other";

export type SearchIntent = {
  /** Free-text keywords the user is searching for (lower-cased, trimmed). */
  keywords: string;
  /** Categories the user wants (empty = all). */
  categories: CategoryTag[];
  /** Trust levels the user wants (empty = all). */
  trustLevels: TrustLevel[];
  /** Best-Move flavours the user wants (empty = all). */
  bestMoves: BestMoveTag[];
  /** Optional max price in USD. null = no cap. */
  priceCap: number | null;
  /** Optional "ending soon" filter (≤ 1 hour remaining, by default). */
  endingSoon: boolean;
  /**
   * Auctions / Savvy+ : require high-trust floor (aligned with trust level "high").
   * Distinct from picking "high" in trustLevels multi-select.
   */
  filterHighTrust?: boolean;
  /** Auctions / Savvy+ : cap bid competition (low bidder count). */
  filterLowCompetition?: boolean;
  /** Auctions / Savvy+ : emphasize listings above an internal deal-score floor. */
  filterBestDealScore?: boolean;
};

export type SmartSearchResult = {
  intent: SearchIntent;
  /** True when the engine couldn't extract enough signal to be useful. */
  vague: boolean;
  /** Savvy AI clarification prompt + button choices when `vague` is true. */
  clarification: SmartClarification | null;
  /** Suggestions the host UI may surface beneath the search bar. */
  suggestions: SmartSuggestion[];
};

export type SmartClarification = {
  prompt: string;
  /** One-tap reply buttons. Each carries an intent-patch to apply. */
  choices: Array<{
    id: string;
    label: string;
    patch: Partial<SearchIntent>;
  }>;
};

export type SmartSuggestion = {
  id: string;
  label: string;
  patch: Partial<SearchIntent>;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

export const EMPTY_INTENT: SearchIntent = Object.freeze({
  keywords: "",
  categories: [],
  trustLevels: [],
  bestMoves: [],
  priceCap: null,
  endingSoon: false,
  filterHighTrust: false,
  filterLowCompetition: false,
  filterBestDealScore: false,
});

const VAGUE_TOKENS = new Set([
  "deal",
  "deals",
  "good",
  "best",
  "great",
  "cheap",
  "stuff",
  "anything",
  "things",
  "hot",
  "fire",
]);

const TRUST_TOKENS: Array<{ token: string; level: TrustLevel }> = [
  { token: "high trust", level: "high" },
  { token: "trusted", level: "high" },
  { token: "verified", level: "high" },
  { token: "safest", level: "high" },
  { token: "low trust", level: "low" },
  { token: "risky", level: "low" },
  { token: "medium trust", level: "medium" },
  { token: "unverified", level: "unverified" },
  { token: "sketchy seller", level: "low" },
];

const BEST_MOVE_TOKENS: Array<{ token: string; tag: BestMoveTag }> = [
  { token: "safest", tag: "safest" },
  { token: "safe", tag: "safest" },
  { token: "balanced", tag: "balanced" },
  { token: "risky", tag: "risky" },
  { token: "high reward", tag: "risky" },
  { token: "moonshot", tag: "risky" },
];

const CATEGORY_TOKENS: Array<{ token: string; tag: CategoryTag }> = [
  { token: "gaming", tag: "gaming" },
  { token: "console", tag: "gaming" },
  { token: "ps5", tag: "gaming" },
  { token: "ps4", tag: "gaming" },
  { token: "xbox", tag: "gaming" },
  { token: "switch", tag: "gaming" },
  { token: "phone", tag: "phones" },
  { token: "phones", tag: "phones" },
  { token: "iphone", tag: "phones" },
  { token: "samsung", tag: "phones" },
  { token: "pixel", tag: "phones" },
  { token: "electronics", tag: "electronics" },
  { token: "laptop", tag: "electronics" },
  { token: "tv", tag: "electronics" },
  { token: "headphones", tag: "electronics" },
  { token: "fashion", tag: "fashion" },
  { token: "shoes", tag: "fashion" },
  { token: "sneakers", tag: "sneakers" },
  { token: "jordans", tag: "sneakers" },
  { token: "home", tag: "home" },
  { token: "auto", tag: "auto" },
  { token: "car", tag: "auto" },
  { token: "collectibles", tag: "collectibles" },
  { token: "cards", tag: "collectibles" },
  { token: "tools", tag: "tools" },
];

/* -------------------------------------------------------------------------- */
/*  Query parsing                                                             */
/* -------------------------------------------------------------------------- */

function tokenize(raw: string): string[] {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9$\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function detectPriceCap(text: string): number | null {
  const m = text.toLowerCase().match(/under\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (m) return Number(m[1]);
  const dollar = text.match(/\$(\d+(?:\.\d+)?)/);
  if (dollar) return Number(dollar[1]);
  return null;
}

function detectEndingSoon(text: string): boolean {
  return /\b(ending soon|ends soon|last 10|final 10|closing|expiring)\b/i.test(text);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Parses a free-form user query into a structured `SearchIntent`. Recognises
 * categories ("ps5", "iphone"), trust phrases ("high trust deals"), Best
 * Move flavours ("safest", "high reward"), price caps ("under $100"), and
 * ending-soon hints.
 */
export function parseQuery(raw: string, base: Partial<SearchIntent> = {}): SearchIntent {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();

  const categories: CategoryTag[] = [...(base.categories || [])];
  const trustLevels: TrustLevel[] = [...(base.trustLevels || [])];
  const bestMoves: BestMoveTag[] = [...(base.bestMoves || [])];

  for (const c of CATEGORY_TOKENS) {
    if (lower.includes(c.token)) categories.push(c.tag);
  }
  for (const t of TRUST_TOKENS) {
    if (lower.includes(t.token)) trustLevels.push(t.level);
  }
  for (const m of BEST_MOVE_TOKENS) {
    if (lower.includes(m.token)) bestMoves.push(m.tag);
  }

  const priceCap = detectPriceCap(lower) ?? base.priceCap ?? null;
  const endingSoon = detectEndingSoon(lower) || Boolean(base.endingSoon);

  // Strip phrases we already consumed so keywords don't double-match.
  let keywords = lower;
  for (const list of [TRUST_TOKENS, BEST_MOVE_TOKENS]) {
    for (const item of list) {
      keywords = keywords.replace(item.token, " ");
    }
  }
  keywords = keywords.replace(/\bunder\s*\$?\s*\d+(?:\.\d+)?\b/g, " ");
  keywords = keywords.replace(/\b(ending soon|ends soon|last 10|final 10)\b/g, " ");
  keywords = keywords.replace(/\s+/g, " ").trim();

  return {
    keywords,
    categories: uniq(categories),
    trustLevels: uniq(trustLevels),
    bestMoves: uniq(bestMoves),
    priceCap,
    endingSoon,
    filterHighTrust: Boolean(base.filterHighTrust),
    filterLowCompetition: Boolean(base.filterLowCompetition),
    filterBestDealScore: Boolean(base.filterBestDealScore),
  };
}

/* -------------------------------------------------------------------------- */
/*  Vague detection + Savvy AI clarification                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns true when a query is so generic that the Savvy AI should ask the
 * user to disambiguate before filtering anything.
 */
export function isVagueQuery(raw: string, intent: SearchIntent): boolean {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return false;
  if (tokens.length > 4) return false;
  if (
    intent.categories.length > 0 ||
    intent.trustLevels.length > 0 ||
    intent.bestMoves.length > 0 ||
    intent.priceCap != null ||
    intent.endingSoon
  ) {
    return false;
  }
  // Must be made up entirely of generic / filler tokens to count as vague.
  return tokens.every((tok) => VAGUE_TOKENS.has(tok));
}

const DEFAULT_CLARIFICATION: SmartClarification = {
  prompt: "🔥 Want safest wins or highest reward plays?",
  choices: [
    {
      id: "safest",
      label: "Safest wins",
      patch: { trustLevels: ["high"], bestMoves: ["safest"] },
    },
    {
      id: "balanced",
      label: "Balanced picks",
      patch: { bestMoves: ["balanced"] },
    },
    {
      id: "risky",
      label: "High reward plays",
      patch: { bestMoves: ["risky"] },
    },
    {
      id: "ending",
      label: "Ending soon",
      patch: { endingSoon: true },
    },
  ],
};

export function clarificationFor(_raw: string): SmartClarification {
  return DEFAULT_CLARIFICATION;
}

/* -------------------------------------------------------------------------- */
/*  Quick suggestions                                                         */
/* -------------------------------------------------------------------------- */

export const QUICK_SUGGESTIONS: SmartSuggestion[] = [
  { id: "ps5", label: "PS5 deals", patch: { keywords: "ps5", categories: ["gaming"] } },
  { id: "iphone", label: "iPhone deals", patch: { keywords: "iphone", categories: ["phones"] } },
  { id: "high-trust", label: "High Trust Only", patch: { trustLevels: ["high"] } },
  { id: "ending", label: "Ending Soon", patch: { endingSoon: true } },
  { id: "under100", label: "Under $100", patch: { priceCap: 100 } },
  { id: "safest", label: "Safest Best Moves", patch: { bestMoves: ["safest"] } },
];

/* -------------------------------------------------------------------------- */
/*  Filtering                                                                 */
/* -------------------------------------------------------------------------- */

export type SearchFieldMap = {
  /** Property to read for the title/keyword match. */
  title?: string;
  /** Property carrying free-form tags (string[] or comma string). */
  tags?: string;
  /** Property carrying the category id/slug. */
  category?: string;
  /** Property carrying a numeric trust score 0..100. */
  trust?: string;
  /** Property carrying a Best-Move recommendationType / bestMove tag. */
  bestMove?: string;
  /** Property carrying the listing price. */
  price?: string;
  /** Property carrying the auction end timestamp (ms or ISO). */
  endsAt?: string;
  /** Property carrying secondsRemaining (preferred over endsAt). */
  secondsRemaining?: string;
  /** Bid count for low-competition filters (Auctions). */
  bidCount?: string;
  marketValue?: string;
  currentBid?: string;
};

const DEFAULT_FIELD_MAP: Required<SearchFieldMap> = {
  title: "title",
  tags: "tags",
  category: "category",
  trust: "trustScore",
  bestMove: "recommendationType",
  price: "price",
  endsAt: "endTime",
  secondsRemaining: "secondsRemaining",
  bidCount: "bidCount",
  marketValue: "marketValue",
  currentBid: "currentBid",
};

function readPath(item: any, path: string | undefined): unknown {
  if (!path || !item) return undefined;
  if (path in item) return item[path];
  // Tolerate camelCase paths with dots ("seller.name") cheaply.
  const parts = path.split(".");
  let cur: any = item;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Internal deal score 0..100 for filterBestDealScore (Auctions-aligned). */
function approxDealScoreForItem(item: any, map: Required<SearchFieldMap>): number {
  const mv = Number(readPath(item, map.marketValue));
  const pRaw =
    Number(readPath(item, map.price)) ||
    Number(readPath(item, map.currentBid)) ||
    null;
  const trust = Number(readPath(item, map.trust));
  const savingsPct =
    mv && pRaw != null && Number.isFinite(pRaw) && mv > 0
      ? Math.max(0, ((mv - pRaw) / mv) * 100)
      : 0;
  let score =
    34 +
    savingsPct * 0.26 +
    (Number.isFinite(trust) ? trust * 0.62 : 0);
  const sec = Number(readPath(item, map.secondsRemaining));
  const bids = Number(readPath(item, map.bidCount)) || 0;
  if (Number.isFinite(sec) && sec > 0 && sec <= 300) score += 6;
  if (bids <= 2) score += 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function trustScoreToLevel(score: number | undefined | null): TrustLevel | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  if (score >= 36) return "low";
  return "unverified";
}

function recommendationTypeToTag(value: unknown): BestMoveTag | null {
  if (!value) return null;
  const s = String(value).toLowerCase();
  if (s === "buy_now_better" || s === "buy_now" || s === "best_move" || s === "safest") return "safest";
  if (s === "auction_better" || s === "bid" || s === "balanced") return "balanced";
  if (s === "wait_and_watch" || s === "watch" || s === "risky" || s === "moonshot") return "risky";
  return null;
}

function asMillis(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Date.parse(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function matchesKeyword(item: any, kw: string, map: Required<SearchFieldMap>): boolean {
  if (!kw) return true;
  const haystacks: string[] = [];
  const title = readPath(item, map.title);
  if (typeof title === "string") haystacks.push(title.toLowerCase());

  const cat = readPath(item, map.category);
  if (typeof cat === "string") haystacks.push(cat.toLowerCase());

  const tags = readPath(item, map.tags);
  if (Array.isArray(tags)) haystacks.push(tags.join(" ").toLowerCase());
  else if (typeof tags === "string") haystacks.push(tags.toLowerCase());

  const text = haystacks.join(" ");
  // All whitespace-separated tokens must appear (AND semantics).
  return kw
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => text.includes(tok));
}

/**
 * Filters an arbitrary item array against a `SearchIntent`. Pass a `fieldMap`
 * if your items don't follow the default property names.
 */
export function filterItemsByIntent<T>(
  items: T[],
  intent: SearchIntent,
  fieldMap: SearchFieldMap = {}
): T[] {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const map: Required<SearchFieldMap> = { ...DEFAULT_FIELD_MAP, ...fieldMap };

  return items.filter((item: any) => {
    if (intent.keywords && !matchesKeyword(item, intent.keywords, map)) return false;

    if (intent.categories.length) {
      const cat = readPath(item, map.category);
      const tags = readPath(item, map.tags);
      const haystack = [
        typeof cat === "string" ? cat.toLowerCase() : "",
        Array.isArray(tags) ? tags.join(" ").toLowerCase() : typeof tags === "string" ? tags.toLowerCase() : "",
        typeof readPath(item, map.title) === "string" ? String(readPath(item, map.title)).toLowerCase() : "",
      ].join(" ");
      const hit = intent.categories.some((c) => haystack.includes(c));
      if (!hit) return false;
    }

    if (intent.trustLevels.length) {
      const score = Number(readPath(item, map.trust));
      const level = trustScoreToLevel(Number.isFinite(score) ? score : null);
      if (!level || !intent.trustLevels.includes(level)) return false;
    }

    if (intent.bestMoves.length) {
      const tag = recommendationTypeToTag(readPath(item, map.bestMove));
      if (!tag || !intent.bestMoves.includes(tag)) return false;
    }

    if (intent.priceCap != null) {
      const priceRaw = readPath(item, map.price);
      const price = Number(priceRaw);
      if (Number.isFinite(price) && price > intent.priceCap) return false;
    }

    if (intent.endingSoon) {
      const secs = Number(readPath(item, map.secondsRemaining));
      if (Number.isFinite(secs)) {
        if (secs > 60 * 60) return false;
      } else {
        const ends = asMillis(readPath(item, map.endsAt));
        if (ends != null && ends - Date.now() > 60 * 60 * 1000) return false;
      }
    }

    if (intent.filterHighTrust) {
      const score = Number(readPath(item, map.trust));
      if (!Number.isFinite(score) || score < 80) return false;
    }

    if (intent.filterLowCompetition) {
      const bids = Number(readPath(item, map.bidCount));
      if (!Number.isFinite(bids) || bids > 3) return false;
    }

    if (intent.filterBestDealScore) {
      const d = approxDealScoreForItem(item, map);
      if (Number.isFinite(d) && d < 68) return false;
    }

    return true;
  });
}

/* -------------------------------------------------------------------------- */
/*  Top-level entry: full smart-search evaluation                             */
/* -------------------------------------------------------------------------- */

export function evaluateSmartSearch(raw: string, base: Partial<SearchIntent> = {}): SmartSearchResult {
  const intent = parseQuery(raw, base);
  const vague = isVagueQuery(raw, intent);
  return {
    intent,
    vague,
    clarification: vague ? clarificationFor(raw) : null,
    suggestions: QUICK_SUGGESTIONS,
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers used by the UI                                                    */
/* -------------------------------------------------------------------------- */

export function applyIntentPatch(base: SearchIntent, patch: Partial<SearchIntent>): SearchIntent {
  return {
    keywords: patch.keywords != null ? patch.keywords : base.keywords,
    categories: patch.categories
      ? uniq([...base.categories, ...patch.categories])
      : base.categories,
    trustLevels: patch.trustLevels
      ? uniq([...base.trustLevels, ...patch.trustLevels])
      : base.trustLevels,
    bestMoves: patch.bestMoves
      ? uniq([...base.bestMoves, ...patch.bestMoves])
      : base.bestMoves,
    priceCap: patch.priceCap !== undefined ? patch.priceCap : base.priceCap,
    endingSoon: patch.endingSoon !== undefined ? patch.endingSoon : base.endingSoon,
    filterHighTrust:
      patch.filterHighTrust !== undefined ? patch.filterHighTrust : Boolean(base.filterHighTrust),
    filterLowCompetition:
      patch.filterLowCompetition !== undefined
        ? patch.filterLowCompetition
        : Boolean(base.filterLowCompetition),
    filterBestDealScore:
      patch.filterBestDealScore !== undefined
        ? patch.filterBestDealScore
        : Boolean(base.filterBestDealScore),
  };
}

export function isIntentEmpty(intent: SearchIntent): boolean {
  return (
    !intent.keywords &&
    intent.categories.length === 0 &&
    intent.trustLevels.length === 0 &&
    intent.bestMoves.length === 0 &&
    intent.priceCap == null &&
    !intent.endingSoon &&
    !intent.filterHighTrust &&
    !intent.filterLowCompetition &&
    !intent.filterBestDealScore
  );
}

export function intentToSearchParams(intent: SearchIntent): URLSearchParams {
  const sp = new URLSearchParams();
  if (intent.keywords) sp.set("q", intent.keywords);
  if (intent.categories.length) sp.set("cat", intent.categories.join(","));
  if (intent.trustLevels.length) sp.set("trust", intent.trustLevels.join(","));
  if (intent.bestMoves.length) sp.set("move", intent.bestMoves.join(","));
  if (intent.priceCap != null) sp.set("max", String(intent.priceCap));
  if (intent.endingSoon) sp.set("end", "1");
  if (intent.filterHighTrust) sp.set("ht", "1");
  if (intent.filterLowCompetition) sp.set("lc", "1");
  if (intent.filterBestDealScore) sp.set("bd", "1");
  return sp;
}

export function intentFromSearchParams(sp: URLSearchParams): SearchIntent {
  const splitOr = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
    !value
      ? []
      : value
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is T => (allowed as readonly string[]).includes(s));

  const max = sp.get("max");
  return {
    keywords: sp.get("q") || "",
    categories: splitOr<CategoryTag>(sp.get("cat"), [
      "gaming",
      "phones",
      "electronics",
      "fashion",
      "home",
      "auto",
      "collectibles",
      "tools",
      "sneakers",
      "other",
    ]),
    trustLevels: splitOr<TrustLevel>(sp.get("trust"), ["high", "medium", "low"]),
    bestMoves: splitOr<BestMoveTag>(sp.get("move"), ["safest", "balanced", "risky"]),
    priceCap: max != null && max !== "" && Number.isFinite(Number(max)) ? Number(max) : null,
    endingSoon: sp.get("end") === "1",
    filterHighTrust: sp.get("ht") === "1",
    filterLowCompetition: sp.get("lc") === "1",
    filterBestDealScore: sp.get("bd") === "1",
  };
}
