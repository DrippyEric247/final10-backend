const mongoose = require('mongoose');

const promoCodeUsageSchema = new mongoose.Schema({
  // Code and user information
  promoCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Order information
  orderId: { type: String },
  orderValue: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Discount applied
  discountAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  finalAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Commission tracking
  commissionAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['applied', 'refunded', 'cancelled'],
    default: 'applied'
  },
  
  // Metadata
  ipAddress: { type: String },
  userAgent: { type: String },
  sessionId: { type: String },
  
  // Admin notes
  notes: { type: String },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
promoCodeUsageSchema.index({ promoCode: 1, user: 1 });
promoCodeUsageSchema.index({ user: 1, createdAt: -1 });
promoCodeUsageSchema.index({ promoCode: 1, createdAt: -1 });
promoCodeUsageSchema.index({ orderId: 1 });
promoCodeUsageSchema.index({ status: 1 });

// Virtual for savings percentage
promoCodeUsageSchema.virtual('savingsPercentage').get(function() {
  if (this.orderValue === 0) return 0;
  return Math.round((this.discountAmount / this.orderValue) * 100);
});

// Static methods
promoCodeUsageSchema.statics.getUserUsageHistory = function(userId, limit = 20) {
  return this.find({ user: userId })
    .populate('promoCode', 'code description discountType discountValue')
    .sort({ createdAt: -1 })
    .limit(limit);
};

promoCodeUsageSchema.statics.getCodeUsageHistory = function(promoCodeId, limit = 50) {
  return this.find({ promoCode: promoCodeId })
    .populate('user', 'username email firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

promoCodeUsageSchema.statics.getUserCodeUsage = function(userId, promoCodeId) {
  return this.countDocuments({ 
    user: userId, 
    promoCode: promoCodeId,
    status: 'applied'
  });
};

promoCodeUsageSchema.statics.getTotalSavings = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId), status: 'applied' } },
    {
      $group: {
        _id: null,
        totalSavings: { $sum: '$discountAmount' },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: '$orderValue' }
      }
    }
  ]);
};

promoCodeUsageSchema.statics.getCreatorEarnings = function(creatorId) {
  return this.aggregate([
    {
      $lookup: {
        from: 'promocodes',
        localField: 'promoCode',
        foreignField: '_id',
        as: 'promoCodeData'
      }
    },
    { $unwind: '$promoCodeData' },
    { $match: { 'promoCodeData.creator': mongoose.Types.ObjectId(creatorId) } },
    {
      $group: {
        _id: null,
        totalCommission: { $sum: '$commissionAmount' },
        totalUsage: { $sum: 1 },
        totalRevenue: { $sum: '$orderValue' }
      }
    }
  ]);
};

// Instance methods
promoCodeUsageSchema.methods.refund = function() {
  this.status = 'refunded';
  return this.save();
};

promoCodeUsageSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

module.exports = mongoose.model('PromoCodeUsage', promoCodeUsageSchema);








