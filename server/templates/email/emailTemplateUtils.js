const { FINAL10_OFFICIAL_SLOGAN } = require('../../config/final10Branding');

function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pick(raw, fallback = '—') {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  return s || fallback;
}

function pickNumber(raw, fallback = null) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(raw, fallback = '—') {
  const n = pickNumber(raw);
  if (n == null) return fallback;
  return `$${n.toFixed(2)}`;
}

function formatPercent(raw, fallback = '—') {
  const n = pickNumber(raw);
  if (n == null) return fallback;
  return `${Math.round(n)}%`;
}

function formatSavvy(raw, fallback = '0') {
  const n = pickNumber(raw);
  if (n == null) return fallback;
  return Math.round(n).toLocaleString('en-US');
}

function getClientBaseUrl() {
  return String(process.env.CLIENT_URL || process.env.PUBLIC_APP_URL || 'https://final10.app').replace(/\/$/, '');
}

function getEmailAssetsBaseUrl() {
  const explicit = String(process.env.EMAIL_ASSETS_BASE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const client = getClientBaseUrl();
  // Prefer known deployed frontend when custom domain is not serving static assets yet.
  if (!client || client.includes('localhost') || client === 'https://final10.app') {
    return 'https://final10-backend-jo1t.vercel.app';
  }
  return client.replace(/\/$/, '');
}

function emailProductFallbackImageUrl() {
  const override = String(process.env.EMAIL_PRODUCT_FALLBACK_URL || '').trim();
  if (override) return normalizePublicHttpsUrl(override);
  return `${getEmailAssetsBaseUrl()}/assets/email/savvy-scout-hero.png`;
}

/**
 * Force https and fix protocol-relative URLs for email clients (Gmail requires https).
 */
function normalizePublicHttpsUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
  return url;
}

/**
 * Upgrade eBay thumbnail URLs to a larger public size (better for email + fewer broken thumbs).
 */
function upgradeEbayImageUrl(raw) {
  let url = normalizePublicHttpsUrl(raw);
  if (!url) return '';
  if (!/ebayimg\.com/i.test(url)) return url;
  url = url.replace(/\/thumbs\//i, '/images/');
  url = url.replace(/\/s-l\d+\./gi, '/s-l500.');
  return url;
}

function isPublicHttpsImageUrl(raw) {
  const url = normalizePublicHttpsUrl(raw);
  if (!url) return false;
  if (!/^https:\/\//i.test(url)) return false;
  if (url.startsWith('https://localhost') || url.startsWith('https://127.')) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:')) return false;
  if (lower.includes('placeholder')) return false;
  if (/\/fallback\.png(?:\?|$)/i.test(lower)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) return false;
  } catch {
    return false;
  }
  return true;
}

/**
 * Resolve product image for HTML email — always https; invalid/missing → Final10 fallback.
 */
function resolveEmailProductImageUrl(raw) {
  const upgraded = upgradeEbayImageUrl(raw);
  if (isPublicHttpsImageUrl(upgraded)) return upgraded;
  return emailProductFallbackImageUrl();
}

/**
 * Optional HEAD check so broken remote URLs are swapped before send (Gmail cannot use onerror).
 */
async function ensureAccessibleEmailProductImageUrl(raw, { timeoutMs = 4000 } = {}) {
  const resolved = resolveEmailProductImageUrl(raw);
  const fallback = emailProductFallbackImageUrl();
  if (resolved === fallback) {
    return { url: resolved, usedFallback: true, source: raw || null };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(resolved, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Final10-Email/1.0' },
    });
    clearTimeout(timer);
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && contentType.startsWith('image/')) {
      return { url: resolved, usedFallback: false, source: raw || null };
    }
  } catch {
    // fall through to fallback
  }

  return { url: fallback, usedFallback: true, source: raw || null };
}

function savvyScoutHeroImageUrl() {
  const override = String(process.env.EMAIL_SAVVY_SCOUT_HERO_URL || '').trim();
  if (override) return override;
  return `${getEmailAssetsBaseUrl()}/assets/email/savvy-scout-hero.png`;
}

function final10LogoImageUrl() {
  const override = String(process.env.EMAIL_FINAL10_LOGO_URL || '').trim();
  if (override) return override;
  return `${getEmailAssetsBaseUrl()}/assets/final10-logo.png`;
}

function emailBrandingFooterHtml({ mutedColor = '#6b7280', marginTop = 12, prominent = false } = {}) {
  if (prominent) {
    return `<div style="margin-top:${marginTop}px;padding:14px 12px;border-top:1px solid #1f3d2e;border-bottom:1px solid #1f3d2e;text-align:center;">
      <div style="font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;color:#4ade80;line-height:1.6;">${escapeHtml(FINAL10_OFFICIAL_SLOGAN)}</div>
    </div>`;
  }
  return `<div style="margin-top:${marginTop}px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${mutedColor};font-style:italic;line-height:1.55;text-align:center;">${escapeHtml(FINAL10_OFFICIAL_SLOGAN)}</div>`;
}

function monthlyReportHeroImageUrl() {
  const override = String(process.env.EMAIL_MONTHLY_REPORT_HERO_URL || '').trim();
  if (override) return override;
  return savvyScoutHeroImageUrl();
}

function emailBrandingFooterText() {
  return FINAL10_OFFICIAL_SLOGAN;
}

module.exports = {
  escapeHtml,
  pick,
  pickNumber,
  formatMoney,
  formatPercent,
  formatSavvy,
  getClientBaseUrl,
  getEmailAssetsBaseUrl,
  normalizePublicHttpsUrl,
  upgradeEbayImageUrl,
  isPublicHttpsImageUrl,
  resolveEmailProductImageUrl,
  ensureAccessibleEmailProductImageUrl,
  emailProductFallbackImageUrl,
  savvyScoutHeroImageUrl,
  final10LogoImageUrl,
  emailBrandingFooterHtml,
  emailBrandingFooterText,
  monthlyReportHeroImageUrl,
};
