/**
 * Savvy Scout — Monthly Report email (HTML + plain text).
 * Visual reference: dark tactical / neon-green Savvy Scout monthly recap.
 */

const {
  escapeHtml,
  pick,
  pickNumber,
  formatMoney,
  formatSavvy,
  getClientBaseUrl,
  savvyScoutHeroImageUrl,
  final10LogoImageUrl,
  savvyScoutLogoImageUrl,
  savvyUniverseLogoImageUrl,
  emailBrandingFooterHtml,
  emailBrandingFooterText,
  monthlyReportHeroImageUrl,
} = require('./emailTemplateUtils');
const { FINAL10_TAGLINE, FINAL10_EMAIL_SOCIALS } = require('../../config/final10Branding');
const { generateMonthlyScoutGoals } = require('../../services/monthlyScoutGoalsService');

const COLORS = {
  bg: '#050806',
  card: '#0c1210',
  cardAlt: '#101a14',
  border: '#1f3d2e',
  green: '#4ade80',
  greenDeep: '#16a34a',
  gold: '#f5b942',
  purple: '#c084fc',
  purpleDeep: '#9333ea',
  text: '#f8fafc',
  muted: '#94a3b8',
  dim: '#64748b',
};

const DEFAULT_STATS = Object.freeze([
  { key: 'savvyEarned', icon: '💰', label: 'Savvy Earned', format: 'savvy' },
  { key: 'bestMovesUsed', icon: '🎯', label: 'Best Moves Used', format: 'number' },
  { key: 'alertsCreated', icon: '🔔', label: 'Alerts Created', format: 'number' },
  { key: 'alertClicks', icon: '👆', label: 'Alert Clicks', format: 'number' },
  { key: 'currentStreak', icon: '🔥', label: 'Current Streak', format: 'days' },
  { key: 'battlePassTier', icon: '🎟️', label: 'Battle Pass Tier', format: 'number' },
  { key: 'eggsCollected', icon: '🥚', label: 'Eggs Collected', format: 'number' },
  { key: 'callingCardsEarned', icon: '🎖️', label: 'Calling Cards Earned', format: 'number' },
  { key: 'estimatedSavings', icon: '💵', label: 'Estimated Savings', format: 'money' },
  { key: 'membershipTier', icon: '⭐', label: 'Membership', format: 'text' },
]);

function formatStatValue(stat, raw) {
  const format = stat.format || 'text';
  if (format === 'savvy') return formatSavvy(raw);
  if (format === 'money') {
    const n = pickNumber(raw);
    return n != null ? `$${Math.round(n).toLocaleString('en-US')}` : '—';
  }
  if (format === 'days') {
    const n = pickNumber(raw);
    return n != null ? `${Math.round(n)} Days` : '—';
  }
  if (format === 'number') {
    const n = pickNumber(raw);
    return n != null ? String(Math.round(n)) : '—';
  }
  return pick(raw, '—');
}

function normalizeAchievements(input) {
  const defaults = [
    { icon: '🔥', title: 'Streak Champion', description: 'Maintained a 30+ Day Streak' },
    { icon: '🥚', title: 'Egg Collector', description: 'Collected multiple Eggs this month' },
    { icon: '🎟️', title: 'Battle Pass Veteran', description: 'Reached Tier 18' },
  ];
  if (!Array.isArray(input) || !input.length) return defaults;
  return input
    .filter(Boolean)
    .slice(0, 6)
    .map((a) => ({
      icon: pick(a.icon, '🏆'),
      title: pick(a.title, 'Achievement'),
      description: pick(a.description, ''),
    }));
}

function normalizeComingSoon(input) {
  const defaults = [
    { icon: '🎰', label: 'Perk Machine Rewards' },
    { icon: '🥚', label: 'New Egg Drops' },
    { icon: '🎟️', label: 'Battle Pass Rewards' },
    { icon: '🔥', label: 'Double Points Weekend' },
  ];
  if (!Array.isArray(input) || !input.length) return defaults;
  return input
    .filter(Boolean)
    .slice(0, 6)
    .map((item) => ({
      icon: pick(item.icon, '✨'),
      label: pick(item.label, 'Coming soon'),
    }));
}

