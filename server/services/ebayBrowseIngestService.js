const Auction = require('../models/Auction');
const { ebayBrowseGet } = require('./ebayBrowseClient');
const { normalizeEbayItemSummary } = require('./ebayListingNormalizer');
const { auditAlertScan } = require('./auditLogger');

function dealPotentialFromListing(listing) {
  if (listing.confidenceScore != null && Number.isFinite(Number(listing.confidenceScore))) {
    const n = Number(listing.confidenceScore);
    const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
    return Math.min(100, Math.max(0, pct));
  }
  if (listing.dealScore != null && Number.isFinite(Number(listing.dealScore))) {
    return Math.min(100, Math.max(0, Math.round(Number(listing.dealScore))));
  }
  const savingsPct = Number(listing.savingsPct) || 0;
  return Math.min(100, Math.max(40, Math.round(50 + savingsPct * 0.5)));
}

/**
 * Upsert one eBay Browse listing into Auction collection (platform=ebay).
 */
async function upsertEbayBrowseListing(listing) {
  const externalId = String(listing.itemId || listing.id || '').trim();
  if (!externalId) return null;

  const end = listing.itemEndDate ? new Date(listing.itemEndDate) : new Date(Date.now() + 86400000);
  const price = Number(listing.price ?? listing.currentBidPrice ?? listing.buyNowPrice) || 0;
  const dealPotential = dealPotentialFromListing(listing);
  const bidCount = Number(listing.bidCount) || 0;

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
        condition: listing.condition || 'good',
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
          dealPotential,
          competitionLevel: bidCount > 8 ? 'high' : bidCount > 3 ? 'medium' : 'low',
          trendingScore: Math.min(100, Math.round(Number(listing.rankedAbovePercent) || dealPotential)),
        },
        savings: listing.savings ?? undefined,
        savingsPct: listing.savingsPct ?? undefined,
        marketValue: listing.marketValue ?? undefined,
        lastUpdated: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

/**
 * Search eBay Browse API and persist listings for Savvy Scout alert matching.
 */
async function searchEbayBrowseAndSave(query, limit = 5) {
  const q = String(query || '').trim();
  if (!q) return [];

  auditAlertScan({ phase: 'browse_search_start', query: q, limit });

  let data;
  try {
    data = await ebayBrowseGet('item_summary/search', {
      q,
      limit: String(Math.min(50, Math.max(1, limit))),
      sort: 'bestMatch',
      filter: 'buyingOptions:{FIXED_PRICE|AUCTION}',
    });
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 200);
    console.warn(`[SavvyScout] eBay Browse search failed query="${q.slice(0, 80)}" error=${msg}`);
    auditAlertScan({ phase: 'browse_search_error', query: q.slice(0, 80), message: msg });
    return [];
  }

  const rows = (data?.itemSummaries || []).map(normalizeEbayItemSummary);
  const saved = [];
  for (const row of rows) {
    if (!row?.itemId || !row?.title) continue;
    try {
      const doc = await upsertEbayBrowseListing(row);
      if (doc) saved.push(doc);
    } catch (err) {
      console.warn('[SavvyScout] upsert failed:', String(err?.message || err).slice(0, 120));
    }
  }

  auditAlertScan({
    phase: 'browse_search_done',
    query: q,
    rawCount: rows.length,
    savedCount: saved.length,
  });

  return saved;
}

module.exports = {
  searchEbayBrowseAndSave,
  upsertEbayBrowseListing,
  dealPotentialFromListing,
};
