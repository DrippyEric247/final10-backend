/**
 * Seller trend signals from eBay Browse API (active item_summary only).
 * Uses the same app-token flow as /api/ebay/search — no user OAuth.
 */

const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const { getEbayAppToken, getEbayOAuthConfig } = require('./ebayAuthService');
const { normalizeEbayItemSummary } = require('./ebayListingNormalizer');
const { logEbayProviderError } = require('./structuredLog');

const DISCLAIMER =
  'Real-time money signals from what sellers are asking right now on eBay — not old sold prices.';

/** Weights sum to 100 — each factor contributes up to its weight when fully “hot”. */
const WEIGHTS = {
  bidCount: 22,
  endingSoon: 22,
  priceDemand: 22,
  categoryFrequency: 18,
  listingVolume: 16,
};

const STOPWORDS = new Set([
  'with', 'from', 'this', 'that', 'your', 'free', 'shipping', 'ship', 'used', 'new', 'for',
  'the', 'and', 'are', 'you', 'ebay', 'sale', 'brand', 'authentic', 'fast', 'great', 'good',
  'lot', 'set', 'pair', 'one', 'two', 'size', 'color', 'black', 'white', 'blue', 'red',
]);

/** Macro seeds aligned with server/routes/ebay.js EBAY_CATEGORY_SLUG_KEYWORDS */
const SELLER_TREND_SEEDS = [
  { key: 'electronics', label: 'Electronics', q: 'electronics' },
  { key: 'furniture', label: 'Furniture', q: 'furniture used' },
  { key: 'vehicles', label: 'Automotive', q: 'automotive' },
  { key: 'fashion', label: 'Fashion', q: 'fashion' },
  { key: 'tools', label: 'Tools', q: 'tools' },
  { key: 'toys', label: 'Toys', q: 'toys' },
  { key: 'books', label: 'Books', q: 'books' },
  { key: 'collectibles', label: 'Collectibles', q: 'collectibles' },
  { key: 'home', label: 'Home & garden', q: 'home garden' },
  { key: 'sports', label: 'Sports & outdoors', q: 'sports outdoors' },
];

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

