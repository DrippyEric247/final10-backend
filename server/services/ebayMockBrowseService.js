/**
 * Curated mock Browse API payloads when eBay app-token or Browse calls fail.
 * Shapes match raw eBay item summaries before normalizeEbayItemSummary().
 */

const MOCK_SEEDS = [
  { title: 'Sony PlayStation 5 Console', price: 389, bids: 2, minutes: 28 },
  { title: 'Apple iPhone 15 Pro 128GB Unlocked', price: 749, bids: 5, minutes: 45 },
  { title: 'NVIDIA RTX 4070 Graphics Card', price: 499, bids: 1, minutes: 18 },
  { title: 'Air Jordan 1 Retro High OG', price: 165, bids: 3, minutes: 52 },
  { title: 'Dyson V15 Detect Vacuum', price: 420, bids: 0, minutes: 120 },
  { title: 'BMW Alloy Wheels Set 18in', price: 599, bids: 2, minutes: 35 },
  { title: 'Pokemon TCG Booster Box', price: 128, bids: 4, minutes: 22 },
  { title: 'MacBook Air M2 256GB', price: 799, bids: 6, minutes: 40 },
];

function buyingOptionsForMode(listingMode) {
  if (listingMode === 'auction') return ['AUCTION'];
  if (listingMode === 'buy_now') return ['FIXED_PRICE'];
  return ['AUCTION', 'FIXED_PRICE'];
}

function buildMockItemSummary(seed, index, query, listingMode) {
  const isAuction = buyingOptionsForMode(listingMode).includes('AUCTION');
  const isBuyNow = buyingOptionsForMode(listingMode).includes('FIXED_PRICE');
  const end = new Date(Date.now() + seed.minutes * 60 * 1000).toISOString();
  const slug = encodeURIComponent(String(query || 'deal').replace(/\s+/g, '-').slice(0, 40));

  return {
    itemId: `f10-mock-${slug}-${index}-${Date.now()}`,
    title: `${seed.title} (${query})`.slice(0, 88),
    image: {
      imageUrl:
        'https://via.placeholder.com/640x480/0f172a/38bdf8?text=Final10+Sample+Deal',
    },
    itemWebUrl: `https://www.ebay.com/sch/i.html?_nkw=${slug}`,
    price: { value: String(seed.price), currency: 'USD' },
    currentBidPrice: isAuction
      ? { value: String(Math.max(1, seed.price - 15)), currency: 'USD' }
      : undefined,
    buyNowPrice: isBuyNow ? { value: String(seed.price + 20), currency: 'USD' } : undefined,
    bidCount: isAuction ? seed.bids : 0,
    itemEndDate: end,
    condition: 'Used',
    buyingOptions: buyingOptionsForMode(listingMode),
    seller: {
      username: 'savvy_verified_seller',
      feedbackScore: 1840 + index * 17,
      feedbackPercentage: '99.4',
      topRatedBuyingExperience: true,
    },
    categories: [{ categoryName: 'Sample' }],
  };
}

/**
 * @returns {{ itemSummaries: object[], total: number, mock: true }}
 */
function buildMockBrowseResponse({
  searchQuery = 'electronics',
  limit = 20,
  listingMode = 'mixed',
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const itemSummaries = MOCK_SEEDS.slice(0, cap).map((seed, i) =>
    buildMockItemSummary(seed, i, searchQuery, listingMode)
  );
  return {
    itemSummaries,
    total: itemSummaries.length,
    mock: true,
  };
}

module.exports = {
  buildMockBrowseResponse,
  MOCK_FALLBACK_WARNING:
    'Live eBay inventory is temporarily unavailable. Showing sample deals until marketplace auth is restored.',
};
