// Security and Performance Middleware
const helmet = require('helmet');

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

// CORS configuration
const corsConfig = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://www.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
};


module.exports = {
  securityHeaders,
  cacheControl,
  cookieSecurity,
  corsConfig,
  rateLimitConfig,
  cspConfig
};
