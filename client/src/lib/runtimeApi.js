const LOCAL_API_ORIGIN = "http://localhost:5000";

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

function withApiSuffix(base) {
  if (!base) return "/api";
  if (base.endsWith("/api")) return base;
  return `${base}/api`;
}

export function getApiBaseUrl() {
  const configured = readConfiguredApiUrl();
  if (configured) return withApiSuffix(configured);

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${LOCAL_API_ORIGIN}/api`;
    }
  }

  return "/api";
}

export function buildApiUrl(path = "") {
  const base = getApiBaseUrl();
  const suffix = String(path || "").trim();
  if (!suffix) return base;
  if (suffix.startsWith("http://") || suffix.startsWith("https://")) return suffix;
  return `${base}${suffix.startsWith("/") ? "" : "/"}${suffix}`;
}
