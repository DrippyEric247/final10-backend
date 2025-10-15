const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  // Basic code information
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9_-]+$/.test(v);
      },
      message: 'Promo code can only contain letters, numbers, underscores, and hyphens'
    }
  },
  description: { type: String, required: true },
  
  // Creator/Influencer information
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creatorType: {
    type: String,
    enum: ['influencer', 'partner', 'admin'],
    default: 'influencer'
  },
  
  // Discount configuration
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'free_shipping'],
    required: true
  },
  discountValue: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Usage limits and restrictions
  usageLimit: { 
    type: Number, 
    default: null // null means unlimited
  },
  usageCount: { 
    type: Number, 
    default: 0 
  },
  userUsageLimit: { 
    type: Number, 
    default: 1 // How many times a single user can use this code
  },
  
  // Date restrictions
  validFrom: { 
    type: Date, 
    default: Date.now 
  },
  validUntil: { 
    type: Date, 
    default: null // null means no expiration
  },
  
  // Status and controls
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isPublic: { 
    type: Boolean, 
    default: true // Can be discovered publicly vs private codes
  },
  
  // Minimum order requirements
  minimumOrderValue: { 
    type: Number, 
    default: 0 
  },
  
  // Commission tracking
  commissionRate: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100 // Percentage of order value
  },
  
  // Analytics tracking
  totalRevenue: { 
    type: Number, 
    default: 0 
  },
  totalCommission: { 
    type: Number, 
    default: 0 
  },
  
  // Metadata
  tags: [{ type: String }],
  notes: { type: String },
  
  // Admin controls
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for usage percentage
promoCodeSchema.virtual('usagePercentage').get(function() {
  if (!this.usageLimit) return null;
  return Math.round((this.usageCount / this.usageLimit) * 100);
});

// Virtual for days until expiration
promoCodeSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.validUntil) return null;
  const now = new Date();
  const diffTime = this.validUntil - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for is expired
promoCodeSchema.virtual('isExpired').get(function() {
  if (!this.validUntil) return false;
  return new Date() > this.validUntil;
});

// Virtual for is fully used
promoCodeSchema.virtual('isFullyUsed').get(function() {
  if (!this.usageLimit) return false;
  return this.usageCount >= this.usageLimit;
});

// Virtual for can be used
promoCodeSchema.virtual('canBeUsed').get(function() {
  return this.isActive && 
         !this.isExpired && 
         !this.isFullyUsed &&
         new Date() >= this.validFrom;
});

// Indexes for performance
// Note: code index is automatically created by unique: true
promoCodeSchema.index({ creator: 1 });
promoCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ usageCount: 1, usageLimit: 1 });

// Instance methods
promoCodeSchema.methods.validateUsage = function(userId, orderValue = 0) {
  const errors = [];
  
  // Check if code is active
  if (!this.isActive) {
    errors.push('Promo code is not active');
  }
  
  // Check if code has expired
  if (this.isExpired) {
    errors.push('Promo code has expired');
  }
  
  // Check if code is valid from date
  if (new Date() < this.validFrom) {
    errors.push('Promo code is not yet valid');
  }
  
  // Check usage limit
  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    errors.push('Promo code usage limit reached');
  }
  
  // Check minimum order value
  if (orderValue < this.minimumOrderValue) {
    errors.push(`Minimum order value of $${this.minimumOrderValue} required`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

promoCodeSchema.methods.calculateDiscount = function(orderValue) {
  if (!this.validateUsage(null, orderValue).isValid) {
    return { discountAmount: 0, finalAmount: orderValue };
  }
  
  let discountAmount = 0;
  
  switch (this.discountType) {
    case 'percentage':
      discountAmount = (orderValue * this.discountValue) / 100;
      break;
    case 'fixed':
      discountAmount = this.discountValue;
      break;
    case 'free_shipping':
      // This would be handled by shipping logic
      discountAmount = 0;
      break;
  }
  
  // Ensure discount doesn't exceed order value
  discountAmount = Math.min(discountAmount, orderValue);
  const finalAmount = Math.max(0, orderValue - discountAmount);
  
  return {
    discountAmount,
    finalAmount,
    discountType: this.discountType,
    discountValue: this.discountValue
  };
};

promoCodeSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

promoCodeSchema.methods.addRevenue = function(orderValue) {
  this.totalRevenue += orderValue;
  const commission = (orderValue * this.commissionRate) / 100;
  this.totalCommission += commission;
  return this.save();
};

// Static methods
promoCodeSchema.statics.findValidCode = function(code, userId = null, orderValue = 0) {
  return this.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [
      { validUntil: null },
      { validUntil: { $gt: new Date() } }
    ],
    $or: [
      { usageLimit: null },
      { usageCount: { $lt: this.usageLimit } }
    ]
  }).populate('creator', 'username email firstName lastName');
};

promoCodeSchema.statics.getCreatorStats = function(creatorId) {
  return this.aggregate([
    { $match: { creator: mongoose.Types.ObjectId(creatorId) } },
    {
      $group: {
        _id: null,
        totalCodes: { $sum: 1 },
        activeCodes: { 
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $eq: ['$isActive', true] },
                  { $or: [
                    { $eq: ['$validUntil', null] },
                    { $gt: ['$validUntil', new Date()] }
                  ]}
                ]
              }, 
              1, 
              0
            ]
          }
        },
        totalUsage: { $sum: '$usageCount' },
        totalRevenue: { $sum: '$totalRevenue' },
        totalCommission: { $sum: '$totalCommission' }
      }
    }
  ]);
};

promoCodeSchema.statics.getPopularCodes = function(limit = 10) {
  return this.find({ 
    isActive: true,
    isPublic: true 
  })
  .sort({ usageCount: -1 })
  .limit(limit)
  .populate('creator', 'username')
  .select('code description usageCount totalRevenue discountType discountValue');
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);








