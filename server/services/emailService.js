const nodemailer = require('nodemailer');

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_TIMEOUT_MS = 60000;

let transport = null;
let lastVerifyResult = null;

function isGmailHost(host) {
  const h = String(host || '').trim().toLowerCase();
  return h === 'smtp.gmail.com' || h.endsWith('.gmail.com');
}

function readSmtpAuth() {
  return {
    host: String(process.env.SMTP_HOST || '').trim(),
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || '').trim(),
  };
}

function resolveSmtpTransportSettings() {
  const { host } = readSmtpAuth();
  const portRaw = String(process.env.SMTP_PORT || '').trim();
  const port = portRaw ? Number(portRaw) : DEFAULT_SMTP_PORT;
  const gmail = isGmailHost(host);
  const timeoutMs =
    Math.max(Number(process.env.SMTP_TIMEOUT_MS || DEFAULT_SMTP_TIMEOUT_MS) || DEFAULT_SMTP_TIMEOUT_MS, 10000);

  // Gmail / STARTTLS on 587: secure must be false; requireTLS true.
  let secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  if (gmail || port === 587) {
    if (secure) {
      console.warn('[email] SMTP_SECURE=true ignored for port 587 / Gmail — using secure:false + requireTLS');
    }
    secure = false;
  } else if (port === 465) {
    secure = true;
  }

  const requireTLS = gmail
    ? true
    : String(process.env.SMTP_REQUIRE_TLS || 'true').toLowerCase() !== 'false';

  return {
    host,
    port: Number.isFinite(port) ? port : DEFAULT_SMTP_PORT,
    secure,
    requireTLS,
    connectionTimeout: timeoutMs,
    gmail,
  };
}

function logSmtpDiagnostics(extra = {}) {
  const auth = readSmtpAuth();
  const settings = resolveSmtpTransportSettings();
  console.log(
    '[email] SMTP diagnostics',
    JSON.stringify({
      smtpHostPresent: Boolean(auth.host),
      smtpPort: settings.port,
      secure: settings.secure,
      requireTLS: settings.requireTLS,
      smtpUserPresent: Boolean(auth.user),
      smtpPassPresent: Boolean(auth.pass),
      timeoutMs: settings.connectionTimeout,
      gmailMode: settings.gmail,
      ...extra,
    })
  );
}

function formatMailerError(err) {
  if (!err) {
    return {
      errorCode: 'SMTP_ERROR',
      errorReason: 'Unknown mailer error',
      smtpCommand: null,
      responseCode: null,
    };
  }
  return {
    errorCode: err.code || err.errno || 'SMTP_ERROR',
    errorReason: err.message || String(err),
    smtpCommand: err.command || null,
    responseCode: err.responseCode || null,
  };
}

function buildTransportOptions() {
  const auth = readSmtpAuth();
  const settings = resolveSmtpTransportSettings();
  if (!auth.host || !auth.user || !auth.pass) return null;

  return {
    host: auth.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: settings.requireTLS,
    auth: { user: auth.user, pass: auth.pass },
    connectionTimeout: settings.connectionTimeout,
    greetingTimeout: settings.connectionTimeout,
    socketTimeout: settings.connectionTimeout,
    tls: {
      minVersion: 'TLSv1.2',
    },
  };
}

function resetTransport() {
  transport = null;
}

function getTransport() {
  if (transport) return transport;
  const options = buildTransportOptions();
  if (!options) return null;
  transport = nodemailer.createTransport(options);
  return transport;
}

function getSmtpTransportSettings() {
  const settings = resolveSmtpTransportSettings();
  return {
    smtpPort: settings.port,
    secure: settings.secure,
    requireTLS: settings.requireTLS,
    timeoutMs: settings.connectionTimeout,
    gmailMode: settings.gmail,
  };
}

async function verifySmtpConnection({ log = true } = {}) {
  const tx = getTransport();
  if (!tx) {
    lastVerifyResult = { ok: false, verified: false, reason: 'smtp_not_configured' };
    if (log) logSmtpDiagnostics({ connectionVerify: 'skipped_not_configured' });
    return lastVerifyResult;
  }

  if (log) logSmtpDiagnostics({ connectionVerify: 'starting' });

  try {
    await tx.verify();
    lastVerifyResult = { ok: true, verified: true, ...getSmtpTransportSettings() };
    if (log) {
      console.log('[email] SMTP connection verify: success');
      logSmtpDiagnostics({ connectionVerify: 'success' });
    }
    return lastVerifyResult;
  } catch (err) {
    const mailerError = formatMailerError(err);
    lastVerifyResult = {
      ok: false,
      verified: false,
      ...getSmtpTransportSettings(),
      ...mailerError,
    };
    if (log) {
      console.warn(
        '[email] SMTP connection verify: failed',
        JSON.stringify({
          connectionVerify: 'failed',
          ...mailerError,
          smtpPort: lastVerifyResult.smtpPort,
          secure: lastVerifyResult.secure,
          requireTLS: lastVerifyResult.requireTLS,
        })
      );
    }
    resetTransport();
    return lastVerifyResult;
  }
}

function alertEmailEnabled() {
  return String(process.env.ALERT_EMAIL_ENABLED || '').toLowerCase() === 'true';
}

