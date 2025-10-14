const PromoCode = require('../models/PromoCode');
const PromoCodeUsage = require('../models/PromoCodeUsage');

// Middleware to validate promo code format
const validatePromoCodeFormat = (req, res, next) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ message: 'Promo code is required' });
  }
  
  // Check format: only letters, numbers, underscores, and hyphens
  const codeRegex = /^[A-Z0-9_-]+$/i;
  if (!codeRegex.test(code)) {
    return res.status(400).json({ 
      message: 'Promo code can only contain letters, numbers, underscores, and hyphens' 
    });
  }
  
  // Check length
  if (code.length < 3 || code.length > 50) {
    return res.status(400).json({ 
      message: 'Promo code must be between 3 and 50 characters' 
    });
  }
  
  next();
};

// Middleware to validate discount configuration
const validateDiscountConfig = (req, res, next) => {
  const { discountType, discountValue, minimumOrderValue } = req.body;
  
  // Validate discount type
  const validDiscountTypes = ['percentage', 'fixed', 'free_shipping'];
  if (!validDiscountTypes.includes(discountType)) {
    return res.status(400).json({ 
      message: 'Invalid discount type. Must be percentage, fixed, or free_shipping' 
    });
  }
  
  // Validate discount value
  if (discountValue === undefined || discountValue === null) {
    return res.status(400).json({ message: 'Discount value is required' });
  }
  
  if (typeof discountValue !== 'number' || discountValue < 0) {
    return res.status(400).json({ 
      message: 'Discount value must be a positive number' 
    });
  }
  
  // Validate percentage discount
  if (discountType === 'percentage' && discountValue > 100) {
    return res.status(400).json({ 
      message: 'Percentage discount cannot exceed 100%' 
    });
  }
  
  // Validate minimum order value
  if (minimumOrderValue !== undefined && minimumOrderValue < 0) {
    return res.status(400).json({ 
      message: 'Minimum order value must be positive' 
    });
  }
  
  next();
};

// Middleware to validate usage limits
const validateUsageLimits = (req, res, next) => {
  const { usageLimit, userUsageLimit } = req.body;
  
  if (usageLimit !== undefined && usageLimit !== null) {
    if (typeof usageLimit !== 'number' || usageLimit < 1) {
      return res.status(400).json({ 
        message: 'Usage limit must be a positive number' 
      });
    }
  }
  
  if (userUsageLimit !== undefined && userUsageLimit !== null) {
    if (typeof userUsageLimit !== 'number' || userUsageLimit < 1) {
      return res.status(400).json({ 
        message: 'User usage limit must be a positive number' 
      });
    }
  }
  
  next();
};

// Middleware to validate date ranges
const validateDateRanges = (req, res, next) => {
  const { validFrom, validUntil } = req.body;
  
  if (validFrom) {
    const fromDate = new Date(validFrom);
    if (isNaN(fromDate.getTime())) {
      return res.status(400).json({ message: 'Invalid valid from date' });
    }
  }
  
  if (validUntil) {
    const untilDate = new Date(validUntil);
    if (isNaN(untilDate.getTime())) {
      return res.status(400).json({ message: 'Invalid valid until date' });
    }
    
    // Check if valid until is in the future
    if (untilDate <= new Date()) {
      return res.status(400).json({ 
        message: 'Valid until date must be in the future' 
      });
    }
  }
  
  // Check if valid from is before valid until
  if (validFrom && validUntil) {
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    if (fromDate >= untilDate) {
      return res.status(400).json({ 
        message: 'Valid from date must be before valid until date' 
      });
    }
  }
  
  next();
};

// Middleware to validate commission rate
const validateCommissionRate = (req, res, next) => {
  const { commissionRate } = req.body;
  
  if (commissionRate !== undefined && commissionRate !== null) {
    if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ 
        message: 'Commission rate must be between 0 and 100' 
      });
    }
  }
  
  next();
};

// Middleware to check if user can create promo codes
const canCreatePromoCode = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if user has permission to create promo codes
    // This could be based on user role, subscription tier, or other criteria
    const canCreate = user.membershipTier === 'premium' || 
                     user.membershipTier === 'pro' || 
                     user.role === 'admin' ||
                     user.role === 'influencer';
    
    if (!canCreate) {
      return res.status(403).json({ 
        message: 'You need a premium subscription to create promo codes' 
      });
    }
    
    // Check if user has reached their promo code limit
    const userCodeCount = await PromoCode.countDocuments({ creator: user.id });
    const maxCodes = user.membershipTier === 'pro' ? 50 : 
                    user.membershipTier === 'premium' ? 20 : 5;
    
    if (userCodeCount >= maxCodes) {
      return res.status(400).json({ 
        message: `You have reached the maximum number of promo codes (${maxCodes}). Upgrade to create more.` 
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking promo code creation permission:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to validate order value
const validateOrderValue = (req, res, next) => {
  const { orderValue } = req.body;
  
  if (orderValue !== undefined && orderValue !== null) {
    if (typeof orderValue !== 'number' || orderValue < 0) {
      return res.status(400).json({ 
        message: 'Order value must be a positive number' 
      });
    }
  }
  
  next();
};

// Combined validation middleware for promo code creation
const validatePromoCodeCreation = [
  validatePromoCodeFormat,
  validateDiscountConfig,
  validateUsageLimits,
  validateDateRanges,
  validateCommissionRate,
  canCreatePromoCode
];

// Combined validation middleware for promo code application
const validatePromoCodeApplication = [
  validatePromoCodeFormat,
  validateOrderValue
];

module.exports = {
  validatePromoCodeFormat,
  validateDiscountConfig,
  validateUsageLimits,
  validateDateRanges,
  validateCommissionRate,
  canCreatePromoCode,
  validateOrderValue,
  validatePromoCodeCreation,
  validatePromoCodeApplication
};








