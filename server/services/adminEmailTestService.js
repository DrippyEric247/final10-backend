const mongoose = require('mongoose');
const User = require('../models/User');
const AdminEmailTestLog = require('../models/AdminEmailTestLog');
const { sendOperationalEmail, getEmailEnvPresence, getEmailConfigStatus } = require('./emailService');
const {
  buildAdminTestEmail,
  TEMPLATE_LABELS,
} = require('../templates/email/adminTestEmailTemplates');

class AdminEmailTestError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'AdminEmailTestError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const USER_SELECT =
  'username email firstName betaTester foundingAccess betaAccessExpiresAt membershipTier premiumTier subscription role';

const VALID_TEMPLATE_KEYS = Object.keys(TEMPLATE_LABELS);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveActorId(user = {}) {
  return user._id || user.id || null;
}

function buildUserSearchFilter(q) {
  const query = String(q || '').trim();
  if (!query) return null;
  if (mongoose.Types.ObjectId.isValid(query) && String(new mongoose.Types.ObjectId(query)) === query) {
    return { _id: query };
  }
  const rx = new RegExp(escapeRegex(query), 'i');
  return { $or: [{ username: rx }, { email: rx }] };
}

function describeBetaStatus(user) {
  if (user.foundingAccess) return 'Founding Tester';
  if (user.betaTester) return 'Beta Tester';
  return 'None';
}

function describeSubscription(user) {
  return (
    user.subscription?.tier ||
    user.membershipTier ||
    user.premiumTier ||
    'free'
  );
}

function mapLastEmailSent(log) {
  if (!log) return null;
  return {
    at: log.createdAt,
    templateKey: log.templateKey,
    templateLabel: log.templateLabel,
    status: log.status,
    deliveryId: log.deliveryId || null,
  };
}

async function attachLastEmailSent(userRow) {
  const last = await AdminEmailTestLog.findOne({ recipientUserId: userRow._id })
    .sort({ createdAt: -1 })
    .select('createdAt templateKey templateLabel status deliveryId')
    .lean();
  return {
    id: String(userRow._id),
    username: userRow.username || '',
    email: userRow.email || '',
    betaStatus: describeBetaStatus(userRow),
    subscription: describeSubscription(userRow),
    lastEmailSent: mapLastEmailSent(last),
  };
}

async function searchUsers(q) {
  const filter = buildUserSearchFilter(q);
  if (!filter) {
    throw new AdminEmailTestError(
      400,
      'QUERY_REQUIRED',
      'Enter a username, email, or user ID to search.'
    );
  }

  const users = await User.find(filter).select(USER_SELECT).limit(15).lean();
  return Promise.all(users.map((row) => attachLastEmailSent(row)));
}

async function getUserById(userId) {
  const user = await User.findById(userId).select(USER_SELECT).lean();
  if (!user) {
    throw new AdminEmailTestError(404, 'USER_NOT_FOUND', 'User not found.');
  }
  return attachLastEmailSent(user);
}

function mapHistoryRow(log) {
  return {
    id: String(log._id),
    templateKey: log.templateKey,
    templateLabel: log.templateLabel,
    subject: log.subject,
    status: log.status,
    deliveryId: log.deliveryId || null,
    messageId: log.messageId || null,
    sentAt: log.createdAt,
    sentByEmail: log.sentByEmail || '',
  };
}

