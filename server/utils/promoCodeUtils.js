const mongoose = require('mongoose');
const PromoCode = require('../models/PromoCode');
const PromoCodeUsage = require('../models/PromoCodeUsage');
const Commission = require('../models/Commission');

// Utility functions for promo code operations

/**
 * Generate a unique promo code
 * @param {string} prefix - Optional prefix for the code
 * @param {number} length - Length of the random part
 * @returns {Promise<string>} - Generated unique code
 */
const generateUniqueCode = async (prefix = '', length = 6) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    let code = prefix.toUpperCase();
    
    // Add random characters
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existingCode = await PromoCode.findOne({ code });
    if (!existingCode) {
      return code;
    }

    attempts++;
  }

  throw new Error('Unable to generate unique promo code after maximum attempts');
};

/**
 * Validate promo code format
 * @param {string} code - Code to validate
 * @returns {boolean} - Is valid format
 */
const isValidCodeFormat = (code) => {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 3 || code.length > 50) return false;
  return /^[A-Z0-9_-]+$/i.test(code);
};

/**
 * Calculate commission amount
 * @param {number} orderValue - Order value
 * @param {number} commissionRate - Commission rate percentage
 * @returns {number} - Commission amount
 */
const calculateCommission = (orderValue, commissionRate) => {
  return (orderValue * commissionRate) / 100;
};

/**
 * Get promo code performance metrics
 * @param {string} promoCodeId - Promo code ID
 * @param {Date} startDate - Start date for metrics
 * @param {Date} endDate - End date for metrics
 * @returns {Promise<Object>} - Performance metrics
 */
const getPromoCodeMetrics = async (promoCodeId, startDate = null, endDate = null) => {
  const match = { promoCode: mongoose.Types.ObjectId(promoCodeId) };
  
  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const metrics = await PromoCodeUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalUsage: { $sum: 1 },
        totalRevenue: { $sum: '$orderValue' },
        totalDiscount: { $sum: '$discountAmount' },
        totalCommission: { $sum: '$commissionAmount' },
        averageOrderValue: { $avg: '$orderValue' },
        averageDiscount: { $avg: '$discountAmount' }
      }
    }
  ]);

  return metrics[0] || {
    totalUsage: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    totalCommission: 0,
    averageOrderValue: 0,
    averageDiscount: 0
  };
};

/**
 * Get creator performance summary
 * @param {string} creatorId - Creator ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} - Creator performance
 */
const getCreatorPerformance = async (creatorId, startDate = null, endDate = null) => {
  const match = { creator: mongoose.Types.ObjectId(creatorId) };
  
  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const performance = await PromoCode.aggregate([
    { $match: match },
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
                  {
                    $or: [
                      { $eq: ['$validUntil', null] },
                      { $gt: ['$validUntil', new Date()] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        },
        totalUsage: { $sum: '$usageCount' },
        totalRevenue: { $sum: '$totalRevenue' },
        totalCommission: { $sum: '$totalCommission' },
        averageCommissionRate: { $avg: '$commissionRate' }
      }
    }
  ]);

  return performance[0] || {
    totalCodes: 0,
    activeCodes: 0,
    totalUsage: 0,
    totalRevenue: 0,
    totalCommission: 0,
    averageCommissionRate: 0
  };
};

/**
 * Get daily usage statistics
 * @param {string} promoCodeId - Promo code ID (optional)
 * @param {string} creatorId - Creator ID (optional)
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} - Daily usage data
 */
const getDailyUsageStats = async (promoCodeId = null, creatorId = null, days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const match = {
    createdAt: { $gte: startDate }
  };

  if (promoCodeId) {
    match.promoCode = mongoose.Types.ObjectId(promoCodeId);
  }

  if (creatorId) {
    match.creator = mongoose.Types.ObjectId(creatorId);
  }

  const dailyStats = await PromoCodeUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        usage: { $sum: 1 },
        revenue: { $sum: '$orderValue' },
        discount: { $sum: '$discountAmount' },
        commission: { $sum: '$commissionAmount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  // Format the data for charts
  return dailyStats.map(stat => ({
    date: new Date(stat._id.year, stat._id.month - 1, stat._id.day).toISOString().split('T')[0],
    usage: stat.usage,
    revenue: stat.revenue,
    discount: stat.discount,
    commission: stat.commission
  }));
};

/**
 * Check if user can use promo code
 * @param {string} userId - User ID
 * @param {string} promoCodeId - Promo code ID
 * @returns {Promise<boolean>} - Can use code
 */
const canUserUseCode = async (userId, promoCodeId) => {
  const promoCode = await PromoCode.findById(promoCodeId);
  if (!promoCode) return false;

  const userUsage = await PromoCodeUsage.getUserCodeUsage(userId, promoCodeId);
  return userUsage < promoCode.userUsageLimit;
};

/**
 * Get expired promo codes
 * @returns {Promise<Array>} - Expired codes
 */
const getExpiredPromoCodes = async () => {
  return PromoCode.find({
    isActive: true,
    validUntil: { $lt: new Date() }
  });
};

/**
 * Deactivate expired promo codes
 * @returns {Promise<number>} - Number of codes deactivated
 */
const deactivateExpiredCodes = async () => {
  const result = await PromoCode.updateMany(
    {
      isActive: true,
      validUntil: { $lt: new Date() }
    },
    {
      $set: { isActive: false }
    }
  );

  return result.modifiedCount;
};

/**
 * Get low usage promo codes (for cleanup suggestions)
 * @param {number} days - Days to look back
 * @param {number} threshold - Usage threshold
 * @returns {Promise<Array>} - Low usage codes
 */
const getLowUsageCodes = async (days = 30, threshold = 5) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return PromoCode.find({
    isActive: true,
    usageCount: { $lt: threshold },
    createdAt: { $lt: startDate }
  }).populate('creator', 'username email');
};

/**
 * Calculate conversion rate for promo code
 * @param {string} promoCodeId - Promo code ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} - Conversion metrics
 */
const getConversionMetrics = async (promoCodeId, startDate = null, endDate = null) => {
  const match = { promoCode: mongoose.Types.ObjectId(promoCodeId) };
  
  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const conversion = await PromoCodeUsage.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalUsage: { $sum: 1 },
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$orderValue' },
        averageOrderValue: { $avg: '$orderValue' },
        averageDiscount: { $avg: '$discountAmount' },
        uniqueUsers: { $addToSet: '$user' }
      }
    },
    {
      $project: {
        totalUsage: 1,
        totalOrders: 1,
        totalRevenue: 1,
        averageOrderValue: 1,
        averageDiscount: 1,
        uniqueUsers: { $size: '$uniqueUsers' }
      }
    }
  ]);

  const metrics = conversion[0] || {
    totalUsage: 0,
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    averageDiscount: 0,
    uniqueUsers: 0
  };

  // Calculate additional metrics
  metrics.conversionRate = metrics.uniqueUsers > 0 ? (metrics.totalUsage / metrics.uniqueUsers) : 0;
  metrics.revenuePerUser = metrics.uniqueUsers > 0 ? (metrics.totalRevenue / metrics.uniqueUsers) : 0;

  return metrics;
};

module.exports = {
  generateUniqueCode,
  isValidCodeFormat,
  calculateCommission,
  getPromoCodeMetrics,
  getCreatorPerformance,
  getDailyUsageStats,
  canUserUseCode,
  getExpiredPromoCodes,
  deactivateExpiredCodes,
  getLowUsageCodes,
  getConversionMetrics
};








