const mongoose = require('mongoose');

const promotionPaymentSchema = new mongoose.Schema({
  // User and promotion details
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  promotedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromotedListing',
    required: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'points', 'credit'],
    default: 'stripe'
  },
  
  // Stripe specific fields
  stripe: {
    paymentIntentId: { type: String },
    chargeId: { type: String },
    customerId: { type: String },
    subscriptionId: { type: String }
  },
  
  // Payment status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  
  // Payment timing
  paidAt: { type: Date },
  failedAt: { type: Date },
  refundedAt: { type: Date },
  
  // Refund information
  refund: {
    amount: { type: Number, default: 0 },
    reason: { type: String },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    processedAt: { type: Date }
  },
  
  // Payment metadata
  metadata: {
    promotionPackage: { type: String },
    duration: { type: Number },
    targetCategory: { type: String },
    userAgent: { type: String },
    ipAddress: { type: String }
  },
  
  // Error handling
  error: {
    code: { type: String },
    message: { type: String },
    details: { type: String }
  },
  
  // Admin notes
  adminNotes: { type: String },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
promotionPaymentSchema.index({ user: 1, status: 1 });
promotionPaymentSchema.index({ promotedListing: 1 });
promotionPaymentSchema.index({ status: 1, createdAt: -1 });
promotionPaymentSchema.index({ 'stripe.paymentIntentId': 1 });

// Virtual for is successful
promotionPaymentSchema.virtual('isSuccessful').get(function() {
  return this.status === 'completed';
});

// Virtual for is refunded
promotionPaymentSchema.virtual('isRefunded').get(function() {
  return this.status === 'refunded' || this.refund.amount > 0;
});

// Instance methods
promotionPaymentSchema.methods.markAsCompleted = function(stripeData = {}) {
  this.status = 'completed';
  this.paidAt = new Date();
  this.stripe = { ...this.stripe, ...stripeData };
  return this.save();
};

promotionPaymentSchema.methods.markAsFailed = function(errorData = {}) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.error = errorData;
  return this.save();
};

promotionPaymentSchema.methods.processRefund = function(amount, reason, processedBy, stripeRefundData = {}) {
  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refund = {
    amount: amount || this.amount,
    reason,
    processedBy,
    processedAt: new Date(),
    stripeRefundId: stripeRefundData.refundId,
    stripeStatus: stripeRefundData.status
  };
  return this.save();
};

// Static methods
promotionPaymentSchema.statics.getUserPayments = function(userId, status = null) {
  const query = { user: userId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('promotedListing', 'listingType listingId status')
    .sort({ createdAt: -1 });
};

promotionPaymentSchema.statics.getPaymentStats = function(startDate, endDate) {
  const match = {};
  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

promotionPaymentSchema.statics.getRevenueStats = function(period = 'month') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  return this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        averagePayment: { $avg: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('PromotionPayment', promotionPaymentSchema);


