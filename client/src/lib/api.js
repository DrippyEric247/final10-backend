import axios from "axios";
import { devDiagApiFailure } from "./devApiDiagnostics";
import { parseApiError } from "./apiErrorParsing";
import { trackEvent } from "./analytics";
import { getApiBaseUrl } from "./runtimeApi";
import {
  gatedRequest,
  markServerRateLimit,
  clearRateLimitRecovery,
  registerRateLimitFailedRequest,
} from "./apiRequestGate";
import { parseRetryAfterSec, sleepMs } from "./parseRetryAfter";
import { rateLimitBackoffMs, RATE_LIMIT_MAX_ATTEMPTS } from "./apiRateLimitBackoff";
import { SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE } from "./savvyScoutRateLimitCopy";
import { isBetaModeActive } from "./betaModeAccess";

export {
  ApiCoolingDownError,
  getApiCoolingState,
  getLastRateLimitMeta,
  subscribeApiCooling,
  resetAuthMeBootstrap,
  clearRateLimitRecovery,
  manualRateLimitRetry,
  registerRateLimitFailedRequest,
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
  async (error) => {
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
    if (error.response?.status === 503) {
      const path = String(url).split("?")[0];
      const code = parsed.code;
      if (isBetaModeActive() && (code === "MARKETPLACE_BUSY" || /^\/ebay\//i.test(path))) {
        const busyError = new Error(SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE);
        busyError.status = 503;
        busyError.code = code;
        busyError.isCoolingDown = true;
        busyError.isRateLimited = false;
        busyError.isMarketplaceBusy = true;
        return Promise.reject(busyError);
      }
    }

    if (error.response?.status === 429) {
      const headers = error.response.headers;
      const retryAfter = parseRetryAfterSec(headers, 60);
      const path = String(url).split("?")[0];
      const methodUpper = method;
      const isAuthLogin = methodUpper === "POST" && /\/auth\/(login|register)$/i.test(path);
      const originalConfig = error.config || {};

      if (isAuthLogin) {
        const rateLimitError = new Error("Please wait a moment before trying again.");
        rateLimitError.status = 429;
        rateLimitError.retryAfter = retryAfter;
        rateLimitError.isCoolingDown = true;
        rateLimitError.isRateLimited = true;
        return Promise.reject(rateLimitError);
      }

      markServerRateLimit(retryAfter, { path, method: methodUpper }, { attempt: 1, phase: "updating" });

      const startAttempt = Number(originalConfig.__rateLimitAttempt) || 0;
      for (let attempt = startAttempt; attempt < RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
        const delayMs = rateLimitBackoffMs(attempt, retryAfter);
        markServerRateLimit(Math.ceil(delayMs / 1000), { path, method: methodUpper }, {
          attempt: attempt + 1,
          phase: "updating",
        });
        await sleepMs(delayMs);
        try {
          const retryConfig = {
            ...originalConfig,
            __rateLimitAttempt: attempt + 1,
          };
          const response = await api.request(retryConfig);
          clearRateLimitRecovery();
          return response;
        } catch (retryErr) {
          if (retryErr.response?.status !== 429) {
            clearRateLimitRecovery();
            return Promise.reject(retryErr);
          }
          error = retryErr;
        }
      }

      const retryRunner = async () => {
        const res = await api.request({ ...originalConfig, __rateLimitAttempt: 0 });
        return res;
      };
      registerRateLimitFailedRequest(originalConfig, retryRunner);

      const rateLimitError = new Error(SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE);
      rateLimitError.status = 429;
      rateLimitError.retryAfter = retryAfter;
      rateLimitError.isCoolingDown = true;
      rateLimitError.isRateLimited = true;
      rateLimitError.isRateLimitExhausted = true;
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

/** Which social sign-in providers are configured on the backend. */
export async function getAuthProviders() {
  try {
    const { data } = await api.get("/auth/providers");
    return {
      google: Boolean(data?.google),
      apple: Boolean(data?.apple),
    };
  } catch {
    return { google: false, apple: false };
  }
}

/** POST /auth/forgot-password — always returns generic success copy. */
export async function requestPasswordReset(email) {
  const { data } = await api.post("/auth/forgot-password", { email: String(email || "").trim() });
  return data;
}

/** POST /auth/reset-password — sets new password via one-time token. */
export async function submitPasswordReset({ token, password, confirmPassword }) {
  const { data } = await api.post("/auth/reset-password", {
    token,
    password,
    confirmPassword,
  });
  return data;
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

/** GET /api/points/credits — server discount credit wallet */
export async function getSavvyCredits() {
  const { data } = await api.get("/points/credits");
  return data;
}

/** POST /api/points/convert-credits — Savvy → discount credit (server debit) */
export async function convertSavvyToCreditsRemote(body) {
  const { data } = await api.post("/points/convert-credits", body);
  return data;
}

/** POST /api/points/redeem-store — spend Savvy on store catalog item */
export async function redeemSavvyStoreItemRemote(body) {
  const { data } = await api.post("/points/redeem-store", body);
  return data;
}

/** POST /api/community/missions/claim — community hub mission Savvy */
export async function claimCommunityMissionRemote(body) {
  const { data } = await api.post("/community/missions/claim", body);
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

export async function getPerkMachineRewardIndex() {
  const { data } = await api.get("/perk-machine/reward-index");
  return data;
}

export async function spinPerkMachine(mode) {
  const { data } = await api.post("/perk-machine/spin", { mode });
  return data;
}

export async function getScoutFlightTournamentStatus() {
  const { data } = await api.get("/scout-flight/tournament/status");
  return data;
}

export async function startScoutFlightTournament() {
  const { data } = await api.post("/scout-flight/tournament/start");
  return data;
}

export async function sendScoutFlightHeartbeat(payload) {
  const { data } = await api.post("/scout-flight/tournament/heartbeat", payload);
  return data;
}

export async function adminStartScoutFlightTestRun() {
  const { data } = await api.post("/scout-flight/admin/start-test-run");
  return data;
}

export async function submitScoutFlightTournamentScore({
  runId,
  score,
  elapsedMs,
  baseScore = null,
  nuke = null,
}) {
  const { data } = await api.post("/scout-flight/tournament/submit", {
    runId,
    score,
    elapsedMs,
    baseScore,
    nuke,
  });
  return data;
}

export async function adminGetScoutFlightNukeStats(userId = null) {
  const { data } = await api.get("/scout-flight/admin/nuke-stats", {
    params: userId ? { userId } : {},
  });
  return data;
}

export async function adminResetScoutFlightNukeStats(userId = null) {
  const { data } = await api.post("/scout-flight/admin/reset-nuke-stats", { userId });
  return data;
}

export async function getScoutFlightLeaderboard(period = "daily", limit = 50, seasonId = null) {
  const { data } = await api.get("/scout-flight/tournament/leaderboard", {
    params: { period, limit, ...(seasonId ? { seasonId } : {}) },
  });
  return data;
}

export async function getScoutFlightChampionship() {
  const { data } = await api.get("/scout-flight/championship/current");
  return data;
}

export async function getScoutFlightSeasonLeaderboard(seasonId, limit = 50) {
  const { data } = await api.get(`/scout-flight/championship/season/${seasonId}/leaderboard`, {
    params: { limit },
  });
  return data;
}

export async function getScoutFlightHallOfChampions(limit = 50) {
  const { data } = await api.get("/scout-flight/championship/hall-of-champions", {
    params: { limit },
  });
  return data;
}

export async function hatchPerkEgg(eggTier) {
  const { data } = await api.post("/perk-machine/hatch", { eggTier });
  return data;
}

export async function activatePerkItem(itemKey, idempotencyKey) {
  const { data } = await api.post("/perk-machine/activate", {
    itemKey,
    idempotencyKey,
  });
  return data;
}

export async function activateInventoryToken(itemType, idempotencyKey) {
  const { data } = await api.post("/inventory/use", { itemType, idempotencyKey });
  return data;
}

export async function getInventoryStatus() {
  const { data } = await api.get("/inventory/status");
  return data;
}

/* ---------------- Savvy Camo Locker (universal across Savvy apps) --------- */

export async function getCamoLocker() {
  const { data } = await api.get("/camo-locker/me");
  return data;
}

/** Signals a qualifying category action — the server owns the increment + caps. */
export async function recordCamoCategoryProgress(category, increment) {
  const { data } = await api.post("/camo-locker/progress", { category, increment });
  return data;
}

export async function markCamosSeen(itemIds) {
  const { data } = await api.post("/camo-locker/seen", { itemIds });
  return data;
}

export async function claimCamoReward(itemId) {
  const { data } = await api.post("/camo-locker/claim", { itemId });
  return data;
}

/** Admin/founder-only secret Nuke Collection preview (404 for normal users). */
export async function getNukeCollectionPreview() {
  const { data } = await api.get("/camo-locker/nuke/preview");
  return data;
}

/** Classified / Master Collection — six-camo Camo Locker mastery endgame. */
export async function getMasterClassifiedCollection() {
  const { data } = await api.get("/camo-locker/master-classified/me");
  return data;
}

/** Admin-only Classified Master asset preview (404 for normal users). Read-only. */
export async function getMasterClassifiedAdminPreview() {
  const { data } = await api.get("/camo-locker/master-classified/admin-preview");
  return data;
}

/* ---------------- Savvy Universe Contracts ---------------- */

export async function getContractsHub(appId = "final10") {
  const { data } = await api.get("/contracts/hub", { params: { appId } });
  return data;
}

export async function claimContractReward(contractId, appId = "final10") {
  const { data } = await api.post("/contracts/claim", { contractId, appId });
  return data;
}

export async function recordContractAppOpen(appId = "final10") {
  const { data } = await api.post("/contracts/record-app-open", { appId });
  return data;
}

export async function getDealStreakStatus() {
  const { data } = await api.get("/deal-streak/status");
  return data;
}

export async function acknowledgeNukeCelebration() {
  const { data } = await api.post("/deal-streak/ack-celebration");
  return data;
}

/* ---------------- Egg Camo Collection (lifetime Egg mastery) ---------------- */

export async function getEggCamoCollection() {
  const { data } = await api.get("/egg-camo/me");
  return data;
}

export async function acknowledgeEggCamoCelebrations(camoIds) {
  const { data } = await api.post("/egg-camo/celebrations/ack", {
    camoIds: Array.isArray(camoIds) ? camoIds : camoIds ? [camoIds] : [],
  });
  return data;
}

/* ---------------- Egg Keychain Collection (premium collectibles) ---------------- */

export async function getEggKeychainCollection() {
  const { data } = await api.get("/egg-keychains/me");
  return data;
}

export async function acknowledgeQuantumReveal() {
  const { data } = await api.post("/deal-streak/ack-quantum-reveal");
  return data;
}

/** Admin Nuke Monitor — summary dashboard cards. */
export async function getNukeMonitorSummary(params = {}) {
  const { data } = await api.get("/admin/nuke-monitor/summary", { params });
  return data;
}

export async function getNukeMonitorPlayers(params = {}) {
  const { data } = await api.get("/admin/nuke-monitor/players", { params });
  return data;
}

export async function getNukeMonitorPlayerDetail(userId, params = {}) {
  const { data } = await api.get(`/admin/nuke-monitor/players/${userId}`, { params });
  return data;
}

export async function simulateNukeProgress(userId, percent) {
  const { data } = await api.post("/admin/nuke-monitor/simulate", { userId, percent });
  return data;
}

export async function activatePerkEventToken(tokenId) {
  const { data } = await api.post("/perk-machine/activate-event", { tokenId });
  return data;
}

export async function activateMaxSupplyDropToken() {
  const { data } = await api.post("/perk-machine/max-supply-drop");
  return data;
}

export async function redeemBattlePassTierSkip() {
  const { data } = await api.post("/perk-machine/tier-skip");
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

export async function adminPerkMachineSetNukeProgress(count) {
  const { data } = await api.post("/perk-machine/admin/nuke/set-progress", { count });
  return data;
}

export async function adminPerkMachineTriggerNuke(opts = {}) {
  const { data } = await api.post("/perk-machine/admin/nuke/trigger", opts);
  return data;
}

export async function adminPerkMachineEndNuke() {
  const { data } = await api.post("/perk-machine/admin/nuke/end");
  return data;
}

export async function adminPerkMachineGetNukeState() {
  const { data } = await api.get("/perk-machine/admin/nuke-state");
  return data;
}

export async function adminPerkMachineGetNukeStateForUser(userId) {
  const { data } = await api.get(`/perk-machine/admin/nuke/user/${encodeURIComponent(userId)}`);
  return data;
}

/** ---- Live beta events (Supply Drops, Scout Support, Savvy Sale) ---- **/

export async function getLiveEventsState() {
  const { data } = await api.get("/events/live-state");
  return data;
}

export async function getEventsHub() {
  const { data } = await api.get("/events/hub");
  return data;
}

export async function getPendingEventSummary() {
  const { data } = await api.get("/events/summary/pending");
  return data?.summary || null;
}

export async function getEventSummaryHistory(limit = 40) {
  const { data } = await api.get("/events/summary/history", { params: { limit } });
  return data?.history || [];
}

export async function dismissEventSummary({ summaryId, action = "dismiss" }) {
  const { data } = await api.post("/events/summary/dismiss", { summaryId, action });
  return data;
}

export async function getPendingProfileXpRecap() {
  const { data } = await api.get("/levels/recap/pending");
  return data?.recap || null;
}

export async function getProfileXpRecapHistory(limit = 40) {
  const { data } = await api.get("/levels/recap/history", { params: { limit } });
  return data?.history || [];
}

export async function dismissProfileXpRecap({ recapId, action = "dismiss" }) {
  const { data } = await api.post("/levels/recap/dismiss", { recapId, action });
  return data;
}

export async function getProfileProgress() {
  const { data } = await api.get("/levels/progress");
  return data?.progress || null;
}

export async function estimateDealRewards(listings = []) {
  const { data } = await api.post("/deals/reward-estimate", { listings });
  return data;
}

export async function getSavvyMultiplier() {
  const { data } = await api.get("/savvy/multiplier");
  return data;
}

export async function markDealRewardClickout({ listingId, listing = {} }) {
  const { data } = await api.post("/deals/reward-clickout", { listingId, listing });
  return data;
}

export async function activateLiveEvent({ activationId, eventKey }) {
  const { data } = await api.post("/events/activation/activate", { activationId, eventKey });
  return data;
}

export async function dismissEventExplanation({ activationId }) {
  const { data } = await api.post("/events/activation/dismiss-explanation", { activationId });
  return data;
}

export async function resetEventActivation() {
  const { data } = await api.post("/events/admin/reset-activation");
  return data;
}

export async function getActiveSupplyDrop() {
  const { data } = await api.get("/events/supply-drop/active");
  return data;
}

export async function claimSupplyDrop(dropId) {
  const { data } = await api.post("/events/supply-drop/claim", { dropId });
  return data;
}

export async function getActiveSavvySale() {
  const { data } = await api.get("/events/savvy-sale/active");
  return data;
}

export async function getScoutSupportStatus() {
  const { data } = await api.get("/scout-support/status");
  return data;
}

export async function registerScoutSupportAction(actionType, meta = {}) {
  const { data } = await api.post("/scout-support/register-action", { actionType, meta });
  return data;
}

export async function claimScoutSupportMilestone(milestone) {
  const { data } = await api.post(`/scout-support/claim/${milestone}`);
  return data;
}

export async function checkLiveEventsAdminAccess() {
  try {
    const { data } = await api.get("/events/admin/ping");
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

export async function adminCreateSupplyDrop(scope = "user") {
  const { data } = await api.post("/events/supply-drop/create-test", { scope });
  return data;
}

export async function adminExpireSupplyDrop() {
  const { data } = await api.post("/events/supply-drop/expire");
  return data;
}

export async function adminGetSupplyDropClaims(limit = 20) {
  const { data } = await api.get("/events/supply-drop/recent-claims", { params: { limit } });
  return data;
}

export async function adminStartSavvySale(minutes = 15) {
  const { data } = await api.post("/events/savvy-sale/start", { minutes });
  return data;
}

export async function adminEndSavvySale() {
  const { data } = await api.post("/events/savvy-sale/end");
  return data;
}

export async function adminScoutSupportAddDeal(actionType = "deal_secured_test") {
  const { data } = await api.post("/scout-support/admin/add-deal", { actionType });
  return data;
}

export async function adminScoutSupportSetStreak(count) {
  const { data } = await api.post("/scout-support/admin/set-streak", { count });
  return data;
}

export async function adminScoutSupportReset() {
  const { data } = await api.post("/scout-support/admin/reset");
  return data;
}

export async function adminScoutSupportForceClaim(milestone) {
  const { data } = await api.post("/scout-support/admin/force-claim", { milestone });
  return data;
}

/** ---- Egg Exchange Chamber ---- **/

export async function getEggExchangeStatus() {
  const { data } = await api.get("/eggs/exchange/status");
  return data;
}

export async function performEggExchange(exchangeType) {
  const { data } = await api.post("/eggs/exchange", { exchangeType });
  return data;
}

export async function checkEggExchangeAdminAccess() {
  try {
    const { data } = await api.get("/eggs/exchange/admin/ping");
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

export async function adminEggExchangeGrantRare() {
  const { data } = await api.post("/eggs/exchange/admin/grant-rare");
  return data;
}

export async function adminEggExchangeGrantEpic() {
  const { data } = await api.post("/eggs/exchange/admin/grant-epic");
  return data;
}

export async function adminEggExchangeGrantLegendary() {
  const { data } = await api.post("/eggs/exchange/admin/grant-legendary");
  return data;
}

export async function adminEggExchangeGrantSavvy(amount = 20000) {
  const { data } = await api.post("/eggs/exchange/admin/grant-savvy", { amount });
  return data;
}

export async function adminEggExchangeReset() {
  const { data } = await api.post("/eggs/exchange/admin/reset");
  return data;
}

export async function adminEggExchangePresetRareEpic() {
  const { data } = await api.post("/eggs/exchange/admin/preset-rare-epic");
  return data;
}

export async function adminEggExchangePresetEpicLegendary() {
  const { data } = await api.post("/eggs/exchange/admin/preset-epic-legendary");
  return data;
}

export async function adminEggExchangePresetLegendaryMythic() {
  const { data } = await api.post("/eggs/exchange/admin/preset-legendary-mythic");
  return data;
}

/** ---- Battle Pass (beta 25-tier) ---- **/

/** POST /api/progression/claim-tier — claim a tier reward (free|premium). */
export async function claimBattlePassTier(level, track) {
  const { data } = await api.post("/progression/claim-tier", { level, track });
  return data;
}

/** GET /api/soundtracks/library — unlocked + catalog metadata (no private URLs). */
export async function fetchSoundtrackLibrary() {
  const { data } = await api.get("/soundtracks/library");
  return data;
}

const previewObjectUrlCache = new Map();

/** Authenticated preview stream as object URL (revoke when done). */
export async function getSoundtrackPreviewObjectUrl(trackId) {
  const id = String(trackId || "").trim();
  if (!id) throw new Error("Missing track id");
  if (previewObjectUrlCache.has(id)) {
    URL.revokeObjectURL(previewObjectUrlCache.get(id));
    previewObjectUrlCache.delete(id);
  }
  const { data } = await api.get(`/soundtracks/${id}/preview`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  previewObjectUrlCache.set(id, url);
  return url;
}

/** Protected download — only works for unlocked tracks. */
export async function downloadSoundtrack(trackId, title = "soundtrack") {
  const id = String(trackId || "").trim();
  const { data } = await api.get(`/soundtracks/${id}/download`, { responseType: "blob" });
  const safeName = String(title || "soundtrack").replace(/[^\w\s-]/g, "").trim() || "soundtrack";
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName}.mp3`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** POST /api/soundtracks/menu-music — reserve menu theme selection. */
export async function setMenuMusicTrack(trackId) {
  const { data } = await api.post("/soundtracks/menu-music", { trackId });
  return data;
}

/** GET /api/progression/admin/ping — returns 200 only for admins. */
export async function checkBattlePassAdminAccess() {
  try {
    const { data } = await api.get("/progression/admin/ping");
    return Boolean(data?.admin);
  } catch {
    return false;
  }
}

export async function adminBattlePassSetTier(level) {
  const { data } = await api.post("/progression/admin/set-tier", { level });
  return data;
}

export async function adminBattlePassGrantXp(amount = 1000) {
  const { data } = await api.post("/progression/admin/grant-xp", { amount });
  return data;
}

export async function adminBattlePassResetClaims() {
  const { data } = await api.post("/progression/admin/reset-claims");
  return data;
}

export async function adminBattlePassForceClaim(level) {
  const { data } = await api.post("/progression/admin/force-claim", { level });
  return data;
}

/** POST /api/email/test/monthly-report-early — admin-only early Monthly Scout Report. */
export async function sendEarlyMonthlyReportTest() {
  const { data } = await api.post("/email/test/monthly-report-early");
  return data;
}

/** ---- Admin Email Test Center ---- **/
export async function searchAdminEmailTestUsers(q) {
  const { data } = await api.get("/admin/email-test/users", { params: { q } });
  return data;
}

export async function getAdminEmailTestHistory(userId) {
  const { data } = await api.get(`/admin/email-test/users/${userId}/history`);
  return data;
}

export async function sendAdminTestEmail({
  userId,
  templateKey,
  customSubject,
  customMessage,
  buttonText,
  buttonUrl,
  image,
  imageUrl,
}) {
  const hasFile = image instanceof File;
  if (hasFile) {
    const form = new FormData();
    form.append("userId", userId);
    form.append("templateKey", templateKey);
    if (customSubject) form.append("customSubject", customSubject);
    if (customMessage) form.append("customMessage", customMessage);
    if (buttonText) form.append("buttonText", buttonText);
    if (buttonUrl) form.append("buttonUrl", buttonUrl);
    form.append("image", image);
    const { data } = await api.post("/admin/email-test/send", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  const { data } = await api.post("/admin/email-test/send", {
    userId,
    templateKey,
    customSubject,
    customMessage,
    buttonText,
    buttonUrl,
    imageUrl,
  });
  return data;
}

/** POST /api/scout-missions/claim — persist Savvy Scout mission reward to wallet. */
export async function claimScoutMissionReward({ missionId, periodKey }) {
  const { data } = await api.post("/scout-missions/claim", { missionId, periodKey });
  return data;
}

/** GET /api/scout-missions/progress — server-authoritative completion + claim state. */
export async function getScoutMissionProgress() {
  const { data } = await api.get("/scout-missions/progress");
  return data;
}

/** POST /api/scout-missions/record-action — sync trusted mission trigger to server. */
export async function recordScoutMissionAction({ trigger, increment = 1 }) {
  const { data } = await api.post("/scout-missions/record-action", { trigger, increment });
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

/** Season leaderboard — real users sorted by leaderboard score (max 100). */
export async function getSeasonLeaderboard(limit = 100) {
  const { data } = await api.get("/leaderboard/players", {
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

export async function getCommunityMilestones(limit = 12) {
  const { data } = await api.get("/community/milestones", { params: { limit } });
  return data;
}

/** ---- Beta community vote & feedback ---- **/
export async function getBetaCommunitySnapshot() {
  const { data } = await api.get("/beta-community");
  return data;
}

export async function castBetaCommunityVote(topicId) {
  const { data } = await api.post("/beta-community/vote", { topicId });
  return data;
}

export async function submitBetaCommunityReview(payload) {
  const { data } = await api.post("/beta-community/review", payload);
  return data;
}

export async function submitBetaMembershipFeedback(payload) {
  const { data } = await api.post("/beta-community/membership-feedback", payload);
  return data;
}

export async function getAdminMembershipFeedback(limit = 50) {
  const { data } = await api.get("/beta-community/admin/membership-feedback", { params: { limit } });
  return data;
}

export async function submitBetaSavvyShopFeedback(payload) {
  const { data } = await api.post("/beta-community/savvy-shop-feedback", payload);
  return data;
}

/** Savvy Scout relay — message the founder (multipart: optional screenshot). */
export async function submitFounderMessage(formData) {
  const { data } = await api.post("/founder-messages", formData);
  return data;
}

export async function getAdminSavvyShopFeedback(limit = 50) {
  const { data } = await api.get("/beta-community/admin/savvy-shop-feedback", { params: { limit } });
  return data;
}

export async function getFoundingTesterProgress() {
  const { data } = await api.get("/founding-tester/progress");
  return data;
}

export async function attestFoundingTesterTask(missionId) {
  const { data } = await api.post("/founding-tester/attest-task", { missionId });
  return data;
}

export async function completeFoundingTesterMission({ missionId, feedback }) {
  const { data } = await api.post("/founding-tester/complete", { missionId, feedback });
  return data;
}

export async function getFoundingBetaStatus() {
  const { data } = await api.get("/founding-beta/status");
  return data;
}

export async function getFoundingHall() {
  const { data } = await api.get("/founding-beta/hall");
  return data;
}

export async function getFoundingHallMember(slot) {
  const { data } = await api.get(`/founding-beta/hall/${slot}`);
  return data;
}

export async function getMyFoundingLegacy() {
  const { data } = await api.get("/founding-beta/legacy");
  return data;
}

export async function adminUpdateBetaCommunityConfig(patch) {
  const { data } = await api.put("/beta-community/admin/config", patch);
  return data;
}

export async function adminAddBetaCommunityTopic(topic) {
  const { data } = await api.post("/beta-community/admin/topics", topic);
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


