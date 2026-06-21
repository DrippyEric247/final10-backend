/**
 * Savvy Scout — "Deal Found" notification email (HTML + plain text).
 *
 * Visual reference: Final10 dark purple / gold branding with Savvy Scout mascot hero.
 * Table-based layout + inline styles for Gmail, Outlook, Apple Mail, and mobile clients.
 */

const {
  escapeHtml,
  pick,
  pickNumber,
  formatMoney,
  formatPercent,
  formatSavvy,
  getClientBaseUrl,
  savvyScoutHeroImageUrl,
  final10LogoImageUrl,
} = require('./emailTemplateUtils');

const COLORS = {
  bg: '#08050f',
  card: '#140c22',
  cardAlt: '#1a1028',
  border: '#2d1f45',
  purple: '#a855f7',
  purpleDeep: '#6d28d9',
  gold: '#f5b942',
  goldDark: '#c9922e',
  green: '#4ade80',
  text: '#f8fafc',
  muted: '#a89bb8',
  dim: '#6b5f7a',
};

const EARN_STEPS = Object.freeze([
  { label: 'Save the deal', savvy: 10, icon: '💾' },
  { label: 'Leave a review', savvy: 25, icon: '⭐' },
  { label: 'Share your win', savvy: 50, icon: '📣' },
  { label: 'Upload proof', savvy: 100, icon: '📸' },
]);

function normalizeDealEmailData(input = {}) {
  const baseReward = pickNumber(input.baseReward, 0) || 0;
  const premiumBonus = pickNumber(input.premiumBonus, 0) || 0;
  const seasonPassBonus = pickNumber(input.seasonPassBonus, 0) || 0;
  const doublePointBonus = pickNumber(input.doublePointBonus, 0) || 0;
  const estimatedReward =
    pickNumber(input.estimatedReward) ??
    baseReward + premiumBonus + seasonPassBonus + doublePointBonus;

  const progressPercent = Math.max(0, Math.min(100, pickNumber(input.progressPercent, 0) || 0));
  const trustScore = pickNumber(input.trustScore);
  const rankedAbove = pickNumber(input.rankedAbovePercent);
  const savingsPercent = pickNumber(input.savingsPercent);

  const whyPicked = Array.isArray(input.whyPickedReasons)
    ? input.whyPickedReasons.filter(Boolean).slice(0, 6)
    : buildDefaultWhyPicked({
        trustScore,
        rankedAbove,
        savingsPercent,
        shippingStatus: input.shippingStatus,
        savingsAmount: input.savingsAmount,
      });

  const doublePointActive =
    input.doublePointActive != null
      ? Boolean(input.doublePointActive)
      : doublePointBonus > 0;
  const pointsEventLabel = pick(
    input.pointsEventLabel,
    input.triplePointActive ? '3X REWARDS ACTIVE!' : doublePointActive ? '2X REWARDS ACTIVE!' : ''
  );

  const clientUrl = getClientBaseUrl();
  const viewDealUrl = pick(input.viewDealUrl, `${clientUrl}/auctions`);
  const preferencesUrl = pick(input.preferencesUrl, `${clientUrl}/profile`);
  const unsubscribeUrl = pick(input.unsubscribeUrl, `${clientUrl}/profile?tab=notifications`);

  return {
    userName: pick(input.userName, 'Savvy Hunter'),
    productTitle: pick(input.productTitle, 'A great deal is waiting for you'),
    productImage: pick(input.productImage, ''),
    currentPrice: formatMoney(input.currentPrice, 'See listing'),
    originalPrice: formatMoney(input.originalPrice, ''),
    savingsAmount: formatMoney(input.savingsAmount, ''),
    savingsPercent: savingsPercent != null ? formatPercent(savingsPercent) : '—',
    trustScore: trustScore != null ? `${Math.round(trustScore)}/100` : '—',
    rankedAbovePercent:
      rankedAbove != null ? `${Math.round(rankedAbove)}%` : '—',
    shippingStatus: pick(input.shippingStatus, 'Shipping details on listing'),
    viewDealUrl,
    baseReward: formatSavvy(baseReward),
    premiumBonus: formatSavvy(premiumBonus),
    seasonPassBonus: formatSavvy(seasonPassBonus),
    doublePointBonus: formatSavvy(doublePointBonus),
    estimatedReward: formatSavvy(estimatedReward),
    userLevel: pick(input.userLevel, 'Explorer'),
    savvyBalance: formatSavvy(input.savvyBalance, '0'),
    currentMultiplier: pick(input.currentMultiplier, '1.0X'),
    nextRewardTier: pick(input.nextRewardTier, 'Next tier'),
    progressPercent,
    whyPicked,
    doublePointActive,
    pointsEventLabel,
    preferencesUrl,
    unsubscribeUrl,
    clientUrl,
    heroImageUrl: savvyScoutHeroImageUrl(),
    logoImageUrl: final10LogoImageUrl(),
    preheader: pick(
      input.preheader,
      `Savvy Scout found ${pick(input.productTitle, 'a deal')} — save ${formatMoney(input.savingsAmount, 'big')}!`
    ),
  };
}

