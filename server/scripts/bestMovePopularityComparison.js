#!/usr/bin/env node
/**
 * BEFORE vs AFTER Best Move popularity ranking comparison.
 * Uses representative fixture listings — no fabricated marketplace demand beyond bidCount.
 *
 * Usage: node scripts/bestMovePopularityComparison.js
 */
const fs = require('fs');
const path = require('path');
const {
  computePopularityScore,
  computePopularityBoost,
  applyDiversityRanking,
} = require('../lib/listingRanking/popularityScoreEngine');
const { listBestMoveInterestCategories } = require('../lib/listingRanking/categoryInterestProfiles');

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Legacy instant score (pre-popularity). */
function legacyInstantScore({ trustScore, savingsPct, dealScore, urgencyScore }) {
  const normalizedSavings = clamp(savingsPct * 1.5, 0, 100);
  return (
    trustScore * 0.58 +
    normalizedSavings * 0.18 +
    dealScore * 0.14 +
    urgencyScore * 0.1
  );
}

/** New instant score with popularity boost. */
function newInstantScore(listing, category, meta) {
  const popularity = computePopularityScore(listing, category);
  const boost = computePopularityBoost(popularity.score, {
    dealScore: meta.dealScore,
    savingsPct: meta.savingsPct,
  });
  return (
    legacyInstantScore(meta) +
    boost
  );
}

