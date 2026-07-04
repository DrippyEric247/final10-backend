/**
 * Express CORS — beta launch safe defaults for final10.app + Vercel previews + localhost.
 *
 * Env:
 *   CLIENT_URL / FRONTEND_URL — single origin (+ www/apex variants)
 *   ALLOWED_ORIGINS / CORS_ORIGINS — comma-separated extra origins
 *   CORS_CREDENTIALS=true — only when the client sends cookies (default: false; JWT Bearer auth)
 */
const cors = require('cors');

const DEFAULT_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://final10.app',
  'https://www.final10.app',
]);

const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
  'X-Owner-Grant-Secret',
];

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function expandWwwApexVariants(origin) {
  const out = new Set();
  const value = normalizeOrigin(origin);
  if (!value) return out;
  out.add(value);
  try {
    const url = new URL(value);
    if (url.hostname.startsWith('www.')) {
      out.add(`${url.protocol}//${url.hostname.slice(4)}${url.port ? `:${url.port}` : ''}`);
    } else if (!url.hostname.includes('localhost') && url.hostname.split('.').length >= 2) {
      out.add(`${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ''}`);
    }
  } catch {
    // ignore invalid URLs
  }
  return out;
}

function parseEnvOriginList() {
  const out = [];
  for (const key of ['ALLOWED_ORIGINS', 'CORS_ORIGINS']) {
    const raw = String(process.env[key] || '').trim();
    if (!raw) continue;
    raw
      .split(',')
      .map((s) => normalizeOrigin(s))
      .filter(Boolean)
      .forEach((o) => out.push(o));
  }
  for (const key of ['FRONTEND_URL', 'CLIENT_URL', 'REACT_APP_CLIENT_URL', 'CORS_ORIGIN']) {
    const value = normalizeOrigin(process.env[key]);
    if (value) out.push(value);
  }
  return out;
}

function buildAllowedOrigins() {
  const allowed = new Set(DEFAULT_ORIGINS);
  for (const origin of parseEnvOriginList()) {
    expandWwwApexVariants(origin).forEach((variant) => allowed.add(variant));
  }
  return allowed;
}

function isLocalDevOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeOrigin(origin));
}

/** Beta-safe: any Vercel deployment (*.vercel.app), including preview branches. */
function isVercelAppOrigin(origin) {
  const o = normalizeOrigin(origin);
  return /^https:\/\/[a-z0-9][a-z0-9._-]*\.vercel\.app$/i.test(o);
}

function isFinal10AppOrigin(origin) {
  return /^https:\/\/(www\.)?final10\.app$/i.test(normalizeOrigin(origin));
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (buildAllowedOrigins().has(normalized)) return true;
  if (isLocalDevOrigin(normalized)) return true;
  if (isVercelAppOrigin(normalized)) return true;
  if (isFinal10AppOrigin(normalized)) return true;
  return false;
}

/** Returns the exact origin to echo in Access-Control-Allow-Origin, or null if blocked. */
function resolveCorsOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  const normalized = normalizeOrigin(requestOrigin);
  return isOriginAllowed(normalized) ? normalized : null;
}

function useCorsCredentials() {
  return String(process.env.CORS_CREDENTIALS || '').toLowerCase() === 'true';
}

function logCorsStartup() {
  const explicit = buildAllowedOrigins();
  console.log(
    `[cors] ready credentials=${useCorsCredentials()} explicitOrigins=${explicit.size} vercelPreviews=*.vercel.app localhost=any-port`
  );
}

function createCorsMiddleware() {
  const credentials = useCorsCredentials();

  return cors({
    origin(origin, callback) {
      // Non-browser / same-origin tools (no Origin header)
      if (!origin) {
        return callback(null, !credentials);
      }

      const resolved = resolveCorsOrigin(origin);
      if (!resolved) {
        console.warn(`[cors] blocked origin: ${origin}`);
        return callback(null, false);
      }

      // Never use wildcard ACAO when credentials are enabled
      return callback(null, resolved);
    },
    credentials,
    optionsSuccessStatus: 204,
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: ['Retry-After'],
    maxAge: 86400,
    preflightContinue: false,
  });
}

/** Safety net — attach ACAO on error/404 responses if the cors package did not run. */
function ensureCorsHeaders(req, res) {
  const resolved = resolveCorsOrigin(req.headers.origin);
  if (!resolved) return;

  if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', resolved);
    res.setHeader('Vary', 'Origin');
  }
  if (useCorsCredentials() && !res.getHeader('Access-Control-Allow-Credentials')) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

module.exports = {
  DEFAULT_ORIGINS,
  CORS_METHODS,
  CORS_ALLOWED_HEADERS,
  buildAllowedOrigins,
  isOriginAllowed,
  resolveCorsOrigin,
  useCorsCredentials,
  createCorsMiddleware,
  ensureCorsHeaders,
  logCorsStartup,
  isVercelAppOrigin,
  isLocalDevOrigin,
  isFinal10AppOrigin,
};
