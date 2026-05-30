import { buildCrashReportUrl } from "./runtimeApi";

/**
 * Captures window errors + React error boundary reports and POSTs to the backend
 * `${REACT_APP_API_URL}/api/analytics/crash` when configured.
 */

function authHeaders() {
  try {
    const t = window.localStorage.getItem("f10_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export function reportCrash(payload) {
  if (typeof window === "undefined") return;

  const url = buildCrashReportUrl();
  if (!url) return;

  const isProd = process.env.NODE_ENV === "production";
  const body = JSON.stringify({
    message: payload.message || "Error",
    stack: isProd ? undefined : payload.stack,
    componentStack: isProd ? undefined : payload.componentStack,
    url: window.location?.href,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    name: payload.name,
    extra: payload.extra || {},
    source: "client",
  });

  try {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function initCrashReporting() {
  if (typeof window === "undefined" || window.__f10CrashInit) return;
  window.__f10CrashInit = true;

  window.addEventListener(
    "error",
    (event) => {
      const err = event.error;
      reportCrash({
        message: err?.message || event.message || "window.error",
        stack: err?.stack,
        name: err?.name,
        extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      });
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const r = event.reason;
    const err = r instanceof Error ? r : new Error(typeof r === "string" ? r : JSON.stringify(r));
    reportCrash({
      message: err.message,
      stack: err.stack,
      name: err.name,
      extra: { kind: "unhandledrejection" },
    });
  });
}
