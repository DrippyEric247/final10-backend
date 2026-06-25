import axios from "axios";
import { devDiagApiFailure } from "./devApiDiagnostics";
import { parseApiError } from "./apiErrorParsing";
import { trackEvent } from "./analytics";
import { getApiBaseUrl } from "./runtimeApi";
import {
  gatedRequest,
  markGlobalCooling,
} from "./apiRequestGate";

export {
  ApiCoolingDownError,
  getApiCoolingState,
  subscribeApiCooling,
  resetAuthMeBootstrap,
} from "./apiRequestGate";

const DEFAULT_TIMEOUT_MS = Math.min(Math.max(Number(process.env.REACT_APP_API_TIMEOUT_MS) || 28000, 8000), 120000);

export const api = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (config) => {
    const base = getApiBaseUrl();
    if (base) config.baseURL = base;
    return config;
  },
  (error) => Promise.reject(error)
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
      const retryAfter =
        error.response.headers["retry-after"] ||
        error.response.headers["Retry-After"] ||
        60;
      const path = String(url).split("?")[0];
      const isAuthMe = method === "GET" && /\/auth\/me$/i.test(path);
      const isAuthLogin = method === "POST" && /\/auth\/(login|register)$/i.test(path);
      if (!isAuthMe && !isAuthLogin) {
        markGlobalCooling(retryAfter);
      }
      const rateLimitError = new Error(
        isAuthMe
          ? "Profile sync rate limit — wait a few seconds and retry."
          : isAuthLogin
            ? "Too many login attempts. Wait a moment and try again."
            : `Too many requests. Cooling down for ${retryAfter} seconds.`
      );
      rateLimitError.status = 429;
      rateLimitError.retryAfter = retryAfter;
      rateLimitError.isCoolingDown = true;
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
  const res = await gatedRequest(
    "authLogin",
    async () => api.post("/auth/login", { email, password }),
    { force: true }
  );
  setAuthToken(res.data.token);
  return res.data.user;
}
export async function registerUser(payload) {
  const { data } = await api.post("/auth/register", payload);
  setAuthToken(data.token);
  return data.user;
}


/** GET /auth/me — once on app load; further calls need `{ force: true }` (manual refresh). */
export async function getMe(options = {}) {
  const { force = false } = options;
  return gatedRequest(
    "authMe",
    async () => {
      const { data } = await api.get("/auth/me");
      return data;
    },
    { force, allowBootstrap: !force }
  );
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

/** Server-authoritative daily Savvy claim. Returns `added`, `newBalance`, `reward` log payload. */
export async function claimDailyLogin() {
  const { data } = await api.post("/auctions/claim-daily-login");
  return data;
}

/** GET /api/streak/status — daily streak calendar + claim eligibility */
export async function getDailyStreakStatus() {
  const { data } = await api.get("/streak/status");
  return data;
}

/** POST /api/streak/claim — claim today's streak reward */
export async function claimDailyStreak() {
  const { data } = await api.post("/streak/claim");
  return data;
}

/** Admin-only streak testing */
export async function checkStreakAdminAccess() {
  const { data } = await api.get("/streak/admin/milestones");
  return data;
}

export async function adminForceStreakClaim() {
  const { data } = await api.post("/streak/admin/force-claim");
  return data;
}

export async function adminAdvanceStreakDay() {
  const { data } = await api.post("/streak/admin/advance");
  return data;
}

export async function adminSetStreakMilestone(day) {
  const { data } = await api.post("/streak/admin/set-milestone", { day });
  return data;
}

/** Savvy Perk Machine */
export async function getPerkMachineStatus() {
  const { data } = await api.get("/perk-machine/status");
  return data;
}

export async function getPerkMachineHistory() {
  const { data } = await api.get("/perk-machine/history");
  return data;
}

export async function spinPerkMachine(mode) {
  const { data } = await api.post("/perk-machine/spin", { mode });
  return data;
}

export async function hatchPerkEgg(eggTier) {
  const { data } = await api.post("/perk-machine/hatch", { eggTier });
  return data;
}

export async function checkPerkMachineAdminAccess() {
  const { data } = await api.get("/perk-machine/admin/ping");
  return data;
}

export async function adminPerkMachineResetFreeSpin() {
  const { data } = await api.post("/perk-machine/admin/reset-free-spin");
  return data;
}

export async function adminPerkMachineGrantSavvy(amount = 500) {
  const { data } = await api.post("/perk-machine/admin/grant-savvy", { amount });
  return data;
}

export async function adminPerkMachineForceSpin(slots = 1) {
  const { data } = await api.post("/perk-machine/admin/force-spin", { slots });
  return data;
}

export async function adminPerkMachineGrantEgg(tier = "rare", count = 1) {
  const { data } = await api.post("/perk-machine/admin/grant-egg", { tier, count });
  return data;
}

export async function adminPerkMachineForceLegendary() {
  const { data } = await api.post("/perk-machine/admin/force-legendary");
  return data;
}

export async function adminPerkMachineClearHistory() {
  const { data } = await api.post("/perk-machine/admin/clear-history");
  return data;
}

/** POST /api/email/test/monthly-report-early — admin-only early Monthly Scout Report. */
export async function sendEarlyMonthlyReportTest() {
  const { data } = await api.post("/email/test/monthly-report-early");
  return data;
}

/** POST /api/scout-missions/claim — persist Savvy Scout mission reward to wallet. */
export async function claimScoutMissionReward({ missionId, periodKey }) {
  const { data } = await api.post("/scout-missions/claim", { missionId, periodKey });
  return data;
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

/** ---- In-app notifications (Savvy Scout alert matches) ---- **/
export async function getNotificationSummary(options = {}) {
  return gatedRequest(
    "notifications",
    async () => {
      const { data } = await api.get("/notifications");
      return data;
    },
    { force: Boolean(options.force) }
  );
}

export async function markNotificationsRead(kind = null) {
  const { data } = await api.patch("/notifications/read", kind ? { kind } : {});
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
export async function getDailyTasks(options = {}) {
  return gatedRequest(
    "dailyTasks",
    async () => {
      const { data } = await api.get("/auctions/daily-tasks");
      return data;
    },
    { force: Boolean(options.force) }
  );
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
export async function getLevelInfo(options = {}) {
  return gatedRequest(
    "levelsMe",
    async () => {
      const { data } = await api.get("/levels/me");
      return data;
    },
    { force: Boolean(options.force) }
  );
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

export async function getMyParty(options = {}) {
  return gatedRequest(
    "partiesMe",
    async () => {
      const { data } = await api.get("/parties/me");
      return data;
    },
    { force: Boolean(options.force) }
  );
}

/** GET /users/:userId/ebay-status — throttled per user id. */
export async function getUserEbayStatus(userId, options = {}) {
  const uid = String(userId || "").trim();
  if (!uid) throw new Error("userId required");
  return gatedRequest(
    `userEbay:${uid}`,
    async () => {
      const { data } = await api.get(`/users/${uid}/ebay-status`);
      return data;
    },
    { force: Boolean(options.force) }
  );
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


