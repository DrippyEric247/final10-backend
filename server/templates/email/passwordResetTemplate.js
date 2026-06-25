/**
 * Final10 password reset email — Savvy Scout purple/gold branding.
 */

const {
  escapeHtml,
  pick,
  getClientBaseUrl,
  savvyScoutLogoImageUrl,
  final10LogoImageUrl,
  emailBrandingFooterHtml,
  emailBrandingFooterText,
} = require('./emailTemplateUtils');

const COLORS = {
  bg: '#08050f',
  card: '#140c22',
  border: '#2d1f45',
  purple: '#a855f7',
  purpleDeep: '#6d28d9',
  gold: '#f5b942',
  text: '#f8fafc',
  muted: '#a89bb8',
};

const RESET_SUBJECT = 'Reset your Final10 password';

function buildPasswordResetUrl(rawToken) {
  const base = getClientBaseUrl();
  const params = new URLSearchParams({ token: String(rawToken || '') });
  return `${base}/reset-password?${params.toString()}`;
}

function buildPasswordResetEmail({ resetToken, firstName } = {}) {
  const resetUrl = buildPasswordResetUrl(resetToken);
  const greeting = pick(firstName, 'Operator');
  const scoutLogo = savvyScoutLogoImageUrl();
  const f10Logo = final10LogoImageUrl();

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 24px 16px;text-align:center;background:linear-gradient(180deg,#1a1028 0%,${COLORS.card} 100%);">
            <img src="${escapeHtml(f10Logo)}" alt="Final10" width="120" style="display:block;margin:0 auto 16px;border:0;" />
            <img src="${escapeHtml(scoutLogo)}" alt="Savvy Scout" width="72" style="display:block;margin:0 auto 12px;border:0;" />
            <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:20px;font-weight:900;color:${COLORS.gold};letter-spacing:0.04em;">PASSWORD RESET</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.muted};margin-top:6px;">Savvy Scout secured link · expires in 30 minutes</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};font-size:15px;line-height:1.6;">
            <p style="margin:0 0 12px;">Hey ${escapeHtml(greeting)},</p>
            <p style="margin:0 0 16px;color:${COLORS.muted};">We received a request to reset your Final10 password. Tap the button below to choose a new one. This link expires in <strong style="color:${COLORS.gold};">30 minutes</strong>.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px auto;">
              <tr>
                <td style="border-radius:12px;background:linear-gradient(90deg,${COLORS.purpleDeep},${COLORS.purple});">
                  <a href="${escapeHtml(resetUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#fff;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase;">Reset Password</a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:${COLORS.muted};">If you didn&apos;t request this, you can safely ignore this email — your password won&apos;t change.</p>
            <p style="margin:12px 0 0;font-size:11px;color:#6b5f7a;word-break:break-all;">Or copy this link:<br/><a href="${escapeHtml(resetUrl)}" style="color:${COLORS.purple};">${escapeHtml(resetUrl)}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 24px;">
            ${emailBrandingFooterHtml({ prominent: true, marginTop: 8 })}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    'Reset your Final10 password',
    '',
    `Hey ${greeting},`,
    '',
    'We received a request to reset your Final10 password.',
    'Open this link within 30 minutes to choose a new password:',
    resetUrl,
    '',
    "If you didn't request this, ignore this email — your password won't change.",
    '',
    emailBrandingFooterText(),
  ].join('\n');

  return { subject: RESET_SUBJECT, html, text, resetUrl };
}

module.exports = {
  RESET_SUBJECT,
  buildPasswordResetEmail,
  buildPasswordResetUrl,
};
