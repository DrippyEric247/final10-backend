const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { auditEmailDelivery } = require('./auditLogger');
const { buildSavvyScoutDealFoundEmail } = require('../templates/email/savvyScoutDealFoundTemplate');
const {
  buildSavvyScoutMonthlyReportEmail,
  sampleMonthlyReportData,
} = require('../templates/email/savvyScoutMonthlyReportTemplate');
const { buildEarlyMonthlyReportTestPayload } = require('./monthlyReportService');
const { FOUNDER_ADMIN_EMAIL } = require('../lib/founderAdminAccess');

const EARLY_MONTHLY_REPORT_SUBJECT = '🛩️ Your Early Savvy Scout Monthly Report Test';
const { emailBrandingFooterHtml, emailBrandingFooterText } = require('../templates/email/emailTemplateUtils');
const {
  resolveEmailFrom,
  auditEmailFrom,
  resendValidationHint,
  isResendSandboxAddress,
  allowResendSandboxFrom,
} = require('../config/emailFrom');
const { ensureAccessibleEmailProductImageUrl } = require('../templates/email/emailTemplateUtils');

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_TIMEOUT_MS = 60000;

let transport = null;
let lastVerifyResult = null;
let resendClient = null;
let resendConnectedLogged = false;

function readResendApiKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function getEmailFrom() {
  return resolveEmailFrom();
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
  const fromAudit = auditEmailFrom();
  if (isResendConfigured()) {
    getResendClient();
    console.log('[email] sender audit', JSON.stringify({
      resolvedAddress: fromAudit.resolvedAddress,
      isResendSandboxFrom: fromAudit.isResendSandboxFrom,
      verifiedDomain: fromAudit.verifiedDomain,
      recommendedFrom: fromAudit.recommendedFrom,
      issue: fromAudit.issue,
    }));
    if (fromAudit.issue === 'resend_sandbox_from_restricted') {
      console.warn('[email] FIX:', fromAudit.fixHint);
    }
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
    fromAudit: auditEmailFrom(),
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

async function sendViaResend({ to, subject, text, html, trace = null }) {
  const client = getResendClient();
  const from = getEmailFrom();
  if (!client || !from) {
    const result = { sent: false, logOnly: true, provider: 'resend', reason: 'resend_not_configured' };
    trace?.step('provider_resend_not_configured', {
      ok: false,
      hasClient: Boolean(client),
      hasFrom: Boolean(from),
      ...result,
    });
    return result;
  }

  if (isResendSandboxAddress(from) && !allowResendSandboxFrom()) {
    const audit = auditEmailFrom();
    const result = {
      sent: false,
      logOnly: false,
      provider: 'resend',
      reason: 'resend_sandbox_from_blocked',
      errorCode: 'RESEND_SANDBOX_FROM',
      errorReason:
        'Resend sandbox sender onboarding@resend.dev only delivers to your Resend account email.',
      resendValidationHint: audit.fixHint,
    };
    trace?.step('provider_resend_sandbox_blocked', { ok: false, ...result, fromAudit: audit });
    return result;
  }

  const fromAudit = auditEmailFrom();
  trace?.step('provider_resend_from_audit', {
    resolvedAddress: fromAudit.resolvedAddress,
    isResendSandboxFrom: fromAudit.isResendSandboxFrom,
    verifiedDomain: fromAudit.verifiedDomain,
  });

  trace?.step('provider_resend_request', {
    to: `${String(to).slice(0, 3)}***`,
    from: from.replace(/(.{0,12}).+@/, '$1…@'),
    subjectLen: String(subject || '').length,
    htmlLen: String(html || '').length,
    textLen: String(text || '').length,
  });
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
      const validationHint = resendValidationHint(formatted.errorReason);
      console.warn(
        '[email] Email failed',
        JSON.stringify({
          provider: 'resend',
          to,
          validationHint,
          ...formatted,
        })
      );
      const result = {
        sent: false,
        logOnly: false,
        provider: 'resend',
        reason: 'resend_send_failed',
        resendValidationHint: validationHint,
        ...formatted,
      };
      trace?.step('provider_resend_error', { ok: false, ...result });
      return result;
    }

    console.log(
      '[email] Email sent',
      JSON.stringify({ provider: 'resend', to, messageId: data?.id || null })
    );
    const result = { sent: true, provider: 'resend', messageId: data?.id || null };
    trace?.step('provider_resend_success', { ok: true, messageId: result.messageId });
    return result;
  } catch (err) {
    const formatted = formatMailerError(err);
    console.warn(
      '[email] Email failed',
      JSON.stringify({ provider: 'resend', to, ...formatted })
    );
    const result = {
      sent: false,
      logOnly: false,
      provider: 'resend',
      reason: 'resend_send_failed',
      ...formatted,
    };
    trace?.step('provider_resend_exception', { ok: false, ...result });
    return result;
  }
}

