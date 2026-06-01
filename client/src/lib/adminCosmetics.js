/**
 * Admin-granted cosmetics — exclusive calling cards + emblems that normal
 * progression cannot unlock. Manual grant/revoke with an audit log.
 *
 * Storage (localStorage):
 *   f10_exclusive_grants_v1 → { [userKey]: { [itemId]: { grantedBy, grantedAt, note } } }
 *   f10_exclusive_audit_v1  → last 200 grant/revoke events (global)
 *   f10_current_user        → snapshot of { id, username, email, role } for local lookups
 *
 * All writes dispatch `f10-admin-cosmetics-updated` so the Customization page
 * refreshes without a reload.
 */

import { isSuperAdminUser } from "./adminAccess";

const GRANTS_KEY = "f10_exclusive_grants_v1";
const AUDIT_KEY = "f10_exclusive_audit_v1";
const CURRENT_USER_KEY = "f10_current_user";
const AUDIT_CAP = 200;
const UPDATE_EVENT = "f10-admin-cosmetics-updated";

// Role → items that are considered auto-granted. Keeps "tied to influencer
// account flag" / "dev/admin only" requirements working without a backend.
const ROLE_AUTO_GRANTS = {
  influencer: ["card_savvy_creator", "sigil_savvy_creator"],
  developer: ["card_savvy_core", "sigil_savvy_core"],
  dev: ["card_savvy_core", "sigil_savvy_core"],
  superadmin: [
    "card_founders_circle",
    "sigil_founders_circle",
    "card_savvy_elite",
    "sigil_savvy_elite",
    "card_the_signal",
    "sigil_the_signal",
    "card_savvy_core",
    "sigil_savvy_core",
    "card_debug_king",
    "sigil_debug_king",
  ],
};

function safeLS() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function read(key, fallback) {
  const ls = safeLS();
  if (!ls) return fallback;
  try {
    const raw = JSON.parse(ls.getItem(key) || "null");
    return raw == null ? fallback : raw;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — best-effort */
  }
}

function emitUpdate() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch {
    /* ignore */
  }
}

// ----- current-user identity ------------------------------------------------

/**
 * Call this once the auth layer has hydrated a user. We store a thin snapshot
 * so the pure `check()` functions in customizationCatalog can resolve "is this
 * card granted to the current user?" without needing React context.
 */
export function setCurrentUserForCosmetics(user) {
  if (!user || typeof user !== "object") {
    write(CURRENT_USER_KEY, null);
    emitUpdate();
    return;
  }
  const snapshot = {
    id: user.id || user._id || null,
    username: user.username || null,
    email: user.email || null,
    role: user.role || null,
  };
  write(CURRENT_USER_KEY, snapshot);
  emitUpdate();
}

export function getCurrentUserSnapshot() {
  return read(CURRENT_USER_KEY, null);
}

/** Resolve the best identifier for a user (prefers id, falls back to username, then email). */
export function userKeyFor(user) {
  if (!user) return null;
  return (
    user.id ||
    user._id ||
    user.userId ||
    user.username ||
    user.email ||
    null
  );
}

function currentUserKey() {
  return userKeyFor(getCurrentUserSnapshot());
}

function currentUserRole() {
  const snap = getCurrentUserSnapshot();
  const role = String(snap?.role || "").toLowerCase();
  return role || null;
}

// ----- read API (safe from anywhere) ---------------------------------------

