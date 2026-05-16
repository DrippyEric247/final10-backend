import axios from "axios";
import { devDiagApiFailure } from "./devApiDiagnostics";
import { parseApiError } from "./apiErrorParsing";
import { trackEvent } from "./analytics";
import { getApiBaseUrl } from "./runtimeApi";

const API_BASE = getApiBaseUrl();

const DEFAULT_TIMEOUT_MS = Math.min(Math.max(Number(process.env.REACT_APP_API_TIMEOUT_MS) || 28000, 8000), 120000);

export const api = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
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
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`Rate limit reached. Waiting ${Math.ceil(timeUntilReset / 1000)} seconds...`);
      }
      
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
    const url = String(error?.config?.url || "");
    const method = String(error?.config?.method || "get").toUpperCase();
    const parsed = parseApiError(error);
    const isAuth = /^\/auth\//.test(url) || error?.response?.status === 401 || error?.response?.status === 403;
    const isEbay = /^\/ebay\//.test(url);
    try {
      trackEvent("api_failure", {
        path: url,
        method,
        status: parsed.status,
        code: parsed.code,
        message: parsed.message,
        category: isAuth ? "auth" : isEbay ? "ebay" : "general",
      });
      if (isAuth) {
        trackEvent("auth_error", {
          path: url,
          method,
          status: parsed.status,
          code: parsed.code,
          message: parsed.message,
        });
      }
      if (isEbay) {
        trackEvent("ebay_failure", {
          path: url,
          method,
          status: parsed.status,
          code: parsed.code,
          message: parsed.message,
        });
      }
    } catch {
      /* ignore telemetry failure */
    }

    if (error.code === "ECONNABORTED") {
      devDiagApiFailure("timeout", { url: error.config?.url, method: error.config?.method });
    } else if (error.response) {
      devDiagApiFailure("http_error", {
        ...parseApiError(error),
        url: error.config?.url,
      });
    } else {
      devDiagApiFailure("network", { message: error.message, url: error.config?.url });
    }
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60;
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`Rate limited by server. Retry after ${retryAfter} seconds.`);
      }
      
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
  const { data } = await api.post("/auth/register", payload);
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
  return data; // pointsBalance, lifetimePointsEarned, badges, recent, trial, ...
}

export async function getLifetimeLeaderboard() {
  const { data } = await api.get("/leaderboard/lifetime");
  return data;
}

