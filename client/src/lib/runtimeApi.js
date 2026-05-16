const LOCAL_API_ORIGIN = "http://localhost:5000";

/**
 * Build-time / env API origin (no trailing slash, no `/api` suffix).
 * In production without env, use getApiOrigin() at runtime for same-origin `/api`.
 */
export const API_BASE_URL = String(
  process.env.REACT_APP_API_URL || process.env.VITE_API_URL || LOCAL_API_ORIGIN
)
  .trim()
  .replace(/\/+$/, "");

function clean(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readConfiguredApiUrl() {
  const runtime = typeof window !== "undefined" ? window.__APP_CONFIG__ || {} : {};
  return clean(
    runtime.VITE_API_URL ||
      runtime.REACT_APP_API_URL ||
      process.env.REACT_APP_API_URL ||
      process.env.VITE_API_URL
  );
}

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** API server origin without `/api` (empty => same-origin in production). */
export function getApiOrigin() {
  const configured = readConfiguredApiUrl();
  if (configured) return configured;
  if (isLocalDevHost()) return LOCAL_API_ORIGIN;
  return "";
}

function withApiSuffix(origin) {
  if (!origin) return "/api";
  if (origin.endsWith("/api")) return origin;
  return `${origin}/api`;
}

/** Axios/fetch API root including `/api` (e.g. http://localhost:5000/api or /api). */
export function getApiBaseUrl() {
  return withApiSuffix(getApiOrigin());
}

/**
 * Full URL for an API path (path should start with `/`, e.g. `/auth/login`).
 * Resolves to `${origin}/api/...` or `/api/...` when same-origin.
 */
export function buildApiUrl(path = "") {
  const base = getApiBaseUrl();
  const suffix = String(path || "").trim();
  if (!suffix) return base;
  if (suffix.startsWith("http://") || suffix.startsWith("https://")) return suffix;
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  if (normalized.startsWith("/api/")) {
    const origin = getApiOrigin();
    if (origin) return `${origin}${normalized}`;
    return normalized;
  }
  return `${base}${normalized}`;
}

export function buildAuthUrl(action) {
  const segment = String(action || "").replace(/^\/+/, "");
  return buildApiUrl(`/auth/${segment}`);
}
