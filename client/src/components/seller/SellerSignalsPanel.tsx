import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CategoryTrend } from "../../lib/sellerTrendEngine";
import type { EbayTrendForAssistant, ListAssistantSeed } from "../../lib/listThisItemAssistantEngine";
import {
  SELLER_SIGNAL_CATEGORY_OPTIONS,
  completeSellerSignalsSetup,
  getSellerIntelligenceProfile,
  recordSellerCategoryEngagement,
  saveSellerIntelligenceProfile,
  setSellerIntelligenceMode,
  type SellerIntelligenceMode,
  type SellerIntelligenceProfile,
  type SellerSignalCategoryId,
  SELLER_INTEL_PROFILE_EVENT,
} from "../../lib/sellerIntelligenceProfile";
import {
  SIGNAL_TYPE_LABELS,
  buildSavvyAiInsight,
  buildSellerIntelligenceDeck,
  filterAndSortSignals,
  sortDeckForYou,
  type EbayHotCategoryRow,
  type SellerIntelligenceCard,
  type SignalFilterId,
  type SizeIntelligencePayload,
} from "../../lib/sellerIntelligenceFeed";

function rowToAssistant(row: EbayHotCategoryRow): EbayTrendForAssistant {
  return {
    id: row.id,
    label: row.label,
    trendScore: row.trendScore,
    listingCount: row.listingCount,
    competitionLevel: row.competitionLevel,
    buyerActivityCopy: row.buyerActivityCopy,
    priceRange: row.priceRange
      ? {
          min: row.priceRange.min,
          max: row.priceRange.max,
          median: row.priceRange.median,
          currency: row.priceRange.currency,
        }
      : null,
    hotInCategoryKeywords: row.hotInCategoryKeywords,
    postNow: row.postNow,
  };
}

type Props = {
  userId: string | null | undefined;
  ebayRows: EbayHotCategoryRow[];
  localTrends: CategoryTrend[];
  onOpenListingAssistant: (seed: ListAssistantSeed) => void;
};

const FILTERS: { id: SignalFilterId; label: string }[] = [
  { id: "for_you", label: "For you" },
  { id: "my_categories", label: "My categories" },
  { id: "hot_today", label: "Hot today" },
  { id: "highest_margin", label: "Highest margin" },
  { id: "low_competition", label: "Low competition" },
  { id: "trending_up", label: "Trending up" },
  { id: "rare_opportunities", label: "Rare opportunities" },
];

const MODES: { id: SellerIntelligenceMode; label: string; hint: string }[] = [
  { id: "casual", label: "Casual", hint: "Simple lane reads" },
  { id: "pro", label: "Pro", hint: "Full metrics" },
  { id: "elite", label: "Elite", hint: "Momentum + outlook" },
];