/** Whether each SMTP env var is set (values never returned). */
function getSmtpEnvPresence() {
  return {
    SMTP_HOST: Boolean(String(process.env.SMTP_HOST || '').trim()),
    SMTP_PORT: Boolean(String(process.env.SMTP_PORT || '').trim()),
    SMTP_USER: Boolean(String(process.env.SMTP_USER || '').trim()),
    SMTP_PASS: Boolean(String(process.env.SMTP_PASS || '').trim()),
    SMTP_FROM: Boolean(String(process.env.SMTP_FROM || '').trim()),
  };
}

function getEmailConfigStatus() {
  const auth = readSmtpAuth();
  const smtpConfigured = Boolean(auth.host && auth.user && auth.pass);
  const transportSettings = getSmtpTransportSettings();
  return {
    smtpConfigured,
    alertEmailEnabled: alertEmailEnabled(),
    smtpHost: auth.host ? auth.host.replace(/^(.{3}).+/, '$1…') : null,
    smtpFrom: String(process.env.SMTP_FROM || auth.user || '').trim() || null,
    mode: smtpConfigured && alertEmailEnabled() ? 'live' : 'log-only',
    envPresent: getSmtpEnvPresence(),
    transportSettings,
    lastVerify: lastVerifyResult
      ? {
          ok: lastVerifyResult.ok,
          verified: lastVerifyResult.verified,
          errorCode: lastVerifyResult.errorCode || null,
          errorReason: lastVerifyResult.errorReason || null,
        }
      : null,
  };
}

async function sendMailMessage({ to, subject, text, html, verifyFirst = false }) {
  const tx = getTransport();
  if (!tx || !to) {
    console.log(`[email] (log-only) To: ${to || 'missing'} | ${subject}`);
    return {
      sent: false,
      logOnly: true,
      reason: !tx ? 'smtp_not_configured' : 'missing_recipient',
    };
  }

  if (verifyFirst) {
    const verify = await verifySmtpConnection({ log: true });
    if (!verify.ok) {
      return {
        sent: false,
        logOnly: false,
        reason: 'smtp_verify_failed',
        verify,
        ...formatMailerError(
          verify.errorCode
            ? { code: verify.errorCode, message: verify.errorReason, command: verify.smtpCommand }
            : null
        ),
      };
    }
  }

  try {
    const info = await tx.sendMail({
      from: String(process.env.SMTP_FROM || readSmtpAuth().user),
      to,
      subject,
      text,
      html,
    });

    console.log('[email] sendMail success', JSON.stringify({ to, messageId: info.messageId || null }));
    return { sent: true, messageId: info.messageId || null };
  } catch (err) {
    const mailerError = formatMailerError(err);
    console.warn(
      '[email] sendMail failed',
      JSON.stringify({
        to,
        ...mailerError,
        smtpPort: getSmtpTransportSettings().smtpPort,
        secure: getSmtpTransportSettings().secure,
        requireTLS: getSmtpTransportSettings().requireTLS,
      })
    );
    resetTransport();
    return {
      sent: false,
      logOnly: false,
      reason: 'smtp_send_failed',
      ...mailerError,
    };
  }
}

/**
 * Send alert match email when SMTP + ALERT_EMAIL_ENABLED are configured.
 * Logs only when email is not configured (beta-safe fallback).
 */
async function sendAlertMatchEmail({ to, alertName, listingTitle, listingUrl }) {
  const subject = `🎯 Savvy Scout Alert: ${alertName}`;
  const text = [
    'Savvy Scout found a listing that matches your alert.',
    '',
    `Alert: ${alertName}`,
    `Listing: ${listingTitle}`,
    listingUrl ? `Link: ${listingUrl}` : '',
    '',
    'Open Final10 to review the match.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <p><strong>Savvy Scout</strong> found a listing that matches your alert.</p>
    <p><strong>Alert:</strong> ${alertName}</p>
    <p><strong>Listing:</strong> ${listingTitle}</p>
    ${listingUrl ? `<p><a href="${listingUrl}">View listing</a></p>` : ''}
    <p>Open Final10 to review the match.</p>
  `;

  if (!alertEmailEnabled()) {
    console.log(`[email] Alert match (log-only) → ${to || 'no-email'} | ${alertName}`);
    return { sent: false, logOnly: true, reason: 'alert_email_disabled' };
  }

  return sendMailMessage({ to, subject, text, html });
}

/**
 * Ops / user test message — sends whenever SMTP is configured (ignores ALERT_EMAIL_ENABLED).
 */
async function sendTestEmail({ to }) {
  const subject = '🎯 Savvy Scout — Final10 test email';
  const text = [
    'This is a test email from Final10 Savvy Scout alert delivery.',
    '',
    'If you received this, SMTP is configured correctly on the server.',
    `Time: ${new Date().toISOString()}`,
  ].join('\n');
  const html = `
    <p><strong>Savvy Scout</strong> test email from Final10.</p>
    <p>If you received this, SMTP is configured correctly on the server.</p>
    <p><small>${new Date().toISOString()}</small></p>
  `;

  const result = await sendMailMessage({ to, subject, text, html, verifyFirst: true });
  if (result.sent) {
    console.log(`[email] Test email sent to ${to}`);
  }
  return { ...result, config: getEmailConfigStatus() };
}

module.exports = {
  sendAlertMatchEmail,
  sendTestEmail,
  alertEmailEnabled,
  getEmailConfigStatus,
  getSmtpEnvPresence,
  verifySmtpConnection,
  formatMailerError,
  getSmtpTransportSettings,
};
