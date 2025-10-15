import api from './authService';

export const easterEggService = {
  // Redeem easter egg code
  redeemCode: (code) => {
    return api.post('/easter-eggs/redeem', { code });
  },

  // Get available easter egg codes
  getAvailableCodes: () => {
    return api.get('/easter-eggs/available');
  },

  // Get user's redemption history
  getRedemptionHistory: () => {
    return api.get('/easter-eggs/history');
  },

  // Get easter egg statistics (admin only)
  getStats: () => {
    return api.get('/easter-eggs/stats');
  },

  // Add new easter egg code (admin only)
  addCode: (codeData) => {
    return api.post('/easter-eggs/admin/add', codeData);
  },

  // Remove easter egg code (admin only)
  removeCode: (code) => {
    return api.delete(`/easter-eggs/admin/${code}`);
  }
};

export default easterEggService;








