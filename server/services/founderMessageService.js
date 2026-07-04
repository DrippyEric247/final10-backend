const crypto = require('crypto');
const FounderMessage = require('../models/FounderMessage');

const SUBJECTS = Object.freeze([
  'general_feedback',
  'investment_inquiry',
  'partnership',
  'retailer',
  'media',
  'bug_report',
  'other',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class FounderMessageError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function hashIp(ip) {
  const salt = process.env.FOUNDER_MESSAGE_IP_SALT || 'f10-founder-msg';
  return crypto.createHash('sha256').update(`${salt}:${String(ip || 'unknown')}`).digest('hex');
}

function generateReferenceId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `F10-SCOUT-${ts}-${rand}`;
}

function validatePayload(payload) {
  const subject = String(payload?.subject || '').trim();
  const name = String(payload?.name || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  const company = String(payload?.company || '').trim();
  const message = String(payload?.message || '').trim();

  if (!SUBJECTS.includes(subject)) {
    throw new FounderMessageError(400, 'INVALID_SUBJECT', 'Please choose a valid subject.');
  }
  if (name.length < 2) {
    throw new FounderMessageError(400, 'INVALID_NAME', 'Name is required.');
  }
  if (!EMAIL_RE.test(email)) {
    throw new FounderMessageError(400, 'INVALID_EMAIL', 'A valid email address is required.');
  }
  if (message.length < 20) {
    throw new FounderMessageError(
      400,
      'INVALID_MESSAGE',
      'Message must be at least 20 characters.'
    );
  }
  if (message.length > 5000) {
    throw new FounderMessageError(400, 'INVALID_MESSAGE', 'Message is too long.');
  }
  if (company.length > 120) {
    throw new FounderMessageError(400, 'INVALID_COMPANY', 'Company name is too long.');
  }

  return { subject, name, email, company, message };
}

function validateScreenshot(file) {
  if (!file) return null;

  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  const mimeType = String(file.mimetype || '').toLowerCase();
  if (!allowed.has(mimeType)) {
    throw new FounderMessageError(
      400,
      'INVALID_SCREENSHOT',
      'Screenshot must be PNG, JPG, WEBP, or GIF.'
    );
  }
  const size = Number(file.size) || 0;
  if (size > 2 * 1024 * 1024) {
    throw new FounderMessageError(400, 'INVALID_SCREENSHOT', 'Screenshot must be under 2 MB.');
  }
  if (!file.buffer || !file.buffer.length) {
    throw new FounderMessageError(400, 'INVALID_SCREENSHOT', 'Screenshot upload failed.');
  }

  return {
    mimeType,
    size,
    data: file.buffer,
  };
}

/**
 * @param {object} payload
 * @param {{ user?: object, ip?: string, screenshot?: object|null }} ctx
 */
async function submitFounderMessage(payload, ctx = {}) {
  const fields = validatePayload(payload);
  const screenshot = validateScreenshot(ctx.screenshot);

  const referenceId = generateReferenceId();
  const doc = await FounderMessage.create({
    referenceId,
    ...fields,
    userId: ctx.user?._id || null,
    username: ctx.user?.username || ctx.user?.firstName || '',
    ipHash: hashIp(ctx.ip),
    screenshot: screenshot || undefined,
  });

  return {
    ok: true,
    referenceId: doc.referenceId,
    submittedAt: doc.createdAt,
    message: 'Transmission complete. Your message has been delivered to the Final10 team.',
  };
}

module.exports = {
  SUBJECTS,
  FounderMessageError,
  submitFounderMessage,
};
