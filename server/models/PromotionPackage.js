const mongoose = require('mongoose');

const promotionPackageSchema = new mongoose.Schema({
  // Package identification
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  
  // Package type and tier
  type: {
    type: String,
    enum: ['featured', 'promoted', 'trending', 'category', 'custom'],
    required: true
  },
  tier: {
    type: String,
    enum: ['basic', 'premium', 'platinum', 'enterprise'],
    default: 'basic'
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Duration options
  duration: {
    hours: { type: Number, default: 24 },
    maxHours: { type: Number, default: 168 }, // 7 days max
    minHours: { type: Number, default: 1 }
  },
  
  // Package features
  features: {
    impressions: {
      type: String,
      enum: ['unlimited', 'limited'],
      default: 'unlimited'
    },
    maxImpressions: { type: Number, default: null },
    priority: { type: Number, default: 1 },
    badge: {
      type: String,
      enum: ['featured', 'promoted', 'sponsored', 'trending'],
      default: 'promoted'
    },
    position: {
      type: String,
      enum: ['top', 'mixed', 'category'],
      default: 'mixed'
    },
    targeting: {
      categories: [String],
      keywords: { type: Boolean, default: false },
      location: { type: Boolean, default: false }
    }
  },
  
  // Display settings
  display: {
    badgeColor: { type: String, default: '#8B5CF6' },
    badgeText: { type: String, default: 'PROMOTED' },
    highlightColor: { type: String, default: '#F59E0B' },
    animation: { type: String, default: 'none' }
  },
  
  // Performance guarantees
  guarantees: {
    minImpressions: { type: Number, default: null },
    minClicks: { type: Number, default: null },
    maxCPC: { type: Number, default: null },
    refundPolicy: { type: String, default: 'none' }
  },
  
  // Package limits
  limits: {
    maxPerUser: { type: Number, default: null },
    maxPerDay: { type: Number, default: null },
    maxConcurrent: { type: Number, default: null }
  },
  
  // Status and availability
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  
  // Package description and marketing
  description: {
    short: { type: String, required: true },
    long: { type: String },
    benefits: [String],
    testimonials: [String]
  },
  
  // Analytics and performance
  stats: {
    totalPurchases: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averagePerformance: { type: Number, default: 0 },
    satisfaction: { type: Number, default: 0 } // 1-5 rating
  },
  
  // Admin settings
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Sort order for display
  sortOrder: {
    type: Number,
    default: 0
  }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
promotionPackageSchema.index({ type: 1, tier: 1 });
promotionPackageSchema.index({ isActive: 1, sortOrder: 1 });
promotionPackageSchema.index({ slug: 1 });

// Virtual for is available
promotionPackageSchema.virtual('isAvailable').get(function() {
  return this.isActive;
});

// Virtual for price per hour
promotionPackageSchema.virtual('pricePerHour').get(function() {
  return this.price / this.duration.hours;
});

// Static methods
promotionPackageSchema.statics.getAvailablePackages = function(type = null) {
  const query = { isActive: true };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ sortOrder: 1, tier: 1, price: 1 });
};

promotionPackageSchema.statics.getPopularPackages = function(limit = 5) {
  return this.find({ 
    isActive: true, 
    isPopular: true 
  })
  .sort({ 'stats.totalPurchases': -1 })
  .limit(limit);
};

promotionPackageSchema.statics.getRecommendedPackages = function(userId = null) {
  // This could be personalized based on user history
  return this.find({ 
    isActive: true, 
    isRecommended: true 
  })
  .sort({ sortOrder: 1, price: 1 });
};

// Instance methods
promotionPackageSchema.methods.incrementPurchases = function() {
  this.stats.totalPurchases += 1;
  this.stats.totalRevenue += this.price;
  return this.save();
};

promotionPackageSchema.methods.updatePerformance = function(performanceScore) {
  // Update average performance with weighted average
  const total = this.stats.totalPurchases;
  if (total > 0) {
    this.stats.averagePerformance = 
      ((this.stats.averagePerformance * (total - 1)) + performanceScore) / total;
  } else {
    this.stats.averagePerformance = performanceScore;
  }
  return this.save();
};

module.exports = mongoose.model('PromotionPackage', promotionPackageSchema);