async function sendViaSmtp({ to, subject, text, html, verifyFirst = false, trace = null }) {
  const tx = getTransport();
  if (!tx) {
    const result = { sent: false, logOnly: true, provider: 'smtp', reason: 'smtp_not_configured' };
    trace?.step('provider_smtp_not_configured', { ok: false, ...result });
    return result;
  }

  if (verifyFirst) {
    trace?.step('provider_smtp_verify_start', {});
    const verify = await verifySmtpConnection({ log: true });
    if (!verify.ok) {
      const result = {
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
      trace?.step('provider_smtp_verify_failed', { ok: false, ...result });
      return result;
    }
    trace?.step('provider_smtp_verify_ok', { ok: true });
  }

  trace?.step('provider_smtp_send_start', {
    to: `${String(to).slice(0, 3)}***`,
    subjectLen: String(subject || '').length,
  });

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
    const result = { sent: true, provider: 'smtp', messageId: info.messageId || null };
    trace?.step('provider_smtp_success', { ok: true, messageId: result.messageId });
    return result;
  } catch (err) {
    const mailerError = formatMailerError(err);
    console.warn('[email] SMTP send failed', JSON.stringify({ provider: 'smtp', to, ...mailerError }));
    resetTransport();
    const result = {
      sent: false,
      logOnly: false,
      provider: 'smtp',
      reason: 'smtp_send_failed',
      ...mailerError,
    };
    trace?.step('provider_smtp_failed', { ok: false, ...result });
    return result;
  }
}

async function sendMailMessage({ to, subject, text, html, verifyFirst = false, trace = null }) {
  trace?.step('send_mail_enter', {
    hasRecipient: Boolean(to),
    subjectLen: String(subject || '').length,
    htmlLen: String(html || '').length,
    textLen: String(text || '').length,
  });

  if (!to) {
    console.log(`[email] (log-only) To: missing | ${subject}`);
    const result = { sent: false, logOnly: true, reason: 'missing_recipient' };
    trace?.step('send_mail_stop', { ok: false, reason: 'missing_recipient', ...result });
    return result;
  }

  const provider = getEmailProvider();
  trace?.step('provider_selected', {
    provider,
    emailConfigured: isEmailConfigured(),
    alertEmailEnabled: alertEmailEnabled(),
    resendConfigured: isResendConfigured(),
    smtpConfigured: isSmtpConfigured(),
    fromPresent: Boolean(getEmailFrom()),
  });
  logEmailDiagnostics({ action: 'send_route' });

  if (provider === 'resend') {
    const result = await sendViaResend({ to, subject, text, html, trace });
    trace?.step('send_mail_complete', { sent: Boolean(result.sent), provider: 'resend', reason: result.reason || null });
    return result;
  }
  if (provider === 'smtp') {
    const result = await sendViaSmtp({ to, subject, text, html, verifyFirst, trace });
    trace?.step('send_mail_complete', { sent: Boolean(result.sent), provider: 'smtp', reason: result.reason || null });
    return result;
  }

  console.log(`[email] (log-only) To: ${to} | ${subject}`);
  const result = { sent: false, logOnly: true, reason: 'email_not_configured' };
  trace?.step('send_mail_stop', {
    ok: false,
    reason: 'email_not_configured',
    hint: 'Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS on Railway',
    ...result,
  });
  return result;
}

