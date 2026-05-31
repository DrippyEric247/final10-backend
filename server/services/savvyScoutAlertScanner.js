const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const AuctionAggregator = require('./AuctionAggregator');
const marketScanner = require('./marketScanner');

const aggregator = new AuctionAggregator();

/**
 * Savvy Scout beta sweep: scan active alert keyword lanes, ingest listings, run matchers.
 */
async function runSavvyScoutAlertScan() {
  console.log('[SavvyScout] Scanning active alert targets…');

  const alerts = await Alert.find({ isActive: true }).select('name keywords user').lean();
  if (!alerts.length) {
    console.log('[SavvyScout] No active alert targets.');
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
    console.log(`[SavvyScout] Sweeping lane "${query}" (${alertName})`);
    try {
      const { savedAuctions = [] } = await aggregator.searchAndSave(query, 4);
      for (const auction of savedAuctions) {
        listingsChecked += 1;
        await marketScanner.checkAlerts(auction);
      }
    } catch (err) {
      console.warn(`[SavvyScout] Lane sweep failed for "${query}":`, err.message);
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
    `[SavvyScout] Scan complete — ${alerts.length} targets, ${lanes.size} lanes, ${listingsChecked} listings checked`
  );

  return { targets: alerts.length, lanesSwept: lanes.size, listingsChecked };
}

module.exports = { runSavvyScoutAlertScan };
