// top (already there)
const path = require('path');

// Load .env only when not in production
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const { validateCoreEnv, printSecurityStartupReport } = require('./config/envValidation');
validateCoreEnv();

const express = require('express');
const { requestTelemetry } = require('./middleware/requestTelemetry');
const mongoose = require('mongoose');
const compression = require('compression');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const AuctionAggregator = require('./services/AuctionAggregator');
const {
  securityHeaders,
  cacheControl,
  cookieSecurity,
  createCorsMiddleware,
  rateLimitConfig,
  cspConfig,
} = require('./middleware/security');
// SavvyShield Proactive Investigation System
// Only starts when activated by superadmin through dashboard
const shieldProactiveInvestigation = require('./services/shieldProactiveInvestigation');



const app = express();

// --- Trust Proxy (for rate limiting behind reverse proxies) ---
app.set('trust proxy', 1);

// --- CORS (before rate limits, security headers, and all /api routes) ---
const corsMiddleware = createCorsMiddleware();
app.use(corsMiddleware);
app.options('*', corsMiddleware);

// --- Compression Middleware (apply early) ---
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if the request includes a no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    // Use compression
    return compression.filter(req, res);
  }
}));

// --- Security Middleware (apply first) ---
app.use(securityHeaders);
app.use(cacheControl);
app.use(cookieSecurity);

// --- Rate Limiting (skip OPTIONS + telemetry ingest) ---
const limiter = rateLimit({
  ...rateLimitConfig,
  skip: (req) =>
    req.method === 'OPTIONS' ||
    req.path.startsWith('/analytics'),
});
app.use('/api/', limiter);

const { stripeWebhookHandler } = require('./routes/stripeWebhook');

app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    Promise.resolve(stripeWebhookHandler(req, res)).catch(next);
  }
);

// --- BODY PARSERS (must be before routes) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestTelemetry);

// --- Routes
const configRoutes      = require('./routes/config');
const pointsRoutes      = require('./routes/points');
const leaderboardRoutes = require('./routes/leaderboard');
const authRoutes        = require('./routes/auth');
const auctionRoutes     = require('./routes/auctions');
const scannerRoutes     = require('./routes/scanner');
const feedRoutes        = require('./routes/feed');
const userRoutes        = require('./routes/users');
const levelRoutes       = require('./routes/levels');
const paymentRoutes     = require('./routes/payments');
const localDealsRoutes  = require('./routes/localDeals');
const communityRoutes   = require('./routes/community');
const alertsRoutes      = require('./routes/alerts');
const projectAlertsRoutes = require('./routes/projectAlerts');
const buildWarsRoutes = require('./routes/buildWars');
const ebayRoutes        = require("./routes/ebay");
const ebayAuthRoutes    = require('./routes/ebayAuth');
const mcpRoutes         = require('./routes/mcp');
const promoCodeRoutes   = require('./routes/promoCodes');
const easterEggRoutes   = require('./routes/easterEggs');
const promotionRoutes   = require('./routes/promotions');
const bugReportRoutes   = require('./routes/bugReports');
const shieldRoutes      = require('./routes/shield');
const { router: shieldEnforcementRouter, checkShieldStatus, checkFeatureAccess } = require('./routes/shieldEnforcement');
const ownerControlRoutes = require('./routes/ownerControl');
const { requireOwnerGrantAccess } = require('./middleware/requireOwnerGrantAccess');
const { grantFoundingAccessHandler } = require('./handlers/grantFoundingAccess');
const progressionRoutes = require('./routes/progressionRoutes');
const cosmeticRoutes = require('./routes/cosmeticRoutes');
const entitlementRoutes = require('./routes/entitlementRoutes');
const offersRoutes = require('./routes/offers');
const businessOffersRoutes = require('./routes/businessOffers');
const creatorRoutes = require('./routes/creators');
const savvyShopRoutes = require('./routes/savvyShop');
const partyRoutes = require('./routes/parties');
const subscribeRoutes = require('./routes/subscribe');
const flipRewardsRoutes = require('./routes/flipRewards');
const marketValueRoutes = require('./routes/marketValue');
const analyticsIngestRoutes = require('./routes/analyticsIngest');
const notificationsRoutes = require('./routes/notifications');
const { runSavvyScoutAlertScan } = require('./services/savvyScoutAlertScanner');
const { logProcessCrash } = require('./services/structuredLog');

process.on('uncaughtException', (err) => {
  logProcessCrash('PROCESS_UNCAUGHT_EXCEPTION', err);
});
process.on('unhandledRejection', (reason) => {
  const e =
    reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
  logProcessCrash('PROCESS_UNHANDLED_REJECTION', e);
});

