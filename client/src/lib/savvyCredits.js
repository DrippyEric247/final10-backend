import { getDollarValue } from "./savvyValue";

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

function setSavvyCreditState(next) {
  const value = { ...defaultState(), ...next, updatedAt: Date.now() };
  localStorage.setItem(CREDIT_STATE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(SAVVY_CREDIT_EVENT, { detail: value }));
  return value;
}

export function convertPointsToCredits(pointsToConvert, currentPoints) {
  const pts = Math.max(0, Math.round(Number(pointsToConvert) || 0));
  const balance = Math.max(0, Math.round(Number(currentPoints) || 0));
  if (!pts) return { ok: false, reason: "Enter points to convert." };
  if (pts > balance) return { ok: false, reason: "Not enough Savvy points." };
  const addedCents = Math.round(getDollarValue(pts) * 100);
  const prev = getSavvyCreditState();
  const next = setSavvyCreditState({
    ...prev,
    creditCents: prev.creditCents + addedCents,
    history: [
      { id: `h_${Date.now()}`, type: "convert", points: pts, creditCents: addedCents, ts: Date.now() },
      ...prev.history,
    ].slice(0, 40),
  });
  return { ok: true, nextPoints: balance - pts, creditState: next };
}

export function redeemSavvyStoreItem(itemId, currentPoints) {
  const item = SAVVY_STORE_ITEMS.find((x) => x.id === itemId);
  if (!item) return { ok: false, reason: "Item unavailable." };
  const balance = Math.max(0, Math.round(Number(currentPoints) || 0));
  if (item.costSavvy > balance) return { ok: false, reason: "Not enough Savvy points." };
  const prev = getSavvyCreditState();
  const next = setSavvyCreditState({
    ...prev,
    creditCents: prev.creditCents + item.creditCents,
    premiumDays: prev.premiumDays + item.premiumDays,
    history: [
      {
        id: `h_${Date.now()}`,
        type: "redeem_item",
        itemId: item.id,
        itemLabel: item.label,
        points: item.costSavvy,
        creditCents: item.creditCents,
        premiumDays: item.premiumDays,
        ts: Date.now(),
      },
      ...prev.history,
    ].slice(0, 40),
  });
  return { ok: true, nextPoints: balance - item.costSavvy, creditState: next, item };
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

