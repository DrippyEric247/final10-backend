// client/src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  loginUser,
  registerUser,
  setAuthToken,
  getMe,
  STORAGE_KEY,
} from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load token on mount + fetch user
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setToken(stored);
      setAuthToken(stored);
      // hydrate user profile
      getMe()
        .then((user) => {
          console.log("Auth hydration successful:", user);
          setUser(user);
        })
        .catch((err) => {
          console.error("Auth hydration failed:", err);
          console.log("🧹 Clearing invalid token and resetting auth state...");
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
  }, []);

  const login = async (email, password) => {
    setError("");
    try {
      const res = await loginUser(email, password);
      // loginUser already sets token + returns user
      setToken(localStorage.getItem(STORAGE_KEY));
      setUser(res);
    } catch (err) {
      setError("Login failed: " + err.message);
      throw err;
    }
  };

  const register = async (form) => {
    setError("");
    try {
      const res = await registerUser(form);
      // registerUser already sets token + returns user
      setToken(localStorage.getItem(STORAGE_KEY));
      setUser(res);
    } catch (err) {
      setError("Signup failed: " + err.message);
      throw err;
    }
  };

  const logout = () => {
    console.log("🚪 Logging out user...");
    setUser(null);
    setToken(null);
    setAuthToken(null);
    setError("");
    // Clear any additional auth-related data
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}





































