const LOCAL_API_ORIGIN = "http://localhost:5000";

function clean(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}

function readConfiguredApiUrl() {
  const runtime =
    typeof window !== "undefined" ? window.__APP_CONFIG__ || {} : {};
  return clean(
    runtime.REACT_APP_API_URL ||
      runtime.VITE_API_URL ||
      runtime.apiUrl ||
      process.env.REACT_APP_API_URL ||
      process.env.VITE_API_URL ||
      process.env.REACT_APP_API_BASE
  );
}

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Build-time API origin (no trailing slash, no `/api` suffix).
 * Falls back to localhost for local development builds.
 */
export const API_BASE_URL = clean(
  process.env.REACT_APP_API_URL ||
    process.env.VITE_API_URL ||
    process.env.REACT_APP_API_BASE ||
    LOCAL_API_ORIGIN
);

function warnMissingApiOnce() {
  if (typeof window === "undefined") return;
  if (window.__f10ApiWarned) return;
  window.__f10ApiWarned = true;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[Final10] REACT_APP_API_URL is not set. Backend API calls are disabled until it points at your server origin (e.g. https://your-api.onrender.com)."
    );
  }
}

/** API server origin without `/api`. Empty when unconfigured on static hosts (Vercel). */
export function getApiOrigin() {
  const configured = readConfiguredApiUrl();
  if (configured) return configured;
  if (isLocalDevHost()) return LOCAL_API_ORIGIN;
  return "";
}

export function isBackendApiConfigured() {
  return Boolean(getApiOrigin());
}

function withApiSuffix(origin) {
  if (!origin) return null;
  if (origin.endsWith("/api")) return origin;
  return `${origin}/api`;
}

/** Axios/fetch API root including `/api`, or null when backend URL is not configured. */
export function getApiBaseUrl() {
  const origin = getApiOrigin();
  if (!origin) return null;
  return withApiSuffix(origin);
}

/**
 * Full URL for an API path (path should start with `/`, e.g. `/auth/login`).
 * Returns null when REACT_APP_API_URL is missing in production (never same-origin `/api` on Vercel).
 */
export function buildApiUrl(path = "") {
  const base = getApiBaseUrl();
  const suffix = String(path || "").trim();

  if (!base) {
    if (suffix) warnMissingApiOnce();
    return null;
  }

  if (!suffix) return base;
  if (suffix.startsWith("http://") || suffix.startsWith("https://")) return suffix;

  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  if (normalized.startsWith("/api/")) {
    const origin = getApiOrigin();
    return origin ? `${origin}${normalized}` : null;
  }
  return `${base}${normalized}`;
}

/** POST target for client crash reports — `${REACT_APP_API_URL}/api/analytics/crash`. */
export function buildCrashReportUrl() {
  const origin = getApiOrigin();
  if (!origin) {
    warnMissingApiOnce();
    return null;
  }
  return `${origin}/api/analytics/crash`;
}

export function buildAuthUrl(action) {
  const segment = String(action || "").replace(/^\/+/, "");
  return buildApiUrl(`/auth/${segment}`);
}
