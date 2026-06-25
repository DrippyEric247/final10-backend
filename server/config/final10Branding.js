/** Official Final10 + Savvy Universe slogan — do not modify or abbreviate. */
const FINAL10_OFFICIAL_SLOGAN =
  'Stay Savvy. Stay Smart. The best deals from the start.';

/** Official production domains. User-facing links → app; API requests → api. */
const FINAL10_APP_URL = 'https://final10.app';
const FINAL10_API_URL = 'https://api.final10.app';

/**
 * Hosts that must never appear in user-facing links/emails (deploy/preview
 * infrastructure). If any of these resolve, fall back to the official app URL.
 */
const NON_PUBLIC_LINK_HOSTS = Object.freeze([
  'vercel.app',
  'onrender.com',
  'up.railway.app',
  'railway.app',
  'herokuapp.com',
]);

/** True when a URL points at deploy/preview infra rather than the public site. */
function isNonPublicLinkUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return true;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true;
  return NON_PUBLIC_LINK_HOSTS.some((bad) => host === bad || host.endsWith(`.${bad}`));
}

const SAVVY_UNIVERSE_LABEL = 'Savvy Universe';

const FINAL10_TAGLINE = 'We Hunt. You Win.';

/** Social links for email footers and branded closings. */
const FINAL10_EMAIL_SOCIALS = Object.freeze([
  { id: 'discord', label: 'Discord', icon: '💬', url: 'https://discord.gg/savvyuniverse' },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📷',
    url: 'https://www.instagram.com/final10_app?igsh=NXZsbDFxa2FmYzkz&utm_source=qr',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    url: 'https://www.tiktok.com/@final10app?_r=1&_t=ZP-95l2wOte0h5',
  },
  { id: 'x', label: 'X', icon: '𝕏', url: 'https://x.com/final10app?s=21' },
  { id: 'youtube', label: 'YouTube', icon: '▶', url: 'https://www.youtube.com/@final10app' },
]);

module.exports = {
  FINAL10_OFFICIAL_SLOGAN,
  FINAL10_APP_URL,
  FINAL10_API_URL,
  NON_PUBLIC_LINK_HOSTS,
  isNonPublicLinkUrl,
  SAVVY_UNIVERSE_LABEL,
  FINAL10_TAGLINE,
  FINAL10_EMAIL_SOCIALS,
};
