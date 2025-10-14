const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const User = require('../models/User');
const PromotedListing = require('../models/PromotedListing');
const PromotionPackage = require('../models/PromotionPackage');
const PromotionPayment = require('../models/PromotionPayment');
const PromoCode = require('../models/PromoCode');
const PromoCodeUsage = require('../models/PromoCodeUsage');

// Helper function to create index if it doesn't exist
async function createIndexIfNotExists(collection, indexSpec, options = {}) {
  try {
    await collection.createIndex(indexSpec, options);
  } catch (error) {
    if (error.code === 86) { // IndexKeySpecsConflict
      console.log(`   ⚠️  Index already exists: ${JSON.stringify(indexSpec)}`);
    } else {
      throw error;
    }
  }
}

async function createPerformanceIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Creating performance indexes...');

    // User model indexes
    console.log('👤 Creating User indexes...');
    await createIndexIfNotExists(User.collection, { email: 1 }, { unique: true, sparse: true });
    await createIndexIfNotExists(User.collection, { username: 1 }, { unique: true, sparse: true });
    await createIndexIfNotExists(User.collection, { points: -1 });
    await createIndexIfNotExists(User.collection, { membershipTier: 1 });
    await createIndexIfNotExists(User.collection, { subscriptionExpires: 1 });
    await createIndexIfNotExists(User.collection, { lastLogin: -1 });
    await createIndexIfNotExists(User.collection, { 'ebayAuth.accessToken': 1 }, { sparse: true });
    await createIndexIfNotExists(User.collection, { 'ebayAuth.refreshToken': 1 }, { sparse: true });
    console.log('✅ User indexes created');

    // PromotedListing model indexes
    console.log('📢 Creating PromotedListing indexes...');
    await createIndexIfNotExists(PromotedListing.collection, { user: 1, status: 1 });
    await createIndexIfNotExists(PromotedListing.collection, { status: 1, startDate: 1, endDate: 1 });
    await createIndexIfNotExists(PromotedListing.collection, { targetCategory: 1, status: 1 });
    await createIndexIfNotExists(PromotedListing.collection, { promotionPackage: 1 });
    await createIndexIfNotExists(PromotedListing.collection, { createdAt: -1 });
    await createIndexIfNotExists(PromotedListing.collection, { 
      status: 1, 
      displaySettings: 1, 
      startDate: 1, 
      endDate: 1 
    });
    console.log('✅ PromotedListing indexes created');

    // PromotionPackage model indexes
    console.log('📦 Creating PromotionPackage indexes...');
    await createIndexIfNotExists(PromotionPackage.collection, { type: 1, tier: 1 });
    await createIndexIfNotExists(PromotionPackage.collection, { isActive: 1, price: 1 });
    await createIndexIfNotExists(PromotionPackage.collection, { 'features.priority': -1 });
    await createIndexIfNotExists(PromotionPackage.collection, { createdAt: -1 });
    console.log('✅ PromotionPackage indexes created');

    // PromotionPayment model indexes
    console.log('💳 Creating PromotionPayment indexes...');
    await createIndexIfNotExists(PromotionPayment.collection, { user: 1, status: 1 });
    await createIndexIfNotExists(PromotionPayment.collection, { promotedListing: 1 });
    await createIndexIfNotExists(PromotionPayment.collection, { status: 1, createdAt: -1 });
    await createIndexIfNotExists(PromotionPayment.collection, { 'stripe.paymentIntentId': 1 }, { sparse: true });
    await createIndexIfNotExists(PromotionPayment.collection, { amount: -1 });
    console.log('✅ PromotionPayment indexes created');

    // PromoCode model indexes
    console.log('🎟️ Creating PromoCode indexes...');
    await createIndexIfNotExists(PromoCode.collection, { code: 1 }, { unique: true });
    await createIndexIfNotExists(PromoCode.collection, { createdBy: 1, isActive: 1 });
    await createIndexIfNotExists(PromoCode.collection, { isActive: 1, expiresAt: 1 });
    await createIndexIfNotExists(PromoCode.collection, { type: 1, isActive: 1 });
    await createIndexIfNotExists(PromoCode.collection, { createdAt: -1 });
    console.log('✅ PromoCode indexes created');

    // PromoCodeUsage model indexes
    console.log('📝 Creating PromoCodeUsage indexes...');
    await createIndexIfNotExists(PromoCodeUsage.collection, { user: 1, promoCode: 1 });
    await createIndexIfNotExists(PromoCodeUsage.collection, { promoCode: 1, usedAt: -1 });
    await createIndexIfNotExists(PromoCodeUsage.collection, { usedAt: -1 });
    await createIndexIfNotExists(PromoCodeUsage.collection, { user: 1, usedAt: -1 });
    console.log('✅ PromoCodeUsage indexes created');

    console.log('\n🎉 All performance indexes created successfully!');
    console.log('\n📈 Performance improvements:');
    console.log('  • Faster user lookups by email/username');
    console.log('  • Optimized promotion queries by status and date');
    console.log('  • Improved payment processing performance');
    console.log('  • Enhanced promo code validation speed');
    console.log('  • Better trending feed performance');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
createPerformanceIndexes();
