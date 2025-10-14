import axios from "axios";

// force baseURL to backend (skip dev proxy)
const API_BASE ='/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Rate limiting handler - prevent excessive requests
let requestCount = 0;
let lastRequestTime = 0;
const REQUEST_LIMIT = 30; // Max 30 requests per minute (increased from 10)
const TIME_WINDOW = 60000; // 1 minute

// Request interceptor to track requests
api.interceptors.request.use(
  (config) => {
    const now = Date.now();
    
    // Reset counter if time window has passed
    if (now - lastRequestTime > TIME_WINDOW) {
      requestCount = 0;
      lastRequestTime = now;
    }
    
    // Check if we're hitting rate limits
    if (requestCount >= REQUEST_LIMIT) {
      const timeUntilReset = TIME_WINDOW - (now - lastRequestTime);
      console.warn(`Rate limit reached. Waiting ${Math.ceil(timeUntilReset / 1000)} seconds...`);
      
      // Instead of rejecting, add a small delay to prevent overwhelming the server
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(config);
        }, Math.min(timeUntilReset, 5000)); // Max 5 second delay
      });
    }
    
    requestCount++;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 429 errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      console.warn(`Rate limited by server. Retry after ${retryAfter} seconds.`);
      
      // Create a more user-friendly error message
      const rateLimitError = new Error(`Too many requests. Please wait ${retryAfter} seconds before trying again.`);
      rateLimitError.status = 429;
      rateLimitError.retryAfter = retryAfter;
      
      return Promise.reject(rateLimitError);
    }
    
    return Promise.reject(error);
  }
);

// token helpers (unchanged)
export const STORAGE_KEY = "f10_token";
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem(STORAGE_KEY);
    delete api.defaults.headers.common.Authorization;
  }
}
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) setAuthToken(saved);

// AUTH endpoints (note the /api prefix now baked into baseURL)
export async function loginUser({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  setAuthToken(data.token);
  return data.user;
}
export async function registerUser(payload) {
  const { data } = await api.post("/auth/signup", payload);
  setAuthToken(data.token);
  return data.user;
}


/** NEW: get current user from token */
export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data; // { id, email, username, ... }
}

/** ---- Points ---- **/
export async function getMyPoints() {
  const { data } = await api.get("/points/me");
  return data; // { balance, history }
}

export async function claimDailyLogin() {
  const { data } = await api.post("/auctions/claim-daily-login");
  return data; // { newBalance, added } or { message }
}

/** ---- Alerts ---- **/
export async function getAlerts() {
  const { data } = await api.get("/alerts");
  return data;
}

export async function createAlert(alertData) {
  const { data } = await api.post("/alerts", alertData);
  return data;
}

export async function toggleAlert(alertId) {
  const { data } = await api.patch(`/alerts/${alertId}/toggle`);
  return data;
}

export async function deleteAlert(alertId) {
  const { data } = await api.delete(`/alerts/${alertId}`);
  return data;
}

/** ---- Daily Tasks ---- **/
export async function getDailyTasks() {
  const { data } = await api.get("/auctions/daily-tasks");
  return data;
}

export async function watchAd() {
  const { data } = await api.post("/auctions/watch-ad");
  return data;
}

export async function trackAppShare(shareUrl, platform) {
  const { data } = await api.post("/auctions/track-app-share", {
    shareUrl,
    platform
  });
  return data;
}

export async function trackProductShare(productId, productTitle, shareUrl, platform) {
  const { data } = await api.post("/auctions/track-product-share", {
    productId,
    productTitle,
    shareUrl,
    platform
  });
  return data;
}

export async function completeSocialPost(platform, postUrl) {
  const { data } = await api.post("/auctions/complete-social-post", {
    platform,
    postUrl
  });
  return data;
}

/** ---- Level System ---- **/
export async function getLevelInfo() {
  const { data } = await api.get("/levels/me");
  return data;
}

export async function getLevelLeaderboard(type = 'level', limit = 50) {
  const { data } = await api.get("/levels/leaderboard", {
    params: { type, limit }
  });
  return data;
}

export async function getMilestones() {
  const { data } = await api.get("/levels/milestones");
  return data;
}

export async function getLevelStats() {
  const { data } = await api.get("/levels/stats");
  return data;
}

// Payment API functions
export async function createPaymentIntent(planId = 'monthly') {
  const { data } = await api.post("/payments/create-payment-intent", { planId });
  return data;
}

export async function confirmPayment(paymentIntentId) {
  const { data } = await api.post("/payments/confirm-payment", { paymentIntentId });
  return data;
}

export async function getSubscriptionStatus() {
  const { data } = await api.get("/payments/subscription-status");
  return data;
}

export async function getPaymentPlans() {
  const { data } = await api.get("/payments/plans");
  return data;
}

export async function cancelSubscription() {
  const { data } = await api.post("/payments/cancel-subscription");
  return data;
}

// Local Deals API functions
export async function searchLocalDeals(searchTerm, limit = 10, radius = 25) {
  const { data } = await api.get("/local-deals/search", {
    params: { q: searchTerm, limit, radius }
  });
  return data;
}

export async function getTrendingLocalDeals(category = 'all', limit = 20) {
  const { data } = await api.get("/local-deals/trending", {
    params: { category, limit }
  });
  return data;
}

export async function getLocalDealsByCategory(category, limit = 15) {
  const { data } = await api.get(`/local-deals/categories/${category}`, {
    params: { limit }
  });
  return data;
}

// Daily task tracking functions
export async function trackVideoScanner() {
  const { data } = await api.post("/auctions/track-video-scanner");
  return data;
}

export async function trackLocalDealsSearch(searchTerm) {
  const { data } = await api.post("/auctions/track-local-deals-search", { searchTerm });
  return data;
}

// Community Goals API functions
export async function getCommunityGoals() {
  const { data } = await api.get("/community/goals");
  return data;
}

export async function getCommunityProgress() {
  const { data } = await api.get("/community/progress");
  return data;
}

export async function claimCommunityReward() {
  const { data } = await api.post("/community/claim-reward");
  return data;
}

/** ---- eBay API ---- **/
export async function searchEbayItems(searchParams = {}) {
  const { data } = await api.get("/ebay/search", { params: searchParams });
  return data;
}

export async function getEbayItemDetails(itemId) {
  const { data } = await api.get(`/ebay/item/${itemId}`);
  return data;
}

export async function getEbayTrendingItems(category = 'all', limit = 20) {
  const { data } = await api.get("/ebay/trending", { params: { category, limit } });
  return data;
}

export async function getEbayEndingSoonItems(limit = 20) {
  const { data } = await api.get("/ebay/ending-soon", { params: { limit } });
  return data;
}

export async function getEbayBestDeals(limit = 20) {
  const { data } = await api.get("/ebay/best-deals", { params: { limit } });
  return data;
}

export async function getEbayCategories(parentCategoryId = null) {
  const params = parentCategoryId ? { parentCategoryId } : {};
  const { data } = await api.get("/ebay/categories", { params });
  return data;
}

export async function getEbayWatchlist() {
  const { data } = await api.get("/ebay/watchlist");
  return data;
}

export async function addToEbayWatchlist(itemId) {
  const { data } = await api.post("/ebay/watchlist", { itemId });
  return data;
}

export async function removeFromEbayWatchlist(itemId) {
  const { data } = await api.delete(`/ebay/watchlist/${itemId}`);
  return data;
}


