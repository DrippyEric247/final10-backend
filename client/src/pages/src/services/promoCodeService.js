import api from './authService';

export const promoCodeService = {
  // Public promo codes
  getPublicPromoCodes: () => {
    return api.get('/promo-codes/public');
  },

  // Validate promo code
  validatePromoCode: (code, orderValue = 0) => {
    return api.post('/promo-codes/validate', { code, orderValue });
  },

  // Apply promo code
  applyPromoCode: (code, orderValue = 0, orderId = null) => {
    return api.post('/promo-codes/apply', { code, orderValue, orderId });
  },

  // Creator endpoints
  getMyPromoCodes: () => {
    return api.get('/promo-codes/creator/my-codes');
  },

  getCreatorStats: () => {
    return api.get('/promo-codes/creator/stats');
  },

  getCreatorCommissions: (status = null) => {
    const params = status ? { status } : {};
    return api.get('/promo-codes/creator/commissions', { params });
  },

  createPromoCode: (promoCodeData) => {
    return api.post('/promo-codes/creator/create', promoCodeData);
  },

  updatePromoCode: (id, updateData) => {
    return api.put(`/promo-codes/creator/${id}`, updateData);
  },

  getCodeUsageHistory: (id) => {
    return api.get(`/promo-codes/creator/${id}/usage`);
  },

  // Admin endpoints
  getAllPromoCodes: (params = {}) => {
    return api.get('/promo-codes/admin/all', { params });
  },

  getAdminAnalytics: (startDate = null, endDate = null) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/promo-codes/admin/analytics', { params });
  },

  createPromoCodeAdmin: (promoCodeData) => {
    return api.post('/promo-codes/admin/create', promoCodeData);
  },

  updatePromoCodeAdmin: (id, updateData) => {
    return api.put(`/promo-codes/admin/${id}`, updateData);
  },

  deletePromoCode: (id) => {
    return api.delete(`/promo-codes/admin/${id}`);
  },

  getAllCommissions: (params = {}) => {
    return api.get('/promo-codes/admin/commissions', { params });
  },

  approveCommission: (id) => {
    return api.put(`/promo-codes/admin/commissions/${id}/approve`);
  },

  payCommission: (id, paidAmount, transactionId = null) => {
    return api.put(`/promo-codes/admin/commissions/${id}/pay`, {
      paidAmount,
      transactionId
    });
  }
};

export default promoCodeService;







