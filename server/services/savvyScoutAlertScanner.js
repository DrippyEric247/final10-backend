const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const AuctionAggregator = require('./AuctionAggregator');
const marketScanner = require('./marketScanner');
const { isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
const { isProduction } = require('../config/envValidation');
const { auditAlertScan } = require('./auditLogger');

const aggregator = new AuctionAggregator();

const MAX_RECENT_AUCTIONS = isProduction() ? 30 : 80;
const LANE_RESULT_LIMIT = isProduction() ? 5 : 6;

/** Round-robin offset when lane count exceeds per-scan cap. */
let laneRotationOffset = 0;

function readMaxLanesPerScan() {
  const n = Number(process.env.SAVVY_SCOUT_MAX_LANES_PER_SCAN);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  // Production previously capped at 3 — too low for multi-alert accounts.
  return isProduction() ? 24 : 12;
}

let scanRunning = false;

function scoutLog(...args) {
  console.log(...args);
}

function scoutVerbose(...args) {
  if (isEbayVerboseLogEnabled()) console.log(...args);
}

/**
 * Pick keyword lanes for this sweep (all lanes when under cap; otherwise rotate).
 */
function selectLaneEntries(lanesMap) {
  const all = Array.from(lanesMap.entries());
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

/**
 * Savvy Scout background sweep: scan active alert keyword lanes, ingest listings, run matchers.
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

    const alerts = await Alert.find({ isActive: true })
      .select('name keywords user minConfidence maxPrice')
      .sort({ updatedAt: -1 })
      .lean();

    if (!alerts.length) {
      scoutLog('[SavvyScout] alert scan — no active alerts');
      auditAlertScan({ phase: 'skip', reason: 'no_active_alerts' });
      return { targets: 0, lanesSwept: 0, listingsChecked: 0 };
    }

    /** @type {Map<string, { alertName: string, alertIds: string[] }>} */
    const lanes = new Map();
    for (const alert of alerts) {
      const query = (alert.keywords || []).map((k) => String(k).trim()).filter(Boolean).join(' ');
      if (!query) {
        scoutLog(`[SavvyScout] alert skipped (no keywords) id=${alert._id} name="${alert.name}"`);
        auditAlertScan({
          phase: 'alert_skipped',
          alertId: String(alert._id),
          alertName: alert.name,
          reason: 'no_keywords',
        });
        continue;
      }
      const existing = lanes.get(query);
      if (existing) {
        existing.alertIds.push(String(alert._id));
      } else {
        lanes.set(query, { alertName: alert.name, alertIds: [String(alert._id)] });
      }
      scoutVerbose(`[SavvyScout] alert queued id=${alert._id} name="${alert.name}" query="${query}"`);
      auditAlertScan({
        phase: 'alert_queued',
        alertId: String(alert._id),
        alertName: alert.name,
        query,
        minConfidence: alert.minConfidence,
        maxPrice: alert.maxPrice ?? null,
      });
    }

    const { entries: laneEntries, rotated, totalLanes, nextOffset } = selectLaneEntries(lanes);
    scoutLog(
      `[SavvyScout] alert scan lanes total=${totalLanes} sweeping=${laneEntries.length} rotated=${rotated}${rotated ? ` nextOffset=${nextOffset}` : ''}`
    );
    auditAlertScan({
      phase: 'lanes_selected',
      totalLanes,
      lanesSwept: laneEntries.length,
      rotated,
      nextOffset: rotated ? nextOffset : 0,
      maxLanesPerScan: readMaxLanesPerScan(),
    });

    let listingsChecked = 0;
    let laneMatches = 0;

    for (const [query, meta] of laneEntries) {
      scoutLog(`[SavvyScout] lane sweep query="${query}" alert="${meta.alertName}" alertIds=${meta.alertIds.join(',')}`);
      auditAlertScan({
        phase: 'lane_start',
        query,
        alertName: meta.alertName,
        alertIds: meta.alertIds,
        limit: LANE_RESULT_LIMIT,
      });

      try {
        const { savedAuctions = [] } = await aggregator.searchAndSave(query, LANE_RESULT_LIMIT);
        scoutLog(
          `[SavvyScout] lane results query="${query}" listingsFound=${savedAuctions.length}`
        );
        auditAlertScan({
          phase: 'lane_results',
          query,
          listingsFound: savedAuctions.length,
        });

        for (const auction of savedAuctions) {
          listingsChecked += 1;
          const matchResult = await marketScanner.checkAlerts(auction, {
            source: 'lane_sweep',
            query,
          });
          laneMatches += matchResult?.newMatches || 0;
        }
      } catch (err) {
        const msg = String(err?.message || err).slice(0, 200);
        console.warn(`[SavvyScout] lane failed query="${query.slice(0, 80)}" error=${msg}`);
        auditAlertScan({ phase: 'lane_error', query: query.slice(0, 80), message: msg });
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

    let recentMatches = 0;
    for (const auction of recent) {
      listingsChecked += 1;
      const matchResult = await marketScanner.checkAlerts(auction, { source: 'recent_recheck' });
      recentMatches += matchResult?.newMatches || 0;
    }

    const elapsedMs = Date.now() - scanStartedAt;
    scoutLog(
      `[SavvyScout] alert scan done targets=${alerts.length} lanes=${totalLanes} swept=${laneEntries.length} checked=${listingsChecked} newMatches=${laneMatches + recentMatches} elapsedMs=${elapsedMs}`
    );
    auditAlertScan({
      targets: alerts.length,
      totalLanes,
      lanesSwept: laneEntries.length,
      listingsChecked,
      newMatches: laneMatches + recentMatches,
      elapsedMs,
      phase: 'done',
    });

    return {
      targets: alerts.length,
      totalLanes,
      lanesSwept: laneEntries.length,
      listingsChecked,
      newMatches: laneMatches + recentMatches,
    };
  } finally {
    scanRunning = false;
  }
}

module.exports = { runSavvyScoutAlertScan };
