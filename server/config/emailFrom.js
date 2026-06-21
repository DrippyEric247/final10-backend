/**
 * Resend / SMTP sender resolution for Final10 alert emails.
 *
 * Resend sandbox `onboarding@resend.dev` only delivers to the Resend account owner.
 * Production must use a verified domain (e.g. scout@final10.app).
 */
const { isProduction } = require('./envValidation');

const RESEND_SANDBOX_ADDRESS = 'onboarding@resend.dev';

function extractEmailAddress(from) {
  const raw = String(from || '').trim();
  const match = raw.match(/<([^>]+@[^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  if (raw.includes('@')) return raw.toLowerCase();
  return '';
}

function extractDomainFromUrl(rawUrl) {
  try {
    const host = new URL(String(rawUrl || '').trim()).hostname.toLowerCase();
    if (!host || host === 'localhost') return '';
    if (host.endsWith('.vercel.app')) return '';
    if (host.endsWith('.railway.app')) return '';
    if (host.endsWith('.onrender.com')) return '';
    return host;
  } catch {
    return '';
  }
}

function readVerifiedDomain() {
  const explicit = String(process.env.RESEND_VERIFIED_DOMAIN || '').trim().toLowerCase();
  if (explicit) return explicit.replace(/^@/, '');
  return (
    extractDomainFromUrl(process.env.CLIENT_URL) ||
    extractDomainFromUrl(process.env.PUBLIC_APP_URL) ||
    'final10.app'
  );
}

function isResendSandboxAddress(from) {
  const addr = extractEmailAddress(from) || String(from || '').trim().toLowerCase();
  return addr === RESEND_SANDBOX_ADDRESS || addr.endsWith('@resend.dev');
}

function buildVerifiedFromAddress() {
  const domain = readVerifiedDomain();
  const localPart = String(process.env.RESEND_FROM_LOCAL || 'scout').trim() || 'scout';
  const displayName = String(process.env.RESEND_FROM_NAME || 'Savvy Scout').trim() || 'Savvy Scout';
  return `${displayName} <${localPart}@${domain}>`;
}

function allowResendSandboxFrom() {
  return String(process.env.RESEND_ALLOW_SANDBOX_FROM || '').trim().toLowerCase() === 'true';
}

/**
 * Resolve the From header used for outbound mail.
 */
function resolveEmailFrom() {
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const explicit = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || smtpUser || '').trim();
  const hasResendKey = Boolean(String(process.env.RESEND_API_KEY || '').trim());
  const verifiedFrom = buildVerifiedFromAddress();

  if (explicit) {
    if (hasResendKey && isResendSandboxAddress(explicit) && !allowResendSandboxFrom()) {
      if (isProduction()) {
        console.warn(
          '[email] EMAIL_FROM uses Resend sandbox (onboarding@resend.dev) — using verified domain sender instead:',
          verifiedFrom.replace(/<([^@]+)@.+>/, '<$1@…>')
        );
        return verifiedFrom;
      }
      console.warn(
        '[email] EMAIL_FROM is Resend sandbox — only delivers to your Resend account email. Set EMAIL_FROM=',
        verifiedFrom
      );
    }
    return explicit;
  }

  if (hasResendKey) {
    if (isProduction() || !allowResendSandboxFrom()) return verifiedFrom;
    return `Savvy Scout <${RESEND_SANDBOX_ADDRESS}>`;
  }

  return '';
}

function auditEmailFrom() {
  const envFrom = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
  const resolved = resolveEmailFrom();
  const resolvedAddress = extractEmailAddress(resolved);
  const sandbox = isResendSandboxAddress(resolved);
  const verifiedDomain = readVerifiedDomain();
  const recommended = buildVerifiedFromAddress();

  return {
    envEmailFrom: envFrom || null,
    resolvedFrom: resolved || null,
    resolvedAddress: resolvedAddress || null,
    isResendSandboxFrom: sandbox,
    verifiedDomain,
    recommendedFrom: recommended,
    allowSandbox: allowResendSandboxFrom(),
    production: isProduction(),
    issue: sandbox
      ? 'resend_sandbox_from_restricted'
      : !resolved
        ? 'missing_email_from'
        : null,
    fixHint: sandbox
      ? `Set Railway EMAIL_FROM=${recommended} after verifying ${verifiedDomain} in Resend → Domains`
      : null,
  };
}

function resendValidationHint(errorMessage) {
  const msg = String(errorMessage || '').toLowerCase();
  if (!msg) return null;
  if (
    msg.includes('testing emails') ||
    msg.includes('verify a domain') ||
    msg.includes('validation') ||
    msg.includes('not authorized to send') ||
    msg.includes('from address')
  ) {
    const audit = auditEmailFrom();
    return audit.fixHint || `Use a verified domain sender: ${audit.recommendedFrom}`;
  }
  return null;
}

module.exports = {
  RESEND_SANDBOX_ADDRESS,
  extractEmailAddress,
  isResendSandboxAddress,
  readVerifiedDomain,
  buildVerifiedFromAddress,
  allowResendSandboxFrom,
  resolveEmailFrom,
  auditEmailFrom,
  resendValidationHint,
};
