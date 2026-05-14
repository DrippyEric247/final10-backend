import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SavvyPointsIcon } from "../components/rewards/SavvyPointsIcon";
import { createAlert } from "../lib/api";
import {
  fetchInstantBestMove,
  interestLabelList,
  type InstantBestMoveCandidate,
  type InstantBestMoveResult,
} from "../lib/instantBestMove";
import { INTERESTS, labelForInterest } from "../lib/onboardingInterests";
import {
  getSelectedInterests,
  markOnboardingCompleted,
  recordFirstBestMove,
  type InterestId,
} from "../lib/onboardingPreferences";
import { onboardingAnalytics } from "../lib/onboardingAnalytics";
import { ANALYTICS_EVENTS, trackEvent, trackPointsEarned } from "../lib/analytics";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import SavvyAlertButton from "../components/alerts/SavvyAlertButton";
import "../styles/OnboardingBestMove.css";

const LOADING_STAGES = [
  "Scanning deals...",
  "Checking trust...",
  "Finding your Best Move...",
];

const FIRST_MOVE_BONUS_KEY = "f10_first_best_move_bonus_granted_v1";
const FIRST_MOVE_BONUS_POINTS = 25;

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: InstantBestMoveResult }
  | { kind: "error"; message: string };

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

function formatCountdown(seconds: number | null | undefined): string | null {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return null;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

function getEstimatedEarn(c: InstantBestMoveCandidate): number {
  const raw = c.listing as Record<string, unknown>;
  const explicit = Number(raw.estimatedPointsEarned);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const price =
    Number(c.listing.buyNowPrice ?? c.listing.currentBidPrice ?? c.listing.price) || 0;
  if (price <= 0) return 20;
  const trustBump = c.trust.trustScore >= 80 ? 1.2 : c.trust.trustScore >= 65 ? 1.05 : 0.9;
  return Math.max(15, Math.round(price * 0.18 * trustBump));
}

function getSecondsRemaining(c: InstantBestMoveCandidate): number | null {
  const raw = c.listing as Record<string, unknown>;
  const s =
    Number(raw.secondsRemaining) ||
    Number(raw.timeRemaining) ||
    0;
  return Number.isFinite(s) && s > 0 ? s : null;
}

function bestMoveLabel(c: InstantBestMoveCandidate): string {
  switch (c.decision.bestMove) {
    case "buy_now":
      return "Buy Now";
    case "bid":
      return "Bid";
    case "watch":
      return "Watch";
    default:
      return "Browse";
  }
}

function trustBand(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

/**
 * "Better than X% of scanned listings" — the pick is always ranked #1 so
 * it edges out every other candidate we scored. We clamp to 70% as a
 * floor so the copy still feels aspirational when the pool is thin, and
 * 99% as a ceiling because honesty matters.
 */
function betterThanPct(totalCandidates: number): number {
  if (!Number.isFinite(totalCandidates) || totalCandidates <= 1) return 82;
  const raw = ((totalCandidates - 1) / totalCandidates) * 100;
  return Math.min(99, Math.max(70, Math.round(raw)));
}

/**
 * Stable pseudo-random FOMO count (3–12) keyed on listing identity so the
 * number doesn't flicker on re-render but varies across picks. This is a
 * placeholder — the real "watchers" feed will replace it later.
 */
function fomoWatcherCount(c: InstantBestMoveCandidate): number {
  const key = String(
    c.listing.itemId ?? c.listing.id ?? c.listing.itemWebUrl ?? c.listing.title ?? "f10"
  );
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return 3 + (Math.abs(hash) % 10); // 3..12
}

/** Animated 0 → target count-up, ~900ms, ease-out cubic. */
function useCountUp(target: number, active: boolean, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }
    const safeTarget = Math.max(0, Math.round(target));
    if (safeTarget === 0) {
      setValue(0);
      return undefined;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * safeTarget));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, durationMs, target]);

  return value;
}

function grantFirstMoveBonusOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(FIRST_MOVE_BONUS_KEY) === "1") return false;
    window.localStorage.setItem(FIRST_MOVE_BONUS_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export default function OnboardingBestMove() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState<InterestId[]>(() =>
    getSelectedInterests()
  );
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [stageIdx, setStageIdx] = useState(0);
  const [selectedAltIdx, setSelectedAltIdx] = useState<number | null>(null);
  const [bonusShown, setBonusShown] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Redirect back to the preference picker if the user somehow lands here
  // without having chosen anything. This keeps /onboarding/best-move safe
  // to deep-link to.
  useEffect(() => {
    if (interests.length === 0) {
      navigate("/onboarding/preferences", { replace: true });
    }
  }, [interests.length, navigate]);

  const runFetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "loading" });
    setStageIdx(0);
    try {
      const data = await fetchInstantBestMove(interests, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setState({ kind: "ready", data });
      setSelectedAltIdx(null);
      if (data.pick) {
        recordFirstBestMove(
          data.pick.interest,
          String(data.pick.listing.itemId ?? data.pick.listing.id ?? "")
        );
        markOnboardingCompleted();
        onboardingAnalytics.bestMoveLoaded({
          category: data.pick.interest,
          trustBand: trustBand(data.pick.trust.trustScore),
          trustScore: data.pick.trust.trustScore,
          instantScore: data.pick.instantScore,
          savingsPercent: data.pick.savingsPercent,
          bestMove: data.pick.decision.bestMove,
          interests,
        });
      } else {
        onboardingAnalytics.bestMoveEmpty({
          interests,
          emptyInterests: data.emptyInterests,
          totalCandidates: data.totalCandidates,
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setState({ kind: "error", message });
    }
  }, [interests]);

  useEffect(() => {
    if (interests.length === 0) return;
    runFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [interests, runFetch]);

  // Loading stage rotator (pure UX flavor; doesn't gate the actual fetch).
  useEffect(() => {
    if (state.kind !== "loading") return;
    const id = window.setInterval(() => {
      setStageIdx((v) => (v + 1) % LOADING_STAGES.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [state.kind]);

  const readyData = state.kind === "ready" ? state.data : null;
  const active = useMemo<InstantBestMoveCandidate | null>(() => {
    if (!readyData) return null;
    if (selectedAltIdx != null && readyData.alternates[selectedAltIdx]) {
      return readyData.alternates[selectedAltIdx];
    }
    return readyData.pick;
  }, [readyData, selectedAltIdx]);

  // Fire the +25 Savvy dopamine hit once when a successful first match renders.
  useEffect(() => {
    if (bonusShown) return;
    if (!readyData?.pick) return;
    if (!grantFirstMoveBonusOnce()) {
      setBonusShown(true);
      return;
    }
    setBonusShown(true);
    trackPointsEarned(FIRST_MOVE_BONUS_POINTS, "onboarding_first_move_bonus", {});
    emitPowerToast(FIRST_MOVE_BONUS_POINTS, "Preferences saved");
  }, [bonusShown, readyData?.pick]);

  const handleView = useCallback(() => {
    if (!active) return;
    const url = String(active.listing.itemWebUrl || active.listing.url || "");
    onboardingAnalytics.viewClicked({
      category: active.interest,
      trustBand: trustBand(active.trust.trustScore),
      listingId: active.listing.itemId ?? active.listing.id,
      bestMove: active.decision.bestMove,
    });
    markOnboardingCompleted();
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    navigate("/local-deals");
  }, [active, navigate]);

  const handleSave = useCallback(() => {
    if (!active) return;
    onboardingAnalytics.saved({
      category: active.interest,
      trustBand: trustBand(active.trust.trustScore),
      listingId: active.listing.itemId ?? active.listing.id,
    });
    markOnboardingCompleted();
    navigate("/local-deals");
  }, [active, navigate]);

  const handleSkip = useCallback(() => {
    onboardingAnalytics.skipped({ interests });
    markOnboardingCompleted();
    navigate("/local-deals");
  }, [interests, navigate]);

  const handleCreateAlert = useCallback(async () => {
    if (creatingAlert) return;
    setCreatingAlert(true);
    try {
      const primary = interests[0];
      const label = primary ? labelForInterest(primary) : "Best Move";
      await createAlert({
        name: `Onboarding watch • ${label}`,
        keywords: interests.map((id) => labelForInterest(id)),
        minConfidence: 72,
        persona: "buyer",
        kind: "best_move_high_conf",
        sources: ["ebay"],
      });
      trackEvent(ANALYTICS_EVENTS.ALERT_CREATED, {
        kind: "best_move_high_conf",
        keywordCount: interests.length,
        hasMaxPrice: false,
        source: "onboarding_best_move",
      });
      onboardingAnalytics.skipped({ interests, from: "watching_alert_created" });
      markOnboardingCompleted();
      navigate("/alerts");
    } catch {
      // If alert creation fails (e.g. unauthenticated session), keep moving
      // forward so users never get stuck on an empty-state branch.
      markOnboardingCompleted();
      navigate("/register");
    } finally {
      setCreatingAlert(false);
    }
  }, [creatingAlert, interests, navigate]);

  const handleRefine = useCallback(() => {
    onboardingAnalytics.refined({ interests });
    navigate("/onboarding/preferences");
  }, [interests, navigate]);

  const handleShuffle = useCallback(() => {
    if (!readyData) return;
    if (!readyData.alternates.length) return;
    const nextIdx =
      selectedAltIdx == null
        ? 0
        : (selectedAltIdx + 1) % readyData.alternates.length;
    onboardingAnalytics.reshuffled({
      fromIndex: selectedAltIdx,
      toIndex: nextIdx,
    });
    setSelectedAltIdx(nextIdx);
  }, [readyData, selectedAltIdx]);

  const handleFallbackInterest = useCallback(
    (id: InterestId) => {
      setInterests([id]);
      onboardingAnalytics.refined({ from: "fallback", interest: id });
    },
    []
  );

  return (
    <div className="onboard-move-overlay" role="dialog" aria-labelledby="onboard-move-title">
      <div className="onboard-move-shell">
        {state.kind === "loading" ? (
          <LoadingPanel stage={LOADING_STAGES[stageIdx]} />
        ) : null}

        {state.kind === "error" ? (
          <ErrorPanel message={state.message} onRetry={runFetch} onSkip={handleSkip} />
        ) : null}

        {state.kind === "ready" && !readyData?.pick ? (
          <FallbackPanel
            interests={interests}
            emptyInterests={readyData?.emptyInterests ?? []}
            matchLabel={readyData?.matchLabel ?? "Savvy Watching"}
            matchMessage={readyData?.matchMessage ?? ""}
            onPickInterest={handleFallbackInterest}
            onRefine={handleRefine}
            onCreateAlert={handleCreateAlert}
            creatingAlert={creatingAlert}
          />
        ) : null}

        {state.kind === "ready" && active ? (
          <ResultPanel
            active={active}
            interests={interests}
            matchType={readyData?.matchType ?? "exact"}
            matchLabel={readyData?.matchLabel ?? "Exact Match"}
            matchMessage={readyData?.matchMessage ?? "High trust. Strong value. No guesswork."}
            pickedReason={readyData?.pickedReason ?? ""}
            hasAlternates={(readyData?.alternates.length ?? 0) > 0}
            totalCandidates={readyData?.totalCandidates ?? 0}
            bonusPoints={FIRST_MOVE_BONUS_POINTS}
            onView={handleView}
            onSave={handleSave}
            onShuffle={handleShuffle}
            onRefine={handleRefine}
            onSkip={handleSkip}
          />
        ) : null}
      </div>
    </div>
  );
}

function LoadingPanel({ stage }: { stage: string }) {
  return (
    <div className="onboard-move-loading">
      <div className="onboard-move-loading-ring" aria-hidden />
      <div className="onboard-move-eyebrow">Final10 · instant best move</div>
      <h2 id="onboard-move-title" className="onboard-move-loading-title">
        Finding your first Best Move
      </h2>
      <div className="onboard-move-loading-stage" aria-live="polite">
        {stage}
      </div>
      <ul className="onboard-move-loading-checks">
        <li>High-trust sellers</li>
        <li>Real market value gap</li>
        <li>Timing that works for you</li>
      </ul>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
  onSkip,
}: {
  message: string;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="onboard-move-error">
      <div className="onboard-move-eyebrow">Final10 · retry</div>
      <h2 id="onboard-move-title" className="onboard-move-error-title">
        Couldn&apos;t pull your Best Move
      </h2>
      <p className="onboard-move-error-body">
        Live deals are temporarily unreachable. This usually clears up in a moment.
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <div className="onboard-move-error-meta">{message}</div>
      ) : null}
      <div className="onboard-move-actions">
        <button type="button" className="onboard-move-btn ghost" onClick={onSkip}>
          Skip for now
        </button>
        <button type="button" className="onboard-move-btn primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

function FallbackPanel({
  interests,
  emptyInterests,
  matchLabel,
  matchMessage,
  onPickInterest,
  onRefine,
  onCreateAlert,
  creatingAlert,
}: {
  interests: InterestId[];
  emptyInterests: InterestId[];
  matchLabel: string;
  matchMessage: string;
  onPickInterest: (id: InterestId) => void;
  onRefine: () => void;
  onCreateAlert: () => void | Promise<void>;
  creatingAlert: boolean;
}) {
  const primary = interests[0];
  const primaryCfg = INTERESTS.find((i) => i.id === primary);
  const nearby = primaryCfg
    ? primaryCfg.neighbors.filter((id) => !interests.includes(id))
    : [];
  return (
    <div className="onboard-move-fallback">
      <div className="onboard-move-eyebrow">Final10 · {matchLabel}</div>
      <h2 id="onboard-move-title" className="onboard-move-fallback-title">
        Nothing strong in your picks yet — want Final10 to watch this for you?
      </h2>
      <p className="onboard-move-fallback-body">
        {matchMessage} Nothing live in{" "}
        <strong>{interestLabelList(interests)}</strong> cleared our trust +
        value bar, so Savvy will keep monitoring and notify you when a strong
        deal appears.
      </p>
      {emptyInterests.length ? (
        <div className="onboard-move-fallback-note">
          No strong live deal in{" "}
          <strong>{interestLabelList(emptyInterests)}</strong> right now.
        </div>
      ) : null}
      {nearby.length ? (
        <div className="onboard-move-fallback-grid">
          {nearby.map((id) => {
            const cfg = INTERESTS.find((i) => i.id === id);
            if (!cfg) return null;
            return (
              <button
                key={id}
                type="button"
                className="onboard-move-fallback-chip"
                onClick={() => onPickInterest(id)}
              >
                <span aria-hidden>{cfg.emoji}</span>
                Show strongest {cfg.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="onboard-move-actions">
        <button type="button" className="onboard-move-btn ghost" onClick={onRefine}>
          Adjust interests
        </button>
        <button type="button" className="onboard-move-btn primary" onClick={onCreateAlert} disabled={creatingAlert}>
          {creatingAlert ? "Creating Alert..." : "Create Alert"}
        </button>
      </div>
    </div>
  );
}

function ResultPanel({
  active,
  interests,
  matchType,
  matchLabel,
  matchMessage,
  pickedReason,
  hasAlternates,
  totalCandidates,
  bonusPoints,
  onView,
  onSave,
  onShuffle,
  onRefine,
  onSkip,
}: {
  active: InstantBestMoveCandidate;
  interests: InterestId[];
  matchType: InstantBestMoveResult["matchType"];
  matchLabel: InstantBestMoveResult["matchLabel"];
  matchMessage: string;
  pickedReason: string;
  hasAlternates: boolean;
  totalCandidates: number;
  bonusPoints: number;
  onView: () => void;
  onSave: () => void;
  onShuffle: () => void;
  onRefine: () => void;
  onSkip: () => void;
}) {
  const { listing, decision, trust, savingsAmount, savingsPercent } = active;
  const price =
    listing.buyNowPrice ?? listing.currentBidPrice ?? listing.currentBid ?? listing.price;
  const band = trustBand(trust.trustScore);
  const countdown = formatCountdown(getSecondsRemaining(active));
  const estimatedEarn = getEstimatedEarn(active);
  const title = String(listing.title || "Featured listing");
  const imageSrc = String(
    listing.imageUrl ||
      "https://via.placeholder.com/960x720/111827/A78BFA?text=Final10+Best+Move"
  );
  const pickId = String(
    listing.itemId ?? listing.id ?? listing.itemWebUrl ?? title
  );
  const isHighConfidence = decision.confidence === "high";
  const badgeLabel = matchLabel;
  const beatsPct = betterThanPct(totalCandidates);
  const watchers = fomoWatcherCount(active);
  const bonusCount = useCountUp(bonusPoints, true, 1100);
  const hasSavings = savingsAmount > 0;
  const displayedSavingsPct = hasSavings ? Math.max(1, Math.round(savingsPercent)) : 0;
  const numericPrice = Number(price);
  const alertPayload = {
    name: `First Best Move watch • ${labelForInterest(active.interest)}`,
    keywords: String(listing.title || labelForInterest(active.interest))
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5),
    ...(Number.isFinite(numericPrice) && numericPrice > 0 ? { maxPrice: numericPrice } : {}),
    minConfidence: 72,
    persona: "buyer",
    kind: "ending_soon",
    context: {
      source: "onboarding_best_move_alert_power",
      interest: active.interest,
      listingId: String(listing.itemId ?? listing.id ?? ""),
    },
  };

  return (
    <div
      className={`onboard-move-result is-entering ${
        isHighConfidence ? "is-high-confidence" : ""
      }`}
    >
      <div className="onboard-move-eyebrow">Your First Best Move</div>
      <h2 id="onboard-move-title" className="onboard-move-headline">
        Here&apos;s your Best Move.
      </h2>
      <p className="onboard-move-subhead">
        {matchMessage}
      </p>

      <article
        className={`onboard-move-card onboard-move-card-jackpot ${
          isHighConfidence ? "is-elite" : ""
        }`}
        key={pickId}
      >
        <div className="onboard-move-card-glow" aria-hidden />
        <div className="onboard-move-card-image">
          <img src={imageSrc} alt={title} loading="lazy" />
          <span
            className={`onboard-move-card-picked ${
              isHighConfidence ? "is-elite" : ""
            } is-${matchType}`}
          >
            {matchType === "exact" ? "✅ " : null}
            {matchType === "next_best_win" ? "🔥 " : null}
            {matchType === "closest_strong_match" ? "🎯 " : null}
            {matchType === "global_next_best_win" ? "🌍 " : null}
            {badgeLabel}
          </span>
          <span className="onboard-move-card-picked-reason">{pickedReason}</span>
          <span className="onboard-move-card-category">
            {labelForInterest(active.interest)}
          </span>
          {hasSavings ? (
            <span className="onboard-move-card-savings-flag" aria-hidden>
              −{displayedSavingsPct}% under market
            </span>
          ) : null}
        </div>
        <div className="onboard-move-card-body">
          <div className="onboard-move-card-move">{bestMoveLabel(active)}</div>
          <h3 className="onboard-move-card-title">{title}</h3>

          {hasSavings && listing.marketValue != null ? (
            <div className="onboard-move-price-hero" aria-label="Price vs market price">
              <div className="onboard-move-price-primary">
                {formatCurrency(price)}
              </div>
              <div className="onboard-move-price-compare">
                <span className="onboard-move-price-market">
                  {formatCurrency(listing.marketValue as number)}
                </span>
                <span className="onboard-move-price-delta">
                  Save {formatCurrency(savingsAmount)}
                  <span className="onboard-move-price-delta-pct">
                    ({displayedSavingsPct}%)
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="onboard-move-price-hero single">
              <div className="onboard-move-price-primary">
                {formatCurrency(price)}
              </div>
              {listing.marketValue != null ? (
                <div className="onboard-move-price-compare">
                  <span className="onboard-move-price-market">
                    Market {formatCurrency(listing.marketValue as number)}
                  </span>
                </div>
              ) : null}
            </div>
          )}

          <div className="onboard-move-card-grid">
            <div className={`onboard-move-stat trust trust-${band}`}>
              <div className="onboard-move-stat-label">Trust score</div>
              <div className="onboard-move-stat-value">
                {trust.trustScore}
                <span className="onboard-move-stat-suffix">
                  {" "}
                  · {band.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="onboard-move-stat rank">
              <div className="onboard-move-stat-label">Scored above</div>
              <div className="onboard-move-stat-value">
                {beatsPct}%
                <span className="onboard-move-stat-suffix"> of listings</span>
              </div>
            </div>
          </div>

          <div className="onboard-move-meta">
            <div className="onboard-move-meta-chip savvy">
              <SavvyPointsIcon size={16} glow />
              Earn ~{estimatedEarn} Savvy
            </div>
            {countdown ? (
              <div className="onboard-move-meta-chip urgent">⏱ {countdown}</div>
            ) : null}
            <div className="onboard-move-meta-chip fomo" aria-live="polite">
              👀 {watchers} people watching
            </div>
          </div>

          <div className="onboard-move-reward">
            <SavvyPointsIcon size={22} glow animated />
            <span>
              <strong className="onboard-move-reward-count">
                +{bonusCount} Savvy
              </strong>{" "}
              for setting your preferences — your first smart move starts with a
              bonus.
            </span>
          </div>

          <section className="onboard-move-alert-power" aria-label="Alert power comparison">
            <h4 className="onboard-move-alert-power-title">You found this manually...</h4>
            <p className="onboard-move-alert-power-sub">
              ⚡ Alerts would&apos;ve caught this instantly
            </p>
            <div className="onboard-move-alert-power-grid">
              <div className="onboard-move-alert-power-cell manual">
                <div className="onboard-move-alert-power-label">Manual</div>
                <div className="onboard-move-alert-power-value">Found after 5 min browsing</div>
              </div>
              <div className="onboard-move-alert-power-cell alert">
                <div className="onboard-move-alert-power-label">Alert</div>
                <div className="onboard-move-alert-power-value">Caught instantly when posted</div>
              </div>
            </div>
            <div className="onboard-move-alert-power-cta">
              <SavvyAlertButton
                label="Create Alert"
                payload={alertPayload}
              />
            </div>
            <div className="onboard-move-alert-power-helper">
              Let Final10 watch this for you
            </div>
          </section>

          <div className="onboard-move-actions">
            <button
              type="button"
              className="onboard-move-btn ghost"
              onClick={onSave}
            >
              Save &amp; Keep Browsing
            </button>
            <button
              type="button"
              className="onboard-move-btn primary onboard-move-lock-btn"
              onClick={onView}
            >
              <span className="onboard-move-lock-icon" aria-hidden>
                🔒
              </span>
              Lock This Deal
            </button>
          </div>

          <button
            type="button"
            className="onboard-move-btn secondary onboard-move-shuffle-btn"
            onClick={onShuffle}
            disabled={!hasAlternates}
            aria-disabled={!hasAlternates}
          >
            {hasAlternates ? "Show me another" : "No other strong picks right now"}
          </button>

          <div className="onboard-move-tertiary">
            <button type="button" className="onboard-move-link" onClick={onRefine}>
              Refine my interests
            </button>
            <button type="button" className="onboard-move-link muted" onClick={onSkip}>
              Skip for now
            </button>
          </div>
        </div>
      </article>

      <div className="onboard-move-footnote">
        Based on{" "}
        <strong>{interestLabelList(interests)}</strong> · we only surface picks
        that clear our trust bar.
      </div>
    </div>
  );
}
