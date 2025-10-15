import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
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
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || '';
      const isTokenError = errorMessage.toLowerCase().includes('token') || 
                          errorMessage.toLowerCase().includes('expired') ||
                          errorMessage.toLowerCase().includes('invalid') ||
                          error.config?.url?.includes('/auth/');
      
      // Only logout and redirect if it's a token/auth-related error
      // Don't logout for other 401 errors (like missing eBay OAuth, etc.)
      if (isTokenError) {
        console.log('🔒 Auth token invalid/expired, logging out...');
        localStorage.removeItem('f10_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        console.log('⚠️ 401 error but not token-related:', errorMessage);
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
    const response = await api.post('/auth/register', userData);
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


































