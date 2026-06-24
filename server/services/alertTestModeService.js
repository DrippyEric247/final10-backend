/**
 * Beta alert pipeline verification — PS5 search → score → Savvy Scout email.
 * Temporary; gate with ALERT_TEST_MODE_ENABLED=true.
 */

const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const User = require('../models/User');
const { ebayBrowseGet } = require('./ebayBrowseClient');
const { normalizeEbayItemSummary } = require('./ebayListingNormalizer');
const { enrichItemsWithMarketValue } = require('./marketValueService');
const { sendSavvyScoutDealFoundEmail } = require('./emailService');
const { getTierConfigForUser } = require('./betaTesterService');
const { normalizeTier } = require('../config/subscriptionPlans');
const { applyTierEventMultiplier } = require('../lib/pointsEventMultipliers');
const {
  PS5_SEARCH_TERMS,
  TEST_ALERT_NAME,
  TEST_ALERT_KEYWORDS,
  MAX_MATCHING_LISTINGS,
  SEARCH_LIMIT_PER_TERM,
  EMAIL_COOLDOWN_MS,
  readPointsEventMultiplier,
  isDoubleOrTriplePointsActive,
} = require('../lib/alertTestModeConfig');
const {
  computeTrustScore,
  computeRankedAbovePercent,
  passesBetaTrigger,
  computeDealScore,
  isPs5DiscListing,
  buildWhyPickedReasons,
} = require('./alertTestDealScoring');
const {
  auditAlertTest,
  auditAlertCreated,
  auditAlertDelivery,
} = require('./auditLogger');
const { createEmailPipelineTrace } = require('../lib/emailPipelineTrace');
const { getEmailConfigStatus, auditEmailFrom } = require('./emailService');

/** @type {Map<string, number>} userId → last email sent ms */
const emailCooldown = new Map();

function logTest(phase, meta = {}) {
  console.log('[alertTest]', phase, JSON.stringify(meta));
  auditAlertTest({ phase, ...meta });
}

async function searchPs5Listings() {
  const byId = new Map();

  for (const query of PS5_SEARCH_TERMS) {
    try {
      const data = await ebayBrowseGet('item_summary/search', {
        q: query,
        limit: String(SEARCH_LIMIT_PER_TERM),
        sort: 'bestMatch',
        filter: 'buyingOptions:{FIXED_PRICE|AUCTION}',
      });
      const rows = (data?.itemSummaries || []).map(normalizeEbayItemSummary);
      for (const row of rows) {
        if (!row.itemId || !isPs5DiscListing(row.title)) continue;
        if (!byId.has(row.itemId)) byId.set(row.itemId, row);
      }
      logTest('listings_found', { query, rawCount: rows.length, uniqueTotal: byId.size });
    } catch (err) {
      logTest('search_error', {
        query,
        message: String(err?.message || err).slice(0, 160),
        code: err?.code,
      });
    }
  }

  return Array.from(byId.values());
}

function scoreListings(items) {
  const pool = items.slice();
  return pool
    .map((item) => {
      const trustScore = computeTrustScore(item);
      const rankedAbovePercent = computeRankedAbovePercent(item, pool);
      const savingsPct = Number(item.savingsPct) || 0;
      const betaPass = passesBetaTrigger({ savingsPct, trustScore, rankedAbovePercent });
      const scored = {
        ...item,
        trustScore,
        rankedAbovePercent,
        passesBetaTrigger: betaPass,
      };
      scored.dealScore = computeDealScore(scored);
      scored.whyPickedReasons = buildWhyPickedReasons(scored);
      return scored;
    })
    .sort((a, b) => b.dealScore - a.dealScore);
}

async function ensureTestAlert(userId) {
  let alert = await Alert.findOne({
    user: userId,
    name: TEST_ALERT_NAME,
    isActive: true,
  });

  if (alert) {
    logTest('alert_exists', { userId: String(userId), alertId: String(alert._id) });
    return alert;
  }

  alert = await Alert.create({
    user: userId,
    name: TEST_ALERT_NAME,
    keywords: [...TEST_ALERT_KEYWORDS],
    minConfidence: 10,
    sources: ['ebay'],
    persona: 'buyer',
    kind: 'alert_test_beta',
    status: 'active',
    isActive: true,
    context: { betaTest: true, product: 'PS5 Slim Disc Edition' },
  });

  auditAlertCreated({
    userId: String(userId),
    alertId: String(alert._id),
    keywordCount: alert.keywords.length,
    tier: 'beta_test',
    source: 'alert_test_mode',
  });
  logTest('alert_created', { userId: String(userId), alertId: String(alert._id) });
  return alert;
}

