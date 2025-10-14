import api from './authService';

export const auctionService = {
  // Get all auctions with filters
  async getAuctions(filters = {}) {
    const params = new URLSearchParams();
    
    // Add filters to query params
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        params.append(key, value);
      }
    });

    const response = await api.get(`/auctions?${params.toString()}`);
    return response.data;
  },

  // Get single auction by ID
  async getAuction(id) {
    const response = await api.get(`/auctions/${id}`);
    return response.data;
  },

  // Place a bid on an auction
  async placeBid(auctionId, amount) {
    const response = await api.post(`/auctions/${auctionId}/bid`, { amount });
    return response.data;
  },

  // Watch/unwatch an auction
  async toggleWatch(auctionId) {
    const response = await api.post(`/auctions/${auctionId}/watch`);
    return response.data;
  },

  // Get trending auctions
  async getTrendingAuctions() {
    const response = await api.get('/auctions/trending/auctions');
    return response.data;
  },

  // Get ending soon auctions
  async getEndingSoonAuctions() {
    const response = await api.get('/auctions/ending-soon/auctions');
    return response.data;
  },

  // Get high deal potential auctions
  async getDealAuctions() {
    const response = await api.get('/auctions/deals/auctions');
    return response.data;
  },

  // Create new auction
  async createAuction(auctionData) {
    const response = await api.post('/auctions', auctionData);
    return response.data;
  }
};

export default auctionService;











