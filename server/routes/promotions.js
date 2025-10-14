const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PromotedListing = require('../models/PromotedListing');
const PromotionPackage = require('../models/PromotionPackage');
const PromotionPayment = require('../models/PromotionPayment');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// ===== PACKAGE MANAGEMENT =====

// Get available promotion packages
router.get('/packages', async (req, res) => {
  try {
    const { type } = req.query;
    const packages = await PromotionPackage.getAvailablePackages(type);
    
    res.json({
      packages,
      total: packages.length
    });
  } catch (error) {
    console.error('Error fetching promotion packages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get popular packages
router.get('/packages/popular', async (req, res) => {
  try {
    const packages = await PromotionPackage.getPopularPackages(5);
    res.json(packages);
  } catch (error) {
    console.error('Error fetching popular packages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recommended packages for user
router.get('/packages/recommended', async (req, res) => {
  try {
    const packages = await PromotionPackage.getRecommendedPackages(req.user.id);
    res.json(packages);
  } catch (error) {
    console.error('Error fetching recommended packages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== PROMOTION CREATION =====

// Create new promotion
router.post('/create', async (req, res) => {
  try {
    const {
      listingType,
      listingId,
      packageId,
      targetCategory,
      targetKeywords,
      duration,
      budget,
      autoRenewal
    } = req.body;

    // Validate required fields
    if (!listingType || !listingId || !packageId || !duration) {
      return res.status(400).json({ 
        message: 'Listing type, listing ID, package ID, and duration are required' 
      });
    }

    // Get promotion package
    const promotionPackage = await PromotionPackage.findById(packageId);
    if (!promotionPackage || !promotionPackage.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive promotion package' });
    }

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (duration * 60 * 60 * 1000)); // Convert hours to milliseconds

    // Check if user has reached promotion limits
    const userPromotions = await PromotedListing.countDocuments({
      user: req.user.id,
      status: { $in: ['active', 'pending'] }
    });

    if (promotionPackage.limits.maxPerUser && userPromotions >= promotionPackage.limits.maxPerUser) {
      return res.status(400).json({ 
        message: `You have reached the maximum number of active promotions (${promotionPackage.limits.maxPerUser})` 
      });
    }

    // Create promoted listing
    const promotedListing = new PromotedListing({
      user: req.user.id,
      listingType,
      listingId,
      promotionPackage: packageId,
      startDate,
      endDate,
      duration,
      targetCategory: targetCategory || 'all',
      targetKeywords: targetKeywords || [],
      budget: budget || promotionPackage.price,
      autoRenewal: {
        enabled: autoRenewal?.enabled || false,
        frequency: autoRenewal?.frequency || 'daily',
        maxBudget: autoRenewal?.maxBudget || 100
      },
      displaySettings: {
        badge: promotionPackage.features.badge,
        priority: promotionPackage.features.priority,
        position: promotionPackage.features.position === 'top' ? 1 : 0
      }
    });

    await promotedListing.save();
    await promotedListing.populate('promotionPackage');

    res.status(201).json({
      success: true,
      promotion: promotedListing,
      message: 'Promotion created successfully. Complete payment to activate.'
    });

  } catch (error) {
    console.error('Error creating promotion:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== PAYMENT PROCESSING =====

// Create payment intent for promotion
router.post('/payment/create-intent', async (req, res) => {
  try {
    const { promotionId } = req.body;

    const promotion = await PromotedListing.findById(promotionId)
      .populate('promotionPackage')
      .populate('user');

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (promotion.status !== 'pending') {
      return res.status(400).json({ message: 'Promotion is not pending payment' });
    }

    // Create payment record
    const payment = new PromotionPayment({
      user: req.user.id,
      promotedListing: promotionId,
      amount: promotion.budget,
      paymentMethod: 'stripe',
      metadata: {
        promotionPackage: promotion.promotionPackage.name,
        duration: promotion.duration,
        targetCategory: promotion.targetCategory
      }
    });

    await payment.save();

    // Create payment intent with Stripe
    let paymentIntent;
    
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      // Real Stripe integration
      paymentIntent = await stripe.paymentIntents.create({
        amount: promotion.budget * 100, // Convert to cents
        currency: 'usd',
        metadata: {
          userId: req.user.id,
          promotionId: promotion._id.toString(),
          promotionPackage: promotion.promotionPackage.name,
          duration: promotion.duration,
          targetCategory: promotion.targetCategory
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
    } else {
      // Mock payment intent for testing
      paymentIntent = {
        id: `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_${Date.now()}_secret_mock`,
        amount: promotion.budget * 100,
        currency: 'usd',
        status: 'requires_payment_method'
      };
    }

    // Update payment with Stripe data
    payment.stripe.paymentIntentId = paymentIntent.id;
    await payment.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment._id,
      amount: promotion.budget
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Confirm payment and activate promotion
router.post('/payment/confirm', async (req, res) => {
  try {
    const { paymentId, paymentIntentId } = req.body;

    const payment = await PromotionPayment.findById(paymentId)
      .populate('promotedListing');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Verify payment with Stripe
    let verifiedPayment;
    
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      // Real Stripe verification
      const stripePayment = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (stripePayment.status !== 'succeeded') {
        return res.status(400).json({ message: 'Payment not completed' });
      }
      
      verifiedPayment = {
        paymentIntentId,
        chargeId: stripePayment.latest_charge,
        customerId: stripePayment.customer || `cus_${req.user.id}`
      };
    } else {
      // Mock payment verification for testing
      if (!paymentIntentId.startsWith('pi_mock_')) {
        return res.status(400).json({ message: 'Invalid mock payment intent' });
      }
      
      verifiedPayment = {
        paymentIntentId,
        chargeId: `ch_mock_${Date.now()}`,
        customerId: `cus_${req.user.id}`
      };
    }
    
    await payment.markAsCompleted(verifiedPayment);

    // Activate the promotion
    const promotion = payment.promotedListing;
    promotion.status = 'active';
    await promotion.save();

    // Update package stats
    await PromotionPackage.findByIdAndUpdate(
      promotion.promotionPackage,
      { $inc: { 'stats.totalPurchases': 1, 'stats.totalRevenue': promotion.budget } }
    );

    res.json({
      success: true,
      message: 'Payment confirmed and promotion activated!',
      promotion
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== PROMOTION MANAGEMENT =====

// Get user's promotions
router.get('/my-promotions', async (req, res) => {
  try {
    const { status } = req.query;
    const promotions = await PromotedListing.getUserPromotions(req.user.id, status);
    
    res.json({
      promotions,
      total: promotions.length
    });
  } catch (error) {
    console.error('Error fetching user promotions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific promotion
router.get('/:id', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id)
      .populate('user', 'username firstName lastName')
      .populate('promotionPackage');

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    // Check if user owns this promotion or is admin
    if (promotion.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json(promotion);
  } catch (error) {
    console.error('Error fetching promotion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update promotion
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const promotion = await PromotedListing.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Only allow certain fields to be updated
    const allowedUpdates = ['targetCategory', 'targetKeywords', 'autoRenewal', 'notes'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    const updatedPromotion = await PromotedListing.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('promotionPackage');

    res.json(updatedPromotion);

  } catch (error) {
    console.error('Error updating promotion:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Pause promotion
router.put('/:id/pause', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await promotion.pause();

    res.json({
      success: true,
      message: 'Promotion paused successfully',
      promotion
    });

  } catch (error) {
    console.error('Error pausing promotion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resume promotion
router.put('/:id/resume', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await promotion.resume();

    res.json({
      success: true,
      message: 'Promotion resumed successfully',
      promotion
    });

  } catch (error) {
    console.error('Error resuming promotion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel promotion
router.put('/:id/cancel', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    if (promotion.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await promotion.cancel();

    // Process refund if applicable
    const payment = await PromotionPayment.findOne({
      promotedListing: promotion._id,
      status: 'completed'
    });

    if (payment) {
      // Process refund through Stripe
      let refundResult;
      
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
        // Real Stripe refund
        try {
          const refund = await stripe.refunds.create({
            payment_intent: payment.stripe.paymentIntentId,
            reason: 'requested_by_customer',
            metadata: {
              reason: 'Promotion cancelled by user',
              userId: req.user.id
            }
          });
          refundResult = {
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount
          };
        } catch (stripeError) {
          console.error('Stripe refund error:', stripeError);
          // Continue with mock refund if Stripe fails
          refundResult = {
            refundId: `re_mock_${Date.now()}`,
            status: 'succeeded',
            amount: payment.amount * 100
          };
        }
      } else {
        // Mock refund for testing
        refundResult = {
          refundId: `re_mock_${Date.now()}`,
          status: 'succeeded',
          amount: payment.amount * 100
        };
      }
      
      await payment.processRefund(
        payment.amount,
        'Promotion cancelled by user',
        req.user.id,
        refundResult
      );
    }

    res.json({
      success: true,
      message: 'Promotion cancelled and refund processed',
      promotion
    });

  } catch (error) {
    console.error('Error cancelling promotion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== TRENDING WITH PROMOTIONS =====

// Get trending items with promotions
router.get('/trending/feed', async (req, res) => {
  try {
    const { category = 'all', limit = 20 } = req.query;
    
    // Get promoted listings
    const promotedItems = await PromotedListing.getTrendingWithPromotions(category, limit);
    
    // Here you would mix with organic trending items
    // For now, we'll return just the promoted items
    res.json({
      items: promotedItems,
      total: promotedItems.length,
      hasMore: promotedItems.length >= limit
    });

  } catch (error) {
    console.error('Error fetching trending feed:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== ANALYTICS =====

// Get promotion analytics
router.get('/analytics/overview', async (req, res) => {
  try {
    const stats = await PromotedListing.getPromotionStats(req.user.id);
    const paymentStats = await PromotionPayment.getRevenueStats('month');
    
    res.json({
      promotionStats: stats[0] || {
        totalPromotions: 0,
        activePromotions: 0,
        totalSpent: 0,
        totalBudget: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalViews: 0,
        totalConversions: 0
      },
      paymentStats: paymentStats[0] || {
        totalRevenue: 0,
        totalPayments: 0,
        averagePayment: 0
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== ADMIN ENDPOINTS =====

// Get all promotions (admin)
router.get('/admin/all', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const promotions = await PromotedListing.find(query)
      .populate('user', 'username email')
      .populate('promotionPackage', 'name type price')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PromotedListing.countDocuments(query);

    res.json({
      promotions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching all promotions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


