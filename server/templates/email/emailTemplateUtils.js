/**
 * Shared helpers for Final10 HTML email templates (email-client safe).
 */

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
  return String(process.env.EMAIL_ASSETS_BASE_URL || getClientBaseUrl()).replace(/\/$/, '');
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

module.exports = {
  escapeHtml,
  pick,
  pickNumber,
  formatMoney,
  formatPercent,
  formatSavvy,
  getClientBaseUrl,
  getEmailAssetsBaseUrl,
  savvyScoutHeroImageUrl,
  final10LogoImageUrl,
};
