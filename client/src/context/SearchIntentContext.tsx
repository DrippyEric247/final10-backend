/**
 * SearchIntentContext — global provider for the active Smart Search intent.
 *
 * The provider keeps a single `intent` object in memory so that when the user
 * types a query on one tab (e.g. Trending) and switches to another (e.g.
 * Auctions), the search bar there is pre-populated and the host page can
 * filter against the same intent.
 *
 * The intent is also reflected onto the URL search params (`?q=&cat=&...`)
 * for shareability and back/forward navigation.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  EMPTY_INTENT,
  SearchIntent,
  applyIntentPatch,
  intentFromSearchParams,
  intentToSearchParams,
  isIntentEmpty,
  parseQuery,
} from "../lib/smartSearch";
import { trackEvent } from "../lib/analytics";
import {
  RecentQuery,
  getRecentQueries,
  pushRecentQuery,
} from "../lib/smartSearchCache";

const SEARCH_TAB_PATHS = new Set([
  "/trending",
  "/auctions",
  "/local-deals",
  "/savvy-offers",
]);

type SearchIntentContextValue = {
  intent: SearchIntent;
  /** Last query string committed for full-market fetches (Auctions); typing does not update this. */
  marketSearchKeywords: string;
  recents: RecentQuery[];
  setIntent: (next: SearchIntent) => void;
  patchIntent: (patch: Partial<SearchIntent>) => void;
  resetIntent: () => void;
  commitQuery: (raw: string) => void;
  /**
   * Applies parsed keywords + optional patch, updates `marketSearchKeywords`, and records recents.
   * Skips when trimmed length is 1 (minimum useful query is 2 characters).
   */
  commitMarketSearch: (raw: string, extraPatch?: Partial<SearchIntent>) => void;
};

const SearchIntentContext = createContext<SearchIntentContextValue | null>(null);

function readInitialIntentFromUrl(search: string): SearchIntent {
  try {
    const sp = new URLSearchParams(search);
    return intentFromSearchParams(sp);
  } catch {
    return { ...EMPTY_INTENT };
  }
}

export function SearchIntentProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [intent, setIntentState] = useState<SearchIntent>(() =>
    readInitialIntentFromUrl(location.search)
  );
  const [marketSearchKeywords, setMarketSearchKeywords] = useState(() =>
    String(readInitialIntentFromUrl(location.search).keywords || "").trim()
  );
  const [recents, setRecents] = useState<RecentQuery[]>(() => getRecentQueries());

  // Keep a ref so the URL-sync effect can compare against the latest value
  // without re-creating its dependency list every render.
  const lastSerializedRef = useRef<string>(intentToSearchParams(intent).toString());
  const prevPathRef = useRef<string>(location.pathname);

  // When navigating between search-aware tabs, project the active intent onto
  // the URL so the location reflects what the user is filtering by.
  useEffect(() => {
    if (!SEARCH_TAB_PATHS.has(location.pathname)) {
      lastSerializedRef.current = "";
      return;
    }
    const serialized = intentToSearchParams(intent).toString();
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    const search = serialized ? `?${serialized}` : "";
    if (search === location.search) return;
    navigate({ pathname: location.pathname, search }, { replace: true });
  }, [intent, location.pathname, location.search, navigate]);

  // When the user navigates *to* a search tab (e.g. via the nav bar) and the
  // URL carries search params, hydrate the in-memory intent from them. Only
  // hydrate when the in-memory intent is currently empty so we don't clobber
  // an active session.
  useEffect(() => {
    if (!SEARCH_TAB_PATHS.has(location.pathname)) return;
    if (!isIntentEmpty(intent)) return;
    const fromUrl = readInitialIntentFromUrl(location.search);
    if (!isIntentEmpty(fromUrl)) {
      setIntentState(fromUrl);
      setMarketSearchKeywords(String(fromUrl.keywords || "").trim());
    }
    // Intentionally only re-runs on path change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // When entering Auctions from another search tab, align committed market query with shared intent.
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (location.pathname !== "/auctions") return;
    if (prev === "/auctions") return;
    setMarketSearchKeywords(String(intent.keywords || "").trim());
  }, [location.pathname, intent.keywords]);

  const setIntent = useCallback((next: SearchIntent) => {
    setIntentState(next);
  }, []);

  const patchIntent = useCallback((patch: Partial<SearchIntent>) => {
    setIntentState((prev) => applyIntentPatch(prev, patch));
  }, []);

  const resetIntent = useCallback(() => {
    setIntentState({ ...EMPTY_INTENT });
    setMarketSearchKeywords("");
  }, []);

  const commitQuery = useCallback((raw: string) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return;
    trackEvent("search", {
      channel: "query_commit",
      queryPreview: trimmed.slice(0, 48),
      queryLen: trimmed.length,
    });
    const next = pushRecentQuery(trimmed);
    setRecents(next);
  }, []);

  const commitMarketSearch = useCallback((raw: string, extraPatch?: Partial<SearchIntent>) => {
    const trimmed = String(raw || "").trim();
    if (trimmed.length === 1) return;

    setIntentState((prev) => {
      const base = extraPatch ? applyIntentPatch(prev, extraPatch) : prev;
      if (!trimmed) {
        return { ...base, keywords: "" };
      }
      const parsed = parseQuery(trimmed, base);
      return applyIntentPatch(base, parsed);
    });

    setMarketSearchKeywords(trimmed);
    if (trimmed.length >= 2) {
      trackEvent("search", {
        channel: "market_keywords",
        queryPreview: trimmed.slice(0, 48),
        queryLen: trimmed.length,
      });
      const next = pushRecentQuery(trimmed);
      setRecents(next);
    }
  }, []);

  const value = useMemo<SearchIntentContextValue>(
    () => ({
      intent,
      marketSearchKeywords,
      recents,
      setIntent,
      patchIntent,
      resetIntent,
      commitQuery,
      commitMarketSearch,
    }),
    [
      intent,
      marketSearchKeywords,
      recents,
      setIntent,
      patchIntent,
      resetIntent,
      commitQuery,
      commitMarketSearch,
    ]
  );

  return (
    <SearchIntentContext.Provider value={value}>
      {children}
    </SearchIntentContext.Provider>
  );
}

export function useSearchIntent(): SearchIntentContextValue {
  const ctx = useContext(SearchIntentContext);
  if (!ctx) {
    // Tolerate usage outside provider (e.g. unit tests, stories) by returning
    // a no-op fallback instead of throwing — keeps the search bar from
    // crashing the whole app if the provider isn't mounted yet.
    return {
      intent: { ...EMPTY_INTENT },
      marketSearchKeywords: "",
      recents: [],
      setIntent: () => {},
      patchIntent: () => {},
      resetIntent: () => {},
      commitQuery: () => {},
      commitMarketSearch: () => {},
    };
  }
  return ctx;
}
