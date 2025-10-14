// Script to seed default promotion packages
const mongoose = require('mongoose');
require('dotenv').config();

const PromotionPackage = require('../models/PromotionPackage');

const defaultPackages = [
  {
    name: 'Featured Spotlight',
    slug: 'featured-spotlight',
    type: 'featured',
    tier: 'platinum',
    price: 99,
    duration: { hours: 24, maxHours: 168, minHours: 1 },
    features: {
      impressions: 'unlimited',
      priority: 10,
      badge: 'featured',
      position: 'top',
      targeting: {
        categories: ['all'],
        keywords: true,
        location: true
      }
    },
    display: {
      badgeColor: '#FFD700',
      badgeText: 'FEATURED',
      highlightColor: '#FF6B6B',
      animation: 'pulse'
    },
    guarantees: {
      minImpressions: 5000,
      minClicks: 100,
      maxCPC: 1.50,
      refundPolicy: 'satisfaction_guaranteed'
    },
    limits: {
      maxPerUser: 3,
      maxPerDay: 10,
      maxConcurrent: 1
    },
    description: {
      short: 'Premium top placement for maximum visibility',
      long: 'Get your listing featured in the top positions with guaranteed high visibility and premium placement.',
      benefits: [
        'Top 3 position placement',
        'Golden FEATURED badge',
        'Premium highlighting',
        'Guaranteed minimum impressions',
        'Priority customer support'
      ],
      testimonials: [
        'Increased my sales by 300%!',
        'Best investment I made for my listings',
        'Worth every penny for the visibility'
      ]
    },
    isPopular: true,
    isRecommended: true,
    sortOrder: 1
  },
  {
    name: 'Trending Boost',
    slug: 'trending-boost',
    type: 'promoted',
    tier: 'premium',
    price: 49,
    duration: { hours: 12, maxHours: 72, minHours: 1 },
    features: {
      impressions: 'unlimited',
      priority: 7,
      badge: 'promoted',
      position: 'mixed',
      targeting: {
        categories: ['all'],
        keywords: true,
        location: false
      }
    },
    display: {
      badgeColor: '#8B5CF6',
      badgeText: 'PROMOTED',
      highlightColor: '#A78BFA',
      animation: 'glow'
    },
    guarantees: {
      minImpressions: 2000,
      minClicks: 50,
      maxCPC: 2.00,
      refundPolicy: 'performance_based'
    },
    limits: {
      maxPerUser: 5,
      maxPerDay: 20,
      maxConcurrent: 3
    },
    description: {
      short: 'Boost your listing in trending feeds',
      long: 'Get your listing promoted in trending sections with enhanced visibility and engagement.',
      benefits: [
        'Mixed placement in trending',
        'Purple PROMOTED badge',
        'Enhanced visibility',
        'Good performance guarantees',
        'Flexible duration options'
      ],
      testimonials: [
        'Great for testing new products',
        'Affordable way to get noticed',
        'Perfect for regular promotions'
      ]
    },
    isPopular: true,
    isRecommended: true,
    sortOrder: 2
  },
  {
    name: 'Category Champion',
    slug: 'category-champion',
    type: 'category',
    tier: 'premium',
    price: 29,
    duration: { hours: 24, maxHours: 120, minHours: 2 },
    features: {
      impressions: 'unlimited',
      priority: 5,
      badge: 'sponsored',
      position: 'category',
      targeting: {
        categories: ['electronics', 'fashion', 'home', 'sports', 'automotive'],
        keywords: true,
        location: false
      }
    },
    display: {
      badgeColor: '#10B981',
      badgeText: 'SPONSORED',
      highlightColor: '#34D399',
      animation: 'none'
    },
    guarantees: {
      minImpressions: 1000,
      minClicks: 25,
      maxCPC: 2.50,
      refundPolicy: 'standard'
    },
    limits: {
      maxPerUser: 10,
      maxPerDay: 50,
      maxConcurrent: 5
    },
    description: {
      short: 'Dominate your category listings',
      long: 'Get featured prominently within your specific category with targeted visibility.',
      benefits: [
        'Category-specific placement',
        'Green SPONSORED badge',
        'Targeted audience reach',
        'Category expertise',
        'Competitive pricing'
      ],
      testimonials: [
        'Perfect for niche products',
        'Great ROI in my category',
        'Helped me compete with big brands'
      ]
    },
    isRecommended: true,
    sortOrder: 3
  },
  {
    name: 'Quick Boost',
    slug: 'quick-boost',
    type: 'trending',
    tier: 'basic',
    price: 15,
    duration: { hours: 6, maxHours: 24, minHours: 1 },
    features: {
      impressions: 'limited',
      maxImpressions: 500,
      priority: 3,
      badge: 'trending',
      position: 'mixed',
      targeting: {
        categories: ['all'],
        keywords: false,
        location: false
      }
    },
    display: {
      badgeColor: '#F59E0B',
      badgeText: 'TRENDING',
      highlightColor: '#FBBF24',
      animation: 'none'
    },
    guarantees: {
      minImpressions: 300,
      minClicks: 10,
      maxCPC: 3.00,
      refundPolicy: 'none'
    },
    limits: {
      maxPerUser: 20,
      maxPerDay: 100,
      maxConcurrent: 10
    },
    description: {
      short: 'Affordable visibility boost',
      long: 'Quick and affordable way to get your listing noticed with basic promotion features.',
      benefits: [
        'Low-cost promotion',
        'Orange TRENDING badge',
        'Quick activation',
        'Perfect for testing',
        'No long-term commitment'
      ],
      testimonials: [
        'Great for small budgets',
        'Quick results',
        'Perfect for new sellers'
      ]
    },
    isPopular: false,
    isRecommended: false,
    sortOrder: 4
  },
  {
    name: 'Weekend Warrior',
    slug: 'weekend-warrior',
    type: 'featured',
    tier: 'premium',
    price: 199,
    duration: { hours: 72, maxHours: 168, minHours: 48 },
    features: {
      impressions: 'unlimited',
      priority: 9,
      badge: 'featured',
      position: 'top',
      targeting: {
        categories: ['all'],
        keywords: true,
        location: true
      }
    },
    display: {
      badgeColor: '#FFD700',
      badgeText: 'WEEKEND SPECIAL',
      highlightColor: '#FF6B6B',
      animation: 'pulse'
    },
    guarantees: {
      minImpressions: 15000,
      minClicks: 300,
      maxCPC: 1.25,
      refundPolicy: 'satisfaction_guaranteed'
    },
    limits: {
      maxPerUser: 2,
      maxPerDay: 5,
      maxConcurrent: 1
    },
    description: {
      short: 'Weekend-long premium placement',
      long: 'Extended premium placement perfect for weekend sales and special events.',
      benefits: [
        '3-day premium placement',
        'Special weekend badge',
        'Maximum weekend traffic',
        'Premium performance guarantees',
        'Perfect for sales events'
      ],
      testimonials: [
        'Crushed my weekend sales goals',
        'Best for special promotions',
        'Worth the investment for big events'
      ]
    },
    isPopular: true,
    isRecommended: false,
    sortOrder: 5
  }
];

