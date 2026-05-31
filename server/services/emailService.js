const nodemailer = require('nodemailer');

let transport = null;

function getTransport() {
  if (transport) return transport;
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!host || !user || !pass) return null;

  transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
  return transport;
}

function alertEmailEnabled() {
  return String(process.env.ALERT_EMAIL_ENABLED || '').toLowerCase() === 'true';
}

function getEmailConfigStatus() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const smtpConfigured = Boolean(host && user && pass);
  return {
    smtpConfigured,
    alertEmailEnabled: alertEmailEnabled(),
    smtpHost: host ? host.replace(/^(.{3}).+/, '$1…') : null,
    smtpFrom: String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim() || null,
    mode: smtpConfigured && alertEmailEnabled() ? 'live' : 'log-only',
  };
}

async function sendMailMessage({ to, subject, text, html }) {
  const tx = getTransport();
  if (!tx || !to) {
    console.log(`[email] (log-only) To: ${to || 'missing'} | ${subject}`);
    return { sent: false, logOnly: true, reason: !tx ? 'smtp_not_configured' : 'missing_recipient' };
  }

  const info = await tx.sendMail({
    from: String(process.env.SMTP_FROM || process.env.SMTP_USER),
    to,
    subject,
    text,
    html,
  });

  return { sent: true, messageId: info.messageId || null };
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

  const result = await sendMailMessage({ to, subject, text, html });
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
};
