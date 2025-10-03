const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'fashion', 'home', 'sports', 'collectibles', 'automotive', 'books', 'toys', 'other']
  },
  subcategory: String,
  condition: {
    type: String,
    enum: ['new', 'like-new', 'good', 'fair', 'poor'],
    required: true
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentBid: {
    type: Number,
    default: 0
  },
  buyItNowPrice: Number,
  reservePrice: Number,
  bidIncrement: {
    type: Number,
    default: 1
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  timeRemaining: {
    type: Number, // in seconds
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'cancelled', 'sold'],
    default: 'active'
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bids: [{
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isWinning: {
      type: Boolean,
      default: false
    }
  }],
  bidCount: {
    type: Number,
    default: 0
  },
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [String],
  location: {
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  shipping: {
    cost: Number,
    methods: [String],
    estimatedDays: Number
  },
  source: {
    platform: {
      type: String,
      enum: ['ebay', 'mercari', 'facebook', 'internal'],
      required: true
    },
    externalId: String,
    url: String
  },
  aiScore: {
    dealPotential: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    competitionLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    trendingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
auctionSchema.index({ endTime: 1, status: 1 });
auctionSchema.index({ category: 1, status: 1 });
auctionSchema.index({ 'aiScore.dealPotential': -1 });
auctionSchema.index({ 'source.platform': 1, 'source.externalId': 1 });

// Virtual for time remaining
auctionSchema.virtual('timeRemainingSeconds').get(function() {
  const now = new Date();
  const end = new Date(this.endTime);
  return Math.max(0, Math.floor((end - now) / 1000));
});

// Method to check if auction is ending soon (10 minutes)
auctionSchema.methods.isEndingSoon = function() {
  return this.timeRemainingSeconds <= 600; // 10 minutes
};

// Method to update current bid
auctionSchema.methods.updateCurrentBid = function() {
  if (this.bids.length > 0) {
    const highestBid = this.bids.reduce((max, bid) => 
      bid.amount > max.amount ? bid : max
    );
    this.currentBid = highestBid.amount;
    this.bidCount = this.bids.length;
  }
};

// Pre-save middleware to update time remaining
auctionSchema.pre('save', function(next) {
  this.timeRemaining = this.timeRemainingSeconds;
  this.updateCurrentBid();
  next();
});

module.exports = mongoose.model('Auction', auctionSchema);


































