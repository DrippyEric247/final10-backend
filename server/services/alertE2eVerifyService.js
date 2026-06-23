/**
 * End-to-end alert verification using the REAL production path:
 * eBay Browse ingest → marketScanner.checkAlerts → deliverAlertMatch → Resend email.
 */
const Alert = require('../models/Alert');
const User = require('../models/User');
const { normalizeAlertKeywords } = require('../lib/alertKeywords');
const { searchEbayBrowseAndSave } = require('./ebayBrowseIngestService');
const marketScanner = require('./marketScanner');
const { getRecentAuditEvents } = require('./auditLogger');
const { isAlertEmailDefaultEnabled } = require('./alertDeliveryService');

const E2E_ALERT_NAME = 'E2E Verify — PS5';
const E2E_ALERT_KIND = 'e2e_ps5_verify';
const E2E_SEARCH_QUERY = 'PS5 Slim Disc';

async function runRealAlertE2eVerify(user, opts = {}) {
  const userId = user._id || user.id;
  const startedAt = Date.now();
  const steps = [];
  const push = (step, meta = {}) => {
    steps.push({ step, at: new Date().toISOString(), ...meta });
    console.log('[alert-e2e]', step, JSON.stringify(meta));
  };

  const startedIso = new Date(startedAt - 500).toISOString();

  await User.findByIdAndUpdate(userId, { alertEmailOnMatch: true });
  push('user_email_opt_in', { alertEmailOnMatch: true, alertEmailDefault: isAlertEmailDefaultEnabled() });

  let alert = await Alert.findOne({ user: userId, kind: E2E_ALERT_KIND });
  if (!alert) {
    alert = await Alert.create({
      user: userId,
      name: E2E_ALERT_NAME,
      keywords: normalizeAlertKeywords(['ps5']),
      minConfidence: 10,
      maxPrice: opts.maxPrice,
      sources: ['ebay'],
      persona: 'buyer',
      kind: E2E_ALERT_KIND,
      status: 'active',
      isActive: true,
      context: { e2eVerify: true, product: 'PS5' },
    });
    push('alert_created', { alertId: String(alert._id), keywords: alert.keywords });
  } else {
    alert.name = E2E_ALERT_NAME;
    alert.keywords = normalizeAlertKeywords(['ps5']);
    alert.minConfidence = 10;
    alert.isActive = true;
    alert.matches = [];
    alert.triggerCount = 0;
    alert.lastTriggeredAt = null;
    await alert.save();
    push('alert_reset', { alertId: String(alert._id), keywords: alert.keywords });
  }

  const savedAuctions = await searchEbayBrowseAndSave(
    opts.searchQuery || E2E_SEARCH_QUERY,
    Number(opts.limit) || 10
  );
  push('browse_ingest', { query: opts.searchQuery || E2E_SEARCH_QUERY, saved: savedAuctions.length });

  if (!savedAuctions.length) {
    return {
      ok: false,
      message: 'No eBay listings ingested for PS5 search',
      steps,
      matchFound: false,
      emailSent: false,
      auditEvents: getRecentAuditEvents(10),
    };
  }

  let newMatches = 0;
  const matchedListings = [];
  for (const auction of savedAuctions) {
    const mismatch = alert.explainAuctionMismatch(auction);
    if (mismatch) {
      push('listing_rejected', {
        auctionId: String(auction._id),
        title: String(auction.title || '').slice(0, 80),
        reason: mismatch,
        dealPotential: auction.aiScore?.dealPotential ?? null,
      });
    }
    const result = await marketScanner.checkAlerts(auction, {
      source: 'e2e_verify',
      query: E2E_SEARCH_QUERY,
    });
    if (result?.newMatches > 0) {
      newMatches += result.newMatches;
      matchedListings.push({
        auctionId: String(auction._id),
        title: String(auction.title || '').slice(0, 120),
        dealPotential: auction.aiScore?.dealPotential ?? null,
      });
      break;
    }
  }

  push('check_alerts_done', { newMatches, matchedListings });

  const refreshedAlert = await Alert.findById(alert._id)
    .populate({ path: 'matches.auction', select: 'title currentBid source url images aiScore' })
    .lean();
  const refreshedUser = await User.findById(userId)
    .select('email alertEmailOnMatch notifications')
    .lean();

  const inAppMatches = (refreshedUser?.notifications || []).filter((n) => n.kind === 'alert_match');
  const emailAudit = getRecentAuditEvents(20, 'AUDIT_EMAIL_DELIVERY');
  const deliveryAudit = getRecentAuditEvents(20, 'AUDIT_ALERT_DELIVERY');
  const newEmailEvents = emailAudit.filter((e) => e.at >= startedIso);
  const newDeliveryEvents = deliveryAudit.filter((e) => e.at >= startedIso);

  const emailSuccess = newDeliveryEvents.some(
    (e) => e.meta?.channel === 'email' && e.meta?.phase === 'success' && e.meta?.sent
  );
  const emailAttempt = newDeliveryEvents.some((e) => e.meta?.channel === 'email' && e.meta?.phase === 'attempt');
  const emailFailure = newDeliveryEvents.find(
    (e) => e.meta?.channel === 'email' && (e.meta?.phase === 'failure' || e.meta?.sent === false)
  );

  const elapsedMs = Date.now() - startedAt;

  return {
    ok: newMatches > 0 && emailSuccess,
    matchFound: newMatches > 0,
    newMatches,
    matchedListings,
    emailAttempted: emailAttempt,
    emailSent: emailSuccess,
    emailFailure: emailFailure?.meta || null,
    inAppNotificationCount: inAppMatches.length,
    alert: {
      id: String(refreshedAlert._id),
      name: refreshedAlert.name,
      keywords: refreshedAlert.keywords,
      triggerCount: refreshedAlert.triggerCount,
      matchCount: (refreshedAlert.matches || []).length,
      matches: (refreshedAlert.matches || []).slice(0, 3).map((m) => ({
        matchedAt: m.matchedAt,
        title: m.auction?.title,
        auctionId: m.auction?._id ? String(m.auction._id) : String(m.auction),
      })),
    },
    user: {
      email: refreshedUser?.email ? `${String(refreshedUser.email).slice(0, 3)}***` : null,
      alertEmailOnMatch: refreshedUser?.alertEmailOnMatch,
    },
    steps,
    audit: {
      newEmailDeliveryEvents: newEmailEvents,
      newAlertDeliveryEvents: newDeliveryEvents,
      recentEmailDelivery: emailAudit,
      recentAlertDelivery: deliveryAudit,
    },
    elapsedMs,
    message:
      newMatches > 0 && emailSuccess
        ? 'E2E verified: match found and email sent via production delivery path.'
        : newMatches > 0
          ? `Match found but email not sent${emailFailure?.meta?.reason ? `: ${emailFailure.meta.reason}` : ''}.`
          : 'No qualifying match — check keyword/confidence filters in steps.',
  };
}

module.exports = { runRealAlertE2eVerify, E2E_ALERT_NAME, E2E_SEARCH_QUERY };
