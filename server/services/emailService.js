const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { auditEmailDelivery } = require('./auditLogger');

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_TIMEOUT_MS = 60000;
const DEFAULT_RESEND_FROM = 'onboarding@resend.dev';

let transport = null;
let lastVerifyResult = null;
let resendClient = null;
let resendConnectedLogged = false;

function readResendApiKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function getEmailFrom() {
  const explicit = String(
    process.env.EMAIL_FROM || process.env.SMTP_FROM || readSmtpAuth().user || ''
  ).trim();
  if (explicit) return explicit;
  if (readResendApiKey()) return DEFAULT_RESEND_FROM;
  return '';
}

function isResendConfigured() {
  return Boolean(readResendApiKey());
}

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

function isSmtpConfigured() {
  const auth = readSmtpAuth();
  return Boolean(auth.host && auth.user && auth.pass);
}

function getEmailProvider() {
  if (isResendConfigured()) return 'resend';
  if (isSmtpConfigured()) return 'smtp';
  return 'none';
}

function isEmailConfigured() {
  return getEmailProvider() !== 'none';
}

function getResendClient() {
  const key = readResendApiKey();
  if (!key) return null;
  if (!resendClient) {
    resendClient = new Resend(key);
    if (!resendConnectedLogged) {
      console.log(
        '[email] Resend connected',
        JSON.stringify({
          apiKeyPresent: true,
          from: getEmailFrom(),
        })
      );
      resendConnectedLogged = true;
    }
  }
  return resendClient;
}

function logEmailStartup() {
  if (isResendConfigured()) {
    getResendClient();
    return;
  }
  if (isSmtpConfigured()) {
    console.log('[email] Resend not configured — using SMTP fallback');
    return;
  }
  console.log('[email] Email delivery not configured (set RESEND_API_KEY on Railway)');
}

