import axios from 'axios';
import { devDiagApiFailure } from '../lib/devApiDiagnostics';
import { parseApiError } from '../lib/apiErrorParsing';
import { getApiBaseUrl } from '../lib/runtimeApi';

const DEFAULT_TIMEOUT_MS = Math.min(Math.max(Number(process.env.REACT_APP_API_TIMEOUT_MS) || 28000, 8000), 120000);

// Create axios instance with default config
const api = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const base = getApiBaseUrl();
    if (base) config.baseURL = base;

    const token = localStorage.getItem('f10_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      devDiagApiFailure('authService_timeout', { url: error.config?.url });
    } else if (error.response) {
      devDiagApiFailure('authService_http', { ...parseApiError(error), url: error.config?.url });
    }
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || '';
      const isTokenError = errorMessage.toLowerCase().includes('token') || 
                          errorMessage.toLowerCase().includes('expired') ||
                          errorMessage.toLowerCase().includes('invalid') ||
                          error.config?.url?.includes('/auth/');
      
      // Only logout and redirect if it's a token/auth-related error
      // Don't logout for other 401 errors (like missing eBay OAuth, etc.)
      if (isTokenError) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('Auth token invalid or expired; redirecting to login');
        }
        localStorage.removeItem('f10_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('401 error (not treated as session expiry)', errorMessage);
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  async register(userData) {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },

  async changePassword(currentPassword, newPassword) {
    const response = await api.put('/auth/password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }
};

export default api;


































