import api from './authService';

class PromotionService {
  // ===== PACKAGE MANAGEMENT =====
  
  async getPackages(type = null) {
    try {
      const params = type ? { type } : {};
      const response = await api.get('/api/promotions/packages', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching promotion packages:', error);
      throw error;
    }
  }

  async getPopularPackages() {
    try {
      const response = await api.get('/api/promotions/packages/popular');
      return response.data;
    } catch (error) {
      console.error('Error fetching popular packages:', error);
      throw error;
    }
  }

  async getRecommendedPackages() {
    try {
      const response = await api.get('/api/promotions/packages/recommended');
      return response.data;
    } catch (error) {
      console.error('Error fetching recommended packages:', error);
      throw error;
    }
  }

  // ===== PROMOTION CREATION =====
  
  async createPromotion(promotionData) {
    try {
      const response = await api.post('/api/promotions/create', promotionData);
      return response.data;
    } catch (error) {
      console.error('Error creating promotion:', error);
      throw error;
    }
  }

  // ===== PAYMENT PROCESSING =====
  
  async createPaymentIntent(promotionId) {
    try {
      const response = await api.post('/api/promotions/payment/create-intent', {
        promotionId
      });
      return response.data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async confirmPayment(paymentData) {
    try {
      const response = await api.post('/api/promotions/payment/confirm', paymentData);
      return response.data;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  // ===== PROMOTION MANAGEMENT =====
  
  async getMyPromotions(status = null) {
    try {
      const params = status ? { status } : {};
      const response = await api.get('/api/promotions/my-promotions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching user promotions:', error);
      throw error;
    }
  }

  async getPromotion(promotionId) {
    try {
      const response = await api.get(`/api/promotions/${promotionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching promotion:', error);
      throw error;
    }
  }

  async updatePromotion(promotionId, updateData) {
    try {
      const response = await api.put(`/api/promotions/${promotionId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating promotion:', error);
      throw error;
    }
  }

  async pausePromotion(promotionId) {
    try {
      const response = await api.put(`/api/promotions/${promotionId}/pause`);
      return response.data;
    } catch (error) {
      console.error('Error pausing promotion:', error);
      throw error;
    }
  }

  async resumePromotion(promotionId) {
    try {
      const response = await api.put(`/api/promotions/${promotionId}/resume`);
      return response.data;
    } catch (error) {
      console.error('Error resuming promotion:', error);
      throw error;
    }
  }

  async cancelPromotion(promotionId) {
    try {
      const response = await api.put(`/api/promotions/${promotionId}/cancel`);
      return response.data;
    } catch (error) {
      console.error('Error cancelling promotion:', error);
      throw error;
    }
  }

  // ===== TRENDING FEED =====
  
  async getTrendingFeed(category = 'all', limit = 20) {
    try {
      const response = await api.get('/api/promotions/trending/feed', {
        params: { category, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching trending feed:', error);
      throw error;
    }
  }

  // ===== ANALYTICS =====
  
  async getAnalytics() {
    try {
      const response = await api.get('/api/promotions/analytics/overview');
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }

  // ===== ADMIN ENDPOINTS =====
  
  async getAllPromotions(status = null, page = 1, limit = 20) {
    try {
      const params = { page, limit };
      if (status) params.status = status;
      
      const response = await api.get('/api/promotions/admin/all', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching all promotions:', error);
      throw error;
    }
  }

  // ===== UTILITY METHODS =====
  
  formatPromotionDuration(hours) {
    if (hours < 24) {
      return `${hours}h`;
    } else if (hours < 168) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    } else {
      const weeks = Math.floor(hours / 168);
      const remainingDays = Math.floor((hours % 168) / 24);
      return remainingDays > 0 ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
    }
  }

  calculatePromotionROI(spent, revenue) {
    if (!spent || spent === 0) return 0;
    return ((revenue - spent) / spent) * 100;
  }

  getPromotionStatusColor(status) {
    const colors = {
      pending: 'text-yellow-400',
      active: 'text-green-400',
      paused: 'text-orange-400',
      completed: 'text-blue-400',
      cancelled: 'text-red-400'
    };
    return colors[status] || 'text-gray-400';
  }

  getPromotionTypeIcon(type) {
    const icons = {
      featured: '👑',
      promoted: '⭐',
      sponsored: '🎯',
      trending: '🔥',
      category: '📂'
    };
    return icons[type] || '📢';
  }
}

export default new PromotionService();







