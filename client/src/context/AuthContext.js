// client/src/context/AuthContext.js
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  loginUser,
  registerUser,
  setAuthToken,
  getMe,
  getEntitlementsMe,
  STORAGE_KEY,
  resetAuthMeBootstrap,
} from "../lib/api";
import { hydrateMembershipFromApi } from "../lib/membershipSync";
import { parseApiError, userSafeErrorMessage } from "../lib/apiErrorParsing";
import { getDevSavvyPointsOffset, isDev, FINAL10_DEV_OVERRIDE_EVENT } from "../lib/devOverride";
import { getEquippedCallingCardId, getEquippedEmblemId } from "../lib/customizationCatalog";

/** Default shape so TS/JS consumers never destructure off `null` when Provider wraps the app. */
const defaultAuthValue = {
  user: null,
  token: null,
  loading: true,
  error: "",
  login: async () => {
    throw new Error("useAuth: AuthProvider is missing");
  },
  register: async () => {
    throw new Error("useAuth: AuthProvider is missing");
  },
  logout: () => {},
  refreshProfile: async () => null,
  patchUser: () => {},
};

const AuthContext = createContext(defaultAuthValue);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const logUserMembership = useCallback((u) => {
    // eslint-disable-next-line no-console
    console.log("Current user membership:", {
      username: u?.username,
      membershipTier: u?.membershipTier,
      tier: u?.tier,
      plan: u?.plan,
      subscriptionTier: u?.subscriptionTier,
      isPremium: u?.isPremium,
      premium: u?.premium,
      entitlements: u?.entitlements,
      subscription: u?.subscription,
      membershipExpiresAt: u?.membershipExpiresAt || u?.subscriptionExpires,
    });
  }, []);

  const withLoadout = useCallback((u) => {
    if (!u || typeof u !== "object") return u;
    const rawBase =
      u.savvyPointsServerBase != null && Number.isFinite(Number(u.savvyPointsServerBase))
        ? Number(u.savvyPointsServerBase)
        : Number(u.savvyPoints);
    const pts = Number.isFinite(rawBase) ? rawBase : 0;
    const fake = isDev ? getDevSavvyPointsOffset() : 0;
    return {
      ...u,
      savvyPointsServerBase: pts,
      savvyPoints: pts + fake,
      equippedCallingCardId: u.equippedCallingCardId || getEquippedCallingCardId(),
      equippedEmblemId: u.equippedEmblemId || getEquippedEmblemId(),
    };
  }, []);

  const hydrateSessionUser = useCallback(
    async (rawUser) => {
      const merged = withLoadout(rawUser);
      await hydrateMembershipFromApi(merged, getEntitlementsMe);
      logUserMembership(merged);
      return merged;
    },
    [withLoadout, logUserMembership]
  );

  useEffect(() => {
    if (!isDev) return undefined;
    const refreshPts = () => setUser((prev) => (prev ? withLoadout(prev) : prev));
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, refreshPts);
    return () => window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, refreshPts);
  }, [withLoadout]);

  // Load token on mount + fetch user
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setToken(stored);
      setAuthToken(stored);
      // hydrate user profile
      getMe({ force: true })
        .then(async (user) => {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("Auth hydration successful");
          }
          setUser(await hydrateSessionUser(user));
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            const { code, message } = parseApiError(err);
            // eslint-disable-next-line no-console
            console.warn("Auth hydration failed", code, message);
          }
          // Clear invalid token and reset state
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
          setAuthToken(null);
          setError("Session expired. Please log in again.");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [hydrateSessionUser]);

  const login = async (credentials) => {
    setError("");
    try {
      await loginUser(credentials);
      setToken(localStorage.getItem(STORAGE_KEY));
      const fresh = await getMe({ force: true });
      const hydrated = await hydrateSessionUser(fresh);
      setUser(hydrated);
      return hydrated;
    } catch (err) {
      setError(userSafeErrorMessage(err, "Login failed. Please try again."));
      throw err;
    }
  };

  const register = async (form) => {
    setError("");
    try {
      await registerUser(form);
      setToken(localStorage.getItem(STORAGE_KEY));
      const fresh = await getMe({ force: true });
      const hydrated = await hydrateSessionUser(fresh);
      setUser(hydrated);
      return hydrated;
    } catch (err) {
      setError(userSafeErrorMessage(err, "Signup failed. Please try again."));
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    setError("");
    // Clear any additional auth-related data
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    resetAuthMeBootstrap();
  };

  const patchUser = useCallback((partial) => {
    if (!partial || typeof partial !== "object") return;
    setUser((prev) => (prev ? withLoadout({ ...prev, ...partial }) : prev));
  }, [withLoadout]);

  const refreshProfile = useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      const res = await getMe({ force: true });
      const hydrated = await hydrateSessionUser(res);
      setUser(hydrated);
      return hydrated;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        const { code, message } = parseApiError(err);
        // eslint-disable-next-line no-console
        console.warn("refreshProfile failed", code, message);
      }
      return null;
    }
  }, [hydrateSessionUser]);

  useEffect(() => {
    const onLoadout = () => {
      setUser((prev) => (prev ? withLoadout(prev) : prev));
    };
    window.addEventListener("f10:loadout-updated", onLoadout);
    return () => window.removeEventListener("f10:loadout-updated", onLoadout);
  }, [withLoadout]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, login, register, logout, refreshProfile, patchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}





































