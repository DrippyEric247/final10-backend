// top (already there)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const AuctionAggregator = require('./services/AuctionAggregator');
const { securityHeaders, cacheControl, cookieSecurity, corsConfig, rateLimitConfig, cspConfig } = require('./middleware/security');
// SavvyShield Proactive Investigation System
// Only starts when activated by superadmin through dashboard
const shieldProactiveInvestigation = require('./services/shieldProactiveInvestigation');



const app = express();

// --- Trust Proxy (for rate limiting behind reverse proxies) ---
app.set('trust proxy', 1);

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

// --- Rate Limiting ---
const limiter = rateLimit(rateLimitConfig);
app.use('/api/', limiter);

// --- CORS (enhanced security) ---
app.use(cors(corsConfig));
app.options('*', cors(corsConfig));

// Additional CORS handling for preflight requests (enhanced)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000', 
    'http://localhost:3001',
    'https://final10-client.onrender.com',
    'https://final10-client-production.up.railway.app',
    'https://final10-production.up.railway.app'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// --- BODY PARSERS (must be before routes) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/ebay", ebayRoutes);
app.use('/api/ebay-auth', ebayAuthRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/easter-eggs', easterEggRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/shield', shieldRoutes);
app.use('/final10', shieldEnforcementRouter);
app.use('/api/owner', ownerControlRoutes);

// health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// --- ERROR HANDLING MIDDLEWARE ---
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// --- 404 HANDLER ---
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- START SERVER ---
const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Final10 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
  console.log(`🌟 Savvy Universe Empire is LIVE!`);
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


