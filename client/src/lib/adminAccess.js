/** Client-side admin / operator access helpers (requires role from GET /api/auth/me). */

import { getCurrentUserSnapshot } from "./adminCosmetics";

export function getUserRole(user) {
  return String(user?.role || getCurrentUserSnapshot()?.role || "").toLowerCase();
}

export function isSuperAdminUser(user) {
  if (user?.isSuperAdmin === true) return true;
  const role = getUserRole(user);
  return role === "superadmin" || role === "owner";
}

export function isAdminUser(user) {
  if (user?.isAdmin === true || isSuperAdminUser(user)) return true;
  return getUserRole(user) === "admin";
}

export function hasAdminPermission(user, permissionKey) {
  if (isSuperAdminUser(user)) return true;
  return Boolean(user?.adminPermissions?.[permissionKey]);
}

export function canAccessInternalRoute(user, allowedRoles = ["admin", "superadmin", "owner"]) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const role = getUserRole(user);
  return allowedRoles.map((r) => r.toLowerCase()).includes(role);
}
