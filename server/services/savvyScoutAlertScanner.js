const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const AuctionAggregator = require('./AuctionAggregator');
const marketScanner = require('./marketScanner');
const { isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');
const { auditAlertScan } = require('./auditLogger');

const aggregator = new AuctionAggregator();

function scoutLog(...args) {
  if (isEbayVerboseLogEnabled()) console.log(...args);
}

/**
 * Savvy Scout beta sweep: scan active alert keyword lanes, ingest listings, run matchers.
 */
async function runSavvyScoutAlertScan() {
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

  for (const [query, alertName] of lanes.entries()) {
    scoutLog(`[SavvyScout] Sweeping lane "${query}" (${alertName})`);
    try {
      const { savedAuctions = [] } = await aggregator.searchAndSave(query, 4);
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
    .limit(120);

  for (const auction of recent) {
    listingsChecked += 1;
    await marketScanner.checkAlerts(auction);
  }

  console.log(
    `[SavvyScout] done targets=${alerts.length} lanes=${lanes.size} checked=${listingsChecked}`
  );
  auditAlertScan({
    targets: alerts.length,
    lanesSwept: lanes.size,
    listingsChecked,
    phase: 'done',
  });

  return { targets: alerts.length, lanesSwept: lanes.size, listingsChecked };
}

module.exports = { runSavvyScoutAlertScan };
