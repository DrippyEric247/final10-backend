const mongoose = require('mongoose');
const User = require('../models/User');
const AdminEmailTestLog = require('../models/AdminEmailTestLog');
const { sendOperationalEmail } = require('./emailService');
const {
  buildAdminTestEmail,
  TEMPLATE_LABELS,
} = require('../templates/email/adminTestEmailTemplates');

class AdminEmailTestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AdminEmailTestError';
    this.status = status;
    this.code = code;
  }
}

const USER_SELECT =
  'username email firstName betaTester foundingAccess betaAccessExpiresAt membershipTier premiumTier subscription role';

const VALID_TEMPLATE_KEYS = Object.keys(TEMPLATE_LABELS);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

async function sendAdminTestEmail({ userId, templateKey, custom = {}, adminUser }) {
  if (!VALID_TEMPLATE_KEYS.includes(templateKey)) {
    throw new AdminEmailTestError(400, 'INVALID_TEMPLATE', 'Unknown email template.');
  }

  const user = await User.findById(userId).select(USER_SELECT).lean();
  if (!user?.email) {
    throw new AdminEmailTestError(404, 'USER_NOT_FOUND', 'User not found or missing email.');
  }

  let built;
  try {
    built = buildAdminTestEmail(templateKey, user, custom);
  } catch (err) {
    throw new AdminEmailTestError(400, 'TEMPLATE_BUILD_FAILED', err.message || 'Could not build email.');
  }

  const deliveryId = buildDeliveryId();
  const result = await sendOperationalEmail({
    to: user.email,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });

  const status = result.sent ? 'sent' : result.logOnly ? 'log_only' : 'failed';
  const log = await AdminEmailTestLog.create({
    recipientUserId: user._id,
    recipientEmail: user.email,
    recipientUsername: user.username || '',
    sentByUserId: adminUser._id,
    sentByEmail: adminUser.email || '',
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

  if (status === 'failed') {
    throw new AdminEmailTestError(
      502,
      'DELIVERY_FAILED',
      result.reason || 'Email delivery failed.'
    );
  }

  return {
    ok: true,
    queued: true,
    message: 'Test email successfully queued.',
    recipient: {
      id: String(user._id),
      username: user.username || '',
      email: user.email,
    },
    timestamp: log.createdAt,
    templateKey,
    templateLabel: TEMPLATE_LABELS[templateKey],
    deliveryId,
    status,
    provider: result.provider || null,
    messageId: log.messageId || null,
    logOnly: Boolean(result.logOnly),
    reason: result.reason || null,
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
