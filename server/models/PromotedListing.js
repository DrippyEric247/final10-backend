const mongoose = require('mongoose');

const promotedListingSchema = new mongoose.Schema({
  // User and listing information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Listing details (can be eBay item or custom listing)
  listingType: {
    type: String,
    enum: ['ebay', 'custom', 'auction'],
    required: true
  },
  listingId: {
    type: String,
    required: true // eBay item ID or custom listing ID
  },
  
  // Promotion details
  promotionPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromotionPackage',
    required: true
  },
  
  // Promotion status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled', 'pending'],
    default: 'pending'
  },
  
  // Promotion timing
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true // Duration in hours
  },
  
  // Promotion settings
  targetCategory: {
    type: String,
    default: 'all'
  },
  targetKeywords: [String],
  budget: {
    type: Number,
    required: true
  },
  spent: {
    type: Number,
    default: 0
  },
  
  // Performance metrics
  metrics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    bids: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 }, // Click-through rate
    cpm: { type: Number, default: 0 }, // Cost per mille (1000 impressions)
    cpc: { type: Number, default: 0 }  // Cost per click
  },
  
  // Promotion display settings
  displaySettings: {
    badge: {
      type: String,
      enum: ['featured', 'promoted', 'sponsored', 'trending'],
      default: 'promoted'
    },
    priority: {
      type: Number,
      default: 1 // Higher number = higher priority
    },
    position: {
      type: Number,
      default: 0 // Specific position in trending (0 = auto)
    }
  },
  
  // Payment information
  payment: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    paymentMethod: { type: String, default: 'stripe' },
    paymentId: { type: String },
    paidAt: { type: Date },
    refunded: { type: Boolean, default: false }
  },
  
  // Auto-renewal settings
  autoRenewal: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    maxBudget: { type: Number, default: 100 }
  },
  
  // Metadata
  notes: { type: String },
  tags: [String],
  
  // Admin controls
  adminNotes: { type: String },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: { type: Date }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
promotedListingSchema.index({ user: 1, status: 1 });
promotedListingSchema.index({ listingType: 1, listingId: 1 });
promotedListingSchema.index({ status: 1, startDate: 1, endDate: 1 });
promotedListingSchema.index({ targetCategory: 1, status: 1 });
promotedListingSchema.index({ 'displaySettings.priority': -1, 'displaySettings.position': 1 });
promotedListingSchema.index({ createdAt: -1 });

// Virtual for is active
promotedListingSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         now >= this.startDate && 
         now <= this.endDate;
});

// Virtual for time remaining
promotedListingSchema.virtual('timeRemaining').get(function() {
  if (!this.isActive) return 0;
  const now = new Date();
  return Math.max(0, this.endDate - now);
});

// Virtual for remaining budget
promotedListingSchema.virtual('remainingBudget').get(function() {
  return Math.max(0, this.budget - this.spent);
});

// Virtual for performance score
promotedListingSchema.virtual('performanceScore').get(function() {
  const { impressions, clicks, views } = this.metrics;
  if (impressions === 0) return 0;
  
  const ctr = clicks / impressions;
  const engagement = views / impressions;
  
  return Math.round((ctr * 0.6 + engagement * 0.4) * 100);
});

// Instance methods
promotedListingSchema.methods.updateMetrics = function(type, increment = 1) {
  if (!this.metrics[type]) return;
  
  this.metrics[type] += increment;
  
  // Recalculate derived metrics
  if (this.metrics.impressions > 0) {
    this.metrics.ctr = this.metrics.clicks / this.metrics.impressions;
    this.metrics.cpm = (this.spent / this.metrics.impressions) * 1000;
  }
  
  if (this.metrics.clicks > 0) {
    this.metrics.cpc = this.spent / this.metrics.clicks;
  }
  
  return this.save();
};

promotedListingSchema.methods.spendBudget = function(amount) {
  this.spent += amount;
  return this.save();
};

promotedListingSchema.methods.pause = function() {
  this.status = 'paused';
  return this.save();
};

promotedListingSchema.methods.resume = function() {
  if (this.isActive) {
    this.status = 'active';
  }
  return this.save();
};

promotedListingSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

// Static methods
promotedListingSchema.statics.getActivePromotions = function(category = 'all', limit = 20) {
  const now = new Date();
  const query = {
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  };
  
  if (category !== 'all') {
    query.targetCategory = category;
  }
  
  return this.find(query)
    .populate('user', 'username firstName lastName')
    .populate('promotionPackage', 'name type price features')
    .sort({ 'displaySettings.priority': -1, 'displaySettings.position': 1, createdAt: -1 })
    .limit(limit);
};

promotedListingSchema.statics.getTrendingWithPromotions = async function(category = 'all', limit = 20) {
  // Get active promotions first
  const promotions = await this.getActivePromotions(category, Math.min(limit, 10));
  
  // Mix with organic trending (this would integrate with your existing trending logic)
  // For now, we'll return promotions with a flag to indicate they're promoted
  return promotions.map(promo => ({
    ...promo.toObject(),
    isPromoted: true,
    promotionType: promo.displaySettings.badge,
    promotionMetrics: promo.metrics
  }));
};

promotedListingSchema.statics.getUserPromotions = function(userId, status = null) {
  const query = { user: userId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('promotionPackage', 'name type price')
    .sort({ createdAt: -1 });
};

promotedListingSchema.statics.getPromotionStats = function(userId = null) {
  const match = userId ? { user: mongoose.Types.ObjectId(userId) } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPromotions: { $sum: 1 },
        activePromotions: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        totalSpent: { $sum: '$spent' },
        totalBudget: { $sum: '$budget' },
        totalImpressions: { $sum: '$metrics.impressions' },
        totalClicks: { $sum: '$metrics.clicks' },
        totalViews: { $sum: '$metrics.views' },
        totalConversions: { $sum: '$metrics.conversions' }
      }
    }
  ]);
};

module.exports = mongoose.model('PromotedListing', promotedListingSchema);








