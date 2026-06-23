// top (already there)
const path = require('path');

// Process crash hooks FIRST — before any code that can throw or exit.
const { logProcessCrash } = require('./services/structuredLog');

process.on('uncaughtException', (err) => {
  logProcessCrash('PROCESS_UNCAUGHT_EXCEPTION', err);
  console.error('[startup] uncaughtException — process may be unstable:', err?.message);
});
process.on('unhandledRejection', (reason) => {
  const e =
    reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
  logProcessCrash('PROCESS_UNHANDLED_REJECTION', e);
  console.error('[startup] unhandledRejection:', e.message);
});

// Load .env only when not in production
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const { validateCoreEnv, printSecurityStartupReport, isProduction } = require('./config/envValidation');
console.log(`[startup] boot phase=env_validation NODE_ENV=${process.env.NODE_ENV || 'undefined'} PORT=${process.env.PORT || '(default 8080)'}`);
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

/** Last production boot E2E verify snapshot (for /api/health diagnostics). */
let lastBootAlertE2e = null;

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
const { isAuthMeRequest } = require('./middleware/rateLimits');

const limiter = rateLimit({
  ...rateLimitConfig,
  skip: (req) =>
    req.method === 'OPTIONS' ||
    req.path.startsWith('/analytics') ||
    isAuthMeRequest(req),
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
const { grantFounderAdminHandler } = require('./handlers/grantFounderAdminHandler');
const User = require('./models/User');
const { runRealAlertE2eVerify } = require('./services/alertE2eVerifyService');
const { getRecentAuditEvents } = require('./services/auditLogger');
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
const {
  isSavvyScoutBackgroundScanEnabled,
  isAuctionCronRefreshEnabled,
} = require('./lib/backgroundJobFlags');
const {
  auditStartup,
  auditMongoConnect,
  auditMongoFailure,
  auditCronJob,
} = require('./services/auditLogger');

console.log('[startup] boot phase=routes_loaded');

auditStartup({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8080,
  savvyScoutScan: isSavvyScoutBackgroundScanEnabled(),
  auctionCron: isAuctionCronRefreshEnabled(),
});

console.log('[startup] boot phase=audit_startup');
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

app.post(
  '/api/owner/grant-founder-admin',
  requireOwnerGrantAccess,
  grantFounderAdminHandler
);

/** Real-path alert E2E verify — owner secret only (no JWT, no test-mode gate). */
app.post('/api/owner/verify-alert-e2e', requireOwnerGrantAccess, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, message: 'email is required in body' });
    }
    const user = await User.findOne({ email }).select(
      'username email savvyPoints pointsBalance membershipTier isPremium subscription alertEmailOnMatch'
    );
    if (!user) {
      return res.status(404).json({ ok: false, message: `No user for ${email}` });
    }
    const result = await runRealAlertE2eVerify(user, {
      searchQuery: req.body?.searchQuery,
      maxPrice: req.body?.maxPrice,
      limit: req.body?.limit,
    });
    return res.status(result.ok ? 200 : 422).json({
      ...result,
      via: 'owner-grant-secret',
      auditRecent: {
        emailDelivery: getRecentAuditEvents(10, 'AUDIT_EMAIL_DELIVERY'),
        alertDelivery: getRecentAuditEvents(10, 'AUDIT_ALERT_DELIVERY'),
      },
    });
  } catch (err) {
    console.error('[owner/verify-alert-e2e] error:', err?.message || err);
    return res.status(500).json({
      ok: false,
      message: 'E2E verification failed',
      error: String(err?.message || err).slice(0, 200),
    });
  }
});

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
app.use('/api/scout-missions', require('./routes/scoutMissions'));
app.use('/api/test-alert', require('./routes/testAlert'));
app.use('/api/email', require('./routes/email'));

