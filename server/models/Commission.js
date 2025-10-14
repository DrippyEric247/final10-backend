const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  // Creator/Influencer information
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Related promo code and usage
  promoCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode',
    required: true
  },
  promoCodeUsage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCodeUsage',
    required: true
  },
  
  // Commission details
  orderValue: { 
    type: Number, 
    required: true,
    min: 0
  },
  commissionRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  commissionAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Payout information
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  payoutMethod: {
    type: String,
    enum: ['paypal', 'bank_transfer', 'check', 'points'],
    default: 'paypal'
  },
  payoutDetails: {
    email: String,
    accountNumber: String,
    routingNumber: String,
    address: String
  },
  
  // Payment tracking
  paidAt: Date,
  paidAmount: { type: Number, min: 0 },
  transactionId: String,
  
  // Approval workflow
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  
  // Minimum payout threshold
  minimumPayout: { 
    type: Number, 
    default: 25 // $25 minimum payout
  },
  
  // Metadata
  notes: { type: String },
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
commissionSchema.index({ creator: 1, status: 1 });
commissionSchema.index({ promoCode: 1 });
commissionSchema.index({ status: 1, createdAt: -1 });
commissionSchema.index({ paidAt: -1 });

// Virtual for is ready for payout
commissionSchema.virtual('isReadyForPayout').get(function() {
  return this.status === 'approved' && 
         this.commissionAmount >= this.minimumPayout;
});

// Virtual for days since created
commissionSchema.virtual('daysSinceCreated').get(function() {
  const now = new Date();
  const diffTime = now - this.createdAt;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Static methods
commissionSchema.statics.getCreatorCommissions = function(creatorId, status = null) {
  const match = { creator: mongoose.Types.ObjectId(creatorId) };
  if (status) match.status = status;
  
  return this.find(match)
    .populate('promoCode', 'code description')
    .populate('promoCodeUsage', 'orderValue discountAmount')
    .sort({ createdAt: -1 });
};

commissionSchema.statics.getPendingPayouts = function() {
  return this.find({ 
    status: 'approved',
    commissionAmount: { $gte: this.schema.paths.minimumPayout.defaultValue }
  })
  .populate('creator', 'username email firstName lastName')
  .populate('promoCode', 'code')
  .sort({ createdAt: -1 });
};

commissionSchema.statics.getCreatorEarnings = function(creatorId) {
  return this.aggregate([
    { $match: { creator: mongoose.Types.ObjectId(creatorId) } },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$commissionAmount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

commissionSchema.statics.getTotalPayouts = function(startDate, endDate) {
  const match = {
    status: 'paid',
    paidAt: { $gte: startDate, $lte: endDate }
  };
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$paidAmount' },
        totalCommissions: { $sum: '$commissionAmount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance methods
commissionSchema.methods.approve = function(approvedBy) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  return this.save();
};

commissionSchema.methods.pay = function(paidAmount, transactionId) {
  this.status = 'paid';
  this.paidAmount = paidAmount;
  this.paidAt = new Date();
  this.transactionId = transactionId;
  return this.save();
};

commissionSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

// Pre-save middleware to create commission from promo code usage
commissionSchema.statics.createFromUsage = async function(promoCodeUsage) {
  const PromoCode = require('./PromoCode');
  
  const promoCode = await PromoCode.findById(promoCodeUsage.promoCode);
  if (!promoCode || promoCode.commissionRate === 0) {
    return null;
  }
  
  const commissionAmount = (promoCodeUsage.orderValue * promoCode.commissionRate) / 100;
  
  const commission = new this({
    creator: promoCode.creator,
    promoCode: promoCode._id,
    promoCodeUsage: promoCodeUsage._id,
    orderValue: promoCodeUsage.orderValue,
    commissionRate: promoCode.commissionRate,
    commissionAmount: commissionAmount
  });
  
  return commission.save();
};

module.exports = mongoose.model('Commission', commissionSchema);