function readGrants() {
  const raw = read(GRANTS_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

/** Current user's exclusive item IDs (direct grants + role auto-grants). */
export function currentUserExclusiveIds() {
  const key = currentUserKey();
  const role = currentUserRole();
  const set = new Set();
  if (key) {
    const grants = readGrants()[key] || {};
    for (const id of Object.keys(grants)) set.add(id);
  }
  const auto = role ? ROLE_AUTO_GRANTS[role] || [] : [];
  for (const id of auto) set.add(id);
  return set;
}

/** Pure check used by calling card / emblem entries in the catalog. */
export function userHasExclusive(itemId) {
  if (!itemId) return false;
  return currentUserExclusiveIds().has(itemId);
}

export function listGrantsForUser(userKey) {
  if (!userKey) return [];
  const grants = readGrants()[userKey] || {};
  return Object.entries(grants).map(([itemId, meta]) => ({
    itemId,
    grantedBy: meta?.grantedBy || "unknown",
    grantedAt: Number(meta?.grantedAt) || 0,
    note: meta?.note || "",
  }));
}

export function listAllGrants() {
  const grants = readGrants();
  const rows = [];
  for (const [userKey, items] of Object.entries(grants)) {
    for (const [itemId, meta] of Object.entries(items || {})) {
      rows.push({
        userKey,
        itemId,
        grantedBy: meta?.grantedBy || "unknown",
        grantedAt: Number(meta?.grantedAt) || 0,
        note: meta?.note || "",
      });
    }
  }
  return rows.sort((a, b) => b.grantedAt - a.grantedAt);
}

export function readAuditLog(limit = 50) {
  const raw = read(AUDIT_KEY, []);
  const list = Array.isArray(raw) ? raw : [];
  return list.slice(0, Math.max(0, Number(limit) || 50));
}

// ----- mutations (admin only at the UI layer) -------------------------------

function pushAudit(entry) {
  const next = [entry, ...readAuditLog(AUDIT_CAP)];
  write(AUDIT_KEY, next.slice(0, AUDIT_CAP));
}

export class AdminGrantError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Grant an exclusive card or emblem to a user.
 * @param {{userKey: string, itemId: string, grantedBy?: string, note?: string}} args
 */
export function grantCard({ userKey, itemId, grantedBy, note } = {}) {
  const user = String(userKey || "").trim();
  const id = String(itemId || "").trim();
  if (!user) throw new AdminGrantError("missing_user", "User key required.");
  if (!id) throw new AdminGrantError("missing_item", "Item id required.");

  const grants = readGrants();
  const userGrants = { ...(grants[user] || {}) };
  const now = Date.now();
  userGrants[id] = {
    grantedBy: String(grantedBy || currentUserKey() || "admin"),
    grantedAt: now,
    note: String(note || "").slice(0, 240),
  };
  grants[user] = userGrants;
  write(GRANTS_KEY, grants);

  pushAudit({
    action: "grant",
    userKey: user,
    itemId: id,
    grantedBy: userGrants[id].grantedBy,
    at: now,
    note: userGrants[id].note,
  });
  emitUpdate();
  return userGrants[id];
}

export function revokeCard({ userKey, itemId, revokedBy, note } = {}) {
  const user = String(userKey || "").trim();
  const id = String(itemId || "").trim();
  if (!user) throw new AdminGrantError("missing_user", "User key required.");
  if (!id) throw new AdminGrantError("missing_item", "Item id required.");

  const grants = readGrants();
  const userGrants = { ...(grants[user] || {}) };
  if (!userGrants[id]) {
    throw new AdminGrantError("not_granted", "That user does not have this item.");
  }
  delete userGrants[id];
  if (Object.keys(userGrants).length === 0) delete grants[user];
  else grants[user] = userGrants;
  write(GRANTS_KEY, grants);

  pushAudit({
    action: "revoke",
    userKey: user,
    itemId: id,
    grantedBy: String(revokedBy || currentUserKey() || "admin"),
    at: Date.now(),
    note: String(note || "").slice(0, 240),
  });
  emitUpdate();
  return true;
}

// ----- guards ---------------------------------------------------------------

/**
 * Admin-like privilege check. Returns true for true superadmins AND for a
 * local dev override (`localStorage.f10_dev_admin = 1`) so the panel is
 * reachable during development without a backend.
 */
export function isCosmeticsAdmin(user) {
  if (isSuperAdminUser(user)) return true;
  const role = String(user?.role || getCurrentUserSnapshot()?.role || "").toLowerCase();
  if (role === "owner") return true;
  const ls = safeLS();
  if (ls && ls.getItem("f10_dev_admin") === "1") return true;
  return false;
}

export const ADMIN_COSMETICS_UPDATE_EVENT = UPDATE_EVENT;
