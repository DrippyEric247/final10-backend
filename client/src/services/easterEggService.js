import api from './authService';

export const easterEggService = {
  redeemCode: (code) => api.post('/easter-eggs/redeem', { code }),

  getAvailableCodes: () => api.get('/easter-eggs/available'),

  getAvailable: () => api.get('/easter-eggs/available'),

  getRedemptionHistory: () => api.get('/easter-eggs/history'),

  getHistory: () => api.get('/easter-eggs/history'),

  getStats: () => api.get('/easter-eggs/stats'),

  getTrailerRedemptions: (params = {}) =>
    api.get('/easter-eggs/admin/trailer-redemptions', { params }),

  addCode: (codeData) => api.post('/easter-eggs/admin/add', codeData),

  removeCode: (code) => api.delete(`/easter-eggs/admin/${code}`),
};

export default easterEggService;