const FIXTURES = {
  gaming: [
    { title: 'Sony PlayStation 5 Disc Console — CFI-1215', bidCount: 5, trustScore: 78, dealScore: 72, savingsPct: 12, urgencyScore: 55 },
    { title: 'Xbox Series X 1TB Console Black', bidCount: 3, trustScore: 76, dealScore: 70, savingsPct: 10, urgencyScore: 50 },
    { title: 'NVIDIA GeForce RTX 4070 Graphics Card', bidCount: 4, trustScore: 74, dealScore: 68, savingsPct: 11, urgencyScore: 45 },
    { title: 'USB-C charging cable for PS5 controller only', bidCount: 1, trustScore: 70, dealScore: 66, savingsPct: 15, urgencyScore: 40 },
    { title: 'Arcade fight stick replacement part', bidCount: 0, trustScore: 68, dealScore: 64, savingsPct: 14, urgencyScore: 35 },
    { title: 'Logitech G Pro X Wireless Gaming Headset', bidCount: 2, trustScore: 77, dealScore: 71, savingsPct: 9, urgencyScore: 48 },
    { title: 'Generic gaming mouse pad large', bidCount: 1, trustScore: 65, dealScore: 60, savingsPct: 8, urgencyScore: 30 },
    { title: 'Nintendo Switch OLED White Console', bidCount: 6, trustScore: 79, dealScore: 73, savingsPct: 13, urgencyScore: 52 },
    { title: 'PS5 DualSense controller skin decal only', bidCount: 0, trustScore: 62, dealScore: 58, savingsPct: 20, urgencyScore: 25 },
    { title: '27 inch 144Hz gaming monitor IPS', bidCount: 2, trustScore: 72, dealScore: 67, savingsPct: 10, urgencyScore: 42 },
    { title: 'Sony PlayStation 5 Digital Edition Console', bidCount: 4, trustScore: 75, dealScore: 69, savingsPct: 11, urgencyScore: 50 },
    { title: 'Random PC component lot untested', bidCount: 1, trustScore: 55, dealScore: 52, savingsPct: 25, urgencyScore: 20 },
  ],
  electronics: [
    { title: 'Apple iPhone 15 Pro 256GB Unlocked', bidCount: 8, trustScore: 80, dealScore: 74, savingsPct: 14, urgencyScore: 60 },
    { title: 'Apple AirPods Pro 2nd Generation', bidCount: 5, trustScore: 78, dealScore: 72, savingsPct: 12, urgencyScore: 55 },
    { title: 'Samsung Galaxy S24 Ultra 512GB', bidCount: 4, trustScore: 77, dealScore: 70, savingsPct: 11, urgencyScore: 50 },
    { title: 'MacBook Pro 14 M3 512GB Space Gray', bidCount: 3, trustScore: 79, dealScore: 71, savingsPct: 10, urgencyScore: 48 },
    { title: 'USB adapter cable pack assorted', bidCount: 1, trustScore: 66, dealScore: 62, savingsPct: 18, urgencyScore: 30 },
    { title: 'Refurbished unknown brand tablet 10 inch', bidCount: 0, trustScore: 58, dealScore: 55, savingsPct: 22, urgencyScore: 25 },
    { title: 'Apple Watch Series 9 GPS 45mm', bidCount: 4, trustScore: 76, dealScore: 69, savingsPct: 9, urgencyScore: 45 },
    { title: 'Sony WH-1000XM5 Headphones Black', bidCount: 3, trustScore: 75, dealScore: 68, savingsPct: 10, urgencyScore: 42 },
    { title: 'Dell XPS 15 Laptop i7 16GB', bidCount: 2, trustScore: 73, dealScore: 67, savingsPct: 11, urgencyScore: 40 },
    { title: 'HDMI cable 6ft new', bidCount: 0, trustScore: 60, dealScore: 56, savingsPct: 5, urgencyScore: 20 },
    { title: 'iPad Air 5th Gen 64GB WiFi', bidCount: 5, trustScore: 77, dealScore: 70, savingsPct: 12, urgencyScore: 48 },
    { title: 'LG 55 inch 4K Smart TV', bidCount: 3, trustScore: 74, dealScore: 66, savingsPct: 13, urgencyScore: 44 },
  ],
  sneakers: [
    { title: 'Nike Air Jordan 1 Retro High OG Chicago', bidCount: 9, trustScore: 78, dealScore: 72, savingsPct: 12, urgencyScore: 58 },
    { title: 'Nike Dunk Low Panda White Black', bidCount: 6, trustScore: 76, dealScore: 70, savingsPct: 11, urgencyScore: 52 },
    { title: 'Adidas Yeezy Boost 350 V2', bidCount: 5, trustScore: 75, dealScore: 68, savingsPct: 10, urgencyScore: 50 },
    { title: 'New Balance 550 White Green', bidCount: 4, trustScore: 74, dealScore: 67, savingsPct: 9, urgencyScore: 48 },
    { title: 'Generic running shoes mens size 10', bidCount: 1, trustScore: 62, dealScore: 58, savingsPct: 20, urgencyScore: 30 },
    { title: 'Shoe laces replacement pack white', bidCount: 0, trustScore: 55, dealScore: 50, savingsPct: 15, urgencyScore: 15 },
    { title: 'Nike Air Max 90 Infrared', bidCount: 3, trustScore: 73, dealScore: 66, savingsPct: 8, urgencyScore: 45 },
    { title: 'Air Jordan 4 Military Black', bidCount: 7, trustScore: 77, dealScore: 71, savingsPct: 11, urgencyScore: 55 },
    { title: 'Used gym sneakers no brand', bidCount: 0, trustScore: 50, dealScore: 48, savingsPct: 30, urgencyScore: 20 },
    { title: 'Nike Tech Fleece Joggers Grey', bidCount: 2, trustScore: 70, dealScore: 64, savingsPct: 7, urgencyScore: 40 },
  ],
  fashion: [
    { title: 'North Face Nuptse 700 Puffer Jacket Black', bidCount: 4, trustScore: 76, dealScore: 70, savingsPct: 11, urgencyScore: 48 },
    { title: 'Patagonia Better Sweater Fleece', bidCount: 3, trustScore: 75, dealScore: 68, savingsPct: 10, urgencyScore: 45 },
    { title: 'Levis 501 Original Fit Jeans', bidCount: 2, trustScore: 72, dealScore: 65, savingsPct: 9, urgencyScore: 40 },
    { title: 'Gucci GG Marmont Matelasse Bag', bidCount: 5, trustScore: 74, dealScore: 67, savingsPct: 8, urgencyScore: 50 },
    { title: 'Random t-shirt bundle lot', bidCount: 0, trustScore: 55, dealScore: 52, savingsPct: 25, urgencyScore: 20 },
    { title: 'Carhartt WIP Active Jacket', bidCount: 2, trustScore: 73, dealScore: 66, savingsPct: 10, urgencyScore: 42 },
    { title: 'Lululemon Align Leggings Size 6', bidCount: 3, trustScore: 74, dealScore: 67, savingsPct: 9, urgencyScore: 44 },
    { title: 'Vintage unknown brand coat', bidCount: 1, trustScore: 58, dealScore: 54, savingsPct: 18, urgencyScore: 28 },
    { title: 'Supreme Box Logo Hoodie FW23', bidCount: 6, trustScore: 72, dealScore: 64, savingsPct: 7, urgencyScore: 52 },
    { title: 'Coach Tabby Shoulder Bag', bidCount: 3, trustScore: 73, dealScore: 65, savingsPct: 8, urgencyScore: 43 },
  ],
  collectibles: [
    { title: 'Pokemon Scarlet Violet Booster Box Sealed', bidCount: 7, trustScore: 78, dealScore: 72, savingsPct: 12, urgencyScore: 55 },
    { title: 'PSA 10 Charizard Base Set Holo', bidCount: 5, trustScore: 76, dealScore: 70, savingsPct: 10, urgencyScore: 50 },
    { title: 'Funko Pop Chase Edition Marvel', bidCount: 3, trustScore: 72, dealScore: 65, savingsPct: 9, urgencyScore: 42 },
    { title: 'Magic The Gathering Commander Deck', bidCount: 2, trustScore: 70, dealScore: 64, savingsPct: 8, urgencyScore: 38 },
    { title: 'Random trading card lot 100 cards', bidCount: 1, trustScore: 58, dealScore: 55, savingsPct: 22, urgencyScore: 25 },
    { title: 'Topps Chrome Baseball Hobby Box', bidCount: 4, trustScore: 74, dealScore: 68, savingsPct: 11, urgencyScore: 45 },
    { title: 'Star Wars Black Series Figure Lot', bidCount: 2, trustScore: 71, dealScore: 63, savingsPct: 7, urgencyScore: 36 },
    { title: 'Empty booster pack wrapper only', bidCount: 0, trustScore: 50, dealScore: 45, savingsPct: 30, urgencyScore: 10 },
    { title: 'Pokemon Elite Trainer Box ETB', bidCount: 5, trustScore: 75, dealScore: 69, savingsPct: 10, urgencyScore: 48 },
    { title: 'LEGO Star Wars UCS Set', bidCount: 3, trustScore: 73, dealScore: 66, savingsPct: 9, urgencyScore: 40 },
  ],
  home: [
    { title: 'Secretlab Titan Evo Gaming Chair', bidCount: 3, trustScore: 75, dealScore: 69, savingsPct: 10, urgencyScore: 45 },
    { title: 'Dyson V15 Detect Cordless Vacuum', bidCount: 4, trustScore: 76, dealScore: 70, savingsPct: 11, urgencyScore: 48 },
    { title: 'iRobot Roomba j7+ Self Emptying', bidCount: 3, trustScore: 74, dealScore: 68, savingsPct: 9, urgencyScore: 42 },
    { title: 'Honeywell HEPA Air Purifier Large Room', bidCount: 2, trustScore: 72, dealScore: 65, savingsPct: 8, urgencyScore: 38 },
    { title: 'Generic desk lamp LED', bidCount: 0, trustScore: 58, dealScore: 54, savingsPct: 20, urgencyScore: 22 },
    { title: 'Herman Miller Aeron Chair Size B', bidCount: 2, trustScore: 77, dealScore: 71, savingsPct: 12, urgencyScore: 44 },
    { title: 'Nest Learning Thermostat 3rd Gen', bidCount: 2, trustScore: 73, dealScore: 66, savingsPct: 9, urgencyScore: 40 },
    { title: 'Random home decor bundle', bidCount: 0, trustScore: 52, dealScore: 48, savingsPct: 25, urgencyScore: 18 },
    { title: 'KitchenAid Stand Mixer 5 Quart', bidCount: 3, trustScore: 74, dealScore: 67, savingsPct: 10, urgencyScore: 41 },
    { title: 'Standing Desk Electric Adjustable 55 inch', bidCount: 2, trustScore: 71, dealScore: 64, savingsPct: 8, urgencyScore: 36 },
  ],
  auto: [
    { title: 'OBD2 Scanner Bluetooth Diagnostic Tool', bidCount: 4, trustScore: 74, dealScore: 68, savingsPct: 11, urgencyScore: 45 },
    { title: 'Milwaukee M18 Impact Wrench Kit', bidCount: 3, trustScore: 75, dealScore: 69, savingsPct: 10, urgencyScore: 42 },
    { title: '3 Ton Floor Jack Quick Lift', bidCount: 2, trustScore: 72, dealScore: 65, savingsPct: 9, urgencyScore: 38 },
    { title: 'BMW Performance Exhaust M340i', bidCount: 2, trustScore: 73, dealScore: 66, savingsPct: 8, urgencyScore: 40 },
    { title: 'Random socket adapter piece', bidCount: 0, trustScore: 55, dealScore: 50, savingsPct: 18, urgencyScore: 20 },
    { title: 'Porsche OEM Wheel Center Cap Set', bidCount: 1, trustScore: 70, dealScore: 62, savingsPct: 7, urgencyScore: 35 },
    { title: 'Ford F-150 Bed Liner Drop In', bidCount: 1, trustScore: 68, dealScore: 60, savingsPct: 12, urgencyScore: 32 },
    { title: 'Dash cam 1080p front rear', bidCount: 2, trustScore: 69, dealScore: 63, savingsPct: 9, urgencyScore: 34 },
    { title: 'Toyota OEM Brake Pad Set', bidCount: 2, trustScore: 71, dealScore: 64, savingsPct: 8, urgencyScore: 36 },
    { title: 'Mercedes-Benz Key Fob Replacement', bidCount: 3, trustScore: 72, dealScore: 65, savingsPct: 10, urgencyScore: 38 },
  ],
  luxury: [
    { title: 'Rolex Submariner Date 126610LN', bidCount: 6, trustScore: 78, dealScore: 72, savingsPct: 10, urgencyScore: 55 },
    { title: 'Omega Seamaster Professional 300M', bidCount: 4, trustScore: 76, dealScore: 70, savingsPct: 9, urgencyScore: 48 },
    { title: 'Louis Vuitton Neverfull MM Bag', bidCount: 5, trustScore: 75, dealScore: 68, savingsPct: 8, urgencyScore: 50 },
    { title: 'Gucci Ace Sneaker White Red Stripe', bidCount: 3, trustScore: 73, dealScore: 66, savingsPct: 7, urgencyScore: 42 },
    { title: 'Generic gold tone bracelet', bidCount: 0, trustScore: 52, dealScore: 48, savingsPct: 30, urgencyScore: 15 },
    { title: 'Cartier Love Bracelet 18K', bidCount: 4, trustScore: 74, dealScore: 67, savingsPct: 8, urgencyScore: 45 },
    { title: 'Tag Heuer Carrera Calibre 5', bidCount: 2, trustScore: 72, dealScore: 64, savingsPct: 7, urgencyScore: 38 },
    { title: 'Chanel Classic Flap Medium', bidCount: 3, trustScore: 73, dealScore: 65, savingsPct: 6, urgencyScore: 44 },
    { title: 'Fashion watch unbranded', bidCount: 0, trustScore: 50, dealScore: 46, savingsPct: 35, urgencyScore: 12 },
    { title: 'Tiffany & Co. Silver Bracelet', bidCount: 2, trustScore: 71, dealScore: 63, savingsPct: 8, urgencyScore: 36 },
  ],
};

