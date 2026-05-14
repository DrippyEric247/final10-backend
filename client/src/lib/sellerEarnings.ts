/**
 * Tracks Savvy points earned TODAY by listening to real reward events.
 *
 * Every reward in Final10 (buyer toast, seller toast, smart-coach
 * nudge, tour completion, etc.) flows through `POWER_TOAST_EVENT`. We
 * subscribe once, aggregate into a rolling per-day bucket keyed by the
 * user's local date, and expose a tiny hook for components.
 *
 * The store intentionally lives in localStorage (no server dependency)
 * so the dashboard reads the same number the toast host just showed the
 * user — zero reconciliation lag.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "f10_seller_savvy_today_v1";
const POWER_TOAST_EVENT = "f10-power-toast";
const SELLER_EARNINGS_UPDATED = "f10:seller-earnings-updated";

type DailyBucket = {
  /** Local ISO date (YYYY-MM-DD) this bucket represents. */
  date: string;
  /** Running total of points earned today. */
  totalToday: number;
  /** Breakdown so UI can say "12 buyer earns, 3 seller earns" later. */
  buyer: number;
  seller: number;
  other: number;
};

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyBucket(): DailyBucket {
  return { date: todayKey(), totalToday: 0, buyer: 0, seller: 0, other: 0 };
}

function readBucket(): DailyBucket {
  if (typeof window === "undefined") return emptyBucket();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyBucket();
    const parsed = JSON.parse(raw) as Partial<DailyBucket>;
    if (!parsed || parsed.date !== todayKey()) {
      // date rolled over → start a fresh bucket
      return emptyBucket();
    }
    return {
      date: parsed.date,
      totalToday: Math.max(0, Number(parsed.totalToday) || 0),
      buyer: Math.max(0, Number(parsed.buyer) || 0),
      seller: Math.max(0, Number(parsed.seller) || 0),
      other: Math.max(0, Number(parsed.other) || 0),
    };
  } catch {
    return emptyBucket();
  }
}

function writeBucket(bucket: DailyBucket): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
    window.dispatchEvent(new CustomEvent(SELLER_EARNINGS_UPDATED));
  } catch {
    /* ignore */
  }
}

/**
 * Classifies a reward event so the bucket can break down buyer vs seller
 * contributions. We key off the praise string used across the app —
 * those are small, stable, and set via helpers in `dualEarn.ts`.
 */
function classifyPraise(praise: string | null | undefined): keyof Pick<DailyBucket, "buyer" | "seller" | "other"> {
  const p = String(praise || "").toLowerCase();
  if (!p) return "other";
  if (p.includes("smart buy") || p.includes("savvy watch") || p.includes("strong bid")) {
    return "buyer";
  }
  if (p.includes("listing activity") || p.includes("sale completed") || p.includes("trending category")) {
    return "seller";
  }
  return "other";
}

type PowerToastDetail = { points?: number; praise?: string | null };

/**
 * Idempotent installer — safe to call from multiple components. Hooks
 * into the global toast bus and accumulates into today's bucket. Re-
 * installing is a no-op.
 */
let installed = false;
export function ensureEarningsTracker(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<PowerToastDetail>).detail;
    const points = Number(detail?.points);
    if (!Number.isFinite(points) || points <= 0) return;
    const bucket = readBucket();
    if (bucket.date !== todayKey()) {
      // Someone tabbed midnight — start fresh before adding.
      writeBucket({ ...emptyBucket(), ...addPoints(emptyBucket(), points, detail?.praise) });
      return;
    }
    writeBucket(addPoints(bucket, points, detail?.praise));
  };
  window.addEventListener(POWER_TOAST_EVENT, listener);
}

function addPoints(bucket: DailyBucket, points: number, praise?: string | null): DailyBucket {
  const kind = classifyPraise(praise);
  return {
    ...bucket,
    totalToday: bucket.totalToday + points,
    buyer: bucket.buyer + (kind === "buyer" ? points : 0),
    seller: bucket.seller + (kind === "seller" ? points : 0),
    other: bucket.other + (kind === "other" ? points : 0),
  };
}

export type EarningsSnapshot = DailyBucket & {
  /** True when any points have been earned today (UI can dim empty state). */
  hasActivity: boolean;
};

export function getEarningsSnapshot(): EarningsSnapshot {
  const bucket = readBucket();
  return { ...bucket, hasActivity: bucket.totalToday > 0 };
}

export function resetEarningsToday(): void {
  writeBucket(emptyBucket());
}

/**
 * React hook that returns a live-updating snapshot. Auto-installs the
 * tracker on first use so callers don't need to thread it through App.js.
 */
export function useEarningsToday(): EarningsSnapshot {
  const [snap, setSnap] = useState<EarningsSnapshot>(() => getEarningsSnapshot());

  useEffect(() => {
    ensureEarningsTracker();
    const onUpdate = () => setSnap(getEarningsSnapshot());
    window.addEventListener(SELLER_EARNINGS_UPDATED, onUpdate);
    // Also refresh once per minute so a midnight rollover reflects
    // without the user needing to fire a new event.
    const t = window.setInterval(() => setSnap(getEarningsSnapshot()), 60 * 1000);
    return () => {
      window.removeEventListener(SELLER_EARNINGS_UPDATED, onUpdate);
      window.clearInterval(t);
    };
  }, []);

  return snap;
}
