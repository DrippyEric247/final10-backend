// Security and Performance Middleware
const cors = require('cors');
const helmet = require('helmet');

const PRODUCTION_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://final10.app',
  'https://www.final10.app',
  'https://final10-backend-jo1t.vercel.app',
  'https://final10-backend-qf59.vercel.app',
  'https://final10-client.onrender.com',
];

function expandWwwApexVariants(origin) {
  const out = new Set();
  const value = String(origin || '').trim().replace(/\/+$/, '');
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

function buildAllowedOrigins() {
  const allowed = new Set(PRODUCTION_CORS_ORIGINS);
  for (const key of ['FRONTEND_URL', 'CLIENT_URL', 'REACT_APP_CLIENT_URL', 'CORS_ORIGIN']) {
    const value = String(process.env[key] || '').trim().replace(/\/+$/, '');
    if (value) {
      expandWwwApexVariants(value).forEach((o) => allowed.add(o));
    }
  }
  const extra = String(process.env.CORS_ORIGINS || '').trim();
  if (extra) {
    extra
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean)
      .forEach((o) => {
        expandWwwApexVariants(o).forEach((variant) => allowed.add(variant));
      });
  }
  return allowed;
}

function isOriginAllowed(origin, allowed) {
  if (!origin) return true;
  if (allowed.has(origin)) return true;
  // Vercel preview/production aliases (e.g. final10-backend-jo1t.vercel.app)
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  // Custom production domain (apex + www)
  if (/^https:\/\/(www\.)?final10\.app$/i.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    const allowed = buildAllowedOrigins();
    if (isOriginAllowed(origin, allowed)) {
      return callback(null, true);
    }
    if (origin) {
      console.warn(`[cors] blocked origin: ${origin}`);
    }
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Owner-Grant-Secret',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Retry-After'],
  maxAge: 86400,
};

function createCorsMiddleware() {
  return cors(corsOptions);
}

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: ["'self'", "https://api.stripe.com", "http://localhost:5000", "http://localhost:3000"],
    frameSrc: ["'self'", "https://js.stripe.com"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'", "blob:"],
    childSrc: ["'self'", "blob:"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  }
};

// Security headers middleware using helmet
const securityHeaders = helmet({
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Cache control middleware
const cacheControl = (req, res, next) => {
  // Set cache control headers
  if (req.path.startsWith('/static/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    // Static assets - cache for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path.startsWith('/api/')) {
    // API endpoints - short cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // HTML pages - short cache
    res.setHeader('Cache-Control', 'public, max-age=180');
  }
  
  next();
};

// Cookie security middleware
const cookieSecurity = (req, res, next) => {
  // Override cookie settings for security
  const originalCookie = res.cookie;
  res.cookie = function(name, value, options = {}) {
    // Set secure defaults
    const secureOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      ...options
    };
    
    // Remove expires if maxAge is set (prefer maxAge over expires)
    if (secureOptions.maxAge && secureOptions.expires) {
      delete secureOptions.expires;
    }
    
    // If expires is provided, ensure it's a proper Date object or valid date string
    if (secureOptions.expires && !secureOptions.maxAge) {
      if (typeof secureOptions.expires === 'string') {
        secureOptions.expires = new Date(secureOptions.expires);
      }
      // Ensure it's a valid date
      if (isNaN(secureOptions.expires.getTime())) {
        // Fallback to maxAge if expires is invalid
        delete secureOptions.expires;
        secureOptions.maxAge = 24 * 60 * 60 * 1000;
      }
    }
    
    return originalCookie.call(this, name, value, secureOptions);
  };
  
  next();
};

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
};


module.exports = {
  securityHeaders,
  cacheControl,
  cookieSecurity,
  createCorsMiddleware,
  corsOptions,
  rateLimitConfig,
  cspConfig
};
