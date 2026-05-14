/**
 * GlobalSmartSearch — the search bar mounted at the top of every "deal" tab
 * (Trending, Auctions, Quick Snipes, Savvy Offers).
 *
 * Responsibilities:
 *   • Debounced (300 ms) text input wired into the shared `SearchIntent`.
 *   • Filter dropdown (Category / Trust Level / Best Move).
 *   • Quick suggestion chips beneath the bar.
 *   • Savvy AI clarification prompt for vague queries.
 *   • Recent-queries cache (localStorage) so users can jump tabs without
 *     re-typing.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useSearchIntent } from "../../context/SearchIntentContext";
import { recordSearchSignal } from "../../lib/sellerTrendEngine";
import {
  BestMoveTag,
  CategoryTag,
  QUICK_SUGGESTIONS,
  TrustLevel,
  applyIntentPatch,
  clarificationFor,
  evaluateSmartSearch,
  isIntentEmpty,
  parseQuery,
  type SearchIntent,
} from "../../lib/smartSearch";
import { getEffectiveSubscriptionTier } from "../../lib/tierMultiplier";
import { trackUpgradeClicked } from "../../lib/analytics";
import "../../styles/GlobalSmartSearch.css";

export type GlobalSmartSearchProps = {
  /** Page slug — affects placeholder copy + analytics tag. */
  scope:
    | "trending"
    | "auctions"
    | "quick-snipes"
    | "savvy-offers"
    | "dashboard"
    | "feed";
  /** Optional override placeholder. */
  placeholder?: string;
  /** Visual size treatment for host page emphasis. */
  size?: "default" | "hero";
  /** Hide persistent quick suggestions strip if host renders custom chips. */
  hideQuickSuggestions?: boolean;
  /** Optional route redirect when user submits a query. */
  submitRedirectPath?: string;
  /** Microcopy directly under the search bar (e.g. Auctions positioning). */
  subtext?: string | null;
  /**
   * Auctions: full-market UX — free users see locked Savvy filters + High Trust lock;
   * paid users can enable ranking filters.
   */
  auctionsMarketMode?: boolean;
  /** When a free user taps a locked premium filter (Auctions market mode). */
  onLockedPremiumClick?: () => void;
  /** Host feed is fetching (e.g. Quick Snipes / Auctions market results). */
  listLoading?: boolean;
};

const SCOPE_PLACEHOLDERS: Record<GlobalSmartSearchProps["scope"], string> = {
  trending: 'Search trending — try "ps5", "high trust deals", "ending soon"…',
  auctions: "Search the full market — unlock smarter filters ⚡",
  "quick-snipes": 'Search snipes — try "cheap gaming", "high trust", "ending soon"…',
  "savvy-offers": 'Search offers — try "ps5", "sneakers", "high trust deals"…',
  dashboard: 'Search everything — try "ps5 auctions", "high trust", "ending soon"…',
  feed: 'Search the feed — try "sneakers", "high trust", "under $50"…',
};

const CATEGORY_OPTIONS: Array<{ id: CategoryTag; label: string }> = [
  { id: "gaming", label: "Gaming" },
  { id: "phones", label: "Phones" },
  { id: "electronics", label: "Electronics" },
];

const TRUST_OPTIONS: Array<{ id: TrustLevel; label: string }> = [
  { id: "high", label: "High Trust" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "unverified", label: "Unverified" },
];

const BEST_MOVE_OPTIONS: Array<{ id: BestMoveTag; label: string }> = [
  { id: "safest", label: "Safest" },
  { id: "balanced", label: "Balanced" },
  { id: "risky", label: "Risky" },
];

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

