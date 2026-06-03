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

/** Exact operator hub at /admin (string match only — never RegExp). */
export function isExactAdminPath(pathname) {
  return String(pathname || "") === "/admin";
}

/** Operator hub alias at /dashboard/admin and nested tools under that prefix. */
export function isDashboardAdminPath(pathname) {
  const path = String(pathname || "");
  return path === "/dashboard/admin" || path.startsWith("/dashboard/admin/");
}

export function isAdminAreaPath(pathname) {
  return isExactAdminPath(pathname) || isDashboardAdminPath(pathname);
}

/** Escape a path segment for use inside a RegExp source (never pass full pathname). */
export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
