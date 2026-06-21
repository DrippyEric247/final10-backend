const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const AuctionAggregator = require('./AuctionAggregator');
const marketScanner = require('./marketScanner');
const { isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
const { isProduction } = require('../config/envValidation');
const { auditAlertScan } = require('./auditLogger');

const aggregator = new AuctionAggregator();

const MAX_LANES_PER_SCAN = isProduction() ? 3 : 12;
const MAX_RECENT_AUCTIONS = isProduction() ? 30 : 80;
const LANE_RESULT_LIMIT = isProduction() ? 3 : 4;

let scanRunning = false;

function scoutLog(...args) {
  if (isEbayVerboseLogEnabled()) console.log(...args);
}

/**
 * Savvy Scout beta sweep: scan active alert keyword lanes, ingest listings, run matchers.
 */
async function runSavvyScoutAlertScan() {
  if (scanRunning) {
    scoutLog('[SavvyScout] Scan skipped — previous run still active.');
    auditAlertScan({ phase: 'skip', reason: 'scan_already_running' });
    return { targets: 0, lanesSwept: 0, listingsChecked: 0, skipped: true };
  }
  scanRunning = true;
  try {
  scoutLog('[SavvyScout] Scanning active alert targets…');
  auditAlertScan({ phase: 'start' });

  const alerts = await Alert.find({ isActive: true }).select('name keywords user').lean();
  if (!alerts.length) {
    scoutLog('[SavvyScout] No active alert targets.');
    auditAlertScan({ phase: 'skip', reason: 'no_active_alerts' });
    return { targets: 0, lanesSwept: 0, listingsChecked: 0 };
  }

  const lanes = new Map();
  for (const alert of alerts) {
    const query = (alert.keywords || []).map((k) => String(k).trim()).filter(Boolean).join(' ');
    if (!query) continue;
    if (!lanes.has(query)) lanes.set(query, alert.name);
  }

  let listingsChecked = 0;
  const laneEntries = Array.from(lanes.entries()).slice(0, MAX_LANES_PER_SCAN);

  for (const [query, alertName] of laneEntries) {
    scoutLog(`[SavvyScout] Sweeping lane "${query}" (${alertName})`);
    try {
      const { savedAuctions = [] } = await aggregator.searchAndSave(query, LANE_RESULT_LIMIT);
      for (const auction of savedAuctions) {
        listingsChecked += 1;
        await marketScanner.checkAlerts(auction);
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
    .select('title currentBid endTime status platform source url images sellerUsername');

  for (const auction of recent) {
    listingsChecked += 1;
    await marketScanner.checkAlerts(auction);
  }

  console.log(
    `[SavvyScout] done targets=${alerts.length} lanes=${lanes.size} checked=${listingsChecked}`
  );
  auditAlertScan({
    targets: alerts.length,
    lanesSwept: laneEntries.length,
    listingsChecked,
    phase: 'done',
  });

  return { targets: alerts.length, lanesSwept: laneEntries.length, listingsChecked };
  } finally {
    scanRunning = false;
  }
}

module.exports = { runSavvyScoutAlertScan };
