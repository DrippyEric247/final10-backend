/**
 * Admin Email Test Center — template builders (TEST ONLY, no real side effects).
 */

const { buildPasswordResetEmail } = require('./passwordResetTemplate');
const { buildSavvyScoutDealFoundEmail } = require('./savvyScoutDealFoundTemplate');
const { buildSavvyScoutMonthlyReportEmail } = require('./savvyScoutMonthlyReportTemplate');
const { buildMonthlyScoutReportData } = require('./monthlyScoutReportDataService');
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
  gold: '#f5b942',
  text: '#f8fafc',
  muted: '#a89bb8',
  test: '#f59e0b',
};

const TEST_PREFIX = '[TEST EMAIL]';

const TEMPLATE_LABELS = Object.freeze({
  welcome_email: 'Welcome Email',
  verify_email: 'Verify Email',
  password_reset: 'Password Reset',
  deal_alert: 'Deal Alert',
  price_drop_alert: 'Price Drop Alert',
  best_move_alert: 'Best Move Alert',
  quick_snipe_alert: 'Quick Snipe Alert',
  monthly_scout_report: 'Monthly Scout Report',
  referral_reward: 'Referral Reward',
  founding_tester_reward: 'Founding Tester Reward',
  double_points_event: 'Double Points Event',
  triple_points_event: 'Triple Points Event',
  savvy_sale_event: 'Savvy Sale Event',
  max_supply_drop_event: 'Max Supply Drop Event',
  custom: 'Custom Test Email',
});

function wrapAsTestEmail({ subject, html, text }) {
  const testSubject = subject.startsWith(TEST_PREFIX) ? subject : `${TEST_PREFIX} ${subject}`;
  const bannerHtml = `<div style="background:#78350f;color:#fde68a;font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;text-align:center;padding:12px 16px;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid #f59e0b;">⚠️ TEST EMAIL — NOT A REAL ALERT OR REWARD</div>`;
  const bannerText = '*** TEST EMAIL — NOT A REAL ALERT OR REWARD ***\n\n';
  let wrappedHtml = html;
  if (/<body[^>]*>/i.test(html)) {
    wrappedHtml = html.replace(/<body[^>]*>/i, (m) => `${m}${bannerHtml}`);
  } else {
    wrappedHtml = `${bannerHtml}${html}`;
  }
  return {
    subject: testSubject,
    html: wrappedHtml,
    text: `${bannerText}${text}`,
  };
}

function sampleDealData(user = {}) {
  const base = getClientBaseUrl();
  return {
    userName: pick(user.firstName || user.username, 'Operator'),
    productTitle: 'PlayStation 5 Slim Console — Disc Edition',
    productImage: `${base}/assets/email/savvy-scout-hero.png`,
    currentPrice: 374.99,
    originalPrice: 499.99,
    savingsAmount: 125,
    savingsPercent: 25,
    trustScore: 94,
    rankedAbovePercent: 97,
    shippingStatus: 'Fast Shipping Available',
    viewDealUrl: `${base}/auctions`,
    baseReward: 250,
    premiumBonus: 125,
    seasonPassBonus: 80,
    doublePointBonus: 0,
    doublePointActive: false,
    userLevel: pick(user.membershipTier, 'Beta Tester'),
    savvyBalance: 4250,
    currentMultiplier: '1.5X',
    nextRewardTier: 'Deal Hunter',
    progressPercent: 75,
  };
}