async function getUserTestHistory(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AdminEmailTestError(400, 'INVALID_USER_ID', 'Invalid user ID.');
  }
  const logs = await AdminEmailTestLog.find({ recipientUserId: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return logs.map(mapHistoryRow);
}

async function trimUserHistory(userId) {
  const excess = await AdminEmailTestLog.find({ recipientUserId: userId })
    .sort({ createdAt: -1 })
    .skip(20)
    .select('_id')
    .lean();
  if (!excess.length) return;
  await AdminEmailTestLog.deleteMany({ _id: { $in: excess.map((row) => row._id) } });
}

function buildDeliveryId() {
  return `F10-ET-${Date.now().toString(36).toUpperCase()}`;
}

async function sendAdminTestEmail({ userId, templateKey, custom = {}, adminUser, trace = null }) {
  trace?.step('admin_email_test_enter', {
    userId: String(userId || ''),
    templateKey,
    resendApiKeyPresent: getEmailEnvPresence().RESEND_API_KEY,
    emailFromPresent: Boolean(getEmailConfigStatus().emailFrom),
    provider: getEmailConfigStatus().provider,
  });

  if (!VALID_TEMPLATE_KEYS.includes(templateKey)) {
    throw new AdminEmailTestError(400, 'INVALID_TEMPLATE', 'Unknown email template.');
  }

  const user = await User.findById(userId).select(USER_SELECT).lean();
  if (!user?.email) {
    throw new AdminEmailTestError(404, 'USER_NOT_FOUND', 'User not found or missing email.');
  }

  trace?.step('admin_email_test_recipient', {
    recipientId: String(user._id),
    recipientEmail: `${String(user.email).slice(0, 3)}***@${String(user.email).split('@')[1] || ''}`,
  });

  let built;
  try {
    trace?.step('admin_email_test_template_build_start', { templateKey });
    built = buildAdminTestEmail(templateKey, user, custom);
    trace?.step('admin_email_test_template_build_done', {
      ok: true,
      subjectLen: String(built.subject || '').length,
      htmlLen: String(built.html || '').length,
      textLen: String(built.text || '').length,
    });
  } catch (err) {
    trace?.step('admin_email_test_template_build_failed', {
      ok: false,
      message: String(err?.message || err).slice(0, 500),
      stack: String(err?.stack || '').split('\n').slice(0, 6),
    });
    throw new AdminEmailTestError(400, 'TEMPLATE_BUILD_FAILED', err.message || 'Could not build email.');
  }

  const deliveryId = buildDeliveryId();
  trace?.step('admin_email_test_send_start', { via: 'sendOperationalEmail', deliveryId });

  let result;
  try {
    result = await sendOperationalEmail({
      to: user.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      trace,
    });
  } catch (err) {
    trace?.step('admin_email_test_send_threw', {
      ok: false,
      message: String(err?.message || err).slice(0, 500),
      stack: String(err?.stack || '').split('\n').slice(0, 8),
    });
    console.error('[admin/email-test] sendOperationalEmail threw unexpectedly:', err?.message, err?.stack);
    result = {
      sent: false,
      logOnly: false,
      reason: 'send_operational_exception',
      errorReason: err?.message || 'Unexpected email send error.',
    };
  }

  trace?.step('admin_email_test_send_done', {
    sent: Boolean(result.sent),
    logOnly: Boolean(result.logOnly),
    reason: result.reason || null,
    provider: result.provider || null,
    errorReason: result.errorReason || null,
    resendError: result.resendError || null,
  });

  const status = result.sent ? 'sent' : result.logOnly ? 'log_only' : 'failed';
  const actorId = resolveActorId(adminUser);

  let log = null;
  try {
    log = await AdminEmailTestLog.create({
      recipientUserId: user._id,
      recipientEmail: user.email,
      recipientUsername: user.username || '',
      sentByUserId: actorId,
      sentByEmail: adminUser?.email || '',
      templateKey,
      templateLabel: TEMPLATE_LABELS[templateKey],
      subject: built.subject,
      deliveryId,
      status,
      provider: result.provider || '',
      reason: result.reason || '',
      messageId: result.messageId || '',
    });
    await trimUserHistory(user._id);
  } catch (logErr) {
    console.error('[admin/email-test] log write failed (non-fatal):', logErr?.message, logErr?.stack);
    trace?.step('admin_email_test_log_failed', {
      ok: false,
      message: String(logErr?.message || logErr).slice(0, 300),
    });
  }

  const base = {
    recipient: {
      id: String(user._id),
      username: user.username || '',
      email: user.email,
    },
    timestamp: log?.createdAt || new Date(),
    templateKey,
    templateLabel: TEMPLATE_LABELS[templateKey],
    deliveryId,
    status,
    provider: result.provider || null,
    messageId: log?.messageId || result.messageId || null,
    logOnly: Boolean(result.logOnly),
    reason: result.reason || null,
    errorReason: result.errorReason || null,
    resendError: result.resendError || null,
    resendValidationHint: result.resendValidationHint || null,
    subject: built.subject,
  };

  if (status === 'failed') {
    const failureMessage =
      result.errorReason || result.resendValidationHint || result.reason || 'Email delivery failed.';
    return {
      ok: false,
      code: 'DELIVERY_FAILED',
      message: failureMessage,
      failureReason: failureMessage,
      ...base,
    };
  }

  return {
    ok: true,
    queued: true,
    message: result.logOnly
      ? 'Email logged only — delivery is not configured or was skipped.'
      : 'Test email successfully queued.',
    ...base,
  };
}

function listTemplates() {
  return VALID_TEMPLATE_KEYS.map((key) => ({
    key,
    label: TEMPLATE_LABELS[key],
  }));
}

module.exports = {
  AdminEmailTestError,
  TEMPLATE_LABELS,
  searchUsers,
  getUserById,
  getUserTestHistory,
  sendAdminTestEmail,
  listTemplates,
};
