import { DEAL_COACH_EVENT } from "./assistantSignals";

const DEDUPE_PREFIX = "f10_deal_coach_";

function readDedupe(key) {
  try {
    return Number(sessionStorage.getItem(DEDUPE_PREFIX + key) || 0);
  } catch {
    return 0;
  }
}

function writeDedupe(key) {
  try {
    sessionStorage.setItem(DEDUPE_PREFIX + key, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Ephemeral dock toast + optional low-noise panel row (caller can also pushAssistantSignal).
 * Dedupes by key for minIntervalMs to avoid spam on repeated clicks.
 */
export function pushDealCoachToast(
  { title, body, tone = "coach", eyebrow },
  dedupeKey,
  minIntervalMs = 90000
) {
  if (typeof window === "undefined" || !title || !body || !dedupeKey) return false;
  const last = readDedupe(dedupeKey);
  const now = Date.now();
  if (now - last < minIntervalMs) return false;
  writeDedupe(dedupeKey);
  window.dispatchEvent(
    new CustomEvent(DEAL_COACH_EVENT, {
      detail: { title, body, tone, ts: now, eyebrow },
    })
  );
  return true;
}

function sellerFeedback(item) {
  const raw = item?.sellerFeedbackPercent ?? item?.seller?.feedbackPercentage;
  if (raw == null || raw === "") return null;
  const n =
    typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function numPrice(item) {
  const v = item?.price ?? item?.currentPrice ?? item?.currentBid;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function numBids(item) {
  const n = Number(item?.bidCount ?? item?.bids ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function secondsLeft(item, elapsedSec) {
  const t = Number(item?.timeRemaining);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, t - elapsedSec);
}

function aiDealScore(item) {
  if (item?.aiScore && typeof item.aiScore === "object") {
    const d = Number(item.aiScore.dealPotential);
    if (Number.isFinite(d)) return d;
  }
  const flat = Number(item?.aiScore);
  return Number.isFinite(flat) ? flat : 0;
}

function sellerKey(item) {
  return (
    item?.sellerUsername ||
    item?.seller?.username ||
    item?.sellerId ||
    item?.seller?.sellerId ||
    ""
  );
}

function fmtMoney(n) {
  if (!Number.isFinite(n)) return "";
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

function shortTitle(t, max = 36) {
  const s = String(t || "Listing");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Before saving a listing to watchlist.
 */
export function coachBeforeSave(item, ctx) {
  const { visibleItems, watchlistIds, now, startTime } = ctx;
  const elapsed = Math.floor((now - startTime) / 1000);
  const id = String(item?.id || "");
  if (!id || !Array.isArray(visibleItems)) return;

  const selfP = numPrice(item);
  const selfB = numBids(item);
  const selfT = secondsLeft(item, elapsed);
  const selfAi = aiDealScore(item);
  const selfSeller = sellerKey(item);

  const others = visibleItems.filter((x) => String(x.id) !== id);

  const cheaper =
    Number.isFinite(selfP) &&
    others.find((o) => {
      const p = numPrice(o);
      const b = numBids(o);
      return (
        Number.isFinite(p) &&
        p > 0 &&
        p <= selfP * 0.93 &&
        b <= selfB + 1
      );
    });

  if (cheaper) {
    const cp = numPrice(cheaper);
    pushDealCoachToast(
      {
        tone: "coach",
        title: "Better deal on the board",
        body: `${shortTitle(cheaper.title)} at ${fmtMoney(cp)} — less spend than this pick.`,
      },
      `save-better-${id}`,
      120000
    );
    return;
  }

  const sniper =
    selfT != null &&
    others.find((o) => {
      const ot = secondsLeft(o, elapsed);
      const ob = numBids(o);
      return (
        ot != null &&
        ot > 0 &&
        ot < selfT &&
        ob < selfB &&
        ot <= 420
      );
    });

  if (sniper) {
    const ot = secondsLeft(sniper, elapsed);
    const ob = numBids(sniper);
    pushDealCoachToast(
      {
        tone: "urgent",
        title: "Faster final, fewer bidders",
        body: `${shortTitle(sniper.title)} — ends in ${Math.ceil(ot / 60)}m with ${ob} bids vs yours.`,
      },
      `save-sniper-${id}`,
      120000
    );
    return;
  }

  const stronger = others.find(
    (o) => aiDealScore(o) >= selfAi + 10 && aiDealScore(o) > 0 && selfAi > 0
  );
  if (stronger) {
    pushDealCoachToast(
      {
        tone: "coach",
        title: "Stronger AI signal nearby",
        body: `${shortTitle(stronger.title)} scores higher on deal edge before you lock this.`,
      },
      `save-ai-${id}`,
      120000
    );
    return;
  }

  if (selfSeller) {
    const sameSeller = others.filter(
      (o) => sellerKey(o) === selfSeller && sellerKey(o)
    );
    if (sameSeller.length >= 1) {
      pushDealCoachToast(
        {
          tone: "gem",
          title: "Same-seller bundle lane",
          body: `You’ve got ${sameSeller.length + 1} from this seller in view — stack saves, one checkout flow.`,
        },
        `save-seller-bundle-${selfSeller}`,
        180000
      );
      return;
    }
  }

  const nextCount = watchlistIds.length + 1;
  const tierAt = [3, 5, 10];
  const nextTier = tierAt.find((t) => nextCount < t);
  if (nextTier && nextCount === nextTier - 1) {
    pushDealCoachToast(
      {
        tone: "watch",
        title: "Watchlist tier one away",
        body: `After this save you’re 1 pick from the ${nextTier}-save multiplier band.`,
      },
      `save-tier-${nextTier}`,
      240000
    );
  }
}

/**
 * Before opening external deal (bid/buy on marketplace).
 */
export function coachBeforeBidOpen(item, ctx) {
  const id = String(item?.id || "");
  if (!id) return;
  const elapsed = Math.floor((ctx.now - ctx.startTime) / 1000);
  const selfP = numPrice(item);
  const selfB = numBids(item);
  const selfT = secondsLeft(item, elapsed);
  const others = (ctx.visibleItems || []).filter((x) => String(x.id) !== id);

  const betterComp =
    Number.isFinite(selfP) &&
    others.find((o) => {
      const p = numPrice(o);
      const b = numBids(o);
      return (
        Number.isFinite(p) &&
        p <= selfP * 1.08 &&
        b + 2 <= selfB
      );
    });

  if (betterComp) {
    pushDealCoachToast(
      {
        tone: "coach",
        title: "Less competition option",
        body: `${shortTitle(betterComp.title)} — similar price, fewer bids before you jump in.`,
      },
      `bid-comp-${id}`,
      120000
    );
    return;
  }

  if (selfT != null && selfT <= 180 && selfB <= 2) {
    pushDealCoachToast(
      {
        tone: "urgent",
        title: "Thin auction clock",
        body: "Low bids + tight timer — decide fast or star-save to track.",
      },
      `bid-urgent-${id}`,
      60000
    );
  }
}

/**
 * Before buying a bundle selection on Auctions page.
 */
export function coachBeforeBundleBuy({
  selectedBundleIds,
  visibleItems,
  watchlistIds,
  nextBundleTier,
  addForNextBundleTier,
  bundleMultiplier,
  weeklyMax,
}) {
  const n = selectedBundleIds?.length || 0;
  if (n === 0) return;

  if (n === 1) {
    pushDealCoachToast(
      {
        tone: "coach",
        title: "Solo buy skips stack value",
        body: "Add another saved pick to unlock bundle multipliers before checkout.",
      },
      "bundle-solo",
      120000
    );
    return;
  }

  if (
    nextBundleTier &&
    addForNextBundleTier === 1 &&
    n < (weeklyMax || 99)
  ) {
    pushDealCoachToast(
      {
        tone: "gem",
        title: "One more for tier jump",
        body: `Add 1 listing to hit ${nextBundleTier.multiplier}x — you’re at ${bundleMultiplier} now.`,
      },
      "bundle-one-more-tier",
      90000
    );
    return;
  }

  const set = new Set((selectedBundleIds || []).map(String));
  const selectedRows = (visibleItems || []).filter((x) =>
    set.has(String(x.id))
  );
  const sellerGroups = {};
  for (const row of selectedRows) {
    const k = sellerKey(row) || `_anon_${String(row.id)}`;
    sellerGroups[k] = (sellerGroups[k] || 0) + 1;
  }
  const multiSame = Object.values(sellerGroups).some((c) => c >= 2);
  if (multiSame && n >= 2) {
    const sum = selectedRows.reduce((acc, r) => {
      const p = numPrice(r);
      return acc + (Number.isFinite(p) ? p : 0);
    }, 0);
    pushDealCoachToast(
      {
        tone: "gem",
        title: "Same-seller stack",
        body: `Bundling ${n} picks${Number.isFinite(sum) && sum > 0 ? ` (~${fmtMoney(sum)})` : ""} — ship/logistics often cheaper together.`,
      },
      "bundle-same-seller",
      120000
    );
  }

  const wlExtra = (watchlistIds || []).filter((id) => !set.has(String(id)))
    .length;
  if (wlExtra > 0 && n < (weeklyMax || 99)) {
    pushDealCoachToast(
      {
        tone: "watch",
        title: "Saved picks left out",
        body: `${wlExtra} more saved in watchlist — consider swapping in a stronger pair.`,
      },
      "bundle-wl-extra",
      150000
    );
  }
}

/**
 * Before promoting a feed card.
 */
export function coachBeforePromote(item, sortedItems, promotedIds) {
  const id = String(item?.id || "");
  if (!id || promotedIds.includes(id)) return;
  const others = (sortedItems || []).filter(
    (x) => String(x.id) !== id && !promotedIds.includes(String(x.id))
  );

  const selfEnds =
    item?.endsIn || item?.endsAtHuman || item?.endTime || "";
  const selfAi =
    typeof item?.aiScore === "number"
      ? item.aiScore
      : Number(item?.aiScore?.dealPotential) || 0;
  const selfBids = numBids(item);

  const betterFirst = others.find((o) => {
    const oa =
      typeof o.aiScore === "number"
        ? o.aiScore
        : Number(o.aiScore?.dealPotential) || 0;
    return oa >= selfAi + 12;
  });

  if (betterFirst) {
    pushDealCoachToast(
      {
        tone: "promo",
        title: "Promote higher-edge first",
        body: `${shortTitle(betterFirst.title)} has a stronger AI score for the same boost slot.`,
      },
      `promo-ai-${id}`,
      120000
    );
    return;
  }

  const lowNoise = others.find((o) => numBids(o) + 3 <= selfBids);
  if (lowNoise) {
    pushDealCoachToast(
      {
        tone: "promo",
        title: "Lower competition alternate",
      body: `${shortTitle(lowNoise.title)} is quieter — promo budget may stretch further there.`,
      },
      `promo-bids-${id}`,
      120000
    );
    return;
  }

  if (String(selfEnds).length > 3) {
    pushDealCoachToast(
      {
        tone: "promo",
        title: "End-time promo ROI",
        body: "Ending-soon listings usually convert faster — good first promote if undecided.",
      },
      `promo-time-${id}`,
      180000
    );
  }
}

/**
 * Value-only hint for intent / dwell-based nudges (no toast). Short, direct copy.
 * @returns {{ payload: { title: string, body: string, tone: string }, dedupeKey: string } | null}
 */
export function buildProactiveOptimizationHint(item, ctx) {
  const id = String(item?.id || "");
  if (!id || !Array.isArray(ctx?.visibleItems)) return null;
  const { visibleItems, watchlistIds, now, startTime, isSaved } = ctx;
  const elapsed = Math.floor((now - startTime) / 1000);
  const selfP = numPrice(item);
  const selfB = numBids(item);
  const selfT = secondsLeft(item, elapsed);
  const selfAi = aiDealScore(item);
  const selfSeller = sellerKey(item);
  const selfFb = sellerFeedback(item);
  const others = visibleItems.filter((x) => String(x.id) !== id);

  const cheaper =
    Number.isFinite(selfP) &&
    others.find((o) => {
      const p = numPrice(o);
      const b = numBids(o);
      return (
        Number.isFinite(p) &&
        p > 0 &&
        p <= selfP * 0.93 &&
        b <= selfB + 1
      );
    });
  if (cheaper) {
    const cp = numPrice(cheaper);
    return {
      payload: {
        tone: "coach",
        title: "Cheaper win on the board",
        body: `${shortTitle(cheaper.title)} — ${fmtMoney(cp)}. Same hunt, less cash.`,
      },
      dedupeKey: `intent-opt-cheaper-${id}`,
    };
  }

  const sniper =
    selfT != null &&
    others.find((o) => {
      const ot = secondsLeft(o, elapsed);
      const ob = numBids(o);
      return (
        ot != null &&
        ot > 0 &&
        ot < selfT &&
        ob < selfB &&
        ot <= 420
      );
    });
  if (sniper) {
    const ot = secondsLeft(sniper, elapsed);
    const ob = numBids(sniper);
    return {
      payload: {
        tone: "urgent",
        title: "Ends sooner, quieter",
        body: `${shortTitle(sniper.title)} — ~${Math.ceil(ot / 60)}m left, only ${ob} bids.`,
      },
      dedupeKey: `intent-opt-sniper-${id}`,
    };
  }

  if (selfFb != null) {
    const alt = others.find((o) => {
      const f = sellerFeedback(o);
      const p = numPrice(o);
      return (
        f != null &&
        f >= selfFb + 5 &&
        Number.isFinite(selfP) &&
        Number.isFinite(p) &&
        p <= selfP * 1.12 &&
        p >= selfP * 0.88
      );
    });
    if (alt) {
      const af = sellerFeedback(alt);
      return {
        payload: {
          tone: "coach",
          title: "Stronger seller, similar price",
          body: `${shortTitle(alt.title)} — ${af}% vs ${selfFb}% here.`,
        },
        dedupeKey: `intent-opt-seller-${id}`,
      };
    }
  }

  if (selfSeller) {
    const sameSeller = others.filter(
      (o) => sellerKey(o) === selfSeller && sellerKey(o)
    );
    if (sameSeller.length >= 1) {
      return {
        payload: {
          tone: "gem",
          title: "Bundle same seller",
          body: `${sameSeller.length + 1} listings from one seller — combine saves, one checkout rhythm.`,
        },
        dedupeKey: `intent-opt-bundle-seller-${selfSeller}`,
      };
    }
  }

  if (
    selfT != null &&
    selfT > 0 &&
    selfT <= 360 &&
    selfB <= 2
  ) {
    return {
      payload: {
        tone: "urgent",
        title: "Clock + thin bids",
        body: "Almost nobody’s fighting this one yet — move or star-save before it slips.",
      },
      dedupeKey: `intent-opt-timing-${id}`,
    };
  }

  const stronger = others.find(
    (o) => aiDealScore(o) >= selfAi + 10 && aiDealScore(o) > 0 && selfAi > 0
  );
  if (stronger) {
    return {
      payload: {
        tone: "coach",
        title: "Higher edge nearby",
        body: `${shortTitle(stronger.title)} — AI likes it more before you commit.`,
      },
      dedupeKey: `intent-opt-ai-${id}`,
    };
  }

  if (!isSaved) {
    const nextCount = watchlistIds.length + 1;
    const tierAt = [3, 5, 10];
    const nextTier = tierAt.find((t) => nextCount < t);
    if (nextTier && nextCount === nextTier - 1) {
      return {
        payload: {
          tone: "watch",
          title: "Stack one more save",
          body: `Next save hits the ${nextTier}-pick bonus band — worth a glance elsewhere first.`,
        },
        dedupeKey: `intent-opt-tier-${nextTier}`,
      };
    }
  }

  return null;
}
