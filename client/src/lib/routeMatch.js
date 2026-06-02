/**
 * Safe React Router path matching — always use string prefixes, never
 * `new RegExp(pathname)` (paths like "/admin" break RegExp parsing).
 */

export function matchRoutePrefix(pathname, prefix) {
  const path = String(pathname || "");
  const base = String(prefix || "");
  if (!base) return false;
  if (path === base) return true;
  return path.startsWith(`${base}/`);
}

export function matchAnyRoutePrefix(pathname, prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [];
  return list.some((prefix) => matchRoutePrefix(pathname, prefix));
}

/** Escape a path segment for use inside a RegExp source (never pass full pathname). */
export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