function buildSimpleBrandedEmail({ headline, bodyHtml, bodyText, ctaLabel, ctaUrl, accent = COLORS.purple }) {
  const scoutLogo = savvyScoutLogoImageUrl();
  const f10Logo = final10LogoImageUrl();
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
<tr><td style="padding:24px;text-align:center;background:linear-gradient(180deg,#1a1028,${COLORS.card});">
<img src="${escapeHtml(f10Logo)}" alt="Final10" width="110" style="display:block;margin:0 auto 12px;border:0;" />
<img src="${escapeHtml(scoutLogo)}" alt="Savvy Scout" width="64" style="display:block;margin:0 auto 10px;border:0;" />
<div style="font-family:Arial Black,Arial,sans-serif;font-size:18px;font-weight:900;color:${accent};">${escapeHtml(headline)}</div>
</td></tr>
<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};font-size:15px;line-height:1.6;">
${bodyHtml}
${ctaLabel && ctaUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px auto;"><tr><td style="border-radius:12px;background:linear-gradient(90deg,#6d28d9,${COLORS.purple});"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 24px;font-family:Arial Black,Arial,sans-serif;font-size:13px;font-weight:900;color:#fff;text-decoration:none;text-transform:uppercase;">${escapeHtml(ctaLabel)}</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="padding:0 24px 24px;">${emailBrandingFooterHtml({ prominent: true })}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${headline}\n\n${bodyText}${ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : ''}\n\n${emailBrandingFooterText()}`;
  return { html, text };
}

function buildWelcomeEmail(user) {
  const name = pick(user.firstName || user.username, 'Operator');
  const { html, text } = buildSimpleBrandedEmail({
    headline: 'Welcome to Final10',
    bodyHtml: `<p style="margin:0 0 12px;">Hey ${escapeHtml(name)},</p><p style="margin:0;color:${COLORS.muted};">Savvy Scout is online and ready to hunt deals across the Savvy Universe. This is a preview of your welcome message — no rewards or alerts were triggered.</p>`,
    bodyText: `Hey ${name},\n\nSavvy Scout is online and ready to hunt deals across the Savvy Universe.`,
    ctaLabel: 'Enter Final10',
    ctaUrl: getClientBaseUrl(),
    accent: COLORS.gold,
  });
  return wrapAsTestEmail({ subject: 'Welcome to Final10 — Savvy Scout is ready', html, text });
}

function buildVerifyEmail(user) {
  const name = pick(user.firstName || user.username, 'Operator');
  const verifyUrl = `${getClientBaseUrl()}/login?verify=test-only`;
  const { html, text } = buildSimpleBrandedEmail({
    headline: 'Verify your email',
    bodyHtml: `<p style="margin:0 0 12px;">Hey ${escapeHtml(name)},</p><p style="margin:0;color:${COLORS.muted};">Confirm your email to unlock the full Savvy Universe experience. This test link does not activate a real verification flow.</p>`,
    bodyText: `Hey ${name},\n\nConfirm your email to unlock the full Savvy Universe experience.`,
    ctaLabel: 'Verify Email',
    ctaUrl: verifyUrl,
  });
  return wrapAsTestEmail({ subject: 'Verify your Final10 email address', html, text });
}

function buildPasswordResetTestEmail(user) {
  const built = buildPasswordResetEmail({
    resetToken: 'TEST-ONLY-NOT-VALID',
    firstName: user.firstName || user.username,
  });
  return wrapAsTestEmail(built);
}

function buildDealVariantEmail(user, { subject, preheader }) {
  const built = buildSavvyScoutDealFoundEmail({
    ...sampleDealData(user),
    preheader,
  });
  return wrapAsTestEmail({ subject, html: built.html, text: built.text });
}

async function buildMonthlyReportTestEmail(user) {
  const data = await buildMonthlyScoutReportData(user._id, { logMetrics: true });
  const built = buildSavvyScoutMonthlyReportEmail(data);
  return wrapAsTestEmail({
    subject: built.subject || 'Your Savvy Scout Monthly Report',
    html: built.html,
    text: built.text,
  });
}

function buildReferralRewardEmail(user) {
  const name = pick(user.firstName || user.username, 'Operator');
  const { html, text } = buildSimpleBrandedEmail({
    headline: '🎁 Referral Reward',
    bodyHtml: `<p style="margin:0 0 12px;">Nice work, ${escapeHtml(name)}!</p><p style="margin:0;color:${COLORS.muted};">Your referral brought a new Operator into the Savvy Universe. This preview shows what a referral reward email looks like — no Savvy was granted.</p>`,
    bodyText: `Nice work, ${name}! Your referral reward preview — no Savvy was granted.`,
    ctaLabel: 'View Savvy Wallet',
    ctaUrl: `${getClientBaseUrl()}/profile`,
    accent: COLORS.gold,
  });
  return wrapAsTestEmail({ subject: 'You earned a referral reward!', html, text });
}

function buildFoundingTesterRewardEmail(user) {
  const name = pick(user.firstName || user.username, 'Operator');
  const { html, text } = buildSimpleBrandedEmail({
    headline: '🏅 Founding Tester Reward',
    bodyHtml: `<p style="margin:0 0 12px;">Operator ${escapeHtml(name)},</p><p style="margin:0;color:${COLORS.muted};">Thank you for helping shape Final10 Beta. This email previews founding tester recognition — no cosmetics or Savvy were granted.</p>`,
    bodyText: `Operator ${name}, thank you for helping shape Final10 Beta.`,
    ctaLabel: 'View Founding Hall',
    ctaUrl: `${getClientBaseUrl()}/founding-hall`,
    accent: '#c084fc',
  });
  return wrapAsTestEmail({ subject: 'Founding Tester reward unlocked', html, text });
}

function buildEventEmail(user, { headline, subject, accent, copy }) {
  const name = pick(user.firstName || user.username, 'Operator');
  const { html, text } = buildSimpleBrandedEmail({
    headline,
    bodyHtml: `<p style="margin:0 0 12px;">Hey ${escapeHtml(name)},</p><p style="margin:0;color:${COLORS.muted};">${escapeHtml(copy)} This is a test event announcement — no live event was activated.</p>`,
    bodyText: `Hey ${name},\n\n${copy}`,
    ctaLabel: 'View Events',
    ctaUrl: `${getClientBaseUrl()}/events`,
    accent,
  });
  return wrapAsTestEmail({ subject, html, text });
}

function buildCustomTestEmail({ subject, message, buttonText, buttonUrl, imageUrl }) {
  const safeSubject = pick(subject, 'Savvy Scout Test Message');
  const bodyHtml = `
    <p style="margin:0 0 12px;color:${COLORS.muted};">${escapeHtml(pick(message, 'Custom admin test message.'))}</p>
    ${imageUrl ? `<p style="margin:16px 0;text-align:center;"><img src="${escapeHtml(imageUrl)}" alt="" style="max-width:100%;border-radius:12px;border:1px solid ${COLORS.border};" /></p>` : ''}
  `;
  const { html, text } = buildSimpleBrandedEmail({
    headline: 'Savvy Scout Transmission',
    bodyHtml,
    bodyText: pick(message, 'Custom admin test message.'),
    ctaLabel: buttonText || null,
    ctaUrl: buttonUrl || null,
  });
  return wrapAsTestEmail({ subject: safeSubject, html, text });
}

async function buildAdminTestEmail(templateKey, user = {}, custom = {}) {
  switch (templateKey) {
    case 'welcome_email':
      return buildWelcomeEmail(user);
    case 'verify_email':
      return buildVerifyEmail(user);
    case 'password_reset':
      return buildPasswordResetTestEmail(user);
    case 'deal_alert':
      return buildDealVariantEmail(user, {
        subject: '🎯 Savvy Scout found a deal for you',
        preheader: 'Test deal alert — sample listing preview',
      });
    case 'price_drop_alert':
      return buildDealVariantEmail(user, {
        subject: '📉 Price drop on your watched item',
        preheader: 'Test price drop alert — no alert was created',
      });
    case 'best_move_alert':
      return buildDealVariantEmail(user, {
        subject: '✅ Best Move — Savvy Scout recommendation',
        preheader: 'Test Best Move alert — sample recommendation',
      });
    case 'quick_snipe_alert':
      return buildDealVariantEmail(user, {
        subject: '⚡ Quick Snipe opportunity detected',
        preheader: 'Test Quick Snipe alert — sample local deal',
      });
    case 'monthly_scout_report':
      return buildMonthlyReportTestEmail(user);
    case 'referral_reward':
      return buildReferralRewardEmail(user);
    case 'founding_tester_reward':
      return buildFoundingTesterRewardEmail(user);
    case 'double_points_event':
      return buildEventEmail(user, {
        headline: '⚡ Double Points Live',
        subject: 'Double Points event is active!',
        accent: '#fbbf24',
        copy: 'Earn 2× Savvy on eligible actions while Double Points is live.',
      });
    case 'triple_points_event':
      return buildEventEmail(user, {
        headline: '💜 Triple Points Surge',
        subject: 'Triple Points event is active!',
        accent: '#c084fc',
        copy: 'Earn 3× Savvy on eligible actions during this premium surge.',
      });
    case 'savvy_sale_event':
      return buildEventEmail(user, {
        headline: '🛍️ Savvy Sale',
        subject: 'Savvy Sale — limited-time perks',
        accent: '#f87171',
        copy: 'Perk Machine and shop perks are boosted for a limited window.',
      });
    case 'max_supply_drop_event':
      return buildEventEmail(user, {
        headline: '📦 Max Supply Drop',
        subject: 'Max Supply Drop incoming!',
        accent: '#60a5fa',
        copy: 'A rare supply drop is available — preview of the event email.',
      });
    case 'custom':
      return buildCustomTestEmail(custom);
    default:
      throw new Error(`Unknown template: ${templateKey}`);
  }
}

module.exports = {
  TEMPLATE_LABELS,
  TEST_PREFIX,
  buildAdminTestEmail,
};
