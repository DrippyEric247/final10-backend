/**
 * Structured audit logs for production diagnostics (Railway / monitoring).
 * Never log secrets, tokens, or full PII — use ids and counts only.
 */
const { info, warn, error } = require('./structuredLog');

function audit(event, meta = {}) {
  info(event, { audit: true, ...meta });
}

function auditWarn(event, meta = {}) {
  warn(event, { audit: true, ...meta });
}

function auditError(event, meta = {}) {
  error(event, { audit: true, ...meta });
}

function auditStartup(meta = {}) {
  audit('AUDIT_PROCESS_STARTUP', meta);
}

function auditMongoConnect(meta = {}) {
  audit('AUDIT_MONGO_CONNECT', meta);
}

function auditMongoFailure(meta = {}) {
  auditError('AUDIT_MONGO_FAILURE', meta);
}

function auditCronJob(name, meta = {}) {
  audit('AUDIT_CRON_JOB', { job: name, ...meta });
}

function auditEbaySearch(meta = {}) {
  audit('AUDIT_EBAY_SEARCH', meta);
}

function auditEbayFinal10(meta = {}) {
  audit('AUDIT_EBAY_FINAL10', meta);
}

function auditQuickSnipes(meta = {}) {
  audit('AUDIT_QUICK_SNIPES', meta);
}

function auditBestMove(meta = {}) {
  audit('AUDIT_BEST_MOVE', meta);
}

function auditAlertScan(meta = {}) {
  audit('AUDIT_ALERT_SCAN', meta);
}

function auditAlertCreated(meta = {}) {
  audit('AUDIT_ALERT_CREATED', meta);
}

function auditAlertDelivery(meta = {}) {
  audit('AUDIT_ALERT_DELIVERY', meta);
}

function auditEmailDelivery(meta = {}) {
  audit('AUDIT_EMAIL_DELIVERY', meta);
}

function auditRewardGrant(meta = {}) {
  audit('AUDIT_REWARD_GRANT', meta);
}

function auditOnboarding(meta = {}) {
  audit('AUDIT_ONBOARDING', meta);
}

function auditAlertTest(meta = {}) {
  audit('AUDIT_ALERT_TEST', meta);
}

module.exports = {
  audit,
  auditWarn,
  auditError,
  auditStartup,
  auditMongoConnect,
  auditMongoFailure,
  auditCronJob,
  auditEbaySearch,
  auditEbayFinal10,
  auditQuickSnipes,
  auditBestMove,
  auditAlertScan,
  auditAlertCreated,
  auditAlertDelivery,
  auditEmailDelivery,
  auditRewardGrant,
  auditOnboarding,
  auditAlertTest,
};
