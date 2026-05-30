import { buildCrashReportUrl } from "./runtimeApi";

/**
 * Captures window errors + React error boundary reports and POSTs to the backend
 * `${REACT_APP_API_URL}/api/analytics/crash` when configured.
 */

const reportedKeys = new Set();
const MAX_REPORTS_PER_SESSION = 12;
let reportCount = 0;

function crashReportingEnabled() {
  if (typeof process !== "undefined" && process.env.REACT_APP_ENABLE_CRASH_REPORTING === "false") {
    return false;
  }
  if (typeof process !== "undefined" && process.env.REACT_APP_ENABLE_CRASH_REPORTING === "true") {
    return true;
  }
  // Automatic global handlers off in production until explicitly enabled.
  return typeof process !== "undefined" && process.env.NODE_ENV !== "production";
}

function boundaryReportingEnabled() {
  if (typeof process !== "undefined" && process.env.REACT_APP_ENABLE_CRASH_REPORTING === "false") {
    return false;
  }
  return true;
}

function authHeaders() {
  try {
    const t = window.localStorage.getItem("f10_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function errorKey(payload) {
  const msg = String(payload?.message || "Error").slice(0, 240);
  const name = String(payload?.name || "").slice(0, 80);
  const boundary = String(payload?.extra?.boundary || "").slice(0, 80);
  return `${name}|${msg}|${boundary}`;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      message: "Unserializable crash payload",
      url: typeof window !== "undefined" ? window.location?.href : "",
      source: "client",
    });
  }
}

export function reportCrash(payload, { force = false } = {}) {
  if (typeof window === "undefined") return;
  if (!force && !boundaryReportingEnabled()) return;

  const message = String(payload?.message || "Error");
  if (/maximum call stack size exceeded/i.test(message)) {
    return;
  }

  const key = errorKey(payload);
  if (reportedKeys.has(key)) return;
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const url = buildCrashReportUrl();
  if (!url) return;

  reportedKeys.add(key);
  reportCount += 1;

  const isProd = process.env.NODE_ENV === "production";
  const body = safeStringify({
    message,
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
      mode: "cors",
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function initCrashReporting() {
  if (typeof window === "undefined" || window.__f10CrashInit) return;
  if (!crashReportingEnabled()) return;

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
    const err = r instanceof Error ? r : new Error(typeof r === "string" ? r : safeStringify(r));
    reportCrash({
      message: err.message,
      stack: err.stack,
      name: err.name,
      extra: { kind: "unhandledrejection" },
    });
  });
}