function normalizeMonthlyReportData(input = {}) {
  const clientUrl = getClientBaseUrl();
  const stats = { ...input.stats, ...input };
  const monthLabel = pick(input.monthLabel, 'April 2025');
  const reportYear = pickNumber(input.reportYear) || new Date().getFullYear();
  const streakCurrent = pickNumber(input.currentStreak ?? stats.currentStreak, 34) || 0;
  const streakGoal = pickNumber(input.nextGoalTarget ?? input.streakGoal, 60) || 60;
  const streakProgress = Math.max(0, Math.min(100, Math.round((streakCurrent / Math.max(1, streakGoal)) * 100)));

  const mockUser = {
    firstName: input.userName,
    membershipTier: String(input.membershipTier || 'free').toLowerCase() === 'premium' ? 'premium' : input.membershipTier,
    subscription: { tier: input.subscriptionTier || (input.membershipTier === 'Premium' ? 'core' : 'free') },
    scoutMonthlyGoals: input.scoutMonthlyGoals || { completionBonusClaimedMonths: [] },
    loginStreakDays: streakCurrent,
    monthlyActivity: {
      alertsCreated: pickNumber(input.alertsCreated, stats.alertsCreated),
      bestMovesUsed: pickNumber(input.bestMovesUsed, stats.bestMovesUsed),
      bestMoveActiveDays: pickNumber(input.bestMoveActiveDays, stats.bestMoveActiveDays),
      savvyEarned: pickNumber(input.savvyEarned, stats.savvyEarned),
      battlePassTier: pickNumber(input.battlePassTier, stats.battlePassTier),
      streakDaysClaimed: pickNumber(input.streakDaysClaimedThisMonth, streakCurrent),
      eggsActivated: pickNumber(input.eggsActivated, stats.eggsActivated),
      loginDays: pickNumber(input.loginDaysThisMonth, 20),
      reportOpened: Boolean(input.monthlyReportOpened),
    },
  };

  const activity = {
    alertsCreated: pickNumber(input.alertsCreated, stats.alertsCreated),
    bestMovesUsed: pickNumber(input.bestMovesUsed, stats.bestMovesUsed),
    bestMoveActiveDays: pickNumber(input.bestMoveActiveDays, stats.bestMoveActiveDays, 8),
    savvyEarned: pickNumber(input.savvyEarned, stats.savvyEarned),
    battlePassTier: pickNumber(input.battlePassTier, stats.battlePassTier),
    currentStreak: streakCurrent,
    streakDaysClaimedThisMonth: pickNumber(input.streakDaysClaimedThisMonth, streakCurrent),
    eggsActivated: pickNumber(input.eggsActivated, stats.eggsActivated, 2),
    eggsCollected: pickNumber(input.eggsCollected, stats.eggsCollected),
    loginDaysThisMonth: pickNumber(input.loginDaysThisMonth, 22),
    monthlyReportOpened: input.monthlyReportOpened !== false,
    daysSinceLastActive: pickNumber(input.daysSinceLastActive, 1),
    accountAgeDays: pickNumber(input.accountAgeDays, 120),
    subscriptionTier: input.subscriptionTier || mockUser.subscription.tier,
  };

  const scoutGoals = input.scoutGoals || generateMonthlyScoutGoals(mockUser, activity);
  const estimatedSavingsRaw = pickNumber(input.estimatedSavings ?? stats.estimatedSavings, 327);
  const savvyEarnedRaw = pickNumber(input.savvyEarned ?? stats.savvyEarned, 2485);
  const eggsCollectedRaw = pickNumber(input.eggsCollected ?? stats.eggsCollected, 3);
  const completedGoals = pickNumber(scoutGoals?.completedCount, 0) || 0;
  const totalGoals = pickNumber(scoutGoals?.totalGoals, scoutGoals?.goals?.length || 0) || 0;

  return {
    userName: pick(input.userName, 'Operator'),
    monthLabel,
    reportYear,
    preheader: pick(
      input.preheader,
      `Your ${monthLabel} Savvy Scout report — ${formatSavvy(input.savvyEarned ?? stats.savvyEarned)} Savvy earned`
    ),
    stats: DEFAULT_STATS.map((def) => ({
      ...def,
      value: formatStatValue(def, stats[def.key] ?? input[def.key]),
    })),
    monthlyBonusSavvy: formatSavvy(pickNumber(input.monthlyBonusSavvy, 100)),
    bonusExpiresLabel: pick(input.bonusExpiresLabel, 'Reward available until May 15, 2025'),
    claimRewardUrl: pick(input.claimRewardUrl, `${clientUrl}/profile?tab=rewards`),
    achievements: normalizeAchievements(input.achievements),
    recommendationLead: pick(
      input.recommendationLead,
      'Based on your activity this month:'
    ),
    recommendationBody: pick(
      input.recommendationBody,
      'You used all 10 Premium Best Moves on multiple days. Upgrading to Pro would have unlocked unlimited Best Moves and increased your event earnings.'
    ),
    potentialExtraSavvy: formatSavvy(pickNumber(input.potentialExtraSavvy, 420)),
    upgradeUrl: pick(input.upgradeUrl, `${clientUrl}/premium?tier=pro`),
    scoutGoals,
    goalsClaimUrl: pick(input.goalsClaimUrl, `${clientUrl}/profile?tab=rewards&scoutGoals=1`),
    scoutGoalsMessage: pick(input.scoutGoalsMessage, scoutGoals.scoutGoalsMessage),
    completionBonusPanelTitle: pick(
      input.completionBonusPanelTitle,
      scoutGoals.completionBonusPanelTitle
    ),
    nextGoalTitle: pick(input.nextGoalTitle, 'Reach a 60-Day Streak'),
    streakCurrent,
    streakGoal,
    streakProgress,
    nextGoalRewards: Array.isArray(input.nextGoalRewards)
      ? input.nextGoalRewards.slice(0, 4).map((r) => ({
          icon: pick(r.icon, '🎁'),
          label: pick(r.label, 'Reward'),
        }))
      : [
          { icon: '🥚', label: 'Legendary Egg' },
          { icon: '💰', label: '+500 Savvy' },
          { icon: '🎖️', label: 'Exclusive Calling Card' },
        ],
    comingSoon: normalizeComingSoon(input.comingSoon),
    scoutMessage: pick(
      input.scoutMessage,
      [
        'Not bad, Operator.',
        `You earned ${formatSavvy(input.savvyEarned ?? stats.savvyEarned)} Savvy, saved an estimated ${formatStatValue({ format: 'money' }, input.estimatedSavings ?? stats.estimatedSavings)}, and kept your streak alive for ${streakCurrent} days.`,
        "Let's beat those numbers next month.",
        'Stay focused. See you on the next patrol.',
      ].join(' ')
    ),
    preferencesUrl: pick(input.preferencesUrl, `${clientUrl}/profile?tab=notifications`),
    unsubscribeUrl: pick(input.unsubscribeUrl, `${clientUrl}/profile?tab=notifications`),
    heroImageUrl: monthlyReportHeroImageUrl() || savvyScoutHeroImageUrl(),
    logoImageUrl: final10LogoImageUrl(),
    savvyScoutLogoUrl: savvyScoutLogoImageUrl(),
    savvyUniverseLogoUrl: savvyUniverseLogoImageUrl(),
    endReportEstimatedSavings: formatStatValue({ format: 'money' }, estimatedSavingsRaw),
    endReportSavvyEarned: formatSavvy(savvyEarnedRaw),
    endReportCompletedGoals: completedGoals,
    endReportTotalGoals: totalGoals || scoutGoals?.goals?.length || 0,
    endReportEggsCollected: eggsCollectedRaw ?? 0,
    endReportStreak: streakCurrent,
    socialLinks: FINAL10_EMAIL_SOCIALS,
    final10Tagline: FINAL10_TAGLINE,
    clientUrl,
  };
}

