/** Client-side admin and operator access helpers (requires role from GET /api/auth/me). */

import { getCurrentUserSnapshot } from "./adminCosmetics";

/** Founder account — always treated as admin in the UI. */
export const FOUNDER_ADMIN_EMAIL = "ericvasquez012@gmail.com";

export function isFounderAdminEmail(user) {
  return (
    String(user?.email || getCurrentUserSnapshot()?.email || "")
      .trim()
      .toLowerCase() === FOUNDER_ADMIN_EMAIL
  );
}

export function getUserRole(user) {
  const raw = String(user?.role || getCurrentUserSnapshot()?.role || "").toLowerCase();
  if (isFounderAdminEmail(user)) {
    return raw === "superadmin" ? "superadmin" : "admin";
  }
  return raw;
}

/** Operator nav: admin role or founder email (never regex on paths). */
export function shouldShowAdminNav(user) {
  if (!user) return false;
  const email = String(user.email || "").trim().toLowerCase();
  if (email === FOUNDER_ADMIN_EMAIL) return true;
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "superadmin") return true;
  return hasAdminRole(user);
}

/** True when role is admin or superadmin (operator nav). */
export function hasAdminRole(user) {
  if (isFounderAdminEmail(user)) return true;
  const role = getUserRole(user);
  if (role === "admin" || role === "superadmin") return true;
  if (user?.isAdmin === true || user?.isSuperAdmin === true) return true;
  return false;
}

export function isSuperAdminUser(user) {
  if (user?.isSuperAdmin === true) return true;
  const role = getUserRole(user);
  return role === "superadmin" || role === "owner";
}

export function isAdminUser(user) {
  if (hasAdminRole(user)) return true;
  if (user?.isAdmin === true || isSuperAdminUser(user)) return true;
  return getUserRole(user) === "admin";
}

export function hasAdminPermission(user, permissionKey) {
  if (isFounderAdminEmail(user) || isSuperAdminUser(user)) return true;
  return Boolean(user?.adminPermissions?.[permissionKey]);
}

export function canAccessInternalRoute(user, allowedRoles = ["admin", "superadmin", "owner"]) {
  if (!user) return false;
  if (isFounderAdminEmail(user)) return true;
  if (isSuperAdminUser(user)) return true;
  const role = getUserRole(user);
  return allowedRoles.map((r) => r.toLowerCase()).includes(role);
}