export default function GlobalSmartSearch({
  scope,
  placeholder,
  size = "default",
  hideQuickSuggestions = false,
  submitRedirectPath,
  subtext,
  auctionsMarketMode = false,
  onLockedPremiumClick,
  listLoading = false,
}: GlobalSmartSearchProps) {
  const navigate = useNavigate();
  const { intent, recents, setIntent, patchIntent, resetIntent, commitQuery, commitMarketSearch } =
    useSearchIntent();

  const [subTier, setSubTier] = useState(() => getEffectiveSubscriptionTier());
  useEffect(() => {
    const onTier = () => setSubTier(getEffectiveSubscriptionTier());
    window.addEventListener("f10:subscription-tier-updated", onTier);
    return () => window.removeEventListener("f10:subscription-tier-updated", onTier);
  }, []);

  const isPaid = subTier !== "free";

  const notifyLockedPremium = useCallback(() => {
    trackUpgradeClicked("global_smart_search", { scope });
    onLockedPremiumClick?.();
  }, [scope, onLockedPremiumClick]);

  useEffect(() => {
    if (!auctionsMarketMode || isPaid) return;
    const hasPremiumFilters =
      intent.filterHighTrust || intent.filterLowCompetition || intent.filterBestDealScore;
    const hasHighTrustLevel = intent.trustLevels.includes("high");
    if (!hasPremiumFilters && !hasHighTrustLevel) return;
    patchIntent({
      filterHighTrust: false,
      filterLowCompetition: false,
      filterBestDealScore: false,
      trustLevels: intent.trustLevels.filter((t) => t !== "high"),
    });
  }, [
    auctionsMarketMode,
    isPaid,
    intent.filterHighTrust,
    intent.filterLowCompetition,
    intent.filterBestDealScore,
    intent.trustLevels,
    patchIntent,
  ]);

  const [text, setText] = useState<string>(intent.keywords || "");
  const [open, setOpen] = useState(false); // dropdown (filters / suggestions / recents)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clarification, setClarification] = useState<ReturnType<typeof clarificationFor> | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceIntentRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceMarketRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDebouncedRef = useRef<string>(text);
  /** Last string committed to market search (Auctions); avoids duplicate fetches while debouncing. */
  const lastMarketCommitRef = useRef<string>(String(intent.keywords || "").trim());
  const inputId = useId();
  const dropdownId = useId();

  // Keep local input in sync if the intent changes from elsewhere (e.g. user
  // tapped a suggestion on another tab and navigated here).
  useEffect(() => {
    if (intent.keywords !== lastDebouncedRef.current) {
      setText(intent.keywords || "");
      lastDebouncedRef.current = intent.keywords || "";
      if (auctionsMarketMode) {
        lastMarketCommitRef.current = String(intent.keywords || "").trim();
      }
    }
  }, [intent.keywords, auctionsMarketMode]);

  useEffect(() => {
    if (!auctionsMarketMode) return;
    const onFocus = () => {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };
    window.addEventListener("f10:focus-auction-search", onFocus);
    return () => window.removeEventListener("f10:focus-auction-search", onFocus);
  }, [auctionsMarketMode]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (e.target instanceof Node && wrapperRef.current.contains(e.target)) return;
      setOpen(false);
      setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Debounced commit of typed text into the shared intent (300 ms) — tabs other than Auctions market mode.
  useEffect(() => {
    if (auctionsMarketMode) return;
    if (debounceIntentRef.current) clearTimeout(debounceIntentRef.current);
    debounceIntentRef.current = setTimeout(() => {
      const trimmed = text.trim();
      if (trimmed === lastDebouncedRef.current) return;
      lastDebouncedRef.current = trimmed;

      const evaluated = evaluateSmartSearch(trimmed);
      // Preserve any active filter chips set via the dropdown by merging the
      // freshly-parsed intent on top of the existing one.
      setIntent({
        ...intent,
        keywords: evaluated.intent.keywords,
        categories: Array.from(new Set([...intent.categories, ...evaluated.intent.categories])),
        trustLevels: Array.from(new Set([...intent.trustLevels, ...evaluated.intent.trustLevels])),
        bestMoves: Array.from(new Set([...intent.bestMoves, ...evaluated.intent.bestMoves])),
        priceCap: evaluated.intent.priceCap ?? intent.priceCap,
        endingSoon: evaluated.intent.endingSoon || intent.endingSoon,
        filterHighTrust: intent.filterHighTrust,
        filterLowCompetition: intent.filterLowCompetition,
        filterBestDealScore: intent.filterBestDealScore,
      });
      setClarification(evaluated.vague ? evaluated.clarification : null);
    }, 300);

    return () => {
      if (debounceIntentRef.current) clearTimeout(debounceIntentRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, auctionsMarketMode]);

  // Auctions full market: never auto-run a market search while typing — only Search / Enter / chips commit.
  // Debounce here is for Savvy clarification hints only (no fetch, no intent keyword commit).
  useEffect(() => {
    if (!auctionsMarketMode) return;
    if (debounceMarketRef.current) clearTimeout(debounceMarketRef.current);
    debounceMarketRef.current = setTimeout(() => {
      const trimmed = text.trim();
      const evaluated = evaluateSmartSearch(trimmed);
      setClarification(evaluated.vague ? evaluated.clarification : null);
    }, 400);

    return () => {
      if (debounceMarketRef.current) clearTimeout(debounceMarketRef.current);
    };
  }, [text, auctionsMarketMode]);

  const submitCommittedSearch = useCallback(
    (raw: string) => {
      const trimmed = String(raw || "").trim();
      if (!trimmed) return;

      if (auctionsMarketMode) {
        if (trimmed.length < 2) return;
        if (trimmed === lastMarketCommitRef.current) {
          setOpen(false);
          setFiltersOpen(false);
          return;
        }
        lastMarketCommitRef.current = trimmed;
        const parsed = parseQuery(trimmed, intent);
        commitMarketSearch(trimmed);
        const firstCategory =
          (parsed.categories && parsed.categories[0]) ||
          (intent.categories && intent.categories[0]) ||
          null;
        recordSearchSignal(trimmed, firstCategory);
        setOpen(false);
        setFiltersOpen(false);
        return;
      }

      const parsed = parseQuery(trimmed, intent);
      setIntent(applyIntentPatch(intent, parsed));
      commitQuery(trimmed);
      const firstCategory =
        (parsed.categories && parsed.categories[0]) ||
        (intent.categories && intent.categories[0]) ||
        null;
      recordSearchSignal(trimmed, firstCategory);
      if (submitRedirectPath) {
        navigate({
          pathname: submitRedirectPath,
          search: `?q=${encodeURIComponent(trimmed)}`,
        });
      }
      setOpen(false);
      setFiltersOpen(false);
    },
    [auctionsMarketMode, commitMarketSearch, commitQuery, intent, navigate, setIntent, submitRedirectPath]
  );

  const onChipClick = useCallback(
    (patch: Parameters<typeof patchIntent>[0]) => {
      const kwField = typeof patch.keywords === "string" ? patch.keywords : null;
      const extraPatch: Partial<SearchIntent> = { ...patch };
      delete (extraPatch as { keywords?: string }).keywords;
      const hasExtra = Object.keys(extraPatch).length > 0;

      if (kwField) {
        setText(kwField);
        lastDebouncedRef.current = kwField;
        const kw = kwField.trim();
        if (auctionsMarketMode) {
          if (kw.length >= 2) {
            lastMarketCommitRef.current = kw;
            commitMarketSearch(kwField, hasExtra ? extraPatch : undefined);
            recordSearchSignal(kw, null);
          } else if (hasExtra) {
            patchIntent(extraPatch);
          }
        } else {
          patchIntent(patch);
          commitQuery(kwField);
        }
      } else {
        patchIntent(patch);
      }
      setOpen(false);
    },
    [auctionsMarketMode, commitMarketSearch, commitQuery, patchIntent]
  );

  const onClear = useCallback(() => {
    setText("");
    lastDebouncedRef.current = "";
    lastMarketCommitRef.current = "";
    resetIntent();
    setClarification(null);
    setOpen(false);
    setFiltersOpen(false);
  }, [resetIntent]);

  const activeChipCount = useMemo(() => {
    return (
      intent.categories.length +
      intent.trustLevels.length +
      intent.bestMoves.length +
      (intent.priceCap != null ? 1 : 0) +
      (intent.endingSoon ? 1 : 0) +
      (intent.filterHighTrust ? 1 : 0) +
      (intent.filterLowCompetition ? 1 : 0) +
      (intent.filterBestDealScore ? 1 : 0)
    );
  }, [intent]);

  const showRecents = open && recents.length > 0 && !text.trim();
  const showSuggestions = open;

  return (
    <div className="gss-wrap" ref={wrapperRef} data-scope={scope} data-size={size}>
      <div className="gss-bar" data-fetching={listLoading ? "1" : undefined}>
        {listLoading ? (
          <Loader2 className="gss-bar-icon gss-bar-icon--spin" aria-hidden />
        ) : (
          <Search className="gss-bar-icon" aria-hidden />
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-busy={listLoading}
          className="gss-input"
          placeholder={placeholder || SCOPE_PLACEHOLDERS[scope]}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitCommittedSearch(text);
            } else if (e.key === "Escape") {
              setOpen(false);
              setFiltersOpen(false);
            }
          }}
          aria-label="Smart search across deal tabs"
          aria-expanded={open}
          aria-controls={dropdownId}
          aria-haspopup="dialog"
          aria-autocomplete="none"
          autoComplete="off"
          spellCheck={false}
        />
        {!isIntentEmpty(intent) || text ? (
          <button
            type="button"
            className="gss-icon-btn"
            onClick={onClear}
            aria-label="Clear search and filters"
            title="Clear"
          >
            <X size={16} />
          </button>
        ) : null}
        {auctionsMarketMode ? (
          <button
            type="button"
            className="gss-submit-btn"
            onClick={() => submitCommittedSearch(text)}
            aria-label="Search market"
          >
            Search
          </button>
        ) : null}
        <button
          type="button"
          className={`gss-icon-btn ${filtersOpen ? "is-active" : ""}`}
          onClick={() => {
            setFiltersOpen((v) => !v);
            setOpen(true);
          }}
          aria-label="Toggle filter panel"
          aria-pressed={filtersOpen}
          title="Filters"
        >
          <SlidersHorizontal size={16} />
          {activeChipCount > 0 ? <span className="gss-badge">{activeChipCount}</span> : null}
        </button>
      </div>

      {subtext ? (
        <p className="gss-subtext" role="note">
          {subtext}
        </p>
      ) : null}

      {/* Active filter chips (always visible when set) */}
      {activeChipCount > 0 ? (
        <div className="gss-active-chips" role="list">
          {intent.categories.map((c) => (
            <button
              key={`cat-${c}`}
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() =>
                setIntent({ ...intent, categories: intent.categories.filter((x) => x !== c) })
              }
            >
              {c} ✕
            </button>
          ))}
          {intent.trustLevels.map((t) => (
            <button
              key={`trust-${t}`}
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() =>
                setIntent({ ...intent, trustLevels: intent.trustLevels.filter((x) => x !== t) })
              }
            >
              {t} trust ✕
            </button>
          ))}
          {intent.bestMoves.map((m) => (
            <button
              key={`move-${m}`}
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() =>
                setIntent({ ...intent, bestMoves: intent.bestMoves.filter((x) => x !== m) })
              }
            >
              {m} move ✕
            </button>
          ))}
          {intent.priceCap != null ? (
            <button
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() => setIntent({ ...intent, priceCap: null })}
            >
              under ${intent.priceCap} ✕
            </button>
          ) : null}
          {intent.endingSoon ? (
            <button
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() => setIntent({ ...intent, endingSoon: false })}
            >
              ending soon ✕
            </button>
          ) : null}
          {intent.filterHighTrust ? (
            <button
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() => setIntent({ ...intent, filterHighTrust: false })}
            >
              High Trust filter ✕
            </button>
          ) : null}
          {intent.filterLowCompetition ? (
            <button
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() => setIntent({ ...intent, filterLowCompetition: false })}
            >
              Low Competition ✕
            </button>
          ) : null}
          {intent.filterBestDealScore ? (
            <button
              type="button"
              role="listitem"
              className="gss-chip is-active"
              onClick={() => setIntent({ ...intent, filterBestDealScore: false })}
            >
              Best Deal Score ✕
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Savvy AI clarification — appears for vague queries */}
      {clarification ? (
        <div className="gss-clarify" role="status" aria-live="polite">
          <Sparkles size={16} className="gss-clarify-icon" />
          <span className="gss-clarify-text">{clarification.prompt}</span>
          <div className="gss-clarify-choices">
            {clarification.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="gss-chip gss-chip-ai"
                onClick={() => {
                  patchIntent(choice.patch);
                  setClarification(null);
                }}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Dropdown: filters + recents + suggestions */}
      {(open || filtersOpen) ? (
        <div id={dropdownId} className="gss-dropdown" role="dialog" aria-label="Search filters and suggestions">
          {filtersOpen ? (
            <div className="gss-section">
              <FilterGroup
                label="Category"
                options={CATEGORY_OPTIONS}
                selected={intent.categories}
                onToggle={(id) =>
                  setIntent({ ...intent, categories: toggleInArray(intent.categories, id) })
                }
              />
              <FilterGroup
                label="Trust Level"
                options={TRUST_OPTIONS}
                selected={intent.trustLevels}
                onToggle={(id) =>
                  setIntent({ ...intent, trustLevels: toggleInArray(intent.trustLevels, id) })
                }
                lockedOptionIds={
                  auctionsMarketMode && !isPaid ? (["high"] as TrustLevel[]) : undefined
                }
                onLockedOptionClick={() => notifyLockedPremium()}
              />
              <FilterGroup
                label="Best Move"
                options={BEST_MOVE_OPTIONS}
                selected={intent.bestMoves}
                onToggle={(id) =>
                  setIntent({ ...intent, bestMoves: toggleInArray(intent.bestMoves, id) })
                }
              />
              {auctionsMarketMode ? (
                <div className="gss-filter-group">
                  <div className="gss-section-label">Savvy ranking</div>
                  <p className="gss-filter-hint">
                    Unlock smarter ranking on the full market — same power, less noise, with
                    upgrade.
                  </p>
                  <div className="gss-chip-row">
                    <button
                      type="button"
                      className={`gss-chip ${intent.filterHighTrust ? "is-active" : ""} ${
                        !isPaid ? "is-locked" : ""
                      }`.trim()}
                      aria-disabled={!isPaid}
                      onClick={() => {
                        if (!isPaid) {
                          notifyLockedPremium();
                          return;
                        }
                        setIntent({ ...intent, filterHighTrust: !intent.filterHighTrust });
                      }}
                    >
                      High Trust filter {!isPaid ? "🔒" : ""}
                    </button>
                    <button
                      type="button"
                      className={`gss-chip ${intent.filterLowCompetition ? "is-active" : ""} ${
                        !isPaid ? "is-locked" : ""
                      }`.trim()}
                      aria-disabled={!isPaid}
                      onClick={() => {
                        if (!isPaid) {
                          notifyLockedPremium();
                          return;
                        }
                        setIntent({
                          ...intent,
                          filterLowCompetition: !intent.filterLowCompetition,
                        });
                      }}
                    >
                      Low Competition {!isPaid ? "🔒" : ""}
                    </button>
                    <button
                      type="button"
                      className={`gss-chip ${intent.filterBestDealScore ? "is-active" : ""} ${
                        !isPaid ? "is-locked" : ""
                      }`.trim()}
                      aria-disabled={!isPaid}
                      onClick={() => {
                        if (!isPaid) {
                          notifyLockedPremium();
                          return;
                        }
                        setIntent({
                          ...intent,
                          filterBestDealScore: !intent.filterBestDealScore,
                        });
                      }}
                    >
                      Best Deal Score {!isPaid ? "🔒" : ""}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showRecents ? (
            <div className="gss-section">
              <div className="gss-section-label">Recent</div>
              <div className="gss-chip-row">
                {recents.slice(0, 6).map((r) => (
                  <button
                    key={`recent-${r.q}`}
                    type="button"
                    className="gss-chip"
                    onClick={() => {
                      setText(r.q);
                      submitCommittedSearch(r.q);
                    }}
                  >
                    {r.q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showSuggestions ? (
            <div className="gss-section">
              <div className="gss-section-label">Quick suggestions</div>
              <div className="gss-chip-row">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="gss-chip"
                    onClick={() => onChipClick(s.patch)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Persistent quick suggestions strip beneath the bar (per spec) */}
      {!hideQuickSuggestions ? (
        <div className="gss-quicksuggest" role="list" aria-label="Quick suggestions">
          {QUICK_SUGGESTIONS.slice(0, 4).map((s) => (
            <button
              key={`qs-${s.id}`}
              type="button"
              role="listitem"
              className="gss-pill"
              onClick={() => onChipClick(s.patch)}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  lockedOptionIds,
  onLockedOptionClick,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  selected: T[];
  onToggle: (id: T) => void;
  lockedOptionIds?: T[];
  onLockedOptionClick?: () => void;
}) {
  const locked = lockedOptionIds ?? [];
  return (
    <div className="gss-filter-group">
      <div className="gss-section-label">{label}</div>
      <div className="gss-chip-row">
        {options.map((opt) => {
          const isOn = selected.includes(opt.id);
          const isLocked = locked.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className={`gss-chip ${isOn ? "is-active" : ""} ${isLocked ? "is-locked" : ""}`.trim()}
              aria-pressed={isOn}
              aria-disabled={isLocked}
              onClick={() => {
                if (isLocked) {
                  onLockedOptionClick?.();
                  return;
                }
                onToggle(opt.id);
              }}
            >
              {opt.label}
              {isLocked ? " 🔒" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
