/**
 * Focused owner-panel request logs (no eBay/HTML noise).
 */

function logOwnerPanel(route, payload = {}) {
  const row = {
    ts: new Date().toISOString(),
    scope: 'owner-panel',
    route,
    ...payload,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(row));
}

function actorFromReq(req) {
  const u = req?.ownerUser || req?.user; // ownerUser set by requireOwnerAccess after DB load
  if (!u) return { userId: null, email: null, role: null };
  return {
    userId: String(u._id || u.id || ''),
    email: String(u.email || ''),
    role: String(u.role || ''),
  };
}

module.exports = { logOwnerPanel, actorFromReq };
