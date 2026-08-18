const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const crypto = require('crypto');
const marketScanner = require('./marketScanner');
const { searchEbayBrowseAndSave } = require('./ebayBrowseIngestService');
const { isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
const { isProduction } = require('../config/envValidation');
const { auditAlertScan } = require('./auditLogger');
const {
  isAlertEligibleForScan,
  resolveAlertSpeedProfile,
  scheduleAfterScan,
} = require('./alertTimingService');
const { profileForSpeedTier } = require('../config/alertSpeedConfig');

const MAX_RECENT_AUCTIONS = isProduction() ? 30 : 80;
const LANE_RESULT_LIMIT = isProduction() ? 5 : 6;
const SCAN_CLAIM_TTL_MS = 2 * 60 * 1000;

/** Round-robin offset when lane count exceeds per-scan cap. */
let laneRotationOffset = 0;

function readMaxLanesPerScan() {
  const n = Number(process.env.SAVVY_SCOUT_MAX_LANES_PER_SCAN);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return isProduction() ? 24 : 12;
}

let scanRunning = false;

function scoutLog(...args) {
  console.log(...args);
}

function scoutVerbose(...args) {
  if (isEbayVerboseLogEnabled()) console.log(...args);
}

function lanePriority(meta) {
  return Number(meta?.lanePriority) || 1;
}

/**
 * Pick keyword lanes for this sweep (priority-weighted when over cap).
 */
function selectLaneEntries(lanesMap) {
  const all = Array.from(lanesMap.entries()).sort(
    (a, b) => lanePriority(b[1]) - lanePriority(a[1]) || a[0].localeCompare(b[0])
  );
  const max = readMaxLanesPerScan();
  if (all.length <= max) return { entries: all, rotated: false, totalLanes: all.length };

  const start = laneRotationOffset % all.length;
  const entries = [];
  for (let i = 0; i < max; i += 1) {
    entries.push(all[(start + i) % all.length]);
  }
  laneRotationOffset = (start + entries.length) % all.length;
  return { entries, rotated: true, totalLanes: all.length, nextOffset: laneRotationOffset };
}

async function claimAlertForScan(alertId) {
  const now = new Date();
  const expires = new Date(now.getTime() + SCAN_CLAIM_TTL_MS);
  const token = crypto.randomUUID();
  const claimed = await Alert.findOneAndUpdate(
    {
      _id: alertId,
      isActive: true,
      $or: [{ scanClaimExpiresAt: null }, { scanClaimExpiresAt: { $lt: now } }],
    },
    { $set: { scanClaimedAt: now, scanClaimExpiresAt: expires, scanClaimToken: token } },
    { new: true }
  );
  return claimed ? { alert: claimed, token } : null;
}

async function releaseAlertScanClaim(alertId, token = null) {
  const filter = { _id: alertId };
  if (token) filter.scanClaimToken = token;
  await Alert.updateOne(filter, {
    $unset: { scanClaimedAt: 1, scanClaimExpiresAt: 1, scanClaimToken: 1 },
  });
}

async function finalizeAlertScanClaim(alertId, token, patch = {}) {
  if (!token) return null;
  return Alert.findOneAndUpdate(
    { _id: alertId, scanClaimToken: token },
    { $set: patch, $unset: { scanClaimedAt: 1, scanClaimExpiresAt: 1, scanClaimToken: 1 } },
    { new: true }
  );
}

async function markAlertsScanned(alertClaims = []) {
  const now = new Date();
  const entries = Array.isArray(alertClaims)
    ? alertClaims.map((entry) =>
        typeof entry === 'string' ? { alertId: entry, token: null } : entry
      )
    : [];

  for (const { alertId, token } of entries) {
    try {
      const alert = await Alert.findById(alertId).select('user lastScannedAt effectiveSpeedTier');
      if (!alert) continue;
      const profile = await resolveAlertSpeedProfile(alert.user);
      const patch = scheduleAfterScan(alert, profile, now);
      if (token) {
        const finalized = await finalizeAlertScanClaim(alertId, token, patch);
        if (!finalized) {
          scoutVerbose(`[SavvyScout] scan finalize skipped — claim lost alertId=${alertId}`);
        }
      } else {
        await Alert.updateOne(
          { _id: alertId },
          { $set: patch, $unset: { scanClaimedAt: 1, scanClaimExpiresAt: 1, scanClaimToken: 1 } }
        );
      }
    } catch (err) {
      await releaseAlertScanClaim(alertId, token);
      scoutVerbose(`[SavvyScout] schedule update failed alertId=${alertId}`, err?.message);
    }
  }
}

/**
 * Savvy Scout background sweep: due-time aware, tier-priority lanes.
 */
async function runSavvyScoutAlertScan() {
  if (scanRunning) {
    scoutLog('[SavvyScout] alert scan skipped — previous run still active');
    auditAlertScan({ phase: 'skip', reason: 'scan_already_running' });
    return { targets: 0, lanesSwept: 0, listingsChecked: 0, skipped: true };
  }
  scanRunning = true;
  const scanStartedAt = Date.now();

  try {
    scoutLog('[SavvyScout] alert scan started');
    auditAlertScan({ phase: 'start', at: new Date().toISOString() });

    const now = new Date();
    const alerts = await Alert.find({
      isActive: true,
      $or: [{ eligibleAt: null }, { eligibleAt: { $lte: now } }],
      $and: [{ $or: [{ nextScanAt: null }, { nextScanAt: { $lte: now } }] }],
    })
      .select('name keywords user minConfidence maxPrice eligibleAt nextScanAt effectiveSpeedTier speedLabel')
      .sort({ effectiveSpeedTier: -1, nextScanAt: 1, updatedAt: -1 })
      .lean();

    const dueAlerts = alerts.filter((a) => isAlertEligibleForScan(a, now));

    if (!dueAlerts.length) {
      scoutLog('[SavvyScout] alert scan — no due alerts');
      auditAlertScan({ phase: 'skip', reason: 'no_due_alerts', totalActive: alerts.length });
      return { targets: 0, lanesSwept: 0, listingsChecked: 0, dueAlerts: 0 };
    }

    /** @type {Map<string, { alertName: string, alertClaims: Array<{ alertId: string, token: string }>, lanePriority: number }>} */
    const lanes = new Map();
    const claimedAlertIds = [];
    for (const alert of dueAlerts) {
      const claim = await claimAlertForScan(alert._id);
      if (!claim) {
        auditAlertScan({ phase: 'alert_skipped_claimed', alertId: String(alert._id) });
        continue;
      }
      claimedAlertIds.push(String(alert._id));

      const query = (alert.keywords || []).map((k) => String(k).trim()).filter(Boolean).join(' ');
      if (!query) {
        await releaseAlertScanClaim(alert._id, claim.token);
        scoutLog(`[SavvyScout] alert skipped (no keywords) id=${alert._id} name="${alert.name}"`);
        continue;
      }

      const tierProfile = profileForSpeedTier(alert.effectiveSpeedTier || 'standard');
      const existing = lanes.get(query);
      const claimEntry = { alertId: String(alert._id), token: claim.token };
      if (existing) {
        existing.alertClaims.push(claimEntry);
        existing.lanePriority = Math.max(existing.lanePriority, tierProfile.lanePriority);
      } else {
        lanes.set(query, {
          alertName: alert.name,
          alertClaims: [claimEntry],
          lanePriority: tierProfile.lanePriority,
        });
      }
      scoutVerbose(`[SavvyScout] due alert queued id=${alert._id} tier=${alert.effectiveSpeedTier} nextScan=${alert.nextScanAt}`);
    }

    const { entries: laneEntries, rotated, totalLanes, nextOffset } = selectLaneEntries(lanes);
    scoutLog(
      `[SavvyScout] alert scan due=${dueAlerts.length} lanes total=${totalLanes} sweeping=${laneEntries.length} rotated=${rotated}${rotated ? ` nextOffset=${nextOffset}` : ''}`
    );
    auditAlertScan({
      phase: 'lanes_selected',
      dueAlerts: dueAlerts.length,
      totalLanes,
      lanesSwept: laneEntries.length,
      rotated,
      nextOffset: rotated ? nextOffset : 0,
      maxLanesPerScan: readMaxLanesPerScan(),
    });

    let listingsChecked = 0;
    let laneMatches = 0;

    for (const [query, meta] of laneEntries) {
      const alertIds = meta.alertClaims.map((c) => c.alertId);
      scoutLog(`[SavvyScout] lane sweep query="${query}" alert="${meta.alertName}" alertIds=${alertIds.join(',')}`);
      auditAlertScan({
        phase: 'lane_start',
        query,
        alertName: meta.alertName,
        alertIds,
        limit: LANE_RESULT_LIMIT,
        lanePriority: meta.lanePriority,
      });

      try {
        const savedAuctions = await searchEbayBrowseAndSave(query, LANE_RESULT_LIMIT);
        scoutLog(`[SavvyScout] lane results query="${query}" listingsFound=${savedAuctions.length}`);
        auditAlertScan({ phase: 'lane_results', query, listingsFound: savedAuctions.length });

        for (const auction of savedAuctions) {
          listingsChecked += 1;
          const matchResult = await marketScanner.checkAlerts(auction, {
            source: 'lane_sweep',
            query,
            alertIds,
          });
          laneMatches += matchResult?.newMatches || 0;
        }
      } catch (err) {
        const msg = String(err?.message || err).slice(0, 200);
        console.warn(`[SavvyScout] lane failed query="${query.slice(0, 80)}" error=${msg}`);
        auditAlertScan({ phase: 'lane_error', query: query.slice(0, 80), message: msg });
      } finally {
        await markAlertsScanned(meta.alertClaims);
      }
    }

    // Release claims for due alerts whose lanes were not swept this cycle.
    const sweptAlertIds = new Set(
      laneEntries.flatMap(([, meta]) => meta.alertClaims.map((c) => c.alertId))
    );
    for (const alertId of claimedAlertIds) {
      if (!sweptAlertIds.has(alertId)) {
        await releaseAlertScanClaim(alertId);
      }
    }

    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recent = await Auction.find({ status: 'active', updatedAt: { $gte: since } })
      .sort({ updatedAt: -1 })
      .limit(MAX_RECENT_AUCTIONS)
      .lean()
      .select('title currentBid endTime status platform source url images sellerUsername aiScore');

    scoutLog(`[SavvyScout] recent auction re-check count=${recent.length} windowHours=6`);
    auditAlertScan({ phase: 'recent_recheck_start', recentCount: recent.length });

    const dueAlertIds = dueAlerts.map((a) => String(a._id));
    let recentMatches = 0;
    for (const auction of recent) {
      listingsChecked += 1;
      const matchResult = await marketScanner.checkAlerts(auction, {
        source: 'recent_recheck',
        alertIds: dueAlertIds,
      });
      recentMatches += matchResult?.newMatches || 0;
    }

    const elapsedMs = Date.now() - scanStartedAt;
    scoutLog(
      `[SavvyScout] alert scan done due=${dueAlerts.length} lanes=${totalLanes} swept=${laneEntries.length} checked=${listingsChecked} newMatches=${laneMatches + recentMatches} elapsedMs=${elapsedMs}`
    );
    auditAlertScan({
      dueAlerts: dueAlerts.length,
      totalLanes,
      lanesSwept: laneEntries.length,
      listingsChecked,
      newMatches: laneMatches + recentMatches,
      elapsedMs,
      phase: 'done',
    });

    return {
      dueAlerts: dueAlerts.length,
      totalLanes,
      lanesSwept: laneEntries.length,
      listingsChecked,
      newMatches: laneMatches + recentMatches,
    };
  } finally {
    scanRunning = false;
  }
}

module.exports = {
  runSavvyScoutAlertScan,
  claimAlertForScan,
  releaseAlertScanClaim,
  finalizeAlertScanClaim,
  markAlertsScanned,
  SCAN_CLAIM_TTL_MS,
};