function buildDefaultWhyPicked({ trustScore, rankedAbove, savingsPercent, shippingStatus, savingsAmount }) {
  const rows = [];
  if (trustScore != null && trustScore >= 70) {
    rows.push(`Verified seller with a ${Math.round(trustScore)}/100 trust score`);
  } else if (trustScore != null) {
    rows.push(`Trust score ${Math.round(trustScore)}/100 — review seller details before buying`);
  }
  if (rankedAbove != null && rankedAbove >= 50) {
    rows.push(`Ranked above ${Math.round(rankedAbove)}% of similar listings`);
  }
  if (savingsPercent != null && savingsPercent > 0) {
    rows.push(`Strong discount at ${Math.round(savingsPercent)}% below typical ask`);
  } else if (savingsAmount != null && Number(savingsAmount) > 0) {
    rows.push(`Estimated savings of ${formatMoney(savingsAmount)}`);
  }
  rows.push(pick(shippingStatus, 'Fast shipping may be available — check the listing'));
  rows.push('Low competition window — Savvy Scout recommends acting soon');
  return rows.slice(0, 5);
}

function rewardRow(label, value, highlight = false) {
  const bg = highlight ? '#1f2937' : 'transparent';
  const color = highlight ? COLORS.green : COLORS.text;
  return `
    <tr>
      <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.muted};">${escapeHtml(label)}</td>
      <td align="right" style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${color};background:${bg};">+${escapeHtml(value)} Savvy</td>
    </tr>`;
}

function whyPickedHtml(reasons) {
  return reasons
    .map(
      (reason) => `
      <tr>
        <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.text};line-height:1.5;">
          <span style="color:${COLORS.green};font-weight:bold;">✓</span>&nbsp;${escapeHtml(reason)}
        </td>
      </tr>`
    )
    .join('');
}

function earnStepCell(step) {
  return `
    <td align="center" valign="top" width="50%" class="stack" style="padding:6px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:12px;">
        <tr>
          <td align="center" style="padding:14px 8px 6px;font-size:22px;line-height:1;">${step.icon}</td>
        </tr>
        <tr>
          <td align="center" style="padding:0 8px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.muted};line-height:1.35;">${escapeHtml(step.label)}</td>
        </tr>
        <tr>
          <td align="center" style="padding:0 8px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.gold};">+${step.savvy} Savvy</td>
        </tr>
      </table>
    </td>`;
}

