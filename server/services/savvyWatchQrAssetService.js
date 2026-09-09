/**
 * Branded Savvy Watch Live QR PNG generation for Streamlabs overlays.
 */
const QRCode = require('qrcode');
const sharp = require('sharp');
const { buildSavvyWatchJoinUrl, LIVE_WELCOME_BONUS_AMOUNT } = require('../config/savvyWatchConfig');

const CANVAS_SIZE = 1500;
const QR_SIZE = 760;
const QR_TOP = 400;

function buildBrandedSvg({ qrDataUrl, transparent = false }) {
  const bg = transparent ? 'none' : '#0a0612';
  const card = transparent ? 'none' : '#12081f';
  const gold = '#d4af37';
  const purple = '#7c3aed';
  const white = '#f8f4ff';
  const qrBox = QR_SIZE + 72;
  const qrLeft = (CANVAS_SIZE - qrBox) / 2;
  const qrImageLeft = (CANVAS_SIZE - QR_SIZE) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <defs>
    <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gold}" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="${purple}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${gold}" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${gold}"/>
      <stop offset="100%" stop-color="#f5e6a8"/>
    </linearGradient>
  </defs>
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${bg}"/>
  <rect x="36" y="36" width="${CANVAS_SIZE - 72}" height="${CANVAS_SIZE - 72}" rx="42" fill="${card}" stroke="url(#frameGrad)" stroke-width="8"/>
  <text x="750" y="118" text-anchor="middle" fill="url(#titleGrad)" font-family="Arial Black, Arial, sans-serif" font-size="82" font-weight="900" letter-spacing="1">SCAN TO JOIN</text>
  <text x="750" y="200" text-anchor="middle" fill="url(#titleGrad)" font-family="Arial Black, Arial, sans-serif" font-size="82" font-weight="900" letter-spacing="1">SAVVY WATCH</text>
  <text x="750" y="292" text-anchor="middle" fill="${gold}" font-family="Arial Black, Arial, sans-serif" font-size="72" font-weight="900">JOIN + GET ${LIVE_WELCOME_BONUS_AMOUNT} SAVVY</text>
  <text x="750" y="362" text-anchor="middle" fill="${white}" font-family="Arial Black, Arial, sans-serif" font-size="52" font-weight="800" letter-spacing="2">VOTE • PREDICT • JOIN LIVE</text>
  <rect x="${qrLeft}" y="${QR_TOP - 20}" width="${qrBox}" height="${qrBox}" rx="24" fill="#ffffff" stroke="${gold}" stroke-width="6"/>
  <image href="${qrDataUrl}" x="${qrImageLeft}" y="${QR_TOP}" width="${QR_SIZE}" height="${QR_SIZE}" preserveAspectRatio="xMidYMid meet"/>
  <text x="750" y="1378" text-anchor="middle" fill="url(#titleGrad)" font-family="Arial Black, Arial, sans-serif" font-size="72" font-weight="900">Powered by Final10</text>
</svg>`;
}

async function renderSavvyWatchLiveQrPng(slug, { transparent = false } = {}) {
  const joinUrl = buildSavvyWatchJoinUrl(slug, { useSourceParam: true });
  const qrBuffer = await QRCode.toBuffer(joinUrl, {
    type: 'png',
    errorCorrectionLevel: 'H',
    margin: 4,
    width: QR_SIZE,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  const qrDataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
  const svg = buildBrandedSvg({ qrDataUrl, transparent });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
  CANVAS_SIZE,
  renderSavvyWatchLiveQrPng,
  buildSavvyWatchJoinUrlForSlug: (slug) => buildSavvyWatchJoinUrl(slug, { useSourceParam: true }),
};