app.use('/api/config',      configRoutes);
app.use('/api/points',      pointsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/auth',        authRoutes);
app.use('/api/auctions',    auctionRoutes);
app.use('/api/scanner',     scannerRoutes);
app.use('/api/feed',        feedRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/levels',      levelRoutes);
app.use('/api/payments',    paymentRoutes);
app.use('/api/local-deals', localDealsRoutes);
app.use('/api/community',   communityRoutes);
app.use('/api/alerts',      alertsRoutes);
app.use('/api/project-alerts', projectAlertsRoutes);
app.use('/api/build-wars', buildWarsRoutes);
app.use("/api/ebay", ebayRoutes);
app.use('/api/ebay-auth', ebayAuthRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/easter-eggs', easterEggRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/shield', shieldRoutes);
app.use('/final10', shieldEnforcementRouter);

// Bootstrap founding grant — registered before /api/owner router (no JWT when secret matches)
app.post(
  '/api/owner/grant-founding-access',
  requireOwnerGrantAccess,
  grantFoundingAccessHandler
);

app.use('/api/owner', ownerControlRoutes);
app.use('/api/progression', progressionRoutes);
app.use('/api/cosmetics', cosmeticRoutes);
app.use('/api/entitlements', entitlementRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/business-offers', businessOffersRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/savvy-shop', savvyShopRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/subscribe', subscribeRoutes);
app.use('/api/flip-rewards', flipRewardsRoutes);
app.use('/api/market-value', marketValueRoutes);
app.use('/api/analytics', analyticsIngestRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/email', require('./routes/email'));

// health
app.get('/api/health', (_req, res) => {
  const { getEmailEnvPresence, getEmailProvider, isEmailConfigured } = require('./services/emailService');
  res.json({
    ok: true,
    emailEnvPresent: getEmailEnvPresence(),
    emailProvider: getEmailProvider(),
    emailConfigured: isEmailConfigured(),
  });
});

// --- DATABASE CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';

// MongoDB connection options for production optimization
const mongooseOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  retryWrites: true,
  retryReads: true,
  compressors: ['zlib'], // Use compression
  zlibCompressionLevel: 6
};

mongoose.connect(MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('✅ Connected to MongoDB with production optimizations');
    
    // Initialize auction aggregator
    const auctionAggregator = new AuctionAggregator();
    
    // Schedule auction data refresh every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('🔄 Scheduled auction refresh starting...');
      try {
        const totalRefreshed = await auctionAggregator.refreshAuctionData();
        console.log(`✅ Scheduled refresh completed: ${totalRefreshed} auctions updated`);
      } catch (error) {
        console.error('❌ Scheduled refresh failed:', error);
      }
    });
    
    console.log('⏰ Scheduled auction refresh every 30 minutes');

    // Savvy Scout alert sweep — active targets every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      runSavvyScoutAlertScan().catch((err) => {
        console.error('[SavvyScout] scheduled scan error:', err.message);
      });
    });
    console.log('⏰ Savvy Scout alert scan every 5 minutes');
    runSavvyScoutAlertScan().catch((err) => {
      console.warn('[SavvyScout] initial scan error:', err.message);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// --- 404 HANDLER (before centralized error handler) ---
app.use('*', (req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
});

const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// --- START SERVER ---
const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Final10 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
  const grantSecretLen = String(process.env.OWNER_GRANT_SECRET || '').trim().length;
  console.log(
    grantSecretLen > 0
      ? `🔑 Owner grant bootstrap: enabled (secret length ${grantSecretLen})`
      : '🔑 Owner grant bootstrap: disabled (OWNER_GRANT_SECRET not set)'
  );
  console.log(`🌟 Savvy Universe Empire is LIVE!`);
  const { logEmailStartup } = require('./services/emailService');
  logEmailStartup();
  const { logEbayAuthStartupCheck, getEbayAppToken } = require('./services/ebayAuthService');
  logEbayAuthStartupCheck();
  getEbayAppToken()
    .then((token) => {
      console.log(
        token
          ? 'eBay app token: warmed successfully'
          : 'eBay app token: unavailable — Browse routes will use mock fallback'
      );
    })
    .catch((err) => {
      console.warn('eBay app token warm-up error:', err.message);
    });
  console.log('eBay auth mode: dynamic app token with retry + mock fallback');
  console.log(`eBay env: ${process.env.EBAY_ENV || 'production'}`);
  printSecurityStartupReport();
});

// --- GRACEFUL SHUTDOWN ---
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});