export default function SellerSignalsPanel({
  userId,
  ebayRows,
  localTrends,
  onOpenListingAssistant,
}: Props): JSX.Element {
  const [profile, setProfile] = useState<SellerIntelligenceProfile>(() =>
    getSellerIntelligenceProfile(userId)
  );
  const [filter, setFilter] = useState<SignalFilterId>("for_you");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [editCategoriesOpen, setEditCategoriesOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<SellerSignalCategoryId[]>([]);

  const refreshProfile = useCallback(() => {
    setProfile(getSellerIntelligenceProfile(userId));
  }, [userId]);

  useEffect(() => {
    refreshProfile();
    const on = () => refreshProfile();
    window.addEventListener(SELLER_INTEL_PROFILE_EVENT, on);
    return () => window.removeEventListener(SELLER_INTEL_PROFILE_EVENT, on);
  }, [refreshProfile]);

  useEffect(() => {
    const p = getSellerIntelligenceProfile(userId);
    setProfile(p);
    if (!p.setupComplete) {
      setOnboardingOpen(true);
      setDraftCategories([]);
    }
  }, [userId]);

  const deck = useMemo(
    () => buildSellerIntelligenceDeck(ebayRows, localTrends),
    [ebayRows, localTrends]
  );

  const visibleCards = useMemo(() => {
    if (filter === "for_you") return sortDeckForYou(deck, profile);
    return filterAndSortSignals(deck, filter, profile);
  }, [deck, filter, profile]);

  const savvyLine = useMemo(() => buildSavvyAiInsight(deck, profile), [deck, profile]);

  const openEditCategories = () => {
    setDraftCategories(profile.categories.length ? [...profile.categories] : ["other"]);
    setEditCategoriesOpen(true);
  };

  const saveCategories = (cats: SellerSignalCategoryId[]) => {
    const next = completeSellerSignalsSetup(userId, cats);
    setProfile(next);
    setOnboardingOpen(false);
    setEditCategoriesOpen(false);
  };

  const toggleDraft = (id: SellerSignalCategoryId) => {
    setDraftCategories((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const onCardActivate = (card: SellerIntelligenceCard) => {
    recordSellerCategoryEngagement(card.feedCategory, userId ?? null);
  };

  const momentumRead = (card: SellerIntelligenceCard): string => {
    const base = card.sortKeys.heat;
    if (base >= 58) return `Momentum index high (${Math.round(base)}) — listings clear faster than peers.`;
    if (base >= 50) return `Momentum index firm (${Math.round(base)}) — buyers are active; stay sharp on price.`;
    return `Momentum index neutral (${Math.round(base)}) — selective bids; win on trust + media.`;
  };

  return (
    <section className="ssi-wrap" aria-label="Seller Signals intelligence">
      {onboardingOpen ? (
        <div className="ssi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ssi-onb-title">
          <div className="ssi-modal">
            <h2 id="ssi-onb-title" className="ssi-modal-title">
              What categories do you sell or want to learn?
            </h2>
            <p className="ssi-modal-sub">
              Pick everything that matters — we weight your feed, filters, and Savvy Scout reads toward these lanes.
            </p>
            <div className="ssi-chip-grid">
              {SELLER_SIGNAL_CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ssi-cat-chip ${draftCategories.includes(c.id) ? "is-on" : ""}`}
                  onClick={() => {
                    setDraftCategories((prev) => {
                      const has = prev.includes(c.id);
                      if (has) return prev.filter((x) => x !== c.id);
                      return [...prev, c.id];
                    });
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="ssi-modal-actions">
              <button
                type="button"
                className="ssi-btn ssi-btn-primary"
                onClick={() => saveCategories(draftCategories.length ? draftCategories : ["other"])}
              >
                Save &amp; enter Seller Signals
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editCategoriesOpen ? (
        <div className="ssi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ssi-edit-title">
          <div className="ssi-modal">
            <h2 id="ssi-edit-title" className="ssi-modal-title">
              Selling interests
            </h2>
            <div className="ssi-chip-grid">
              {SELLER_SIGNAL_CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`ssi-cat-chip ${draftCategories.includes(c.id) ? "is-on" : ""}`}
                  onClick={() => toggleDraft(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="ssi-modal-actions">
              <button type="button" className="ssi-btn ssi-btn-ghost" onClick={() => setEditCategoriesOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="ssi-btn ssi-btn-primary"
                onClick={() => {
                  saveSellerIntelligenceProfile({
                    userId: userId ?? null,
                    categories: draftCategories.length ? draftCategories : ["other"],
                    setupComplete: true,
                  });
                  refreshProfile();
                  setEditCategoriesOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ssi-toolbar">
        <div className="ssi-toolbar-row">
          <div className="ssi-modes" role="group" aria-label="Seller mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ssi-mode-pill ${profile.mode === m.id ? "is-active" : ""}`}
                title={m.hint}
                onClick={() => {
                  setSellerIntelligenceMode(m.id, userId ?? null);
                  refreshProfile();
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button type="button" className="ssi-linkish" onClick={openEditCategories}>
            Edit categories
          </button>
        </div>

        <div className="ssi-filter-scroll" role="tablist" aria-label="Signal filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`ssi-filter-chip ${filter === f.id ? "is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {savvyLine ? (
        <div className="ssi-savvy" aria-live="polite">
          <span className="ssi-savvy-mark">✦</span>
          <p className="ssi-savvy-text">{savvyLine}</p>
        </div>
      ) : null}

      {!ebayRows.length && !localTrends.length ? (
        <p className="ssi-empty">Signals appear as marketplace and Final10 motion combine — check back shortly.</p>
      ) : (
        <div className="ssi-card-grid">
          {visibleCards.length === 0 ? (
            <p className="ssi-empty">Nothing in this filter yet — try &ldquo;For you&rdquo; or widen categories.</p>
          ) : (
            visibleCards.map((card) => (
              <IntelligenceCard
                key={card.id}
                card={card}
                mode={profile.mode}
                onList={() => {
                  onCardActivate(card);
                  if (card.source === "ebay" && card.ebayRow) {
                    onOpenListingAssistant({ kind: "ebay", row: rowToAssistant(card.ebayRow) });
                  } else if (card.localTrend) {
                    onOpenListingAssistant({ kind: "local", trend: card.localTrend });
                  }
                }}
                onEngage={() => onCardActivate(card)}
                momentumRead={momentumRead(card)}
              />
            ))
          )}
        </div>
      )}

      <p className="ssi-footnote">
        Prices reflect live listing samples, not settled sales — use ranges as directional, not guarantees.
      </p>
    </section>
  );
}

function SizeIntelBlock({
  intel,
  casual,
}: {
  intel: SizeIntelligencePayload;
  casual: boolean;
}): JSX.Element | null {
  const sizes = intel.profitableSizes.filter(Boolean);
  if (sizes.length === 0) return null;

  if (casual) {
    const bits = [`Most profitable sizes: ${sizes.join(", ")}`];
    if (intel.tightSupplyLine) bits.push(intel.tightSupplyLine);
    return (
      <div className="ssi-size-intel ssi-size-intel--casual" aria-label="Size intelligence">
        <span className="ssi-size-intel-mark">👟</span>
        <p className="ssi-size-intel-casual-text">{bits.join(" · ")}</p>
      </div>
    );
  }

  return (
    <div className="ssi-size-intel" aria-label="Size intelligence">
      <div className="ssi-size-intel-kicker">Size intelligence</div>
      <p className="ssi-size-intel-line">
        <span className="ssi-size-intel-strong">Most profitable sizes:</span> {sizes.join(", ")}
      </p>
      {intel.tightSupplyLine ? <p className="ssi-size-intel-alert">{intel.tightSupplyLine}</p> : null}
      <p className="ssi-size-intel-note">{intel.detailNote}</p>
    </div>
  );
}

function IntelligenceCard({
  card,
  mode,
  onList,
  onEngage,
  momentumRead,
}: {
  card: SellerIntelligenceCard;
  mode: SellerIntelligenceMode;
  onList: () => void;
  onEngage: () => void;
  momentumRead: string;
}): JSX.Element {
  const casual = mode === "casual";
  const elite = mode === "elite";

  const trendArrow = card.trendDirection === "up" ? "↑" : card.trendDirection === "down" ? "↓" : "→";
  const trendWord =
    card.trendDirection === "up" ? "Trending up" : card.trendDirection === "down" ? "Trending down" : "Flat";

  return (
    <article className={`ssi-card ${card.signalTypes.includes("HOT_DEMAND") ? "is-hot" : ""}`}>
      <header className="ssi-card-head">
        <div>
          <div className="ssi-card-eyebrow">
            <span aria-hidden>{card.emoji}</span> {card.productLabel}
          </div>
          <h3 className="ssi-card-title">{card.headline}</h3>
        </div>
        <div className="ssi-card-types" aria-label="Signal types">
          {card.signalTypes.slice(0, 3).map((t) => (
            <span key={t} className="ssi-type-pill">
              {SIGNAL_TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      </header>

      {card.sizeIntelligence ? (
        <SizeIntelBlock intel={card.sizeIntelligence} casual={casual} />
      ) : null}

      {!casual ? (
        <dl className="ssi-metrics">
          <div>
            <dt>Demand</dt>
            <dd>{card.demandTrend}</dd>
          </div>
          <div>
            <dt>Typical price</dt>
            <dd>{card.avgPriceLine}</dd>
          </div>
          <div>
            <dt>Competition</dt>
            <dd>{card.competitionCopy}</dd>
          </div>
          <div>
            <dt>Supply</dt>
            <dd>{card.supplyLevel}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>
              {trendArrow} {trendWord}
            </dd>
          </div>
          <div>
            <dt>Est. margin</dt>
            <dd>{card.estimatedResaleMargin}</dd>
          </div>
        </dl>
      ) : (
        <ul className="ssi-casual-lines">
          <li>
            <strong>Demand</strong> {card.demandTrend}
          </li>
          <li>
            <strong>Edge</strong> {card.competitionCopy}
          </li>
          <li>
            <strong>Margin band</strong> {card.estimatedResaleMargin}
          </li>
        </ul>
      )}

      <div className="ssi-platforms">
        <span className="ssi-label">Best platforms</span>
        <span className="ssi-platform-list">{card.bestPlatforms.join(" · ")}</span>
      </div>

      {!casual ? (
        <div className="ssi-range-row">
          <div>
            <span className="ssi-label">Buy range</span>
            <span className="ssi-value">{card.suggestedBuyRange}</span>
          </div>
          <div>
            <span className="ssi-label">Sell range</span>
            <span className="ssi-value">{card.suggestedSellRange}</span>
          </div>
        </div>
      ) : null}

      {elite ? <p className="ssi-elite">{momentumRead}</p> : null}

      <p className="ssi-sample">{card.sampleNote}</p>

      <div className="ssi-card-actions">
        <button
          type="button"
          className="ssi-btn ssi-btn-primary ssi-btn-block"
          onClick={(e) => {
            e.stopPropagation();
            onEngage();
            onList();
          }}
        >
          List this lane
        </button>
      </div>
    </article>
  );
}