async function upsertTestAuction(listing) {
  const externalId = String(listing.itemId);
  const end = listing.itemEndDate ? new Date(listing.itemEndDate) : new Date(Date.now() + 86400000);
  const price = Number(listing.price ?? listing.currentBidPrice ?? listing.buyNowPrice) || 0;

  const doc = await Auction.findOneAndUpdate(
    { 'source.platform': 'ebay', 'source.externalId': externalId },
    {
      $set: {
        title: listing.title,
        description: listing.recommendationReason || listing.title,
        images: listing.imageUrl
          ? [{ url: listing.imageUrl, alt: listing.title, isPrimary: true }]
          : [],
        category: 'electronics',
        condition: 'good',
        startingPrice: price,
        currentBid: Number(listing.currentBidPrice) || price,
        buyItNowPrice: Number(listing.buyNowPrice) || price,
        endTime: end,
        startTime: new Date(),
        timeRemaining: Number(listing.secondsRemaining) || 0,
        status: 'active',
        seller: listing.sellerUsername || listing.seller || 'eBay',
        source: {
          platform: 'ebay',
          externalId,
          url: listing.itemWebUrl || listing.url || '',
        },
        aiScore: {
          dealPotential: Math.min(100, Math.round(Number(listing.dealScore) || 50)),
          competitionLevel: listing.bidCount > 8 ? 'high' : listing.bidCount > 3 ? 'medium' : 'low',
          trendingScore: Math.min(100, Math.round(Number(listing.rankedAbovePercent) || 60)),
        },
        lastUpdated: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

function computeSavvyRewards(user, listing, pointsMultiplier) {
  const tierCfg = getTierConfigForUser(user);
  const mult = Number(tierCfg.multiplier) || 1;
  const baseReward = Math.max(10, Math.round((Number(listing.savingsPct) || 12) * 1.2));
  const premiumBonus = user.isPremium || normalizeTier(user.membershipTier) !== 'free'
    ? Math.round(baseReward * 0.35)
    : 0;
  const seasonPassBonus = Math.round(baseReward * 0.2);
  const rawEventMult = Math.max(1, pointsMultiplier);
  const userTier = normalizeTier(user?.subscription?.tier || user?.membershipTier);
  const eventMult =
    rawEventMult >= 2 ? applyTierEventMultiplier(rawEventMult, userTier) : 1;
  const doublePointBonus =
    eventMult >= 2 ? Math.round((baseReward + premiumBonus) * (eventMult - 1)) : 0;
  const estimatedReward = baseReward + premiumBonus + seasonPassBonus + doublePointBonus;

  return {
    baseReward,
    premiumBonus,
    seasonPassBonus,
    doublePointBonus,
    estimatedReward,
    doublePointActive: eventMult >= 2,
    triplePointActive: eventMult >= 3,
    pointsEventLabel:
      eventMult >= 3 ? '3X REWARDS ACTIVE!' : eventMult >= 2 ? '2X REWARDS ACTIVE!' : null,
    currentMultiplier: `${(mult * eventMult).toFixed(2).replace(/\.?0+$/, '')}X`,
  };
}

function canSendEmail(userId, force = false) {
  if (force) return { allowed: true };
  const last = emailCooldown.get(String(userId)) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < EMAIL_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((EMAIL_COOLDOWN_MS - elapsed) / 1000),
      lastSentAt: new Date(last).toISOString(),
    };
  }
  return { allowed: true };
}

function markEmailSent(userId) {
  emailCooldown.set(String(userId), Date.now());
}

function slimListing(row) {
  return {
    itemId: row.itemId,
    title: row.title,
    price: row.price ?? row.currentBidPrice ?? row.buyNowPrice,
    savingsPct: row.savingsPct,
    savings: row.savings,
    trustScore: row.trustScore,
    rankedAbovePercent: row.rankedAbovePercent,
    dealScore: row.dealScore,
    passesBetaTrigger: row.passesBetaTrigger,
    url: row.itemWebUrl || row.url,
    imageUrl: row.imageUrl || row.image,
  };
}

/**
 * Run full beta alert test pipeline for authenticated user.
 * @param {object} user — Mongoose user doc or lean user with _id email
 * @param {{ forceEmail?: boolean, skipEmail?: boolean }} [opts]
 */
async function runAlertTestPipeline(user, opts = {}) {
  const userId = user._id || user.id;
  const startedAt = Date.now();

  logTest('pipeline_start', { userId: String(userId) });

  const rawListings = await searchPs5Listings();
  if (!rawListings.length) {
    logTest('pipeline_empty', { userId: String(userId) });
    return {
      ok: false,
      alertStatus: 'no_listings',
      emailStatus: 'skipped',
      listingsFound: 0,
      matchingListings: [],
      message: 'No PS5 disc listings found across beta search terms.',
    };
  }

  const enrichPool = rawListings.slice(0, 8);
  try {
    await enrichItemsWithMarketValue(enrichPool, { fallbackQuery: 'PS5 Slim Disc Console' });
    logTest('listings_enriched', { count: enrichPool.length });
  } catch (err) {
    logTest('enrich_error', { message: String(err?.message || err).slice(0, 120) });
  }

  const scored = scoreListings(rawListings);
  const triggered = scored.filter((s) => s.passesBetaTrigger);
  const topMatches = (triggered.length ? triggered : scored).slice(0, MAX_MATCHING_LISTINGS);
  const selected = topMatches[0] || null;

  logTest('deal_selected', {
    userId: String(userId),
    selectedId: selected?.itemId || null,
    dealScore: selected?.dealScore ?? null,
    triggeredCount: triggered.length,
    topCount: topMatches.length,
  });

  if (!selected) {
    return {
      ok: false,
      alertStatus: 'no_deal_selected',
      emailStatus: 'skipped',
      listingsFound: rawListings.length,
      matchingListings: [],
    };
  }

  const emailTrace = createEmailPipelineTrace();
  emailTrace.step('post_selection_start', {
    selectedId: selected.itemId,
    dealScore: selected.dealScore,
  });

  emailTrace.step('alert_ensure_start', { userId: String(userId) });
  const alert = await ensureTestAlert(userId);
  emailTrace.step('alert_ensure_done', { alertId: String(alert._id), alertName: alert.name });

  emailTrace.step('auction_upsert_start', { externalId: String(selected.itemId) });
  const auction = await upsertTestAuction(selected);
  emailTrace.step('auction_upsert_done', { auctionId: String(auction._id) });

  alert.matches.push({
    auction: auction._id,
    matchedAt: new Date(),
    reason: `Beta test match — deal score ${selected.dealScore}`,
  });
  alert.triggerCount = Number(alert.triggerCount || 0) + 1;
  alert.lastTriggeredAt = new Date();
  await alert.save();
  emailTrace.step('alert_match_saved', {
    alertId: String(alert._id),
    triggerCount: alert.triggerCount,
    matchCount: alert.matches.length,
  });

  auditAlertDelivery({
    userId: String(userId),
    alertId: String(alert._id),
    listingId: String(auction._id),
    channel: 'test_pipeline',
    delivered: true,
    dealScore: selected.dealScore,
  });

  let emailStatus = 'skipped';
  let emailResult = null;
  const cooldown = canSendEmail(userId, Boolean(opts.forceEmail));

  emailTrace.step('email_gate_check', {
    skipEmail: Boolean(opts.skipEmail),
    hasEmail: Boolean(user.email),
    cooldownAllowed: cooldown.allowed,
    forceEmail: Boolean(opts.forceEmail),
    retryAfterSec: cooldown.retryAfterSec || null,
    emailConfig: {
      provider: getEmailConfigStatus().provider,
      emailConfigured: getEmailConfigStatus().emailConfigured,
      alertEmailEnabled: getEmailConfigStatus().alertEmailEnabled,
      fromAudit: auditEmailFrom(),
    },
  });

  if (!opts.skipEmail && !user.email) {
    emailStatus = 'no_email_on_account';
    emailTrace.step('email_stop', { ok: false, reason: emailStatus });
  } else if (!opts.skipEmail && !cooldown.allowed) {
    emailStatus = 'rate_limited';
    emailTrace.step('email_stop', {
      ok: false,
      reason: emailStatus,
      retryAfterSec: cooldown.retryAfterSec,
      lastSentAt: cooldown.lastSentAt || null,
    });
    logTest('email_rate_limited', {
      userId: String(userId),
      retryAfterSec: cooldown.retryAfterSec,
    });
  } else if (!opts.skipEmail) {
    const pointsMult = readPointsEventMultiplier();
    const rewards = computeSavvyRewards(user, selected, pointsMult);
    const tierLabel = getTierConfigForUser(user).label || 'Explorer';

    const emailData = {
      userName: user.username || 'Savvy Hunter',
      productTitle: selected.title,
      productImage: selected.imageUrl || selected.image,
      currentPrice: selected.price ?? selected.currentBidPrice ?? selected.buyNowPrice,
      originalPrice: selected.marketValue,
      savingsAmount: selected.savings,
      savingsPercent: selected.savingsPct,
      trustScore: selected.trustScore,
      rankedAbovePercent: selected.rankedAbovePercent,
      shippingStatus: selected.shippingStatus || 'See listing for shipping details',
      viewDealUrl: selected.itemWebUrl || selected.url || auction.source?.url,
      whyPickedReasons: selected.whyPickedReasons,
      ...rewards,
      userLevel: tierLabel,
      savvyBalance: user.savvyPoints ?? user.pointsBalance ?? 0,
      nextRewardTier: 'Deal Hunter',
      progressPercent: Math.min(100, Math.round(Number(user.loginStreakDays) || 0) * 5),
      preheader: `Savvy Scout beta test — ${selected.title}`,
    };

    emailTrace.step('email_data_built', {
      productTitle: String(selected.title).slice(0, 80),
      hasImage: Boolean(emailData.productImage),
      estimatedReward: rewards.estimatedReward,
      to: `${String(user.email).slice(0, 3)}***`,
    });

    logTest('email_generated', {
      userId: String(userId),
      to: `${String(user.email).slice(0, 3)}***`,
      productTitle: String(selected.title).slice(0, 80),
      estimatedReward: rewards.estimatedReward,
      doublePointActive: rewards.doublePointActive,
    });

    emailResult = await sendSavvyScoutDealFoundEmail({
      to: user.email,
      data: emailData,
      subject: `🎯 Savvy Scout Beta Test — ${String(selected.title).slice(0, 60)}`,
      forceSend: true,
      trace: emailTrace,
    });

    if (emailResult?.sent) {
      markEmailSent(userId);
      emailStatus = 'sent';
      emailTrace.step('email_pipeline_success', {
        ok: true,
        provider: emailResult.provider,
        messageId: emailResult.messageId || null,
      });
      logTest('email_sent', {
        userId: String(userId),
        provider: emailResult.provider,
        messageId: emailResult.messageId || null,
      });
    } else {
      emailStatus = emailResult?.reason || 'send_failed';
      emailTrace.step('email_pipeline_failed', {
        ok: false,
        reason: emailStatus,
        logOnly: Boolean(emailResult?.logOnly),
        provider: emailResult?.provider || null,
        errorCode: emailResult?.errorCode || null,
        errorReason: emailResult?.errorReason || null,
      });
      logTest('email_failed', {
        userId: String(userId),
        reason: emailStatus,
        logOnly: Boolean(emailResult?.logOnly),
        provider: emailResult?.provider,
        errorCode: emailResult?.errorCode,
      });
    }
  } else if (opts.skipEmail) {
    emailTrace.step('email_stop', { ok: false, reason: 'skip_email_requested' });
  }

  const emailStopReason = emailTrace.stopReason();
  const elapsedMs = Date.now() - startedAt;
  logTest('pipeline_done', {
    userId: String(userId),
    elapsedMs,
    emailStatus,
    emailStopReason,
    dealScore: selected.dealScore,
    pipelineSteps: emailTrace.steps.length,
  });

  return {
    ok: true,
    alertStatus: 'triggered',
    alertId: String(alert._id),
    emailStatus,
    emailStopReason,
    emailPipeline: emailTrace.steps,
    emailCooldown: cooldown.allowed ? null : { retryAfterSec: cooldown.retryAfterSec },
    listingsFound: rawListings.length,
    triggeredCount: triggered.length,
    matchingListings: topMatches.map(slimListing),
    selectedListing: slimListing(selected),
    dealScore: selected.dealScore,
    passesBetaTrigger: selected.passesBetaTrigger,
    whyPicked: selected.whyPickedReasons,
    pointsEventActive: isDoubleOrTriplePointsActive(),
    pointsEventMultiplier: readPointsEventMultiplier(),
    email: emailResult
      ? {
          sent: Boolean(emailResult.sent),
          provider: emailResult.provider || null,
          reason: emailResult.reason || null,
          logOnly: Boolean(emailResult.logOnly),
          messageId: emailResult.messageId || null,
          errorCode: emailResult.errorCode || null,
          errorReason: emailResult.errorReason || null,
        }
      : null,
    emailConfig: getEmailConfigStatus(),
    elapsedMs,
  };
}

module.exports = {
  runAlertTestPipeline,
  searchPs5Listings,
  scoreListings,
  canSendEmail,
};
