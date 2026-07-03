/**
 * Normalize axios / fetch failures into a small, UI-safe shape.
 */
import {
  SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE,
  SAVVY_SCOUT_RETRY_FAILED_BODY,
} from "./savvyScoutRateLimitCopy";

/**
 * @param {unknown} e
 * @returns {{ status: number; code: string; message: string }}
 */
export function parseApiError(e) {
  const ax = e && typeof e === "object" && "response" in e ? e.response : null;
  const status = ax && typeof ax.status === "number" ? ax.status : 0;
  const data = ax && ax.data && typeof ax.data === "object" ? ax.data : {};
  const nestedMsg =
    data.message && typeof data.message === "object" && typeof data.message.message === "string"
      ? data.message.message
      : null;
  const code =
    (typeof data.code === "string" && data.code) ||
    (data.message && typeof data.message === "object" && typeof data.message.code === "string"
      ? data.message.code
      : null) ||
    (status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED");
  const message =
    nestedMsg ||
    (typeof data.error === "string" && data.error) ||
    (typeof data.message === "string" && data.message) ||
    (e && typeof e.message === "string" && e.message) ||
    "Something went wrong. Please try again.";
  return { status, code, message };
}

/**
 * User-facing copy for API failures.
 * Keeps details private while giving clear next steps.
 */
export function isRateLimitError(e) {
  return Boolean(e && (e.status === 429 || e.isRateLimited || e.isCoolingDown));
}

export function userSafeErrorMessage(e, fallback = "Something went wrong. Please try again.") {
  if (e?.isRateLimited || e?.isCoolingDown || e?.status === 429) {
    if (e?.isRateLimitExhausted) {
      return SAVVY_SCOUT_RETRY_FAILED_BODY;
    }
    return SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE;
  }
  const directMsg = e && typeof e.message === "string" ? e.message.trim() : "";
  if (directMsg && /rate limit|429|too many request/i.test(directMsg)) {
    return SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE;
  }
  const { status, message } = parseApiError(e);
  if (status === 401 || status === 403) {
    return "Your session expired. Please sign in again.";
  }
  if (status === 429) {
    return SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE;
  }
  if (status >= 500) {
    return "Service is temporarily unavailable. Please try again shortly.";
  }
  if (!status) {
    return "Network error. Check your connection and try again.";
  }
  if (typeof message === "string" && message.trim()) {
    const raw = message.trim();
    if (/rate limit|429|too many request/i.test(raw)) {
      return SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE;
    }
    if (/request failed with status code/i.test(raw)) {
      return fallback;
    }
    return raw;
  }
  return fallback;
}
