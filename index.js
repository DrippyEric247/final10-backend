// top (already there)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const AuctionAggregator = require('./services/AuctionAggregator');
const { securityHeaders, cacheControl, cookieSecurity, corsConfig, rateLimitConfig, cspConfig } = require('./middleware/security');




const app = express();

// --- Trust Proxy (for rate limiting behind reverse proxies) ---
app.set('trust proxy', 1);

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
    'https://final10-client.onrender.com'
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

// health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- DATABASE CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
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
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
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