function rankCategory(category, fixtures) {
  const before = fixtures
    .map((f) => {
      const listing = { title: f.title, bidCount: f.bidCount };
      const meta = {
        trustScore: f.trustScore,
        savingsPct: f.savingsPct,
        dealScore: f.dealScore,
        urgencyScore: f.urgencyScore,
      };
      return {
        title: f.title,
        score: legacyInstantScore(meta),
        listing,
        meta,
      };
    })
    .sort((a, b) => b.score - a.score);

  const afterRaw = fixtures
    .map((f) => {
      const listing = { title: f.title, bidCount: f.bidCount };
      const meta = {
        trustScore: f.trustScore,
        savingsPct: f.savingsPct,
        dealScore: f.dealScore,
        urgencyScore: f.urgencyScore,
      };
      const popularity = computePopularityScore(listing, category);
      const boost = computePopularityBoost(popularity.score, {
        dealScore: f.dealScore,
        savingsPct: f.savingsPct,
      });
      return {
        title: f.title,
        score: newInstantScore(listing, category, meta),
        listing,
        meta,
        popularity,
        boost,
        category,
        rankScore: newInstantScore(listing, category, meta),
      };
    })
    .sort((a, b) => b.score - a.score);

  const after = applyDiversityRanking(afterRaw, {
    scoreKey: 'rankScore',
    categoryKey: 'category',
    limit: 10,
  });

  return { before: before.slice(0, 10), after: after.slice(0, 10) };
}

