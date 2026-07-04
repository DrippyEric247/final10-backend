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
  const explicit = normalizeVerifiedDomain(String(process.env.RESEND_VERIFIED_DOMAIN || '').trim());
  if (explicit) return explicit;
  const fromUrl =
    extractDomainFromUrl(process.env.CLIENT_URL) ||
    extractDomainFromUrl(process.env.PUBLIC_APP_URL);
  return normalizeVerifiedDomain(fromUrl) || 'final10.app';
}

/** Strip www. so Resend uses the verified apex domain (final10.app). */
function normalizeVerifiedDomain(domain) {
  let d = String(domain || '').trim().toLowerCase().replace(/^@/, '');
  if (d.startsWith('www.')) d = d.slice(4);
  return d;
}

function extractDisplayName(from) {
  const raw = String(from || '').trim();
  const match = raw.match(/^([^<]+)</);
  return match ? match[1].trim() : 'Savvy Scout';
}

/**
 * Resend verifies final10.app — not www.final10.app subaddresses.
 * Rewrite any @www.final10.app sender to support@final10.app.
 */
function rewriteWwwFinal10Sender(from) {
  const raw = String(from || '').trim();
  const addr = extractEmailAddress(raw);
  if (!addr || !addr.includes('@www.final10.app')) return raw;
  const displayName = extractDisplayName(raw);
  const rewritten = `${displayName} <support@final10.app>`;
  console.warn(
    '[email] FROM contained @www.final10.app — rewriting sender.',
    JSON.stringify({ originalFrom: raw, originalAddress: addr, rewrittenFrom: rewritten })
  );
  return rewritten;
}

function isResendSandboxAddress(from) {
  const addr = extractEmailAddress(from) || String(from || '').trim().toLowerCase();
  return addr === RESEND_SANDBOX_ADDRESS || addr.endsWith('@resend.dev');
}

function buildVerifiedFromAddress() {
  const domain = readVerifiedDomain();
  const localPart = String(process.env.RESEND_FROM_LOCAL || 'support').trim() || 'support';
  const displayName = String(process.env.RESEND_FROM_NAME || 'Savvy Scout').trim() || 'Savvy Scout';
  return rewriteWwwFinal10Sender(`${displayName} <${localPart}@${domain}>`);
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
          '[email] EMAIL_FROM env is Resend sandbox — production override active.',
          JSON.stringify({
            envEmailFrom: explicit,
            overriddenTo: verifiedFrom,
            reason: 'sandbox_only_delivers_to_resend_account_owner',
          })
        );
        return verifiedFrom;
      }
      console.warn(
        '[email] EMAIL_FROM is Resend sandbox — only delivers to your Resend account email. Set EMAIL_FROM=',
        verifiedFrom
      );
    } else {
      console.log(
        '[email] Using explicit EMAIL_FROM from environment:',
        JSON.stringify({ envEmailFrom: explicit })
      );
    }
    return rewriteWwwFinal10Sender(explicit);
  }

  if (hasResendKey) {
    if (isProduction() || !allowResendSandboxFrom()) {
      console.log(
        '[email] Resolved verified-domain sender (no EMAIL_FROM env):',
        JSON.stringify({ resolvedFrom: verifiedFrom, verifiedDomain: readVerifiedDomain() })
      );
      return verifiedFrom;
    }
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
  normalizeVerifiedDomain,
  readVerifiedDomain,
  buildVerifiedFromAddress,
  rewriteWwwFinal10Sender,
  allowResendSandboxFrom,
  resolveEmailFrom,
  auditEmailFrom,
  resendValidationHint,
};
