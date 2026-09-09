#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

async function main() {
  const htmlPath = path.resolve(__dirname, '../../client/public/savvy-watch-starting-soon-preview.html');
  const outPath = path.resolve(__dirname, '../../client/public/savvy-watch-starting-soon-preview.png');
  const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  // eslint-disable-next-line no-console
  console.log(`[SAVVY_WATCH_PREVIEW] ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