/** POST /api/points/redeem — auction discount against Savvy balance */
export async function redeemPointsDiscount(body) {
  const { data } = await api.post("/points/redeem", body);
  return data;
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

export async function updateAlert(alertId, body) {
  const { data } = await api.patch(`/alerts/${alertId}`, body);
  return data;
}

/** ---- Project Alerts (premium) ---- **/
export async function getProjectAlerts() {
  const { data } = await api.get("/project-alerts");
  return data;
}

export async function createProjectAlert(body) {
  const { data } = await api.post("/project-alerts", body);
  return data;
}

export async function updateProjectAlert(projectId, body) {
  const { data } = await api.patch(`/project-alerts/${projectId}`, body);
  return data;
}

export async function deleteProjectAlert(projectId) {
  const { data } = await api.delete(`/project-alerts/${projectId}`);
  return data;
}

export async function addProjectItem(projectId, body) {
  const { data } = await api.post(`/project-alerts/${projectId}/items`, body);
  return data;
}

export async function updateProjectItem(projectId, itemId, body) {
  const { data } = await api.patch(`/project-alerts/${projectId}/items/${itemId}`, body);
  return data;
}

export async function removeProjectItem(projectId, itemId) {
  const { data } = await api.delete(`/project-alerts/${projectId}/items/${itemId}`);
  return data;
}

export async function spawnProjectMissingAlerts(projectId) {
  const { data } = await api.post(`/project-alerts/${projectId}/spawn-missing-alerts`, {});
  return data;
}

/** ---- Savvy Build Wars ---- **/
export async function getBuildWarsConfig() {
  const { data } = await api.get("/build-wars/config");
  return data;
}

export async function getBuildWarsLeaderboard(limit = 50) {
  const { data } = await api.get("/build-wars/leaderboard", { params: { limit } });
  return data;
}

export async function getBuildWarsMe() {
  const { data } = await api.get("/build-wars/me");
  return data;
}

export async function enterBuildWars(projectAlertId) {
  const { data } = await api.post("/build-wars/enter", { projectAlertId });
  return data;
}

export async function voteBuildWarsEntry(entryId) {
  const { data } = await api.post(`/build-wars/vote/${entryId}`);
  return data;
}

export async function claimBuildWarsRankReward() {
  const { data } = await api.post("/build-wars/claim-rank-reward");
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

/** Savvy earned from verified flip sales this UTC week (public). */
export async function getTopFlippersWeek(limit = 20) {
  const { data } = await api.get("/leaderboard/top-flippers-week", {
    params: { limit },
  });
  return data;
}

/** Savvy Shop — creator storefronts (V1). */
export async function getSavvyShopPublic(slug) {
  const { data } = await api.get(`/savvy-shop/public/${encodeURIComponent(slug)}`);
  return data;
}

/** Public content feed for a shop (sort: new | trending | flip). */
export async function getSavvyShopPosts(slug, params = {}) {
  const { data } = await api.get(`/savvy-shop/public/${encodeURIComponent(slug)}/posts`, { params });
  return data;
}

export async function postSavvyShopPostEngage(slug, postId, body) {
  const { data } = await api.post(
    `/savvy-shop/public/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/engage`,
    body
  );
  return data;
}

export async function createSavvyShopPost(payload) {
  const { data } = await api.post("/savvy-shop/my-shop/posts", payload);
  return data;
}

export async function getMySavvyShopPosts() {
  const { data } = await api.get("/savvy-shop/my-shop/posts");
  return data;
}

export async function getMySavvyShop() {
  const { data } = await api.get("/savvy-shop/my-shop");
  return data;
}

export async function saveMySavvyShop(payload) {
  const { data } = await api.put("/savvy-shop/my-shop", payload);
  return data;
}

export async function addSavvyShopProduct(payload) {
  const { data } = await api.post("/savvy-shop/my-shop/products", payload);
  return data;
}

/** Public engagement (throttled) — views, clicks, saves for creator rewards. */
export async function postSavvyShopEngage(slug, productId, body) {
  const { data } = await api.post(
    `/savvy-shop/public/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/engage`,
    body
  );
  return data;
}

/** Creator confirms a sale for this product (once per product, trust-based V1). */
export async function reportSavvyShopSale(productId) {
  const { data } = await api.post(
    `/savvy-shop/my-shop/products/${encodeURIComponent(productId)}/report-sale`
  );
  return data;
}

export async function updateSavvyShopProduct(productId, payload) {
  const { data } = await api.patch(`/savvy-shop/my-shop/products/${productId}`, payload);
  return data;
}

export async function deleteSavvyShopProduct(productId) {
  const { data } = await api.delete(`/savvy-shop/my-shop/products/${productId}`);
  return data;
}

export async function getEntitlementsMe() {
  const { data } = await api.get("/entitlements/me");
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

export async function getSubscriptionPlans() {
  const { data } = await api.get("/subscribe/plans");
  return data;
}

export async function subscribeUser(tier, billing) {
  const { data } = await api.post("/subscribe", { tier, billing });
  return data;
}

export async function trackSubscriptionMetric(event, tier, billing, meta = {}) {
  const { data } = await api.post("/subscribe/metrics", { event, tier, billing, meta });
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

/** Sniper feed: ending within 10 minutes, ≤3 bids */
export async function getEbayFinal10(searchParams = {}) {
  const { data } = await api.get("/ebay/final10", { params: searchParams });
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

/** Browse API active listings → macro seller trend snapshot (not sold/completed data). */
export async function getEbaySellerTrends(params = {}) {
  const { data } = await api.get("/ebay/seller-trends", { params });
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

/** ---- Creators (Phase B) ---- **/
export async function getCreatorProfile(handle) {
  const { data } = await api.get(`/creators/${encodeURIComponent(handle)}/profile`);
  return data;
}

export async function getCreatorAnalytics(handle, period = 'all') {
  const { data } = await api.get(`/creators/${encodeURIComponent(handle)}/analytics`, {
    params: { period },
  });
  return data;
}

export async function getCreatorCurated(handle) {
  const { data } = await api.get(`/creators/${encodeURIComponent(handle)}/curated`);
  return data;
}

/** ---- Social fabric (Phase C) ---- **/
export async function followUser(userId) {
  const { data } = await api.post(`/users/${userId}/follow`);
  return data;
}

export async function getPinnedWins(userId) {
  const { data } = await api.get(`/users/${userId}/pinned-wins`);
  return data;
}

export async function setMyPinnedWins(auctionIds) {
  const { data } = await api.put('/users/me/pinned-wins', { auctionIds });
  return data;
}

export async function deleteMyAccount(payload = {}) {
  const { data } = await api.delete('/users/me', { data: payload });
  return data;
}

export async function getWeeklyCompare(userId) {
  const { data } = await api.get(`/users/${userId}/weekly-compare`);
  return data;
}

/** ---- Squad Sync (party system) ---- **/
export async function createParty(name) {
  const { data } = await api.post('/parties', { name });
  return data;
}

export async function getMyParty() {
  const { data } = await api.get('/parties/me');
  return data;
}

export async function getParty(partyId) {
  const { data } = await api.get(`/parties/${partyId}`);
  return data;
}

export async function invitePartyMember(partyId, userId) {
  const { data } = await api.post(`/parties/${partyId}/invite`, { userId });
  return data;
}

export async function joinParty(partyId) {
  const { data } = await api.post(`/parties/${partyId}/join`);
  return data;
}

export async function leaveParty(partyId) {
  const { data } = await api.post(`/parties/${partyId}/leave`);
  return data;
}

export async function startPartySession(partyId) {
  const { data } = await api.post(`/parties/${partyId}/start`);
  return data;
}

export async function endPartySession(partyId) {
  const { data } = await api.post(`/parties/${partyId}/end`);
  return data;
}

export async function getPartySummary(partyId) {
  const { data } = await api.get(`/parties/${partyId}/summary`);
  return data;
}

export async function recordPartyEvent(partyId, payload) {
  const { data } = await api.post(`/parties/${partyId}/events`, payload);
  return data;
}