function statCell(stat) {
  return `
    <td class="stat-cell" width="50%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:12px;">
        <tr>
          <td style="padding:12px 10px 4px;font-size:20px;line-height:1;text-align:center;">${stat.icon}</td>
        </tr>
        <tr>
          <td style="padding:0 10px 4px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;color:${COLORS.gold};text-align:center;line-height:1.2;">
            ${escapeHtml(stat.value)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:${COLORS.muted};text-align:center;letter-spacing:0.04em;text-transform:uppercase;">
            ${escapeHtml(stat.label)}
          </td>
        </tr>
      </table>
    </td>`;
}

function statsGridHtml(stats) {
  const rows = [];
  for (let i = 0; i < stats.length; i += 2) {
    const left = stats[i];
    const right = stats[i + 1];
    rows.push(`
      <tr>
        ${statCell(left)}
        ${right ? statCell(right) : '<td width="50%" style="padding:6px;"></td>'}
      </tr>`);
  }
  return rows.join('');
}

function achievementCard(a) {
  return `
    <td class="stack" width="33%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:12px;">
        <tr>
          <td align="center" style="padding:14px 8px 6px;font-size:28px;line-height:1;">${a.icon}</td>
        </tr>
        <tr>
          <td align="center" style="padding:0 10px 4px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;color:${COLORS.green};text-transform:uppercase;">
            ${escapeHtml(a.title)}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};line-height:1.45;">
            ${escapeHtml(a.description)}
          </td>
        </tr>
      </table>
    </td>`;
}