async function sendSavvyScoutDealFoundEmail({
  to,
  data = {},
  subject: subjectOverride,
  forceSend = false,
  trace = null,
}) {
  trace?.step('savvy_email_enter', {
    hasRecipient: Boolean(to),
    forceSend,
    alertEmailEnabled: alertEmailEnabled(),
    emailConfigured: isEmailConfigured(),
    provider: getEmailProvider(),
  });

  const payload = subjectOverride ? { ...data, subject: subjectOverride } : data;

  const imageResult = await ensureAccessibleEmailProductImageUrl(payload.productImage);
  const payloadWithImage = { ...payload, productImage: imageResult.url };

  trace?.step('product_image_resolved', {
    usedFallback: imageResult.usedFallback,
    source: imageResult.source ? String(imageResult.source).slice(0, 120) : null,
    resolved: String(imageResult.url).slice(0, 120),
  });

  trace?.step('template_render_start', {
    productTitle: String(payloadWithImage.productTitle || '').slice(0, 80),
    hasProductImage: Boolean(payloadWithImage.productImage),
  });

  let subject;
  let html;
  let text;
  try {
    const built = buildSavvyScoutDealFoundEmail(payloadWithImage);
    subject = built.subject;
    html = built.html;
    text = built.text;
    trace?.step('template_render_done', {
      ok: true,
      subjectLen: String(subject || '').length,
      htmlLen: String(html || '').length,
      textLen: String(text || '').length,
      preheader: String(built.preheader || '').slice(0, 120),
    });
  } catch (err) {
    trace?.step('template_render_failed', {
      ok: false,
      reason: 'template_build_error',
      message: String(err?.message || err).slice(0, 200),
    });
    throw err;
  }

  if (!forceSend && !alertEmailEnabled()) {
    console.log(`[email] Savvy Scout deal (log-only) → ${to || 'no-email'} | ${subject}`);
    trace?.step('savvy_email_stop', {
      ok: false,
      reason: 'alert_email_disabled',
      forceSend,
      hint: 'Set ALERT_EMAIL_ENABLED=true or pass forceSend:true',
    });
    auditEmailDelivery({
      kind: 'savvy_scout_deal',
      to: to ? `${String(to).slice(0, 3)}***` : null,
      sent: false,
      reason: 'alert_email_disabled',
    });
    return { sent: false, logOnly: true, reason: 'alert_email_disabled', subject, html, text };
  }

  trace?.step('savvy_email_dispatch', { forceSend, provider: getEmailProvider() });

  const result = await sendMailMessage({ to, subject, text, html, trace });

  trace?.step('savvy_email_result', {
    sent: Boolean(result.sent),
    logOnly: Boolean(result.logOnly),
    provider: result.provider || getEmailProvider(),
    reason: result.reason || null,
    messageId: result.messageId || null,
    errorCode: result.errorCode || null,
  });

  auditEmailDelivery({
    kind: 'savvy_scout_deal',
    to: to ? `${String(to).slice(0, 3)}***` : null,
    sent: Boolean(result?.sent),
    reason: result?.reason || null,
    provider: result?.provider || getEmailProvider(),
    logOnly: Boolean(result?.logOnly),
    messageId: result?.messageId || null,
  });
  return { ...result, subject };
}

async function sendAlertMatchEmail({ to, alertName, listingTitle, listingUrl, dealData = {} }) {
  const merged = {
    productTitle: listingTitle,
    viewDealUrl: listingUrl,
    preheader: `Savvy Scout matched your alert "${alertName}"`,
    ...dealData,
  };
  const subjectOverride = `🎯 Savvy Scout Alert: ${alertName}`;
  return sendSavvyScoutDealFoundEmail({
    to,
    data: merged,
    subject: subjectOverride,
    forceSend: true,
  });
}

async function sendSavvyScoutMonthlyReportEmail({
  to,
  data = {},
  subject: subjectOverride,
  forceSend = false,
  trace = null,
}) {
  trace?.step('monthly_report_email_enter', { hasRecipient: Boolean(to), forceSend });

  const payload = subjectOverride ? { ...data, subject: subjectOverride } : data;
  let subject;
  let html;
  let text;
  try {
    const built = buildSavvyScoutMonthlyReportEmail(payload);
    subject = built.subject;
    html = built.html;
    text = built.text;
    trace?.step('monthly_report_render_done', {
      ok: true,
      subjectLen: String(subject || '').length,
      htmlLen: String(html || '').length,
    });
  } catch (err) {
    trace?.step('monthly_report_render_failed', {
      ok: false,
      message: String(err?.message || err).slice(0, 200),
    });
    throw err;
  }

  if (!forceSend && !alertEmailEnabled()) {
    console.log(`[email] Savvy Scout monthly report (log-only) → ${to || 'no-email'} | ${subject}`);
    return { sent: false, logOnly: true, reason: 'alert_email_disabled', subject, html, text };
  }

  const result = await sendMailMessage({ to, subject, text, html, trace });
  auditEmailDelivery({
    kind: 'savvy_scout_monthly_report',
    to: to ? `${String(to).slice(0, 3)}***` : null,
    sent: Boolean(result?.sent),
    reason: result?.reason || null,
    provider: result?.provider || getEmailProvider(),
    logOnly: Boolean(result?.logOnly),
    messageId: result?.messageId || null,
  });
  return { ...result, subject };
}