function resolveSmtpTransportSettings() {
  const { host } = readSmtpAuth();
  const portRaw = String(process.env.SMTP_PORT || '').trim();
  const port = portRaw ? Number(portRaw) : DEFAULT_SMTP_PORT;
  const gmail = isGmailHost(host);
  const timeoutMs =
    Math.max(Number(process.env.SMTP_TIMEOUT_MS || DEFAULT_SMTP_TIMEOUT_MS) || DEFAULT_SMTP_TIMEOUT_MS, 10000);

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

function logEmailDiagnostics(extra = {}) {
  const auth = readSmtpAuth();
  const settings = resolveSmtpTransportSettings();
  const provider = getEmailProvider();
  console.log(
    '[email] diagnostics',
    JSON.stringify({
      provider,
      resendApiKeyPresent: Boolean(readResendApiKey()),
      emailFromPresent: Boolean(getEmailFrom()),
      emailFromHint: getEmailFrom() ? getEmailFrom().replace(/(.{0,12}).+@/, '$1…@') : null,
      smtpHostPresent: Boolean(auth.host),
      smtpPort: settings.port,
      secure: settings.secure,
      requireTLS: settings.requireTLS,
      smtpUserPresent: Boolean(auth.user),
      smtpPassPresent: Boolean(auth.pass),
      timeoutMs: settings.connectionTimeout,
      alertEmailEnabled: alertEmailEnabled(),
      ...extra,
    })
  );
}

function formatMailerError(err) {
  if (!err) {
    return {
      errorCode: 'EMAIL_ERROR',
      errorReason: 'Unknown mailer error',
      smtpCommand: null,
      responseCode: null,
    };
  }
  return {
    errorCode: err.code || err.name || err.errno || 'EMAIL_ERROR',
    errorReason: err.message || String(err),
    smtpCommand: err.command || null,
    responseCode: err.statusCode || err.responseCode || null,
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
    if (log) logEmailDiagnostics({ connectionVerify: 'skipped_not_configured', provider: 'smtp' });
    return lastVerifyResult;
  }

  if (log) logEmailDiagnostics({ connectionVerify: 'starting', provider: 'smtp' });

  try {
    await tx.verify();
    lastVerifyResult = { ok: true, verified: true, provider: 'smtp', ...getSmtpTransportSettings() };
    if (log) {
      console.log('[email] SMTP connection verify: success');
      logEmailDiagnostics({ connectionVerify: 'success', provider: 'smtp' });
    }
    return lastVerifyResult;
  } catch (err) {
    const mailerError = formatMailerError(err);
    lastVerifyResult = {
      ok: false,
      verified: false,
      provider: 'smtp',
      ...getSmtpTransportSettings(),
      ...mailerError,
    };
    if (log) {
      console.warn(
        '[email] SMTP connection verify: failed',
        JSON.stringify({
          provider: 'smtp',
          connectionVerify: 'failed',
          ...mailerError,
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

function getSmtpEnvPresence() {
  return {
    SMTP_HOST: Boolean(String(process.env.SMTP_HOST || '').trim()),
    SMTP_PORT: Boolean(String(process.env.SMTP_PORT || '').trim()),
    SMTP_USER: Boolean(String(process.env.SMTP_USER || '').trim()),
    SMTP_PASS: Boolean(String(process.env.SMTP_PASS || '').trim()),
    SMTP_FROM: Boolean(String(process.env.SMTP_FROM || '').trim()),
  };
}

function getEmailEnvPresence() {
  return {
    RESEND_API_KEY: Boolean(readResendApiKey()),
    EMAIL_FROM: Boolean(String(process.env.EMAIL_FROM || '').trim()),
    ...getSmtpEnvPresence(),
  };
}

function getEmailConfigStatus() {
  const auth = readSmtpAuth();
  const provider = getEmailProvider();
  const emailConfigured = isEmailConfigured();
  const from = getEmailFrom();
  return {
    emailConfigured,
    provider,
    resendConfigured: isResendConfigured(),
    smtpConfigured: isSmtpConfigured(),
    alertEmailEnabled: alertEmailEnabled(),
    emailFrom: from || null,
    smtpHost: auth.host ? auth.host.replace(/^(.{3}).+/, '$1…') : null,
    mode: emailConfigured && alertEmailEnabled() ? 'live' : 'log-only',
    envPresent: getEmailEnvPresence(),
    transportSettings: provider === 'smtp' ? getSmtpTransportSettings() : null,
    lastVerify: lastVerifyResult
      ? {
          ok: lastVerifyResult.ok,
          verified: lastVerifyResult.verified,
          provider: lastVerifyResult.provider || null,
          errorCode: lastVerifyResult.errorCode || null,
          errorReason: lastVerifyResult.errorReason || null,
        }
      : null,
  };
}

async function sendViaResend({ to, subject, text, html }) {
  const client = getResendClient();
  const from = getEmailFrom();
  if (!client || !from) {
    return { sent: false, logOnly: true, provider: 'resend', reason: 'resend_not_configured' };
  }

  logEmailDiagnostics({ provider: 'resend', action: 'send_start' });

  try {
    const { data, error } = await client.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
    });

    if (error) {
      const formatted = formatMailerError(error);
      console.warn(
        '[email] Email failed',
        JSON.stringify({
          provider: 'resend',
          to,
          ...formatted,
        })
      );
      return {
        sent: false,
        logOnly: false,
        provider: 'resend',
        reason: 'resend_send_failed',
        ...formatted,
      };
    }

    console.log(
      '[email] Email sent',
      JSON.stringify({ provider: 'resend', to, messageId: data?.id || null })
    );
    return { sent: true, provider: 'resend', messageId: data?.id || null };
  } catch (err) {
    const formatted = formatMailerError(err);
    console.warn(
      '[email] Email failed',
      JSON.stringify({ provider: 'resend', to, ...formatted })
    );
    return {
      sent: false,
      logOnly: false,
      provider: 'resend',
      reason: 'resend_send_failed',
      ...formatted,
    };
  }
}

async function sendViaSmtp({ to, subject, text, html, verifyFirst = false }) {
  const tx = getTransport();
  if (!tx) {
    return { sent: false, logOnly: true, provider: 'smtp', reason: 'smtp_not_configured' };
  }

  if (verifyFirst) {
    const verify = await verifySmtpConnection({ log: true });
    if (!verify.ok) {
      return {
        sent: false,
        logOnly: false,
        provider: 'smtp',
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
      from: getEmailFrom() || String(process.env.SMTP_FROM || readSmtpAuth().user),
      to,
      subject,
      text,
      html,
    });

    console.log(
      '[email] SMTP send success',
      JSON.stringify({ provider: 'smtp', to, messageId: info.messageId || null })
    );
    return { sent: true, provider: 'smtp', messageId: info.messageId || null };
  } catch (err) {
    const mailerError = formatMailerError(err);
    console.warn('[email] SMTP send failed', JSON.stringify({ provider: 'smtp', to, ...mailerError }));
    resetTransport();
    return {
      sent: false,
      logOnly: false,
      provider: 'smtp',
      reason: 'smtp_send_failed',
      ...mailerError,
    };
  }
}

async function sendMailMessage({ to, subject, text, html, verifyFirst = false }) {
  if (!to) {
    console.log(`[email] (log-only) To: missing | ${subject}`);
    return { sent: false, logOnly: true, reason: 'missing_recipient' };
  }

  const provider = getEmailProvider();
  logEmailDiagnostics({ action: 'send_route' });

  if (provider === 'resend') {
    return sendViaResend({ to, subject, text, html });
  }
  if (provider === 'smtp') {
    return sendViaSmtp({ to, subject, text, html, verifyFirst });
  }

  console.log(`[email] (log-only) To: ${to} | ${subject}`);
  return { sent: false, logOnly: true, reason: 'email_not_configured' };
}

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
    auditEmailDelivery({
      kind: 'alert_match',
      to: to ? `${String(to).slice(0, 3)}***` : null,
      sent: false,
      reason: 'alert_email_disabled',
    });
    return { sent: false, logOnly: true, reason: 'alert_email_disabled' };
  }

  const result = await sendMailMessage({ to, subject, text, html });
  auditEmailDelivery({
    kind: 'alert_match',
    to: to ? `${String(to).slice(0, 3)}***` : null,
    sent: Boolean(result?.sent),
    reason: result?.reason || null,
    provider: result?.provider || getEmailProvider(),
    logOnly: Boolean(result?.logOnly),
  });
  return result;
}

async function sendTestEmail({ to }) {
  const subject = '🎯 Savvy Scout — Final10 test email';
  const provider = getEmailProvider();
  const text = [
    'This is a test email from Final10 Savvy Scout alert delivery.',
    '',
    `Provider: ${provider}`,
    'If you received this, email delivery is configured correctly on the server.',
    `Time: ${new Date().toISOString()}`,
  ].join('\n');
  const html = `
    <p><strong>Savvy Scout</strong> test email from Final10.</p>
    <p>Provider: <code>${provider}</code></p>
    <p>If you received this, email delivery is configured correctly on the server.</p>
    <p><small>${new Date().toISOString()}</small></p>
  `;

  const result = await sendMailMessage({
    to,
    subject,
    text,
    html,
    verifyFirst: provider === 'smtp',
  });
  if (result.sent) {
    console.log(`[email] Test email sent via ${result.provider || provider} to ${to}`);
  }
  return { ...result, config: getEmailConfigStatus() };
}

module.exports = {
  sendAlertMatchEmail,
  sendTestEmail,
  alertEmailEnabled,
  getEmailConfigStatus,
  getSmtpEnvPresence,
  getEmailEnvPresence,
  verifySmtpConnection,
  formatMailerError,
  getSmtpTransportSettings,
  getEmailProvider,
  isEmailConfigured,
  logEmailStartup,
};
