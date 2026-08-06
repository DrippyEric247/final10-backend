import { getSavvyCredits, convertSavvyToCreditsRemote, redeemSavvyStoreItemRemote } from "./api";

const CREDIT_STATE_KEY = "f10_savvy_credit_state_v1";
export const SAVVY_CREDIT_EVENT = "f10-savvy-credit-updated";
const MAX_DISCOUNT_PER_ORDER_PCT = 0.5;

export const SAVVY_STORE_ITEMS = [
  { id: "credit_500", label: "$5 Discount Credit", costSavvy: 500, creditCents: 500, premiumDays: 0 },
  { id: "credit_1000", label: "$10 Discount Credit", costSavvy: 1000, creditCents: 1000, premiumDays: 0 },
  { id: "premium_day_1000", label: "Premium Pass (1 Day)", costSavvy: 1000, creditCents: 0, premiumDays: 1 },
];

function defaultState() {
  return { creditCents: 0, premiumDays: 0, updatedAt: 0, history: [] };
}

function isAuthenticated() {
  try {
    return Boolean(localStorage.getItem("f10_token"));
  } catch {
    return false;
  }
}

function cacheCreditState(remote) {
  const value = {
    ...defaultState(),
    creditCents: Math.max(0, Number(remote?.creditCents) || 0),
    premiumDays: Math.max(0, Number(remote?.premiumDays) || 0),
    updatedAt: Date.now(),
    history: [],
  };
  try {
    localStorage.setItem(CREDIT_STATE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(SAVVY_CREDIT_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
  return value;
}

export function getSavvyCreditState() {
  try {
    const raw = JSON.parse(localStorage.getItem(CREDIT_STATE_KEY) || "{}");
    return {
      ...defaultState(),
      ...raw,
      creditCents: Math.max(0, Number(raw.creditCents) || 0),
      premiumDays: Math.max(0, Number(raw.premiumDays) || 0),
      history: Array.isArray(raw.history) ? raw.history.slice(0, 40) : [],
    };
  } catch {
    return defaultState();
  }
}

/** Hydrate credit wallet from server (authoritative when logged in). */
export async function syncSavvyCreditStateFromServer() {
  if (!isAuthenticated()) return getSavvyCreditState();
  try {
    const remote = await getSavvyCredits();
    return cacheCreditState(remote);
  } catch {
    return getSavvyCreditState();
  }
}

function setSavvyCreditState(next) {
  const value = { ...defaultState(), ...next, updatedAt: Date.now() };
  localStorage.setItem(CREDIT_STATE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(SAVVY_CREDIT_EVENT, { detail: value }));
  return value;
}

/** Convert Savvy → discount credits (server-authoritative when authenticated). */
export async function convertPointsToCredits(pointsToConvert, _currentPoints, idempotencyKey) {
  const pts = Math.max(0, Math.round(Number(pointsToConvert) || 0));
  if (!pts) return { ok: false, reason: "Enter points to convert." };

  if (isAuthenticated()) {
    try {
      const result = await convertSavvyToCreditsRemote({
        points: pts,
        idempotencyKey: idempotencyKey || `convert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
      if (!result?.ok) return { ok: false, reason: result?.error || "Could not convert points." };
      const creditState = cacheCreditState(result.creditState);
      return {
        ok: true,
        nextPoints: result.newBalance,
        newBalance: result.newBalance,
        creditState,
        pointsConverted: pts,
        duplicate: Boolean(result.duplicate),
      };
    } catch (err) {
      return { ok: false, reason: err?.response?.data?.error || err?.message || "Could not convert points." };
    }
  }

  return { ok: false, reason: "Sign in to convert Savvy to credits." };
}

/** Redeem Savvy store catalog item (server-authoritative when authenticated). */
export async function redeemSavvyStoreItem(itemId, _currentPoints, idempotencyKey) {
  const item = SAVVY_STORE_ITEMS.find((x) => x.id === itemId);
  if (!item) return { ok: false, reason: "Item unavailable." };

  if (isAuthenticated()) {
    try {
      const result = await redeemSavvyStoreItemRemote({
        itemId,
        idempotencyKey: idempotencyKey || `store_${itemId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
      if (!result?.ok) return { ok: false, reason: result?.error || "Could not redeem item." };
      const creditState = cacheCreditState(result.creditState);
      return {
        ok: true,
        nextPoints: result.newBalance,
        newBalance: result.newBalance,
        creditState,
        item: result.item || item,
        duplicate: Boolean(result.duplicate),
      };
    } catch (err) {
      return { ok: false, reason: err?.response?.data?.error || err?.message || "Could not redeem item." };
    }
  }

  return { ok: false, reason: "Sign in to redeem store items." };
}

export function getApplicableCreditForPrice(priceDollars, availableCreditCents) {
  const price = Math.max(0, Number(priceDollars) || 0);
  const avail = Math.max(0, Math.round(Number(availableCreditCents) || 0));
  const capped = Math.round(price * 100 * MAX_DISCOUNT_PER_ORDER_PCT);
  return Math.max(0, Math.min(avail, capped));
}

export function applyCreditToOrder(priceDollars, requestedCents) {
  const prev = getSavvyCreditState();
  const applicable = getApplicableCreditForPrice(priceDollars, requestedCents);
  if (applicable <= 0) return { ok: false, reason: "No credit available for this order." };
  if (applicable > prev.creditCents) return { ok: false, reason: "Credit balance is too low." };
  const next = setSavvyCreditState({
    ...prev,
    creditCents: prev.creditCents - applicable,
    history: [
      { id: `h_${Date.now()}`, type: "apply_credit", creditCents: applicable, ts: Date.now() },
      ...prev.history,
    ].slice(0, 40),
  });
  return {
    ok: true,
    appliedCents: applicable,
    creditState: next,
    discountedPrice: Math.max(0, (Math.round((Number(priceDollars) || 0) * 100) - applicable) / 100),
  };
}
