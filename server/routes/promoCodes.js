const express = require('express');
const router = express.Router();
const PromoCode = require('../models/PromoCode');
const PromoCodeUsage = require('../models/PromoCodeUsage');
const Commission = require('../models/Commission');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Apply auth middleware to all routes
router.use(auth);

// ===== PUBLIC ROUTES =====

// Get all active promo codes (public)
router.get('/public', async (req, res) => {
  try {
    const codes = await PromoCode.find({
      isActive: true,
      isPublic: true,
      validFrom: { $lte: new Date() },
      $or: [
        { validUntil: null },
        { validUntil: { $gt: new Date() } }
      ]
    })
    .populate('creator', 'username')
    .select('code description discountType discountValue minimumOrderValue validUntil usageLimit usageCount')
    .sort({ usageCount: -1 });

    res.json(codes);
  } catch (error) {
    console.error('Error fetching public promo codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate and apply promo code
router.post('/validate', async (req, res) => {
  try {
    const { code, orderValue = 0 } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    }).populate('creator', 'username');

    if (!promoCode) {
      return res.status(404).json({ message: 'Invalid promo code' });
    }

    // Check if user has already used this code
    const userUsage = await PromoCodeUsage.getUserCodeUsage(req.user.id, promoCode._id);
    if (userUsage >= promoCode.userUsageLimit) {
      return res.status(400).json({ 
        message: `You have already used this code ${promoCode.userUsageLimit} time(s)` 
      });
    }

    // Validate code usage
    const validation = promoCode.validateUsage(req.user.id, orderValue);
    if (!validation.isValid) {
      return res.status(400).json({ 
        message: validation.errors.join(', ') 
      });
    }

    // Calculate discount
    const discount = promoCode.calculateDiscount(orderValue);

    res.json({
      valid: true,
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        description: promoCode.description,
        creator: promoCode.creator.username,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue
      },
      discount: discount,
      userUsageCount: userUsage,
      userUsageLimit: promoCode.userUsageLimit
    });

  } catch (error) {
    console.error('Error validating promo code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply promo code to order
router.post('/apply', async (req, res) => {
  try {
    const { code, orderValue = 0, orderId } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!promoCode) {
      return res.status(404).json({ message: 'Invalid promo code' });
    }

    // Check if user has already used this code
    const userUsage = await PromoCodeUsage.getUserCodeUsage(req.user.id, promoCode._id);
    if (userUsage >= promoCode.userUsageLimit) {
      return res.status(400).json({ 
        message: `You have already used this code ${promoCode.userUsageLimit} time(s)` 
      });
    }

    // Validate code usage
    const validation = promoCode.validateUsage(req.user.id, orderValue);
    if (!validation.isValid) {
      return res.status(400).json({ 
        message: validation.errors.join(', ') 
      });
    }

    // Calculate discount
    const discount = promoCode.calculateDiscount(orderValue);

    // Create usage record
    const usage = new PromoCodeUsage({
      promoCode: promoCode._id,
      user: req.user.id,
      orderId: orderId,
      orderValue: orderValue,
      discountAmount: discount.discountAmount,
      finalAmount: discount.finalAmount,
      commissionAmount: (orderValue * promoCode.commissionRate) / 100,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await usage.save();

    // Increment usage count
    await promoCode.incrementUsage();
    await promoCode.addRevenue(orderValue);

    // Create commission if applicable
    if (promoCode.commissionRate > 0) {
      await Commission.createFromUsage(usage);
    }

    res.json({
      success: true,
      usageId: usage._id,
      discount: discount,
      commissionAmount: usage.commissionAmount
    });

  } catch (error) {
    console.error('Error applying promo code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== CREATOR ROUTES =====

// Get creator's promo codes
router.get('/creator/my-codes', async (req, res) => {
  try {
    const codes = await PromoCode.find({ creator: req.user.id })
      .sort({ createdAt: -1 });

    res.json(codes);
  } catch (error) {
    console.error('Error fetching creator codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get creator stats
router.get('/creator/stats', async (req, res) => {
  try {
    const stats = await PromoCode.getCreatorStats(req.user.id);
    const earnings = await Commission.getCreatorEarnings(req.user.id);
    
    res.json({
      promoStats: stats[0] || {
        totalCodes: 0,
        activeCodes: 0,
        totalUsage: 0,
        totalRevenue: 0,
        totalCommission: 0
      },
      earnings: earnings
    });
  } catch (error) {
    console.error('Error fetching creator stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get creator's commissions
router.get('/creator/commissions', async (req, res) => {
  try {
    const { status } = req.query;
    const commissions = await Commission.getCreatorCommissions(req.user.id, status);
    
    res.json(commissions);
  } catch (error) {
    console.error('Error fetching creator commissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new promo code
router.post('/creator/create', async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      usageLimit,
      userUsageLimit,
      validUntil,
      minimumOrderValue,
      commissionRate,
      tags,
      notes
    } = req.body;

    // Validate required fields
    if (!code || !description || !discountType || discountValue === undefined) {
      return res.status(400).json({ 
        message: 'Code, description, discount type, and discount value are required' 
      });
    }

    // Check if code already exists
    const existingCode = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ message: 'Promo code already exists' });
    }

    // Create new promo code
    const promoCode = new PromoCode({
      code: code.toUpperCase(),
      description,
      creator: req.user.id,
      discountType,
      discountValue,
      usageLimit,
      userUsageLimit: userUsageLimit || 1,
      validUntil: validUntil ? new Date(validUntil) : null,
      minimumOrderValue: minimumOrderValue || 0,
      commissionRate: commissionRate || 0,
      tags: tags || [],
      notes,
      createdBy: req.user.id
    });

    await promoCode.save();
    await promoCode.populate('creator', 'username email');

    res.status(201).json(promoCode);

  } catch (error) {
    console.error('Error creating promo code:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update promo code
router.put('/creator/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.creator;
    delete updateData.createdBy;
    delete updateData.usageCount;
    delete updateData.totalRevenue;
    delete updateData.totalCommission;

    const promoCode = await PromoCode.findOneAndUpdate(
      { _id: id, creator: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!promoCode) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    res.json(promoCode);

  } catch (error) {
    console.error('Error updating promo code:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get code usage history
router.get('/creator/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const promoCode = await PromoCode.findOne({ _id: id, creator: req.user.id });
    if (!promoCode) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    const usage = await PromoCodeUsage.getCodeUsageHistory(id, 100);
    
    res.json(usage);
  } catch (error) {
    console.error('Error fetching code usage:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== ADMIN ROUTES =====

// Get all promo codes (admin)
router.get('/admin/all', isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, creator } = req.query;
    const query = {};

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (creator) {
      query.creator = creator;
    }

    const codes = await PromoCode.find(query)
      .populate('creator', 'username email firstName lastName')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PromoCode.countDocuments(query);

    res.json({
      codes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching all promo codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin analytics
router.get('/admin/analytics', isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const match = {};
    if (startDate && endDate) {
      match.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const analytics = await PromoCode.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCodes: { $sum: 1 },
          activeCodes: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalUsage: { $sum: '$usageCount' },
          totalRevenue: { $sum: '$totalRevenue' },
          totalCommission: { $sum: '$totalCommission' }
        }
      }
    ]);

    const topCodes = await PromoCode.getPopularCodes(10);
    const pendingPayouts = await Commission.getPendingPayouts();

    res.json({
      overview: analytics[0] || {
        totalCodes: 0,
        activeCodes: 0,
        totalUsage: 0,
        totalRevenue: 0,
        totalCommission: 0
      },
      topCodes,
      pendingPayouts
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create promo code (admin)
router.post('/admin/create', isAdmin, async (req, res) => {
  try {
    const promoCodeData = req.body;
    promoCodeData.createdBy = req.user.id;

    const promoCode = new PromoCode(promoCodeData);
    await promoCode.save();
    await promoCode.populate('creator', 'username email');

    res.status(201).json(promoCode);
  } catch (error) {
    console.error('Error creating promo code (admin):', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update promo code (admin)
router.put('/admin/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const promoCode = await PromoCode.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('creator', 'username email');

    if (!promoCode) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    res.json(promoCode);
  } catch (error) {
    console.error('Error updating promo code (admin):', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete promo code (admin)
router.delete('/admin/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await PromoCode.findByIdAndDelete(id);
    if (!promoCode) {
      return res.status(404).json({ message: 'Promo code not found' });
    }

    res.json({ message: 'Promo code deleted successfully' });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all commissions (admin)
router.get('/admin/commissions', isAdmin, async (req, res) => {
  try {
    const { status, creator, page = 1, limit = 20 } = req.query;
    
    const match = {};
    if (status) match.status = status;
    if (creator) match.creator = creator;

    const commissions = await Commission.find(match)
      .populate('creator', 'username email firstName lastName')
      .populate('promoCode', 'code description')
      .populate('promoCodeUsage', 'orderValue discountAmount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Commission.countDocuments(match);

    res.json({
      commissions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve commission (admin)
router.put('/admin/commissions/:id/approve', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await Commission.findById(id);
    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    await commission.approve(req.user.id);
    await commission.populate('creator', 'username email');

    res.json(commission);
  } catch (error) {
    console.error('Error approving commission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Pay commission (admin)
router.put('/admin/commissions/:id/pay', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, transactionId } = req.body;

    const commission = await Commission.findById(id);
    if (!commission) {
      return res.status(404).json({ message: 'Commission not found' });
    }

    await commission.pay(paidAmount || commission.commissionAmount, transactionId);
    await commission.populate('creator', 'username email');

    res.json(commission);
  } catch (error) {
    console.error('Error paying commission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;