function explainMovement(beforeIdx, afterIdx, row, category) {
  const signals = [];
  if (row.popularity?.signals?.profileMatch?.matchedBrand) {
    signals.push(`brand match (${row.popularity.signals.profileMatch.matchedBrand}) [inferred]`);
  }
  if (row.popularity?.signals?.profileMatch?.matchedFamily) {
    signals.push(`product family (${row.popularity.signals.profileMatch.matchedFamily}) [inferred]`);
  }
  if (row.popularity?.signals?.marketplaceActivity?.bidCount > 0) {
    signals.push(`bid activity (${row.popularity.signals.marketplaceActivity.bidCount} bids) [observed]`);
  }
  if (row.boost > 0) {
    signals.push(`popularity boost +${row.boost.toFixed(1)}`);
  }
  if (row.popularity?.signals?.profileMatch?.lowInterest) {
    signals.push('low-interest accessory penalty');
  }
  if (afterIdx < beforeIdx) {
    signals.push('diversity/variation reorder');
  }
  return signals.length ? signals.join('; ') : 'deal/trust composite unchanged';
}

function buildReport() {
  const categories = listBestMoveInterestCategories();
  const lines = [
    '# Best Move Popularity Ranking — BEFORE vs AFTER',
    '',
    'Generated from representative fixture listings. Marketplace bid counts are **observed** proxies; brand/family matches are **inferred** from configurable category profiles.',
    '',
    'Ranking priority: popularity/relevance → deal quality floor → trust/evidence (unchanged upstream).',
    '',
  ];

  categories.forEach((category) => {
    const fixtures = FIXTURES[category] || [];
    const { before, after } = rankCategory(category, fixtures);
    lines.push(`## ${category.toUpperCase()}`);
    lines.push('');
    lines.push('### BEFORE (legacy ranking)');
    lines.push('');
    before.forEach((row, i) => {
      lines.push(`${i + 1}. **${row.title}** — score ${row.score.toFixed(1)}`);
    });
    lines.push('');
    lines.push('### AFTER (popularity-aware + diversity)');
    lines.push('');
    after.forEach((row, i) => {
      const beforeIdx = before.findIndex((b) => b.title === row.title);
      const moved = beforeIdx >= 0 && beforeIdx !== i ? ` (↑ from #${beforeIdx + 1})` : '';
      const dropped = beforeIdx === -1 ? ' (new)' : '';
      lines.push(`${i + 1}. **${row.title}** — score ${row.score.toFixed(1)} (pop ${row.popularity.score})${moved}${dropped}`);
      if (beforeIdx !== i) {
        lines.push(`   - Signal: ${explainMovement(beforeIdx, i, row, category)}`);
      }
    });
    lines.push('');
  });

  return lines.join('\n');
}

function main() {
  const report = buildReport();
  const outPath = path.resolve(__dirname, '../../docs/best-move-popularity-comparison.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`[BEST_MOVE_COMPARISON] ${outPath}`);
  // eslint-disable-next-line no-console
  console.log('\n' + report);
}

main();
