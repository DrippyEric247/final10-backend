#!/usr/bin/env node
/**
 * Generate branded Savvy Watch Live QR PNG assets for Streamlabs.
 *
 * Usage:
 *   node scripts/generateSavvyWatchLiveQr.js [event-slug]
 *
 * Outputs:
 *   client/public/savvy-watch-live-qr.png
 *   client/public/savvy-watch-live-qr-transparent.png
 */
const fs = require('fs');
const path = require('path');
const { renderSavvyWatchLiveQrPng, buildSavvyWatchJoinUrlForSlug } = require('../services/savvyWatchQrAssetService');

async function main() {
  const slug = process.argv[2] || 'gta-car-meet-001';
  const joinUrl = buildSavvyWatchJoinUrlForSlug(slug);
  const outDir = path.resolve(__dirname, '../../client/public');
  const darkPath = path.join(outDir, 'savvy-watch-live-qr.png');
  const transparentPath = path.join(outDir, 'savvy-watch-live-qr-transparent.png');

  fs.mkdirSync(outDir, { recursive: true });

  const [darkPng, transparentPng] = await Promise.all([
    renderSavvyWatchLiveQrPng(slug, { transparent: false }),
    renderSavvyWatchLiveQrPng(slug, { transparent: true }),
  ]);

  fs.writeFileSync(darkPath, darkPng);
  fs.writeFileSync(transparentPath, transparentPng);

  // eslint-disable-next-line no-console
  console.log('[SAVVY_WATCH_QR] Generated assets');
  // eslint-disable-next-line no-console
  console.log(`  Join URL: ${joinUrl}`);
  // eslint-disable-next-line no-console
  console.log(`  Dark PNG: ${darkPath}`);
  // eslint-disable-next-line no-console
  console.log(`  Transparent PNG: ${transparentPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[SAVVY_WATCH_QR] Failed:', err);
  process.exit(1);
});
