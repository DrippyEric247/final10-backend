/**
 * Express CORS — beta launch safe defaults for final10.app + Vercel previews + localhost.
 *
 * Env:
 *   CLIENT_URL / FRONTEND_URL — single origin (+ www/apex variants)
 *   ALLOWED_ORIGINS / CORS_ORIGINS — comma-separated extra origins
 *   CORS_CREDENTIALS=true — only when the client sends cookies (default: false; JWT Bearer auth)
 */
const cors = require('cors');

/** Production browser origins — also accepted when listed in ALLOWED_ORIGINS. */
const FINAL10_PRODUCTION_ORIGINS = Object.freeze([
  'https://final10.app',
  'https://www.final10.app',
]);

/** Default Vercel project hostname prefixes (Final10-owned previews only — not all *.vercel.app). */
const DEFAULT_FINAL10_VERCEL_PREVIEW_PREFIXES = Object.freeze([
  'final10-client',
  'final10-backend',
  'final10-app',
  'final10-frontend',
]);

const DEFAULT_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...FINAL10_PRODUCTION_ORIGINS,
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

function splitOriginCsv(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => normalizeOrigin(entry)).filter(Boolean);
      }
    } catch {
      // fall through to comma parsing
    }
  }

  return trimmed
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
}

function parseEnvOriginList() {
  const out = [];
  const allowedRaw = String(process.env.ALLOWED_ORIGINS || '').trim();
  const corsOriginsRaw = String(process.env.CORS_ORIGINS || '').trim();

  if (allowedRaw) {
    splitOriginCsv(allowedRaw).forEach((o) => out.push(o));
  }
  if (corsOriginsRaw) {
    splitOriginCsv(corsOriginsRaw).forEach((o) => out.push(o));
  }

  // CLIENT_URL is the canonical app URL (apex). CORS may still allow www via ALLOWED_ORIGINS.
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

function parseFinal10VercelPreviewPrefixes() {
  const raw = String(process.env.VERCEL_PREVIEW_ORIGIN_PREFIXES || '').trim();
  if (!raw) return [...DEFAULT_FINAL10_VERCEL_PREVIEW_PREFIXES];
  return raw
    .split(',')
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Additional Final10 Vercel slug patterns beyond explicit project prefixes.
 * Covers root project "final10" branch previews and team-scoped deployment URLs.
 */
function matchesFinal10VercelSlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (!s) return false;

  const prefixes = parseFinal10VercelPreviewPrefixes();
  if (prefixes.some((prefix) => s === prefix || s.startsWith(`${prefix}-`))) {
    return true;
  }

  if (s === 'final10') return true;
  if (/^final10-git-[a-z0-9-]+$/.test(s)) return true;
  if (/^final10-[a-z0-9-]+s-projects$/.test(s)) return true;
  if (/^final10-[a-z0-9]{6,40}-[a-z0-9-]+$/.test(s)) return true;

  return false;
}

/**
 * Trusted Final10 Vercel preview deployments only.
 * Matches e.g. final10-client.vercel.app, final10-git-beta-team.vercel.app
 * Does NOT match arbitrary *.vercel.app (other Vercel projects).
 */
function isFinal10VercelPreviewOrigin(origin) {
  const o = normalizeOrigin(origin);
  const match = /^https:\/\/([a-z0-9][a-z0-9-]*)\.vercel\.app$/i.exec(o);
  if (!match) return false;
  return matchesFinal10VercelSlug(match[1]);
}

function getCorsRejectReason(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return 'missing_origin';

  if (buildAllowedOrigins().has(normalized)) return null;
  if (isLocalDevOrigin(normalized)) return null;
  if (isFinal10VercelPreviewOrigin(normalized)) return null;
  if (isFinal10AppOrigin(normalized)) return null;

  const vercelMatch = /^https:\/\/([a-z0-9][a-z0-9-]*)\.vercel\.app$/i.exec(normalized);
  if (vercelMatch) {
    return 'vercel_origin_not_in_final10_preview_allowlist';
  }

  return 'origin_not_in_allowlist';
}

function logCorsRejected(origin, reason, context = 'request') {
  const safeOrigin = normalizeOrigin(origin) || '(none)';
  const safeReason = String(reason || 'unknown').slice(0, 120);
  const safeContext = String(context || 'request').slice(0, 40);
  console.warn(`[CORS_REJECTED] origin=${safeOrigin} reason=${safeReason} context=${safeContext}`);
}

function buildCorsDiagnosticReport(requestOrigin) {
  const normalized = normalizeOrigin(requestOrigin);
  const explicit = buildAllowedOrigins();
  const rawAllowedOrigins = String(process.env.ALLOWED_ORIGINS || '').trim();
  const rawCorsOrigins = String(process.env.CORS_ORIGINS || '').trim();
  const parsedAllowedOrigins = splitOriginCsv(process.env.ALLOWED_ORIGINS);
  const parsedCorsOrigins = splitOriginCsv(process.env.CORS_ORIGINS);
  const rejectReason = normalized ? getCorsRejectReason(normalized) : null;

  return {
    requestOrigin: normalized || null,
    originMatch: normalized ? isOriginAllowed(normalized) : null,
    resolvedOrigin: normalized ? resolveCorsOrigin(normalized) : null,
    rejectReason,
    allowedOriginsFormat: 'comma-separated (optional JSON array); CORS_ORIGINS uses same parser',
    rawAllowedOrigins: rawAllowedOrigins || null,
    rawCorsOrigins: rawCorsOrigins || null,
    parsedAllowedOrigins,
    parsedCorsOrigins,
    explicitOriginCount: explicit.size,
    vercelPreviewPrefixes: parseFinal10VercelPreviewPrefixes(),
    credentialsEnabled: useCorsCredentials(),
  };
}

/**
 * @deprecated Broad Vercel allowance — use isFinal10VercelPreviewOrigin instead.
 * Kept for tests; in production only Final10-prefixed previews are accepted.
 */
function isVercelAppOrigin(origin) {
  return isFinal10VercelPreviewOrigin(origin);
}

function isFinal10AppOrigin(origin) {
  return /^https:\/\/(www\.)?final10\.app$/i.test(normalizeOrigin(origin));
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (buildAllowedOrigins().has(normalized)) return true;
  if (isLocalDevOrigin(normalized)) return true;
  if (isFinal10VercelPreviewOrigin(normalized)) return true;
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

function applyPreflightHeaders(req, res, resolvedOrigin) {
  res.setHeader('Access-Control-Allow-Origin', resolvedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Max-Age', '86400');
  if (useCorsCredentials()) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  const requestedMethod = String(req.headers['access-control-request-method'] || '').trim();
  if (requestedMethod) {
    res.setHeader('Access-Control-Allow-Methods', CORS_METHODS.join(', '));
  }
  const requestedHeaders = String(req.headers['access-control-request-headers'] || '').trim();
  if (requestedHeaders) {
    res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS.join(', '));
  }
}

/**
 * Handle OPTIONS preflight for every route (including /api/*) before rate limits and handlers.
 */
function createOptionsPreflightMiddleware() {
  return function optionsPreflight(req, res, next) {
    if (req.method !== 'OPTIONS') {
      return next();
    }

    const resolved = resolveCorsOrigin(req.headers.origin);
    if (!resolved) {
      if (req.headers.origin) {
        logCorsRejected(req.headers.origin, getCorsRejectReason(req.headers.origin), 'options_preflight');
      }
      return res.sendStatus(403);
    }

    applyPreflightHeaders(req, res, resolved);
    return res.sendStatus(204);
  };
}

function logCorsStartup() {
  const explicit = buildAllowedOrigins();
  const clientUrl = normalizeOrigin(process.env.CLIENT_URL) || '(unset)';
  const allowedEnv = splitOriginCsv(process.env.ALLOWED_ORIGINS);
  const final10Listed = FINAL10_PRODUCTION_ORIGINS.every((o) => explicit.has(o));
  const vercelPrefixes = parseFinal10VercelPreviewPrefixes();
  console.log(
    `[cors] ready clientUrl=${clientUrl} credentials=${useCorsCredentials()} ` +
      `allowedOriginsEnv=${allowedEnv.length ? allowedEnv.join('|') : '(defaults)'} ` +
      `explicitOrigins=${explicit.size} final10ApexAndWww=${final10Listed} ` +
      `final10VercelPreviewPrefixes=${vercelPrefixes.join('|')} localhost=any-port`
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
        logCorsRejected(origin, getCorsRejectReason(origin), 'cors_middleware');
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
  FINAL10_PRODUCTION_ORIGINS,
  CORS_METHODS,
  CORS_ALLOWED_HEADERS,
  buildAllowedOrigins,
  isOriginAllowed,
  resolveCorsOrigin,
  useCorsCredentials,
  createCorsMiddleware,
  createOptionsPreflightMiddleware,
  ensureCorsHeaders,
  applyPreflightHeaders,
  logCorsStartup,
  isVercelAppOrigin,
  isFinal10VercelPreviewOrigin,
  parseFinal10VercelPreviewPrefixes,
  isLocalDevOrigin,
  isFinal10AppOrigin,
  splitOriginCsv,
  matchesFinal10VercelSlug,
  getCorsRejectReason,
  logCorsRejected,
  buildCorsDiagnosticReport,
};
