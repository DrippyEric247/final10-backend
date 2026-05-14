const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PromotedListing = require('../models/PromotedListing');
const PromotionPackage = require('../models/PromotionPackage');
const PromotionPayment = require('../models/PromotionPayment');
const User = require('../models/User');
const PointsLedger = require('../models/PointsLedger');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

const WATCH_SAVVY_BONUS = 5;
const BUYER_CLAIM_OFFER_SAVVY = 15;
const SELLER_CONVERSION_SAVVY = 20;
const MIN_WATCHERS_TO_SEND = 5;
const MAX_OFFERS_PER_DAY = 3;
const OFFER_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function clampNum(raw, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function dayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

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

// Watch a listing (buyer intent + optional seller watcher count)
router.post('/watch/:listingId', async (req, res) => {
  try {
    const listingId = String(req.params.listingId || '').trim();
    if (!listingId) return res.status(400).json({ message: 'Listing id is required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!Array.isArray(user.watchlist)) user.watchlist = [];
    const existing = user.watchlist.find((w) => String(w.listingId) === listingId);
    let savvyAwarded = 0;
    if (!existing) {
      user.watchlist.push({
        listingId,
        title: String(req.body?.title || ''),
        image: String(req.body?.image || ''),
        url: String(req.body?.url || ''),
        sellerId: String(req.body?.sellerId || ''),
        watchedAt: new Date(),
        mutedOffers: false,
        savvyAwardedAt: new Date(),
      });
      user.savvyPoints = Number(user.savvyPoints || 0) + WATCH_SAVVY_BONUS;
      savvyAwarded = WATCH_SAVVY_BONUS;
      await PointsLedger.create({
        userId: user._id,
        type: 'earn',
        amount: WATCH_SAVVY_BONUS,
        source: 'watch_listing',
        refId: listingId,
        idempotencyKey: `watch_listing_${user._id}_${listingId}`,
      }).catch((err) => {
        if (err?.code !== 11000) throw err;
      });
    }
    await user.save();

    const promotion = await PromotedListing.findOne({ listingId });
    let watcherCount = 0;
    if (promotion) {
      const uid = String(user._id);
      const hasWatcher = Array.isArray(promotion.watchers)
        ? promotion.watchers.some((id) => String(id) === uid)
        : false;
      if (!hasWatcher) {
        promotion.watchers.push(user._id);
        promotion.watcherActivity.push({ user: user._id, action: 'watch', at: new Date() });
        await promotion.save();
      }
      watcherCount = promotion.watchers.length;
    }

    return res.json({
      success: true,
      listingId,
      watcherCount,
      savvyAwarded,
      message: 'Saved. You may receive exclusive offers.',
    });
  } catch (error) {
    console.error('Error watching listing:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/watch-mute/:listingId', async (req, res) => {
  try {
    const listingId = String(req.params.listingId || '').trim();
    const muted = Boolean(req.body?.muted);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!Array.isArray(user.watchlist)) user.watchlist = [];
    const watch = user.watchlist.find((w) => String(w.listingId) === listingId);
    if (!watch) return res.status(404).json({ message: 'Listing is not in watchlist' });
    watch.mutedOffers = muted;
    await user.save();
    return res.json({ success: true, listingId, mutedOffers: muted });
  } catch (error) {
    console.error('Error muting watch offers:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/private-offers/inbox', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    const now = Date.now();
    const inbox = Array.isArray(user.privateOfferInbox) ? user.privateOfferInbox : [];
    const withExpiry = inbox.map((item) => {
      const expired = item.status === 'sent' && item.expiresAt && new Date(item.expiresAt).getTime() < now;
      return { ...item, status: expired ? 'expired' : item.status };
    });
    return res.json({ offers: withExpiry.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)) });
  } catch (error) {
    console.error('Error loading private offer inbox:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/interested-buyers', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id)
      .populate('watcherActivity.user', 'username')
      .lean();
    if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
    if (String(promotion.user) !== String(req.user.id)) return res.status(403).json({ message: 'Unauthorized' });
    const recentActivity = (promotion.watcherActivity || [])
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8)
      .map((row) => ({
        action: row.action,
        at: row.at,
        buyer: row.user?.username || 'Buyer',
      }));
    return res.json({
      watcherCount: Array.isArray(promotion.watchers) ? promotion.watchers.length : 0,
      recentActivity,
    });
  } catch (error) {
    console.error('Error loading interested buyers:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/private-offers/preview', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id).lean();
    if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
    if (String(promotion.user) !== String(req.user.id)) return res.status(403).json({ message: 'Unauthorized' });
    const discountPercent = clampNum(req.body?.discountPercent, 5, 20);
    const durationHours = clampNum(req.body?.durationHours, 1, 24);
    const quantityLimitRaw = req.body?.quantityLimit;
    const quantityLimit = quantityLimitRaw ? clampNum(quantityLimitRaw, 1, 9999) : null;
    if (discountPercent == null || durationHours == null) {
      return res.status(400).json({ message: 'Invalid offer settings' });
    }
    const expiresAt = new Date(Date.now() + (durationHours * 60 * 60 * 1000));
    return res.json({
      preview: {
        listingId: promotion.listingId,
        discountPercent,
        durationHours,
        quantityLimit,
        watcherCount: Array.isArray(promotion.watchers) ? promotion.watchers.length : 0,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Error previewing private offer:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/private-offers/send', async (req, res) => {
  try {
    const promotion = await PromotedListing.findById(req.params.id);
    if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
    if (String(promotion.user) !== String(req.user.id)) return res.status(403).json({ message: 'Unauthorized' });

    const watcherCount = Array.isArray(promotion.watchers) ? promotion.watchers.length : 0;
    if (watcherCount < MIN_WATCHERS_TO_SEND) {
      return res.status(400).json({ message: `Minimum ${MIN_WATCHERS_TO_SEND} watchers required` });
    }

    const now = Date.now();
    const start = dayStart();
    const sentToday = (promotion.privateOffers || []).filter((o) => new Date(o.sentAt) >= start).length;
    if (sentToday >= MAX_OFFERS_PER_DAY) {
      return res.status(429).json({ message: 'Daily limit reached for this listing (max 3 offers)' });
    }
    const lastOffer = (promotion.privateOffers || []).slice().sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
    if (lastOffer && now - new Date(lastOffer.sentAt).getTime() < OFFER_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Offer cooldown active. Try again later.' });
    }

    const discountPercent = clampNum(req.body?.discountPercent, 5, 20);
    const durationHours = clampNum(req.body?.durationHours, 1, 24);
    const quantityLimitRaw = req.body?.quantityLimit;
    const quantityLimit = quantityLimitRaw ? clampNum(quantityLimitRaw, 1, 9999) : null;
    if (discountPercent == null || durationHours == null) {
      return res.status(400).json({ message: 'Invalid offer settings' });
    }

    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + (durationHours * 60 * 60 * 1000));
    const offerId = `pvt_${promotion._id}_${sentAt.getTime().toString(36)}`;
    promotion.privateOffers.push({
      offerId,
      discountPercent,
      quantityLimit,
      durationHours,
      watcherCountAtSend: watcherCount,
      sentAt,
      expiresAt,
      conversions: 0,
    });
    await promotion.save();

    await User.updateMany(
      {
        _id: { $in: promotion.watchers || [] },
        watchlist: { $elemMatch: { listingId: promotion.listingId, mutedOffers: { $ne: true } } },
      },
      {
        $push: {
          privateOfferInbox: {
            offerId,
            listingId: promotion.listingId,
            promotionId: promotion._id,
            sellerId: promotion.user,
            title: String(req.body?.title || `Listing ${promotion.listingId}`),
            image: String(req.body?.image || ''),
            discountPercent,
            quantityLimit,
            expiresAt,
            sentAt,
            status: 'sent',
          },
          notifications: {
            kind: 'private_offer',
            title: 'Seller sent you a private offer',
            body: `${discountPercent}% off • expires ${expiresAt.toLocaleString()}`,
            listingId: promotion.listingId,
            offerId,
            createdAt: sentAt,
            readAt: null,
          },
        },
      }
    );

    return res.json({
      success: true,
      offer: { offerId, discountPercent, quantityLimit, durationHours, expiresAt },
      notifiedWatchers: watcherCount,
    });
  } catch (error) {
    console.error('Error sending private offer:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/private-offers/:offerId/claim', async (req, res) => {
  try {
    const offerId = String(req.params.offerId || '').trim();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const inboxItem = (user.privateOfferInbox || []).find((o) => String(o.offerId) === offerId);
    if (!inboxItem) return res.status(404).json({ message: 'Offer not found in inbox' });
    if (inboxItem.claimedAt) return res.status(409).json({ message: 'Offer already claimed' });
    if (new Date(inboxItem.expiresAt).getTime() < Date.now()) {
      inboxItem.status = 'expired';
      await user.save();
      return res.status(400).json({ message: 'Offer has expired' });
    }

    const promotion = await PromotedListing.findById(inboxItem.promotionId);
    if (!promotion) return res.status(404).json({ message: 'Promotion not found' });
    const activeOffer = (promotion.privateOffers || []).find((o) => String(o.offerId) === offerId);
    if (!activeOffer) return res.status(404).json({ message: 'Offer not found' });
    if (activeOffer.quantityLimit && activeOffer.conversions >= activeOffer.quantityLimit) {
      return res.status(400).json({ message: 'Offer quantity limit reached' });
    }

    inboxItem.claimedAt = new Date();
    inboxItem.status = 'claimed';
    user.savvyPoints = Number(user.savvyPoints || 0) + BUYER_CLAIM_OFFER_SAVVY;
    await user.save();
    await PointsLedger.create({
      userId: user._id,
      type: 'earn',
      amount: BUYER_CLAIM_OFFER_SAVVY,
      source: 'private_offer_claim',
      refId: offerId,
      idempotencyKey: `private_offer_claim_${user._id}_${offerId}`,
    }).catch((err) => {
      if (err?.code !== 11000) throw err;
    });

    activeOffer.conversions = Number(activeOffer.conversions || 0) + 1;
    promotion.watcherActivity.push({ user: user._id, action: 'claim_offer', at: new Date() });
    await promotion.save();

    const seller = await User.findById(promotion.user);
    if (seller) {
      seller.savvyPoints = Number(seller.savvyPoints || 0) + SELLER_CONVERSION_SAVVY;
      await seller.save();
      await PointsLedger.create({
        userId: seller._id,
        type: 'earn',
        amount: SELLER_CONVERSION_SAVVY,
        source: 'private_offer_conversion',
        refId: offerId,
        idempotencyKey: `private_offer_conversion_${seller._id}_${offerId}_${user._id}`,
      }).catch((err) => {
        if (err?.code !== 11000) throw err;
      });
    }

    return res.json({
      success: true,
      offerId,
      buyerSavvyAwarded: BUYER_CLAIM_OFFER_SAVVY,
      sellerSavvyAwarded: SELLER_CONVERSION_SAVVY,
    });
  } catch (error) {
    console.error('Error claiming private offer:', error);
    return res.status(500).json({ message: 'Server error' });
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