// health
app.get('/api/health', (_req, res) => {
  const { getEmailEnvPresence, getEmailProvider, isEmailConfigured, auditEmailFrom } = require('./services/emailService');
  const mongoState = mongoose.connection.readyState;
  const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    ok: mongoState === 1,
    uptimeSec: Math.round(process.uptime()),
    mongo: {
      readyState: mongoState,
      status: mongoStates[mongoState] || 'unknown',
      host: mongoose.connection.host || null,
    },
    jobs: {
      savvyScoutScan: isSavvyScoutBackgroundScanEnabled(),
      auctionCron: isAuctionCronRefreshEnabled(),
    },
    emailEnvPresent: getEmailEnvPresence(),
    emailProvider: getEmailProvider(),
    emailConfigured: isEmailConfigured(),
    alertEmailEnabled: String(process.env.ALERT_EMAIL_ENABLED || '').toLowerCase() === 'true',
    alertEmailDefault: (() => {
      const raw = process.env.ALERT_EMAIL_DEFAULT;
      if (raw != null && String(raw).trim() !== '') {
        return String(raw).toLowerCase() === 'true';
      }
      const { isProduction } = require('./config/envValidation');
      return isProduction();
    })(),
    emailFromAudit: auditEmailFrom(),
    lastBootAlertE2e,
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
    auditMongoConnect({
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    });
    
    // Initialize auction aggregator
    const auctionAggregator = new AuctionAggregator();
    
    if (isAuctionCronRefreshEnabled()) {
      cron.schedule('*/30 * * * *', async () => {
        console.log('[cron] auction refresh starting');
        auditCronJob('auction_refresh', { phase: 'start' });
        try {
          const totalRefreshed = await auctionAggregator.refreshAuctionData();
          console.log(`[cron] auction refresh done: ${totalRefreshed} updated`);
          auditCronJob('auction_refresh', { phase: 'done', totalRefreshed });
        } catch (error) {
          console.error('[cron] auction refresh failed:', error?.message || error);
          auditCronJob('auction_refresh', { phase: 'error', message: error?.message });
        }
      });
      console.log('⏰ Auction cron refresh enabled (every 30m). Set DISABLE_AUCTION_CRON_REFRESH=true to pause.');
    } else {
      console.log('⏸ Auction cron refresh disabled (DISABLE_AUCTION_CRON_REFRESH=true)');
    }

    if (isSavvyScoutBackgroundScanEnabled()) {
      const scoutCron = isProduction() ? '*/15 * * * *' : '*/5 * * * *';
      cron.schedule(scoutCron, () => {
        auditCronJob('savvy_scout_alert_scan', { phase: 'start' });
        runSavvyScoutAlertScan()
          .then((result) => {
            auditCronJob('savvy_scout_alert_scan', { phase: 'done', ...result });
          })
          .catch((err) => {
            console.error('[SavvyScout] scheduled scan error:', err?.message || err);
            auditCronJob('savvy_scout_alert_scan', {
              phase: 'error',
              message: String(err?.message || err).slice(0, 200),
            });
          });
      });
      console.log(
        `⏰ Savvy Scout background scan enabled (${isProduction() ? 'every 15m' : 'every 5m'}). Set DISABLE_SAVVY_SCOUT_SCAN=true to pause.`
      );
      const bootDelayMs = isProduction() ? 5 * 60 * 1000 : 15_000;
      setTimeout(() => {
        runSavvyScoutAlertScan().catch((err) => {
          console.warn('[SavvyScout] initial scan error:', err?.message || err);
        });
      }, bootDelayMs);
    } else {
      console.log('⏸ Savvy Scout background scan disabled (DISABLE_SAVVY_SCOUT_SCAN=true)');
    }

    if (
      isProduction() &&
      String(process.env.ALERT_E2E_BOOT_DISABLED || '').toLowerCase() !== 'true'
    ) {
      const bootE2eEmail = String(process.env.ALERT_E2E_BOOT_EMAIL || '')
        .trim()
        .toLowerCase();
      if (bootE2eEmail) {
      const e2eDelayMs = 90_000;
      setTimeout(() => {
        void (async () => {
          try {
            const user = await User.findOne({ email: bootE2eEmail }).select(
              'username email savvyPoints pointsBalance membershipTier isPremium subscription alertEmailOnMatch'
            );
            if (!user) {
              lastBootAlertE2e = {
                at: new Date().toISOString(),
                ok: false,
                message: `boot e2e user not found: ${bootE2eEmail}`,
              };
              return;
            }
            console.log('[BOOT] Running alert E2E verify for', bootE2eEmail);
            const result = await runRealAlertE2eVerify(user, { limit: 6 });
            lastBootAlertE2e = {
              at: new Date().toISOString(),
              ok: result.ok,
              matchFound: result.matchFound,
              newMatches: result.newMatches,
              emailAttempted: result.emailAttempted,
              emailSent: result.emailSent,
              emailFailure: result.emailFailure,
              message: result.message,
              alert: result.alert,
              audit: result.audit,
            };
            console.log('[BOOT] alert E2E verify result:', JSON.stringify(lastBootAlertE2e));
          } catch (err) {
            lastBootAlertE2e = {
              at: new Date().toISOString(),
              ok: false,
              error: String(err?.message || err).slice(0, 200),
            };
            console.error('[BOOT] alert E2E verify failed:', err?.message || err);
          }
        })();
      }, e2eDelayMs);
      console.log(
        `🧪 Production boot alert E2E scheduled in ${e2eDelayMs / 1000}s for ${bootE2eEmail} (set ALERT_E2E_BOOT_DISABLED=true to skip)`
      );
      }
    }
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    auditMongoFailure({ message: error?.message, code: error?.code });
    logProcessCrash('MONGO_CONNECT_FAILURE', error);
    console.error('[startup] MongoDB connect failed — exiting (server/index.js:301). Check MONGODB_URI on Railway.');
    process.exit(1);
  });

// --- 404 HANDLER (before centralized error handler) ---
app.use('*', (req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
});

const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// --- START SERVER ---
const PORT = Number(process.env.PORT) || 8080;

console.log(`[startup] boot phase=listen port=${PORT} host=0.0.0.0`);

const server = app.listen(PORT, '0.0.0.0', () => {
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

server.on('error', (err) => {
  logProcessCrash('HTTP_LISTEN_FAILURE', err);
  console.error(`[startup] app.listen failed on port ${PORT}:`, err?.message);
  process.exit(1);
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


