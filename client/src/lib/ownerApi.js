import { api, STORAGE_KEY } from './api';
import { buildApiUrl } from './runtimeApi';

export function getOwnerAuthToken() {
  return localStorage.getItem(STORAGE_KEY) || localStorage.getItem('token') || '';
}

/**
 * Owner-panel POST — uses axios (same base URL as the rest of the app) + Bearer token.
 */
export async function ownerPost(path, body) {
  const token = getOwnerAuthToken();
  if (!token) {
    throw new Error('Missing auth token. Please log in again.');
  }
  if (!buildApiUrl(path)) {
    throw new Error('API URL is not configured. Set REACT_APP_API_URL on Vercel.');
  }

  const response = await api.post(path, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
