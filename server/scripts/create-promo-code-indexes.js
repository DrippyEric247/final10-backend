// Script to create MongoDB indexes for the promo code system
// Run this script to optimize database performance

const mongoose = require('mongoose');
require('dotenv').config();

const createIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Create indexes for PromoCode collection
    console.log('Creating indexes for promocodes collection...');
    
    await db.collection('promocodes').createIndex({ code: 1 }, { unique: true });
    await db.collection('promocodes').createIndex({ creator: 1 });
    await db.collection('promocodes').createIndex({ isActive: 1, validFrom: 1, validUntil: 1 });
    await db.collection('promocodes').createIndex({ usageCount: 1, usageLimit: 1 });
    await db.collection('promocodes').createIndex({ createdAt: -1 });
    await db.collection('promocodes').createIndex({ isPublic: 1, isActive: 1 });
    
    console.log('✅ PromoCode indexes created');

    // Create indexes for PromoCodeUsage collection
    console.log('Creating indexes for promocodeusages collection...');
    
    await db.collection('promocodeusages').createIndex({ promoCode: 1, user: 1 });
    await db.collection('promocodeusages').createIndex({ user: 1, createdAt: -1 });
    await db.collection('promocodeusages').createIndex({ promoCode: 1, createdAt: -1 });
    await db.collection('promocodeusages').createIndex({ orderId: 1 });
    await db.collection('promocodeusages').createIndex({ status: 1 });
    await db.collection('promocodeusages').createIndex({ createdAt: -1 });
    
    console.log('✅ PromoCodeUsage indexes created');

    // Create indexes for Commission collection
    console.log('Creating indexes for commissions collection...');
    
    await db.collection('commissions').createIndex({ creator: 1, status: 1 });
    await db.collection('commissions').createIndex({ promoCode: 1 });
    await db.collection('commissions').createIndex({ status: 1, createdAt: -1 });
    await db.collection('commissions').createIndex({ paidAt: -1 });
    await db.collection('commissions').createIndex({ createdAt: -1 });
    
    console.log('✅ Commission indexes created');

    console.log('\n🎉 All indexes created successfully!');
    console.log('\nIndex Summary:');
    console.log('- PromoCode: 6 indexes (code, creator, status+dates, usage, created, public+active)');
    console.log('- PromoCodeUsage: 6 indexes (code+user, user+date, code+date, order, status, created)');
    console.log('- Commission: 5 indexes (creator+status, code, status+date, paid, created)');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
};

// Run the script
createIndexes();








