import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  buildAssistantHandoff,
  buildListingDraft,
  LISTING_ASSISTANT_STORAGE_KEY,
  type ListAssistantSeed,
} from "../../lib/listThisItemAssistantEngine";

type Props = {
  seed: ListAssistantSeed | null;
  onClose: () => void;
};

const PROMOTE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "electronics", label: "Electronics" },
  { value: "gaming", label: "Gaming" },
  { value: "tech", label: "Tech" },
  { value: "sneakers", label: "Sneakers" },
  { value: "fashion", label: "Fashion" },
  { value: "collectibles", label: "Collectibles" },
  { value: "home", label: "Home & garden" },
  { value: "auto", label: "Automotive" },
];

function formatMoney(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n)}`;
  }
}

export default function ListThisItemAssistantModal({ seed, onClose }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fastSale, setFastSale] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [targetCategory, setTargetCategory] = useState("all");
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [demandDays, setDemandDays] = useState(14);
  const [priceFloor, setPriceFloor] = useState(0);
  const [priceCeil, setPriceCeil] = useState(0);

  const draft = useMemo(() => (seed ? buildListingDraft(seed) : null), [seed]);

  const syncFromDraft = useCallback(() => {
    if (!draft) return;
    setTitle(draft.titleOptimized);
    setDescription(draft.description);
    setTagsStr(draft.tags.join(", "));
    setTargetCategory(draft.targetCategory);
    setCurrency(draft.currency);
    setDemandDays(draft.demandDaysEstimate);
    setPriceFloor(draft.priceFast);
    setPriceCeil(draft.priceMax);
    setPrice(fastSale ? draft.priceFast : draft.priceMax);
  }, [draft, fastSale]);

  useEffect(() => {
    if (!draft) return;
    setStep(1);
    setTitle(draft.titleOptimized);
    setDescription(draft.description);
    setTagsStr(draft.tags.join(", "));
    setTargetCategory(draft.targetCategory);
    setCurrency(draft.currency);
    setDemandDays(draft.demandDaysEstimate);
    setPriceFloor(draft.priceFast);
    setPriceCeil(draft.priceMax);
    setFastSale(true);
    setPrice(draft.priceFast);
  }, [draft]);

  useEffect(() => {
    if (!draft) return;
    setPrice(fastSale ? draft.priceFast : draft.priceMax);
  }, [fastSale, draft]);

  useEffect(() => {
    if (!seed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seed, onClose]);

  const tags = useMemo(
    () =>
      tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsStr]
  );

  const listingCopy = useMemo(() => {
    const lines = [
      `TITLE\n${title}`,
      `CATEGORY\n${PROMOTE_OPTIONS.find((o) => o.value === targetCategory)?.label ?? targetCategory}`,
      `SUGGESTED PRICE\n${formatMoney(currency, price)}`,
      `TAGS\n${tags.join(", ")}`,
      `DESCRIPTION\n${description}`,
      `NOTE\nAt today's heat, plan on ~${demandDays} days to move — heuristic from live signals, not a promise.`,
    ];
    return lines.join("\n\n");
  }, [title, targetCategory, price, currency, tags, description, demandDays]);

  const postHandoff = useCallback(() => {
    const flipRewardContext =
      seed?.kind === "flip"
        ? {
            dealItemId: seed.flip.itemId,
            buyPrice: seed.flip.buyPrice,
            suggestedSellMin: Math.min(priceFloor, priceCeil),
            suggestedSellMax: Math.max(priceFloor, priceCeil),
            predictedDaysToSell: demandDays,
            flipScore: seed.flip.flipScore,
            fromAiSuggestion: true,
          }
        : undefined;
    const handoff = buildAssistantHandoff({
      title,
      description,
      targetCategory,
      tags,
      priceFast: priceFloor,
      priceMax: priceCeil,
      currency,
      demandDaysEstimate: demandDays,
      fastSale,
      flipRewardContext,
    });
    try {
      sessionStorage.setItem(LISTING_ASSISTANT_STORAGE_KEY, JSON.stringify(handoff));
    } catch {
      /* ignore */
    }
    navigate("/promote-listing", { state: { listingAssistant: handoff } });
    onClose();
  }, [
    title,
    description,
    targetCategory,
    tags,
    priceFloor,
    priceCeil,
    currency,
    demandDays,
    fastSale,
    navigate,
    onClose,
    seed,
  ]);

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(listingCopy);
    } catch {
      /* ignore */
    }
  }, [listingCopy]);

  if (!seed || !draft) return null;

  const node = (
    <div
      className="seller-lassist-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="seller-lassist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-lassist-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="seller-pcalc-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="seller-lassist-steps" aria-hidden="true">
          <span className={step >= 1 ? "is-on" : ""}>1</span>
          <span className="seller-lassist-steps-line" />
          <span className={step >= 2 ? "is-on" : ""}>2</span>
          <span className="seller-lassist-steps-line" />
          <span className={step >= 3 ? "is-on" : ""}>3</span>
        </div>

        <h2 id="seller-lassist-title" className="seller-lassist-title">
          List it. Bank it.
        </h2>
        <p className="seller-lassist-source">
          {draft.sourceLabel} · {draft.categoryLabel}
        </p>

        {step === 1 ? (
          <div className="seller-lassist-panel">
            <p className="seller-lassist-lead">Let&apos;s get this sold</p>
            <p className="seller-lassist-hint">
              Title, lane, price band, and tags are already loaded from your signals — polish anything
              in the next step.
            </p>
            <ul className="seller-lassist-summary">
              <li>
                <span>Title</span>
                <strong>{title}</strong>
              </li>
              <li>
                <span>Category</span>
                <strong>{draft.categoryLabel}</strong>
              </li>
              <li>
                <span>Suggested price</span>
                <strong>
                  Fast {formatMoney(currency, priceFloor)} · Max {formatMoney(currency, priceCeil)}
                </strong>
              </li>
              <li>
                <span>Tags</span>
                <strong>{tagsStr || "—"}</strong>
              </li>
            </ul>
            <p className="seller-lassist-demand">
              At today&apos;s heat, this could move in <strong>{demandDays} days</strong> — not a promise,
              just the math on the signal.
            </p>
            <button type="button" className="seller-lassist-primary" onClick={() => setStep(2)}>
              Tune the listing
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="seller-lassist-panel">
            <div className="seller-lassist-ai">
              <div className="seller-lassist-ai-line">Title tuned to convert</div>
              <div className="seller-lassist-ai-line">
                {fastSale ? "Priced to move fast" : "Priced for max take"}
              </div>
              <div className="seller-lassist-ai-line muted">{draft.heatHint}</div>
            </div>

            <div className="seller-lassist-toggle-row" role="group" aria-label="Pricing strategy">
              <button
                type="button"
                className={`seller-lassist-toggle ${fastSale ? "is-on" : ""}`}
                onClick={() => setFastSale(true)}
              >
                Move it fast
              </button>
              <button
                type="button"
                className={`seller-lassist-toggle ${!fastSale ? "is-on" : ""}`}
                onClick={() => setFastSale(false)}
              >
                Hold out for more
              </button>
            </div>

            <label className="seller-pcalc-label">
              Title
              <input className="seller-pcalc-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="seller-pcalc-label">
              Lane to promote into
              <select
                className="seller-pcalc-input"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
              >
                {PROMOTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="seller-pcalc-label">
              Suggested price ({currency})
              <input
                className="seller-pcalc-input"
                type="number"
                min={0}
                step={1}
                value={Number.isFinite(price) ? price : 0}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              />
            </label>

            <label className="seller-pcalc-label">
              Tags <span className="seller-pcalc-optional">(comma-separated)</span>
              <input className="seller-pcalc-input" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
            </label>

            <label className="seller-pcalc-label">
              Description that sells the click
              <textarea
                className="seller-lassist-textarea"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="seller-lassist-nav">
              <button type="button" className="seller-lassist-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="seller-lassist-primary" onClick={() => setStep(3)}>
                Lock the copy
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="seller-lassist-panel">
            <p className="seller-lassist-lead">Packaged for paste</p>
            <p className="seller-lassist-demand">
              At today&apos;s heat, this could move in <strong>{demandDays} days</strong> — use it as a
              planning cue, not a guarantee.
            </p>
            <label className="seller-pcalc-label">
              Ready-to-copy listing
              <textarea className="seller-lassist-textarea seller-lassist-textarea--mono" readOnly rows={12} value={listingCopy} />
            </label>
            <div className="seller-lassist-nav seller-lassist-nav--stack">
              <button type="button" className="seller-lassist-secondary" onClick={copyAll}>
                Copy listing
              </button>
              <button type="button" className="seller-lassist-secondary" onClick={() => syncFromDraft()}>
                Auto-fill from this deal
              </button>
              <div className="seller-lassist-nav">
                <button type="button" className="seller-lassist-secondary" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="button" className="seller-lassist-primary" onClick={postHandoff}>
                  Post My Listing
                </button>
              </div>
              <p className="seller-lassist-footnote">
                One-tap post is on the way — for now we tee up promote with your lane and keywords.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
