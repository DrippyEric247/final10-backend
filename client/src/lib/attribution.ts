import { buildApiUrl } from "./runtimeApi";

/**
 * Creator / referral attribution capture.
 *
 * Captures attribution from the URL on app load and persists it to
 * localStorage so it survives across navigations and is available when the
 * user signs up. Also exposes a tiny client for click telemetry.
 */

export type AttributionSource =
  | "creator"
  | "referral"
  | "campaign"
  | "deeplink"
  | "organic";

export type Attribution = {
  /** Username/handle of the creator that drove this visit, when present. */
  creatorHandle: string | null;
  /** Server creator userId, if known (mirrors creatorHandle). */
  creatorId: string | null;
  /** Promo / creator code that should auto-apply on signup. */
  creatorCode: string | null;
  /** Generic referral userId (existing /register?ref= flow). */
  referralCode: string | null;
  /** Campaign tag from utm_campaign or ?c=. */
  campaign: string | null;
  /** What kind of source produced this attribution. */
  source: AttributionSource;
  /** When attribution was first captured (ms epoch). */
  capturedAt: number;
  /** Landing path the user first hit. */
  landingPath: string;
};

const KEY = "f10_attribution_v1";
const SHOWN_KEY = "f10_attribution_banner_dismissed_v1";

function readStorage(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(value: Attribution): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function pickFirst(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v && String(v).trim().length > 0) return String(v).trim();
  }
  return null;
}

/**
 * Inspects the current URL and persists attribution if any creator/referral
 * markers are present. Returns the active attribution (existing or new).
 *
 * Recognised query params (any of):
 *   ?creator=<handle>     — creator handle (preferred)
 *   ?c=<handle>           — short alias
 *   ?ref=<id>             — legacy referral id
 *   ?code=<promo>         — auto-apply creator code
 *   ?utm_source=<>        — falls back to source bucketing
 *   ?utm_campaign=<>      — campaign tag
 *
 * Path-based deep link: /c/<handle>  is also supported and translated.
 */
export function captureAttributionFromLocation(): Attribution | null {
  if (typeof window === "undefined") return null;
  const existing = readStorage();
  const url = new URL(window.location.href);
  const qs = url.searchParams;

  // path-based /c/<handle>
  let pathHandle: string | null = null;
  const pathMatch = url.pathname.match(/^\/c\/([A-Za-z0-9_.-]+)/);
  if (pathMatch) pathHandle = pathMatch[1];

  const creatorHandle = pickFirst(
    qs.get("creator"),
    qs.get("c"),
    pathHandle
  );
  const creatorCode = pickFirst(qs.get("code"), qs.get("promo"));
  const referralCode = pickFirst(qs.get("ref"));
  const campaign = pickFirst(qs.get("utm_campaign"), qs.get("campaign"));
  const utmSource = pickFirst(qs.get("utm_source"));

  const hasNewSignal =
    Boolean(creatorHandle) ||
    Boolean(creatorCode) ||
    Boolean(referralCode) ||
    Boolean(campaign) ||
    Boolean(utmSource);

  if (!hasNewSignal) return existing;

  let source: AttributionSource = "organic";
  if (creatorHandle || creatorCode) source = "creator";
  else if (referralCode) source = "referral";
  else if (campaign) source = "campaign";
  else if (utmSource) source = "deeplink";

  const next: Attribution = {
    creatorHandle: creatorHandle || existing?.creatorHandle || null,
    creatorId: existing?.creatorId || null,
    creatorCode: creatorCode || existing?.creatorCode || null,
    referralCode: referralCode || existing?.referralCode || null,
    campaign: campaign || existing?.campaign || null,
    source,
    capturedAt: existing?.capturedAt || Date.now(),
    landingPath: existing?.landingPath || url.pathname + url.search,
  };

  writeStorage(next);
  return next;
}

export function getAttribution(): Attribution | null {
  return readStorage();
}

export function clearAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function attributionBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAttributionBannerDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Build the payload that should be sent to the signup endpoint so the server
 * can persist attribution on the new user.
 */
export function buildSignupAttributionPayload(): Record<string, unknown> | null {
  const a = getAttribution();
  if (!a) return null;
  return {
    creatorHandle: a.creatorHandle,
    creatorCode: a.creatorCode,
    referralCode: a.referralCode,
    campaign: a.campaign,
    source: a.source,
    capturedAt: a.capturedAt,
    landingPath: a.landingPath,
  };
}

/**
 * Fire-and-forget click telemetry. Failures are swallowed — we never block
 * the UI on attribution beacons.
 */
export async function recordCreatorClick(
  fetcher: (url: string, init?: RequestInit) => Promise<unknown>
): Promise<void> {
  const a = getAttribution();
  if (!a || !a.creatorHandle) return;
  try {
    const clickUrl = buildApiUrl("/creators/click");
    await fetcher(clickUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorHandle: a.creatorHandle,
        creatorCode: a.creatorCode,
        campaign: a.campaign,
        source: a.source,
        landingPath: a.landingPath,
      }),
    });
  } catch {
    /* swallow */
  }
}