async function ebayBrowseSearch(params) {
  const token = await getEbayAppToken();
  if (!token) {
    const err = new Error('eBay app token unavailable');
    err.status = 503;
    err.code = 'EBAY_TOKEN_UNAVAILABLE';
    throw err;
  }
  const { browseBase } = getEbayOAuthConfig();
  const query = new URLSearchParams(params).toString();
  const url = `${browseBase}/item_summary/search?${query}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(`eBay Browse failed: ${response.status}`);
    err.status = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function fetchSeedSummaries(seed) {
  const params = {
    q: seed.q,
    limit: '45',
    sort: 'BestMatch',
  };
  const data = await ebayBrowseSearch(params);
  const list = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
  return { seed, summaries: list, total: typeof data?.total === 'number' ? data.total : list.length };
}

function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

function tokenizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** Footwear titles only — avoids shirt “size 10” false positives when paired with size regex. */
const SNEAKER_OR_CLEAT_HINT =
  /\b(jordan|nike|adidas|yeezy|dunks?|air max|air force|\baf1\b|retro|sb\b|asics|new balance|vapormax|foamposite|sneaker|cleat|soccer|football|basketball shoe|skate shoe|trainer)\b/i;

/**
 * Parse US shoe sizes from listing titles in this bucket (live snapshot only).
 * @returns {null | { profitableSizes: string[], tightSupplyLine: string | null, detailNote: string }}
 */
function computeShoeSizeIntelligence(items) {
  if (!Array.isArray(items) || items.length < 6) return null;

  const parseSizeToken = (raw) => {
    const v = parseFloat(String(raw).replace(/,/g, '.'));
    if (!Number.isFinite(v)) return null;
    const half = Math.round(v * 2) / 2;
    if (half < 3.5 || half > 16) return null;
    return half;
  };

  const tryExtractSize = (title) => {
    if (!title || !SNEAKER_OR_CLEAT_HINT.test(String(title))) return null;
    const t = String(title).toLowerCase();
    const patterns = [
      /\bsize\s*(\d{1,2}(?:\.\d)?)\b/,
      /\bus\s*(\d{1,2}(?:\.\d)?)\b/,
      /\bus\s*sz\s*(\d{1,2}(?:\.\d)?)\b/,
      /\bsz\.?\s*(\d{1,2}(?:\.\d)?)\b/,
      /\bmen'?s?\s+(\d{1,2}(?:\.\d)?)\b/,
      /\bwomen'?s?\s+(\d{1,2}(?:\.\d)?)\b/,
      /\bwmns?\s+(\d{1,2}(?:\.\d)?)\b/,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        const sz = parseSizeToken(m[1]);
        if (sz != null) return sz;
      }
    }
    return null;
  };

  const fmtSize = (n) => (Number.isInteger(n) ? String(n) : String(n));

  /** @type {Map<number, { n: number; bids: number; priceSum: number; priceN: number }>} */
  const bySize = new Map();
  for (const L of items) {
    const sz = tryExtractSize(L.title);
    if (sz == null) continue;
    const cur = bySize.get(sz) || { n: 0, bids: 0, priceSum: 0, priceN: 0 };
    cur.n += 1;
    cur.bids += Math.min(Number(L.bidCount) || 0, 12);
    const p = Number(L.price) || Number(L.currentBidPrice) || 0;
    if (p > 0) {
      cur.priceSum += p;
      cur.priceN += 1;
    }
    bySize.set(sz, cur);
  }

  if (bySize.size < 3) return null;
  let totalParsed = 0;
  for (const v of bySize.values()) totalParsed += v.n;
  if (totalParsed < 5) return null;

  const demandScore = (rec) => {
    const avgP = rec.priceN > 0 ? rec.priceSum / rec.priceN : 120;
    const bidLean = rec.bids / Math.max(1, rec.n);
    const priceDemand = bidLean / Math.sqrt(avgP + 8);
    return rec.n * (1 + 2.1 * priceDemand);
  };

  const ranked = [...bySize.entries()]
    .map(([size, rec]) => ({ size, rec, score: demandScore(rec) }))
    .sort((a, b) => b.score - a.score);

  const profitableSizes = ranked.slice(0, 3).map((x) => fmtSize(x.size));

  const counts = ranked.map((x) => x.rec.n).sort((a, b) => a - b);
  const med = counts[Math.floor(counts.length / 2)] || 1;
  const lowThreshold = Math.max(1, Math.ceil(med * 0.28));

  const tightCandidates = ranked
    .filter((x) => x.size >= 6 && x.size <= 14 && x.rec.n <= lowThreshold)
    .sort((a, b) => a.rec.n - b.rec.n);
  const tight = tightCandidates[0];
  const tightSupplyLine = tight
    ? `Size ${fmtSize(tight.size)} inventory critically low`
    : null;

  return {
    profitableSizes,
    tightSupplyLine,
    detailNote: 'Sizes inferred from listing titles in this live snapshot — verify comps before you buy.',
  };
}

function hourInTimeZone(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const h = parts.find((p) => p.type === 'hour');
    if (!h) return null;
    const n = parseInt(h.value, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** `peakH` is already the local hour (0–23) in `tz` from listing end times. */
function formatLocalHourRange(peakH) {
  if (peakH == null || !Number.isFinite(peakH)) return null;
  const a = ((peakH % 24) + 24) % 24;
  const b = (a + 2) % 24;
  return `${a}:00–${b}:00 local`;
}

function collectUniqueListings() {
  /** @type {Map<string, any>} */
  const byId = new Map();
  return {
    add(raw, seed) {
      const id = String(raw?.itemId || '').trim();
      if (!id || byId.has(id)) return;
      const norm = normalizeEbayItemSummary(raw);
      byId.set(id, {
        ...norm,
        trendSeed: seed.key,
        trendSeedLabel: seed.label,
      });
    },
    values() {
      return [...byId.values()];
    },
    size() {
      return byId.size;
    },
  };
}

function scoreAndBucket(listings, opts) {
  const { timeZone, maxBucket } = opts;
  const total = listings.length;
  if (!total) {
    return {
      buckets: [],
      hotKeywords: [],
      marketplaceBestWindow: null,
      globalStats: {
        totalListingsSampled: 0,
        seedsWithApiHits: 0,
        distinctMacroBuckets: 0,
        seedsAttempted: SELLER_TREND_SEEDS.length,
      },
    };
  }

  /** @type {Map<string, any[]>} */
  const bySeed = new Map();
  for (const L of listings) {
    const k = L.trendSeed || 'other';
    if (!bySeed.has(k)) bySeed.set(k, []);
    bySeed.get(k).push(L);
  }

  const wordCounts = new Map();
  for (const L of listings) {
    for (const w of tokenizeTitle(L.title)) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
  }
  const hotKeywords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([keyword, count]) => ({
      keyword,
      heat: Math.round(clamp01(count / Math.max(3, total * 0.08)) * 100),
    }));

  const endHours = new Array(24).fill(0);
  for (const L of listings) {
    if (!L.itemEndDate) continue;
    const d = new Date(L.itemEndDate);
    if (Number.isNaN(d.getTime())) continue;
    const h = hourInTimeZone(d, timeZone);
    if (h != null && h >= 0 && h < 24) endHours[h] += 1;
  }
  let peakH = -1;
  let peakC = 0;
  for (let h = 0; h < 24; h += 1) {
    if (endHours[h] > peakC) {
      peakC = endHours[h];
      peakH = h;
    }
  }
  const marketplaceBestWindow =
    peakH >= 0 && peakC >= Math.max(3, Math.floor(total * 0.04))
      ? {
          peakHourLocal: peakH,
          label: formatLocalHourRange(peakH),
          detail: `When listings in this snapshot tend to end (${timeZone}) — a cue for when buyers scroll hardest.`,
        }
      : {
          peakHourLocal: null,
          label: null,
          detail: 'Not enough variety in end times yet — check back and we’ll pin a sharper “go live” window.',
        };

  const buckets = [];
  for (const [seedKey, items] of bySeed.entries()) {
    const seedMeta = SELLER_TREND_SEEDS.find((s) => s.key === seedKey);
    const label = seedMeta?.label || seedKey;
    const n = items.length;
    const auctions = items.filter((x) => x.isAuction);
    const na = Math.max(1, auctions.length);

    const avgBid = auctions.reduce((s, x) => s + Math.min(Number(x.bidCount) || 0, 15), 0) / na;
    const bidSignal = clamp01(avgBid / 7);

    const endingSoonCount = items.filter((x) => x.endingSoon).length;
    const endSignal = clamp01(endingSoonCount / Math.max(6, n * 0.2));

    let priceDemandSum = 0;
    let priceDemandN = 0;
    for (const x of auctions) {
      const p = Number(x.price) || Number(x.currentBidPrice) || 0;
      const b = Number(x.bidCount) || 0;
      if (p > 0) {
        priceDemandSum += b / Math.sqrt(p + 5);
        priceDemandN += 1;
      }
    }
    const priceDemandSignal = priceDemandN > 0 ? clamp01((priceDemandSum / priceDemandN) / 1.2) : clamp01(n / 80 * 0.25);

    const freqSignal = clamp01(n / maxBucket);

    const volSignal = clamp01(Math.log(1 + n) / Math.log(1 + 55));

    const components = {
      bidCount: Math.round(WEIGHTS.bidCount * bidSignal * 10) / 10,
      endingSoon: Math.round(WEIGHTS.endingSoon * endSignal * 10) / 10,
      priceDemand: Math.round(WEIGHTS.priceDemand * priceDemandSignal * 10) / 10,
      categoryFrequency: Math.round(WEIGHTS.categoryFrequency * freqSignal * 10) / 10,
      listingVolume: Math.round(WEIGHTS.listingVolume * volSignal * 10) / 10,
    };

    const trendScore = Math.round(
      WEIGHTS.bidCount * bidSignal +
        WEIGHTS.endingSoon * endSignal +
        WEIGHTS.priceDemand * priceDemandSignal +
        WEIGHTS.categoryFrequency * freqSignal +
        WEIGHTS.listingVolume * volSignal
    );

    const prices = items
      .map((x) => Number(x.price) || Number(x.currentBidPrice))
      .filter((p) => Number.isFinite(p) && p > 0)
      .sort((a, b) => a - b);
    const p25 = prices.length ? percentile(prices, 25) : null;
    const p75 = prices.length ? percentile(prices, 75) : null;
    const med = median(prices);

    const medBid = median(auctions.map((x) => Number(x.bidCount) || 0).filter((x) => Number.isFinite(x)));
    let competitionLevel = 'medium';
    let competitionCopy = 'Some competition — still room to win';
    if (medBid != null) {
      if (n >= 28 && medBid < 1.25) {
        competitionLevel = 'high';
        competitionCopy = 'Crowded lane — stand out on price & photos';
      } else if (medBid >= 2.2 || bidSignal >= 0.55) {
        competitionLevel = 'low';
        competitionCopy = 'Lighter crowd — easier to get seen';
      }
    } else if (n < 10) {
      competitionLevel = 'unknown';
      competitionCopy = 'Still sizing this bucket up — move, but verify comps';
    }

    let buyerActivityCopy = 'Buyers are browsing — earn the click';
    if (bidSignal >= 0.52) buyerActivityCopy = 'Buyers are leaning in — wallets are warm';
    else if (bidSignal >= 0.28) buyerActivityCopy = 'Steady eyeballs — good moment to test a price';

    const postNow = endSignal >= 0.38 || (trendScore >= 56 && bidSignal >= 0.42);
    const postNowCopy = postNow
      ? 'Go live now — buyers are active in this lane'
      : 'Good window coming — line up photos & price tonight';

    const kwLocal = new Map();
    for (const it of items) {
      for (const w of tokenizeTitle(it.title)) {
        kwLocal.set(w, (kwLocal.get(w) || 0) + 1);
      }
    }
    const hotInCategoryKeywords = [...kwLocal.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);

    const sizeIntelligence =
      seedKey === 'sports' || seedKey === 'fashion' ? computeShoeSizeIntelligence(items) : null;

    buckets.push({
      id: seedKey,
      label,
      trendScore,
      components,
      listingCount: n,
      shareOfSample: Math.round((n / total) * 1000) / 1000,
      competitionLevel,
      competitionCopy,
      buyerActivityCopy,
      priceRange:
        p25 != null && p75 != null
          ? {
              min: Math.round(p25 * 100) / 100,
              max: Math.round(p75 * 100) / 100,
              median: med != null ? Math.round(med * 100) / 100 : null,
              currency: items[0]?.currency || 'USD',
              label: 'Typical ask band in this snapshot (live asks, not sold history)',
            }
          : null,
      bestWindowLabel: marketplaceBestWindow.label,
      postNow,
      postNowCopy,
      hotInCategoryKeywords,
      sampleNote: 'Snapshot of what’s listed right now — use it to price and time your play.',
      sizeIntelligence,
    });
  }

  buckets.sort((a, b) => b.trendScore - a.trendScore);

  return {
    buckets,
    hotKeywords,
    marketplaceBestWindow,
    globalStats: {
      totalListingsSampled: total,
      seedsAttempted: SELLER_TREND_SEEDS.length,
      seedsWithApiHits: null,
      distinctMacroBuckets: bySeed.size,
    },
  };
}

/**
 * Weighted 0–10 score: price gap, demand, competition, sell speed, risk, net margin (fee sketch).
 */
function computeFlipScore(L, b, pr, buyRaw, estimatedResell, profitPct) {
  const gapRatio = (pr.min - buyRaw) / Math.max(pr.min * 0.38, 1e-6);
  const gapSub = clamp01(gapRatio);

  const tNorm = clamp01((Number(b.trendScore) || 0) / 100);
  const listingsNorm = clamp01((Number(b.listingCount) || 0) / 45);
  const bidNorm = clamp01((Number(L.bidCount) || 0) / 5);
  const demandSub = clamp01(0.45 * tNorm + 0.35 * listingsNorm + 0.2 * bidNorm);

  let compSub = 0.52;
  const comp = b.competitionLevel;
  if (comp === 'low') compSub = 1;
  else if (comp === 'high') compSub = 0.2;
  else if (comp === 'unknown') compSub = 0.4;

  const end = clamp01((Number(b.components?.endingSoon) || 0) / 22);
  const lv = clamp01((Number(b.components?.listingVolume) || 0) / 16);
  const pd = clamp01((Number(b.components?.priceDemand) || 0) / 22);
  const speedSub = clamp01(0.45 * end + 0.3 * lv + 0.25 * pd);

  const med =
    pr.median != null && Number.isFinite(pr.median) ? pr.median : (pr.min + pr.max) / 2;
  const spreadRatio = med > 0 ? (pr.max - pr.min) / Math.max(med, 1e-6) : 0.55;
  let riskSub = 0.55;
  if (comp === 'low') riskSub += 0.2;
  if (comp === 'high') riskSub -= 0.22;
  riskSub -= clamp01(spreadRatio / 1.35) * 0.28;
  if ((Number(L.bidCount) || 0) >= 1) riskSub += 0.1;
  riskSub = clamp01(riskSub);

  const feeSketch = 0.13;
  const netPct =
    buyRaw > 0
      ? ((estimatedResell * (1 - feeSketch) - buyRaw) / buyRaw) * 100
      : Math.max(0, profitPct * (1 - feeSketch));
  const marginSub = clamp01(Math.max(0, netPct) / 34);

  const raw =
    gapSub * 0.3 +
    demandSub * 0.2 +
    compSub * 0.15 +
    speedSub * 0.15 +
    riskSub * 0.1 +
    marginSub * 0.1;
  let flipScore = Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 100;

  let flipScoreTier = 'avoid';
  if (flipScore >= 8.5) flipScoreTier = 'elite';
  else if (flipScore >= 7.0) flipScoreTier = 'strong';
  else if (flipScore >= 5.0) flipScoreTier = 'risky';

  let flipScoreLabel = 'Avoid';
  if (flipScoreTier === 'elite') flipScoreLabel = 'Elite Flip';
  else if (flipScoreTier === 'strong')
    flipScoreLabel = profitPct >= 22 ? 'Quick Profit' : 'Strong Flip';
  else if (flipScoreTier === 'risky')
    flipScoreLabel = comp === 'high' ? 'High Risk' : 'Slow but Safe';

  const why = [];
  if (gapSub >= 0.52) why.push('wide buy gap');
  if (demandSub >= 0.52) why.push('strong demand');
  if (compSub >= 0.78) why.push('low competition');
  if (speedSub >= 0.52) why.push('fast lane');
  if (marginSub >= 0.52) why.push('solid net margin');
  if (riskSub >= 0.62) why.push('risk in check');
  const flipScoreWhy =
    why.length > 0 ? why.slice(0, 4).join(' + ') : 'mixed lane — double-check comps';

  return { flipScore, flipScoreTier, flipScoreLabel, flipScoreWhy };
}

/**
 * Listings priced below the category p25 band vs same-bucket active asks —
 * heuristic "buy low / resell into the pack" hints (not sold comps).
 */
function computeAutoFlipSuggestions(listings, buckets) {
  const byBucket = new Map(buckets.map((b) => [b.id, b]));
  const out = [];

  for (const L of listings) {
    const id = String(L?.itemId || '').trim();
    if (!id) continue;
    const b = byBucket.get(L.trendSeed);
    const pr = b?.priceRange;
    if (!pr || pr.min == null || pr.max == null) continue;

    const buyRaw = Number(L.price) || Number(L.currentBidPrice) || 0;
    if (!Number.isFinite(buyRaw) || buyRaw <= 0) continue;
    if (buyRaw >= pr.min) continue;

    const med =
      pr.median != null && Number.isFinite(pr.median)
        ? pr.median
        : (pr.min + pr.max) / 2;
    const estimatedResell = Math.round(Math.min(pr.max, Math.max(pr.min, med)) * 100) / 100;
    const profit = Math.round((estimatedResell - buyRaw) * 100) / 100;
    const profitPct = buyRaw > 0 ? Math.round((profit / buyRaw) * 1000) / 10 : 0;
    if (profit < 4 && profitPct < 4) continue;

    let confidence = 'low';
    if (
      profitPct >= 18 &&
      b.competitionLevel !== 'high' &&
      (Number(L.bidCount) || 0) >= 1
    ) {
      confidence = 'high';
    } else if (profitPct >= 9 || (Number(L.bidCount) || 0) >= 2) {
      confidence = 'medium';
    }

    const scorePack = computeFlipScore(L, b, pr, buyRaw, estimatedResell, profitPct);

    out.push({
      itemId: id,
      title: String(L.title || 'Listing').slice(0, 140),
      itemWebUrl: L.itemWebUrl || null,
      currency: pr.currency || L.currency || 'USD',
      categoryId: b.id,
      categoryLabel: b.label,
      buyPrice: Math.round(buyRaw * 100) / 100,
      estimatedResellPrice: estimatedResell,
      profitDollars: profit,
      profitPct,
      confidence,
      competitionLevel: b.competitionLevel,
      competitionCopy: b.competitionCopy,
      bidCount: Number(L.bidCount) || 0,
      ...scorePack,
    });
  }

  out.sort((a, b) => {
    if (b.flipScore !== a.flipScore) return b.flipScore - a.flipScore;
    return b.profitDollars - a.profitDollars;
  });
  return out.slice(0, 96);
}

/**
 * @param {{ timeZone?: string }} [opts]
 */
async function buildEbaySellerTrendsPayload(opts = {}) {
  const timeZone = opts.timeZone || process.env.EBAY_SELLER_TRENDS_TZ || 'America/Los_Angeles';
  const pool = collectUniqueListings();
  let seedsWithResults = 0;
  const errors = [];

  const CONCURRENCY = 3;
  for (let i = 0; i < SELLER_TREND_SEEDS.length; i += CONCURRENCY) {
    const chunk = SELLER_TREND_SEEDS.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((seed) => fetchSeedSummaries(seed)));
    for (let j = 0; j < settled.length; j += 1) {
      const r = settled[j];
      const seed = chunk[j];
      if (r.status === 'fulfilled') {
        if (r.value.summaries.length) seedsWithResults += 1;
        for (const raw of r.value.summaries) {
          pool.add(raw, seed);
        }
      } else {
        const reason = r.reason;
        errors.push({ seed: seed.key, message: String(reason?.message || reason) });
        logEbayProviderError(
          '/ebay/seller-trends/seed',
          reason?.status,
          reason?.code || reason?.message || 'seed_failed'
        );
      }
    }
  }

  const listings = pool.values();
  const total = listings.length;
  const sizes = SELLER_TREND_SEEDS.map((s) => listings.filter((L) => L.trendSeed === s.key).length);
  const maxBucket = Math.max(1, ...sizes, Math.floor(total / 3));

  const scored = scoreAndBucket(listings, { timeZone, maxBucket });
  scored.globalStats.seedsWithApiHits = seedsWithResults;

  const autoFlipSuggestions = computeAutoFlipSuggestions(listings, scored.buckets);

  const weak =
    total < 22 ||
    seedsWithResults < 4 ||
    errors.length > SELLER_TREND_SEEDS.length / 2;

  const signalStrength = weak ? (total < 10 ? 'weak' : 'moderate') : 'strong';

  return {
    success: true,
    disclaimer: DISCLAIMER,
    dataSource: 'ebay_browse_active',
    signalStrength,
    fallbackRecommended: weak,
    fetchedAt: new Date().toISOString(),
    timeZone,
    hotCategories: scored.buckets,
    hotKeywords: scored.hotKeywords,
    marketplaceBestWindow: scored.marketplaceBestWindow,
    autoFlipSuggestions,
    globalStats: {
      ...scored.globalStats,
      errors: errors.length ? errors.slice(0, 5) : undefined,
    },
  };
}

async function safeBuildEbaySellerTrendsPayload(opts = {}) {
  try {
    return await buildEbaySellerTrendsPayload(opts);
  } catch (e) {
    logEbayProviderError('/ebay/seller-trends', e?.status, e?.code || e?.message);
    return {
      success: false,
      disclaimer: DISCLAIMER,
      dataSource: 'ebay_browse_active',
      signalStrength: 'weak',
      fallbackRecommended: true,
      fetchedAt: new Date().toISOString(),
      errorCode: 'ebay_seller_trends_unavailable',
      message: String(e?.message || 'Unable to load eBay seller trends'),
      hotCategories: [],
      hotKeywords: [],
      marketplaceBestWindow: null,
      autoFlipSuggestions: [],
      globalStats: {
        totalListingsSampled: 0,
        seedsWithApiHits: 0,
        distinctMacroBuckets: 0,
        seedsAttempted: SELLER_TREND_SEEDS.length,
      },
    };
  }
}

module.exports = {
  buildEbaySellerTrendsPayload,
  safeBuildEbaySellerTrendsPayload,
  SELLER_TREND_SEEDS,
  DISCLAIMER,
};