/**
 * Admin/test — early Monthly Scout Report with dynamic goals to founder email.
 */
async function sendEarlyMonthlyReportTest({ to = FOUNDER_ADMIN_EMAIL, data = {}, trace = null } = {}) {
  const recipient = String(to || FOUNDER_ADMIN_EMAIL).trim().toLowerCase();
  const payload = buildEarlyMonthlyReportTestPayload(data);
  return sendSavvyScoutMonthlyReportEmail({
    to: recipient,
    data: payload,
    subject: EARLY_MONTHLY_REPORT_SUBJECT,
    forceSend: true,
    trace,
  });
}

async function sendTestEmail({ to, useDealTemplate = true, template = 'deal' }) {
  if (template === 'monthly_report_early' || template === 'early_monthly_report') {
    const result = await sendEarlyMonthlyReportTest({ to });
    if (result.sent) {
      console.log(`[email] Early monthly report test sent via ${result.provider || getEmailProvider()} to ${to}`);
    }
    return { ...result, config: getEmailConfigStatus() };
  }

  if (template === 'monthly_report' || template === 'monthly') {
    const result = await sendSavvyScoutMonthlyReportEmail({
      to,
      data: sampleMonthlyReportData(),
      subject: '🛩️ Savvy Scout Monthly Report — April 2025 (test)',
      forceSend: true,
    });
    if (result.sent) {
      console.log(`[email] Monthly report test sent via ${result.provider || getEmailProvider()} to ${to}`);
    }
    return { ...result, config: getEmailConfigStatus() };
  }

  if (useDealTemplate) {
    const result = await sendSavvyScoutDealFoundEmail({
      to,
      data: {
        userName: 'Eric',
        productTitle: 'PlayStation 5 Slim Console — Disc Edition',
        productImage: 'https://i.ebayimg.com/images/g/example/ps5.jpg',
        currentPrice: 374.99,
        originalPrice: 499.99,
        savingsAmount: 125,
        savingsPercent: 25,
        trustScore: 94,
        rankedAbovePercent: 97,
        shippingStatus: 'Fast Shipping Available',
        viewDealUrl: `${String(process.env.CLIENT_URL || 'https://final10.app').replace(/\/$/, '')}/auctions`,
        baseReward: 250,
        premiumBonus: 125,
        seasonPassBonus: 80,
        doublePointBonus: 150,
        doublePointActive: true,
        userLevel: 'Founding Tester',
        savvyBalance: 4250,
        currentMultiplier: '1.5X',
        nextRewardTier: 'Deal Hunter',
        progressPercent: 75,
      },
      subject: '🎯 Savvy Scout — Final10 deal notification test',
    });
    if (result.sent) {
      console.log(`[email] Deal template test sent via ${result.provider || getEmailProvider()} to ${to}`);
    }
    return { ...result, config: getEmailConfigStatus() };
  }

  const subject = '🎯 Savvy Scout — Final10 test email';
  const provider = getEmailProvider();
  const text = [
    'This is a test email from Final10 Savvy Scout alert delivery.',
    '',
    `Provider: ${provider}`,
    'If you received this, email delivery is configured correctly on the server.',
    `Time: ${new Date().toISOString()}`,
    '',
    emailBrandingFooterText(),
  ].join('\n');
  const html = `
    <p><strong>Savvy Scout</strong> test email from Final10.</p>
    <p>Provider: <code>${provider}</code></p>
    <p>If you received this, email delivery is configured correctly on the server.</p>
    <p><small>${new Date().toISOString()}</small></p>
    ${emailBrandingFooterHtml()}
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
  sendSavvyScoutDealFoundEmail,
  sendSavvyScoutMonthlyReportEmail,
  sendEarlyMonthlyReportTest,
  sendTestEmail,
  buildSavvyScoutDealFoundEmail,
  buildSavvyScoutMonthlyReportEmail,
  auditEmailFrom,
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
