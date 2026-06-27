/**
 * Admin QA helpers for live beta events.
 */

const { auditFireAndForget } = require('./securityAuditService');

function buildAdminLogEntry(action, adminUser, details = {}) {
  return {
    action,
    timestamp: new Date().toISOString(),
    adminUserId: String(adminUser._id),
    adminUsername: adminUser.username || adminUser.email || 'admin',
    details,
  };
}

function logLiveEventAdmin(action, adminUser, details = {}) {
  const entry = buildAdminLogEntry(action, adminUser, details);
  auditFireAndForget('LIVE_EVENTS_ADMIN_TEST', {
    userId: adminUser._id,
    meta: entry,
  });
  console.info('[live-events/admin]', entry);
  return entry;
}

module.exports = {
  buildAdminLogEntry,
  logLiveEventAdmin,
};