function comingSoonCell(item) {
  return `
    <td class="stack" width="25%" align="center" valign="top" style="padding:6px;">
      <div style="font-size:24px;line-height:1;margin-bottom:6px;">${item.icon}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.03em;line-height:1.35;">
        ${escapeHtml(item.label)}
      </div>
    </td>`;
}

function goalRowHtml(goal) {
  const barColor = goal.completed ? COLORS.green : COLORS.gold;
  const statusLabel = goal.completed ? '✓ Complete' : 'In progress';
  const statusColor = goal.completed ? COLORS.green : COLORS.muted;
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${COLORS.text};line-height:1.35;">
              ${escapeHtml(goal.title)}
            </td>
            <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;color:${statusColor};text-transform:uppercase;white-space:nowrap;">
              ${statusLabel}
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.muted};">
              Progress: <strong style="color:${COLORS.text};">${escapeHtml(goal.progressLabel)}</strong>
              &nbsp;·&nbsp; Reward: <strong style="color:${COLORS.gold};">+${escapeHtml(formatSavvy(goal.rewardSavvy))} Savvy</strong>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050806;border-radius:999px;height:8px;">
                <tr>
                  <td width="${goal.progressPercent}%" style="background:${barColor};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function scoutGoalsSectionHtml(d) {
  const g = d.scoutGoals;
  if (!g || !Array.isArray(g.goals) || !g.goals.length) return '';

  const bonusClaimedNote = g.completionBonusClaimed
    ? `<div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.green};">✓ Monthly Completion Bonus already claimed for ${escapeHtml(d.monthLabel)}.</div>`
    : g.allComplete
      ? `<div style="margin-top:12px;"><a href="${escapeHtml(d.goalsClaimUrl)}" style="display:inline-block;padding:12px 22px;background:${COLORS.green};color:#052e16;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;text-decoration:none;border-radius:10px;text-transform:uppercase;">Claim +${escapeHtml(formatSavvy(g.completionBonusSavvy))} Bonus</a></div>`
      : '';

  return `
          <!-- Savvy Scout Goals -->
          <tr>
            <td style="padding:8px 20px 12px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:14px;">
                <tr>
                  <td style="padding:18px 16px;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;">🎯 Savvy Scout Goals</div>
                    <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.muted};line-height:1.55;font-style:italic;">
                      ${escapeHtml(d.scoutGoalsMessage)}
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                      ${g.goals.map(goalRowHtml).join('')}
                    </table>
                    <div style="margin-top:16px;padding:14px;background:linear-gradient(135deg,#0f1a12 0%,#14532d 100%);border:1px solid ${COLORS.green};border-radius:12px;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${COLORS.text};line-height:1.45;">
                        ${escapeHtml(d.completionBonusPanelTitle)}
                      </div>
                      <div style="margin-top:8px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:24px;font-weight:900;color:${COLORS.gold};">
                        +${escapeHtml(formatSavvy(g.completionBonusSavvy))} Savvy
                        <span style="font-size:12px;color:${COLORS.muted};font-weight:bold;"> (${escapeHtml(g.tierLabel)} tier)</span>
                      </div>
                      <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};">
                        ${g.completedCount} / ${g.totalGoals} goals complete
                      </div>
                      ${bonusClaimedNote}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function endReportStatRow(icon, labelHtml) {
  return `
    <tr>
      <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.text};border-bottom:1px solid rgba(31,61,46,0.65);">
        <span style="font-size:18px;line-height:1;vertical-align:middle;margin-right:8px;">${icon}</span>
        ${labelHtml}
      </td>
    </tr>`;
}

function endOfReportSectionHtml(d) {
  const socialCells = (d.socialLinks || FINAL10_EMAIL_SOCIALS)
    .map(
      (s) => `
      <td align="center" valign="middle" style="padding:6px 4px;">
        <a href="${escapeHtml(s.url)}" title="${escapeHtml(s.label)}" style="display:inline-block;padding:10px 12px;background:linear-gradient(180deg,#141c18 0%,#0a100d 100%);border:1px solid ${COLORS.border};border-radius:999px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;color:${COLORS.text};text-decoration:none;letter-spacing:0.04em;box-shadow:0 0 12px rgba(74,222,128,0.12);">
          <span style="font-size:14px;margin-right:4px;">${s.icon}</span>${escapeHtml(s.label)}
        </a>
      </td>`
    )
    .join('');

  return `
          <!-- End of Report -->
          <tr>
            <td style="padding:4px 20px 0;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0;height:2px;background:linear-gradient(90deg, transparent 0%, ${COLORS.purpleDeep} 20%, ${COLORS.green} 50%, ${COLORS.gold} 80%, transparent 100%);font-size:0;line-height:0;box-shadow:0 0 18px rgba(192,132,252,0.35);">&nbsp;</td>
                </tr>
                <tr>
                  <td align="center" style="padding:14px 0 6px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;color:${COLORS.purple};letter-spacing:0.28em;text-transform:uppercase;">
                    🏁 End of Report
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 20px 20px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,#120a1f 0%,#0c1210 35%,#050806 100%);border:1px solid ${COLORS.border};border-radius:18px;overflow:hidden;box-shadow:0 0 32px rgba(147,51,234,0.18), inset 0 1px 0 rgba(245,185,66,0.08);">
                <tr>
                  <td style="padding:22px 18px 8px;text-align:center;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:18px;font-weight:900;color:${COLORS.gold};letter-spacing:0.06em;text-transform:uppercase;text-shadow:0 0 20px rgba(245,185,66,0.35);">
                      🏆 THIS MONTH YOU...
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 12px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(5,8,6,0.55);border:1px solid rgba(31,61,46,0.8);border-radius:14px;">
                      ${endReportStatRow('💰', `Saved <strong style="color:${COLORS.gold};">${escapeHtml(d.endReportEstimatedSavings)}</strong>`)}
                      ${endReportStatRow('🪙', `Earned <strong style="color:${COLORS.gold};">${escapeHtml(d.endReportSavvyEarned)} Savvy</strong>`)}
                      ${endReportStatRow('🎯', `Completed <strong style="color:${COLORS.green};">${d.endReportCompletedGoals}/${d.endReportTotalGoals}</strong> Scout Goals`)}
                      ${endReportStatRow('🥚', `Collected <strong style="color:${COLORS.gold};">${d.endReportEggsCollected}</strong> Eggs`)}
                      ${endReportStatRow('🔥', `Finished with a <strong style="color:${COLORS.green};">${d.endReportStreak}-Day Streak</strong>`)}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:20px 16px 10px;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:26px;line-height:1.15;font-weight:900;color:${COLORS.gold};letter-spacing:0.04em;text-transform:uppercase;text-shadow:0 0 24px rgba(245,185,66,0.28);">
                      STAY SAVVY.
                    </div>
                    <div style="margin-top:6px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:26px;line-height:1.15;font-weight:900;color:${COLORS.purple};letter-spacing:0.04em;text-transform:uppercase;text-shadow:0 0 24px rgba(192,132,252,0.35);">
                      STAY SMART.
                    </div>
                    <div style="margin-top:6px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:20px;line-height:1.2;font-weight:900;color:${COLORS.text};letter-spacing:0.03em;text-transform:uppercase;">
                      THE BEST DEALS FROM THE START.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:6px 16px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${COLORS.muted};letter-spacing:0.08em;text-transform:uppercase;">
                    Powered by <span style="color:${COLORS.gold};">Final10</span> × <span style="color:${COLORS.purple};">Savvy Universe</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 16px 16px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;color:${COLORS.green};letter-spacing:0.14em;text-transform:uppercase;text-shadow:0 0 16px rgba(74,222,128,0.25);">
                    ${escapeHtml(d.final10Tagline)}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 12px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td align="center" valign="middle" style="padding:8px 10px;">
                          <img src="${escapeHtml(d.logoImageUrl)}" alt="Final10" width="88" style="display:block;width:88px;max-width:88px;height:auto;border:0;" />
                        </td>
                        <td align="center" valign="middle" style="padding:8px 10px;">
                          <img src="${escapeHtml(d.savvyScoutLogoUrl)}" alt="Savvy Scout" width="72" style="display:block;width:72px;max-width:72px;height:auto;border:0;border-radius:12px;" />
                        </td>
                        <td align="center" valign="middle" style="padding:8px 10px;">
                          <img src="${escapeHtml(d.savvyUniverseLogoUrl)}" alt="Savvy Universe" width="88" style="display:block;width:88px;max-width:88px;height:auto;border:0;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 8px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>${socialCells}</tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;height:2px;background:linear-gradient(90deg, transparent 0%, ${COLORS.gold} 30%, ${COLORS.purple} 70%, transparent 100%);font-size:0;line-height:0;opacity:0.75;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function buildSavvyScoutMonthlyReportHtml(raw = {}) {
  const d = normalizeMonthlyReportData(raw);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Savvy Scout Monthly Report — ${escapeHtml(d.monthLabel)}</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
  <style>
    @media only screen and (max-width:620px){
      .stack{display:block!important;width:100%!important;max-width:100%!important;}
      .stat-cell{display:block!important;width:100%!important;}
      .pad-sm{padding-left:14px!important;padding-right:14px!important;}
      .hero-img{width:100%!important;max-width:600px!important;height:auto!important;border-radius:14px 14px 0 0!important;}
      .hero-wrap{width:100%!important;max-width:600px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(d.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:18px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:18px 20px 8px;background:linear-gradient(180deg,#0f1a12 0%,${COLORS.card} 100%);" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <img src="${escapeHtml(d.logoImageUrl)}" alt="Savvy Scout" width="120" style="display:block;width:120px;max-width:100%;height:auto;border:0;" />
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#14532d;border:1px solid ${COLORS.green};font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:10px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;">🛩️ MONTHLY REPORT</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title + ribbon -->
          <tr>
            <td align="center" style="padding:8px 20px 0;" class="pad-sm">
              <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:28px;line-height:1.1;font-weight:900;color:${COLORS.text};text-transform:uppercase;text-align:center;">
                SAVVY SCOUT <span style="color:${COLORS.green};">REPORT</span>
              </div>
              <div style="display:inline-block;margin-top:12px;padding:8px 18px;background:linear-gradient(90deg,#14532d,#166534);border:1px solid ${COLORS.green};border-radius:6px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;color:${COLORS.green};letter-spacing:0.12em;text-transform:uppercase;">
                ★ ${escapeHtml(d.monthLabel)} MONTHLY REPORT ★
              </div>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td align="center" style="padding:16px 20px 0;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="hero-wrap" style="max-width:600px;border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;background:${COLORS.card};">
                <tr>
                  <td style="padding:0;margin:0;line-height:0;font-size:0;">
                    <img src="${escapeHtml(d.heroImageUrl)}" alt="Savvy Scout — mission complete. Your monthly intelligence report is ready." width="600" class="hero-img" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px 14px 0 0;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;margin:0;height:32px;background:linear-gradient(180deg, rgba(12,18,16,0) 0%, ${COLORS.card} 55%, ${COLORS.card} 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:8px 24px 16px;" class="pad-sm">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${COLORS.text};">
                Hello <strong>${escapeHtml(d.userName)}</strong>,
              </div>
              <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${COLORS.muted};">
                Savvy Scout has finished reviewing your month.<br/>
                Here's how you performed across the Savvy Universe.
              </div>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding:0 14px 8px;" class="pad-sm">
              <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:13px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;padding-left:6px;">
                📊 Your Monthly Stats
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${statsGridHtml(d.stats)}
              </table>
            </td>
          </tr>

          <!-- Monthly bonus -->
          <tr>
            <td style="padding:12px 20px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#0f1a12 0%,#14532d 100%);border:2px solid ${COLORS.green};border-radius:16px;">
                <tr>
                  <td style="padding:20px 18px;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;">🎁 Monthly Scout Bonus</div>
                    <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.muted};line-height:1.5;">
                      Thanks for being part of the Savvy Universe.
                    </div>
                    <div style="margin-top:14px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:32px;font-weight:900;color:${COLORS.gold};line-height:1;">
                      +${escapeHtml(d.monthlyBonusSavvy)} <span style="font-size:16px;color:${COLORS.text};">SAVVY</span>
                    </div>
                    <div style="margin-top:16px;">
                      <a href="${escapeHtml(d.claimRewardUrl)}" style="display:inline-block;padding:14px 28px;background:${COLORS.green};color:#052e16;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:13px;font-weight:900;text-decoration:none;border-radius:10px;letter-spacing:0.06em;text-transform:uppercase;">CLAIM REWARD</a>
                    </div>
                    <div style="margin-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.dim};">
                      🔒 ${escapeHtml(d.bonusExpiresLabel)}
                    </div>
                  </td>
                  <td align="center" width="90" valign="middle" style="padding:12px;font-size:48px;line-height:1;">🪙</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Achievements -->
          <tr>
            <td style="padding:8px 14px;" class="pad-sm">
              <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:13px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;padding-left:6px;">
                🏆 Monthly Achievements
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${d.achievements.map(achievementCard).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Recommendations -->
          <tr>
            <td style="padding:12px 20px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:14px;">
                <tr>
                  <td style="padding:18px 16px;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;">🛩️ Scout Recommendations</div>
                    <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.muted};line-height:1.55;">
                      <strong style="color:${COLORS.text};">${escapeHtml(d.recommendationLead)}</strong><br/><br/>
                      ${escapeHtml(d.recommendationBody)}
                    </div>
                    <div style="margin-top:14px;padding:12px;background:#0a140f;border-radius:10px;border:1px dashed ${COLORS.border};">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.05em;">Potential Extra Savvy Earned</div>
                      <div style="margin-top:4px;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;color:${COLORS.gold};">+${escapeHtml(d.potentialExtraSavvy)} 🪙</div>
                    </div>
                    <div style="margin-top:14px;">
                      <a href="${escapeHtml(d.upgradeUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${COLORS.green};text-decoration:underline;">Upgrade to Pro →</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${scoutGoalsSectionHtml(d)}

          <!-- Next goal -->
          <tr>
            <td style="padding:8px 20px 12px;" class="pad-sm">
              <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">🎯 Next Goal</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:14px;">
                <tr>
                  <td style="padding:16px;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;color:${COLORS.text};text-transform:uppercase;">
                      ${escapeHtml(d.nextGoalTitle)}
                    </div>
                    <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.muted};">
                      Progress: <strong style="color:${COLORS.text};">${d.streakCurrent} / ${d.streakGoal} Days</strong>
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;background:#050806;border-radius:999px;height:12px;">
                      <tr>
                        <td width="${d.streakProgress}%" style="background:linear-gradient(90deg,${COLORS.greenDeep},${COLORS.green});border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                    <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.05em;">Reward Preview</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
                      <tr>
                        ${d.nextGoalRewards
                          .map((r, idx) => {
                            const arrow =
                              idx > 0
                                ? `<td align="center" style="color:${COLORS.dim};font-size:16px;padding:0 2px;">→</td>`
                                : '';
                            return `${arrow}<td align="center" valign="top" style="padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.text};">
                            <div style="font-size:22px;line-height:1;">${r.icon}</div>
                            <div style="margin-top:4px;color:${COLORS.muted};">${escapeHtml(r.label)}</div>
                          </td>`;
                          })
                          .join('')}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Coming soon -->
          <tr>
            <td style="padding:8px 14px 12px;" class="pad-sm">
              <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;color:${COLORS.green};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;padding-left:6px;">🚀 What's Coming Next</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border:1px solid ${COLORS.border};border-radius:14px;">
                <tr>
                  ${d.comingSoon.map(comingSoonCell).join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Scout message -->
          <tr>
            <td style="padding:8px 20px 16px;" class="pad-sm">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cardAlt};border-left:4px solid ${COLORS.green};border-radius:0 14px 14px 0;">
                <tr>
                  <td width="64" valign="top" style="padding:16px 8px 16px 16px;">
                    <img src="${escapeHtml(d.heroImageUrl)}" alt="" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:50%;border:2px solid ${COLORS.green};object-fit:cover;" />
                  </td>
                  <td style="padding:16px 16px 16px 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.muted};line-height:1.6;">
                    <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;color:${COLORS.green};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">🛩️ Message From Savvy Scout</div>
                    ${escapeHtml(d.scoutMessage)}
                    <div style="margin-top:10px;font-size:12px;color:${COLORS.dim};">— Savvy Scout</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${endOfReportSectionHtml(d)}

          <!-- Footer -->
          <tr>
            <td style="padding:8px 20px 24px;border-top:1px solid ${COLORS.border};background:#030504;" class="pad-sm">
              ${emailBrandingFooterHtml({ prominent: true, marginTop: 0 })}
              <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.dim};line-height:1.6;text-align:center;">
                Thank you for being part of the Savvy Universe!<br/>
                <a href="${escapeHtml(d.preferencesUrl)}" style="color:${COLORS.green};text-decoration:underline;">Manage preferences</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(d.unsubscribeUrl)}" style="color:${COLORS.green};text-decoration:underline;">Unsubscribe</a>
                <br/><br/>
                © ${d.reportYear} Final10 · Savvy Universe
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

function buildSavvyScoutMonthlyReportText(raw = {}) {
  const d = normalizeMonthlyReportData(raw);
  const lines = [
    'SAVVY SCOUT MONTHLY REPORT',
    `★ ${d.monthLabel} MONTHLY REPORT ★`,
    '',
    `Hello ${d.userName},`,
    '',
    "Savvy Scout has finished reviewing your month.",
    "Here's how you performed across the Savvy Universe.",
    '',
    '— YOUR MONTHLY STATS —',
    ...d.stats.map((s) => `${s.icon} ${s.label}: ${s.value}`),
    '',
    '— MONTHLY SCOUT BONUS —',
    'Thanks for being part of the Savvy Universe.',
    `Reward: +${d.monthlyBonusSavvy} Savvy`,
    `Claim: ${d.claimRewardUrl}`,
    d.bonusExpiresLabel,
    '',
    '— MONTHLY ACHIEVEMENTS —',
    ...d.achievements.map((a) => `${a.icon} ${a.title}\n  ${a.description}`),
    '',
    '— SCOUT RECOMMENDATIONS —',
    d.recommendationLead,
    d.recommendationBody,
    `Potential Extra Savvy Earned: +${d.potentialExtraSavvy}`,
    `Upgrade: ${d.upgradeUrl}`,
    '',
    '— SAVVY SCOUT GOALS —',
    d.scoutGoalsMessage,
    ...(d.scoutGoals?.goals || []).map(
      (g) =>
        `${g.completed ? '✓' : '○'} ${g.title}\n  Progress: ${g.progressLabel}\n  Reward: +${formatSavvy(g.rewardSavvy)} Savvy`
    ),
    '',
    d.completionBonusPanelTitle,
    `Monthly Completion Bonus: +${formatSavvy(d.scoutGoals?.completionBonusSavvy)} Savvy (${d.scoutGoals?.tierLabel || 'Free'} tier)`,
    `${d.scoutGoals?.completedCount || 0} / ${d.scoutGoals?.totalGoals || 0} goals complete`,
    d.scoutGoals?.completionBonusClaimed ? '(Bonus already claimed this month)' : '',
    `Claim: ${d.goalsClaimUrl}`,
    '',
    '— NEXT GOAL —',
    d.nextGoalTitle,
    `Progress: ${d.streakCurrent} / ${d.streakGoal} Days`,
    'Reward Preview:',
    ...d.nextGoalRewards.map((r) => `  ${r.icon} ${r.label}`),
    '',
    "— WHAT'S COMING NEXT —",
    ...d.comingSoon.map((c) => `  ${c.icon} ${c.label}`),
    '',
    '— MESSAGE FROM SAVVY SCOUT —',
    d.scoutMessage,
    '— Savvy Scout',
    '',
    '🏁 END OF REPORT',
    '🏆 THIS MONTH YOU...',
    `💰 Saved ${d.endReportEstimatedSavings}`,
    `🪙 Earned ${d.endReportSavvyEarned} Savvy`,
    `🎯 Completed ${d.endReportCompletedGoals}/${d.endReportTotalGoals} Scout Goals`,
    `🥚 Collected ${d.endReportEggsCollected} Eggs`,
    `🔥 Finished with a ${d.endReportStreak}-Day Streak`,
    '',
    'STAY SAVVY.',
    'STAY SMART.',
    'THE BEST DEALS FROM THE START.',
    '',
    'Powered by Final10 × Savvy Universe',
    d.final10Tagline,
    '',
    ...(d.socialLinks || FINAL10_EMAIL_SOCIALS).map((s) => `${s.label}: ${s.url}`),
    '',
    emailBrandingFooterText(),
    '',
    `Manage preferences: ${d.preferencesUrl}`,
    `Unsubscribe: ${d.unsubscribeUrl}`,
  ];
  return lines.join('\n');
}

function buildSavvyScoutMonthlyReportEmail(raw = {}) {
  const d = normalizeMonthlyReportData(raw);
  const subject = pick(raw.subject, `🛩️ Savvy Scout Monthly Report — ${d.monthLabel}`);
  return {
    subject,
    html: buildSavvyScoutMonthlyReportHtml(raw),
    text: buildSavvyScoutMonthlyReportText(raw),
    preheader: d.preheader,
  };
}

/** Sample payload with dynamic Scout Goals (Premium-tier realistic stats). */
function sampleMonthlyReportData(overrides = {}) {
  const { buildEarlyMonthlyReportTestPayload } = require('../../services/monthlyReportService');
  return buildEarlyMonthlyReportTestPayload(overrides);
}

module.exports = {
  buildSavvyScoutMonthlyReportEmail,
  buildSavvyScoutMonthlyReportHtml,
  buildSavvyScoutMonthlyReportText,
  normalizeMonthlyReportData,
  sampleMonthlyReportData,
  DEFAULT_STATS,
};