function buildSavvyScoutDealFoundHtml(raw = {}) {
  const d = normalizeDealEmailData(raw);
  const showOriginal = d.originalPrice && d.originalPrice !== '—' && d.originalPrice !== d.currentPrice;
  const savingsLine =
    d.savingsAmount !== '—' && d.savingsPercent !== '—'
      ? `You Save ${d.savingsAmount} (${d.savingsPercent} OFF)`
      : d.savingsAmount !== '—'
        ? `You Save ${d.savingsAmount}`
        : 'Strong savings potential';

  const productImgBlock = d.productImage
    ? `<img src="${escapeHtml(d.productImage)}" alt="${escapeHtml(d.productTitle)}" width="240" style="display:block;width:100%;max-width:240px;height:auto;border:0;border-radius:12px;margin:0 auto;" />`
    : `<div style="width:240px;max-width:100%;height:160px;margin:0 auto;background:${COLORS.cardAlt};border:1px dashed ${COLORS.border};border-radius:12px;line-height:160px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:${COLORS.dim};font-size:13px;">Product image</div>`;

  const doublePointBanner = d.doublePointActive
    ? `
    <tr>
      <td style="padding:0 20px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#2e1065 0%,#4c1d95 100%);border:2px solid ${COLORS.purple};border-radius:16px;">
          <tr>
            <td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:12px;font-weight:bold;color:${COLORS.gold};letter-spacing:1px;text-transform:uppercase;">Double Point Weekend</div>
              <div style="font-size:22px;font-weight:bold;color:${COLORS.text};margin-top:4px;">${escapeHtml(d.pointsEventLabel || '2X REWARDS ACTIVE!')}</div>
              <div style="font-size:13px;color:${COLORS.muted};margin-top:6px;">Earn twice the Savvy on qualifying actions this weekend.</div>
            </td>
            <td align="center" width="80" style="padding:12px;font-size:36px;line-height:1;">🪙</td>
          </tr>
        </table>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Savvy Scout found a deal for you</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
  <style>
    @media only screen and (max-width:620px){
      .stack{display:block!important;width:100%!important;max-width:100%!important;}
      .hero-img{width:180px!important;height:auto!important;}
      .pad-sm{padding-left:16px!important;padding-right:16px!important;}
      .earn-step{display:block!important;width:100%!important;padding:6px 0!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(d.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:20px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:20px 24px 8px;background:linear-gradient(180deg,#1a0f2e 0%,${COLORS.card} 100%);" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;font-style:italic;color:${COLORS.text};letter-spacing:-0.5px;">
                      FINAL<span style="color:${COLORS.gold};">10</span> APP
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${COLORS.purpleDeep};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:${COLORS.text};">🎯 Savvy Scout</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td align="center" style="padding:8px 24px 0;" class="pad-sm">
              <img src="${escapeHtml(d.heroImageUrl)}" alt="Savvy Scout mascot" width="220" class="hero-img" style="display:block;width:220px;max-width:100%;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 24px 4px;" class="pad-sm">
              <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:26px;line-height:1.15;font-weight:900;color:${COLORS.text};text-transform:uppercase;text-align:center;">
                Savvy Scout Found Something<br/><span style="color:${COLORS.purple};">For You!</span>
              </div>
              <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${COLORS.muted};text-align:center;">
                Yo ${escapeHtml(d.userName)}, I hunted high and low so you can win big.
              </div>
            </td>
          </tr>

          <!-- Deal Found card -->
          <tr>
            <td style="padding:20px 20px 8px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:16px;">
                <tr>
                  <td style="padding:14px 16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${COLORS.gold};letter-spacing:1px;text-transform:uppercase;">
                    🎯 Deal Found
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 16px 12px;">${productImgBlock}</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:${COLORS.text};line-height:1.35;">
                    ${escapeHtml(d.productTitle)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 12px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:bold;color:${COLORS.purple};">${escapeHtml(d.currentPrice)}</span>
                    ${showOriginal ? `<span style="margin-left:8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${COLORS.dim};text-decoration:line-through;">${escapeHtml(d.originalPrice)}</span>` : ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.green};">
                    ${escapeHtml(savingsLine)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="33%" align="center" style="padding:8px 4px;background:${COLORS.card};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};">
                          <div style="font-size:16px;font-weight:bold;color:${COLORS.text};">${escapeHtml(d.trustScore)}</div>
                          Trust Score
                        </td>
                        <td width="33%" align="center" style="padding:8px 4px;background:${COLORS.card};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};">
                          <div style="font-size:16px;font-weight:bold;color:${COLORS.text};">${escapeHtml(d.rankedAbovePercent)}</div>
                          Ranked Above
                        </td>
                        <td width="33%" align="center" style="padding:8px 4px;background:${COLORS.card};border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};">
                          <div style="font-size:13px;font-weight:bold;color:${COLORS.text};line-height:1.3;">${escapeHtml(d.shippingStatus)}</div>
                          Shipping
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Why I picked this deal -->
          <tr>
            <td style="padding:8px 20px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border:1px solid ${COLORS.border};border-radius:14px;">
                <tr>
                  <td style="padding:14px 16px 6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${COLORS.gold};text-transform:uppercase;letter-spacing:0.5px;">
                    Why I Picked This Deal
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${whyPickedHtml(d.whyPicked)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- View Deal CTA -->
          <tr>
            <td align="center" style="padding:8px 20px 20px;" class="pad-sm">
              <a href="${escapeHtml(d.viewDealUrl)}" target="_blank" style="display:inline-block;width:100%;max-width:520px;padding:16px 24px;background:linear-gradient(180deg,${COLORS.gold} 0%,${COLORS.goldDark} 100%);border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#1a1028;text-decoration:none;text-align:center;box-sizing:border-box;">
                VIEW DEAL &nbsp;›
              </a>
            </td>
          </tr>

          <!-- Savvy Rewards -->
          <tr>
            <td style="padding:0 20px 12px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:16px;">
                <tr>
                  <td style="padding:16px 16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.text};">
                    🪙 Your Savvy Rewards
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${rewardRow('Base Reward', d.baseReward)}
                      ${rewardRow('Premium Bonus', d.premiumBonus)}
                      ${rewardRow('Season Pass Bonus', d.seasonPassBonus)}
                      ${d.doublePointActive ? rewardRow('Double Point Weekend (2X)', d.doublePointBonus, true) : ''}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 16px;border-top:1px solid ${COLORS.border};">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;">Estimated Reward</div>
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:28px;font-weight:900;color:${COLORS.gold};margin-top:4px;">+${escapeHtml(d.estimatedReward)} SAVVY</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${doublePointBanner}

          <!-- Maximize earnings -->
          <tr>
            <td style="padding:12px 20px 8px;" class="pad-sm">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.text};text-transform:uppercase;letter-spacing:0.5px;">
                🚀 Maximize Your Earnings
              </div>
            </td>
          </tr>
    <tr>
      <td style="padding:0 16px 16px;" class="pad-sm">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${EARN_STEPS.slice(0, 2).map((step) => earnStepCell(step)).join('')}
          </tr>
          <tr>
            ${EARN_STEPS.slice(2, 4).map((step) => earnStepCell(step)).join('')}
          </tr>
        </table>
      </td>
    </tr>

          <!-- Bonus reward -->
          <tr>
            <td style="padding:8px 20px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border:1px solid ${COLORS.purple};border-radius:16px;">
                <tr>
                  <td style="padding:16px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:13px;font-weight:bold;color:${COLORS.gold};text-transform:uppercase;">🏆 Bonus Reward</div>
                    <div style="margin-top:8px;font-size:15px;font-weight:bold;color:${COLORS.text};line-height:1.45;">
                      Post using <span style="color:${COLORS.purple};">#Final10Win</span> <span style="color:${COLORS.purple};">#SavvyScout</span> <span style="color:${COLORS.purple};">#SavvyUniverse</span>
                    </div>
                    <div style="margin-top:8px;font-size:14px;color:${COLORS.muted};line-height:1.5;">
                      Upload a screenshot or proof of purchase in the Win Feed. Featured wins can earn even more Savvy!
                    </div>
                    <div style="margin-top:12px;font-size:13px;font-weight:bold;color:${COLORS.green};">BONUS REWARD: +100 SAVVY</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- User progress -->
          <tr>
            <td style="padding:8px 20px 20px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:16px;">
                <tr>
                  <td style="padding:16px 16px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.text};">
                    📈 Your Progress
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.muted};">Level</td>
                        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.gold};">${escapeHtml(d.userLevel)}</td>
                      </tr>
                      <tr>
                        <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.muted};">Savvy Balance</td>
                        <td align="right" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${COLORS.green};">${escapeHtml(d.savvyBalance)}</td>
                      </tr>
                      <tr>
                        <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.muted};">Multiplier</td>
                        <td align="right" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.green};">${escapeHtml(d.currentMultiplier)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 16px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.muted};margin-bottom:6px;">Next: ${escapeHtml(d.nextRewardTier)}</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f0a18;border-radius:999px;height:10px;">
                      <tr>
                        <td width="${d.progressPercent}%" style="background:linear-gradient(90deg,${COLORS.purpleDeep},${COLORS.purple});border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                    <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.dim};text-align:right;">${d.progressPercent}% to next tier</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Scout sign-off -->
          <tr>
            <td style="padding:0 20px 16px;" class="pad-sm">
              <div style="padding:14px 16px;border-left:3px solid ${COLORS.purple};background:${COLORS.cardAlt};border-radius:0 12px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.muted};line-height:1.55;font-style:italic;">
                "I search millions of listings… You focus on winning. I'll focus on finding. <strong style="color:${COLORS.text};font-style:normal;">WE HUNT. YOU WIN.</strong>"
                <div style="margin-top:8px;font-size:12px;color:${COLORS.dim};font-style:normal;">— Savvy Scout</div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 20px 24px;border-top:1px solid ${COLORS.border};background:#06040c;" class="pad-sm">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.dim};line-height:1.6;text-align:center;">
                You're receiving this because Savvy Scout found a deal matching your alerts or hunts.<br/>
                <a href="${escapeHtml(d.preferencesUrl)}" style="color:${COLORS.purple};text-decoration:underline;">Manage preferences</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:${COLORS.purple};text-decoration:underline;">Unsubscribe</a>
                <br/><br/>
                © ${new Date().getFullYear()} Final10 App · Savvy Universe
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSavvyScoutDealFoundText(raw = {}) {
  const d = normalizeDealEmailData(raw);
  const lines = [
    'FINAL10 APP — Savvy Scout',
    '',
    `Savvy Scout Found Something For You!`,
    `Yo ${d.userName}, I hunted high and low so you can win big.`,
    '',
    '— DEAL FOUND —',
    d.productTitle,
    `Price: ${d.currentPrice}${d.originalPrice !== '—' ? ` (was ${d.originalPrice})` : ''}`,
    `Savings: ${d.savingsAmount} (${d.savingsPercent} OFF)`,
    `Trust Score: ${d.trustScore}`,
    `Ranked Above: ${d.rankedAbovePercent} of similar listings`,
    `Shipping: ${d.shippingStatus}`,
    '',
    'Why I picked this deal:',
    ...d.whyPicked.map((r) => `  ✓ ${r}`),
    '',
    `View deal: ${d.viewDealUrl}`,
    '',
    '— YOUR SAVVY REWARDS —',
    `Base Reward: +${d.baseReward} Savvy`,
    `Premium Bonus: +${d.premiumBonus} Savvy`,
    `Season Pass Bonus: +${d.seasonPassBonus} Savvy`,
    ...(d.doublePointActive ? [`Double Point Weekend: +${d.doublePointBonus} Savvy`] : []),
    `Estimated Reward: +${d.estimatedReward} SAVVY`,
    '',
    ...(d.doublePointActive ? ['2X REWARDS ACTIVE — Double Point Weekend!', ''] : []),
    '— MAXIMIZE YOUR EARNINGS —',
    ...EARN_STEPS.map((s) => `  ${s.label}: +${s.savvy} Savvy`),
    '',
    '— BONUS REWARD —',
    'Post using #Final10Win #SavvyScout #SavvyUniverse',
    'Upload screenshot/proof of purchase in the Win Feed.',
    'Bonus: +100 Savvy',
    '',
    '— YOUR PROGRESS —',
    `Level: ${d.userLevel}`,
    `Savvy Balance: ${d.savvyBalance}`,
    `Multiplier: ${d.currentMultiplier}`,
    `Next tier: ${d.nextRewardTier} (${d.progressPercent}%)`,
    '',
    'WE HUNT. YOU WIN. — Savvy Scout',
    '',
    `Manage preferences: ${d.preferencesUrl}`,
    `Unsubscribe: ${d.unsubscribeUrl}`,
  ];
  return lines.join('\n');
}

function buildSavvyScoutDealFoundEmail(raw = {}) {
  const d = normalizeDealEmailData(raw);
  const titleSnippet = d.productTitle.length > 48 ? `${d.productTitle.slice(0, 45)}…` : d.productTitle;
  const subject = pick(raw.subject, `🎯 Savvy Scout found a deal: ${titleSnippet}`);
  return {
    subject,
    html: buildSavvyScoutDealFoundHtml(raw),
    text: buildSavvyScoutDealFoundText(raw),
    preheader: d.preheader,
  };
}

module.exports = {
  buildSavvyScoutDealFoundEmail,
  buildSavvyScoutDealFoundHtml,
  buildSavvyScoutDealFoundText,
  normalizeDealEmailData,
  EARN_STEPS,
};