const seedPromotionPackages = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    // Get admin user or create a default one
    const User = require('../models/User');
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      // Create a default admin user for seeding
      adminUser = new User({
        username: 'admin',
        email: 'admin@final10.com',
        role: 'admin',
        firstName: 'System',
        lastName: 'Admin'
      });
      await adminUser.save();
      console.log('Created default admin user for seeding');
    }

    // Clear existing packages
    await PromotionPackage.deleteMany({});
    console.log('Cleared existing promotion packages');

    // Add createdBy to all packages
    const packagesWithCreator = defaultPackages.map(pkg => ({
      ...pkg,
      createdBy: adminUser._id
    }));

    // Create default packages
    const packages = await PromotionPackage.insertMany(packagesWithCreator);
    console.log(`Created ${packages.length} promotion packages:`);
    
    packages.forEach(pkg => {
      console.log(`- ${pkg.name} (${pkg.type}/${pkg.tier}): $${pkg.price}`);
    });

    console.log('\n✅ Promotion packages seeded successfully!');
    console.log('\nPackage Summary:');
    console.log('- Featured Spotlight: Premium top placement ($99)');
    console.log('- Trending Boost: Mixed trending promotion ($49)');
    console.log('- Category Champion: Category-specific promotion ($29)');
    console.log('- Quick Boost: Affordable visibility ($15)');
    console.log('- Weekend Warrior: Extended premium ($199)');

  } catch (error) {
    console.error('❌ Error seeding promotion packages:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
};

// Run the script
seedPromotionPackages();
