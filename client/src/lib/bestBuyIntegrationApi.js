import { api } from './api';
import { apiPath, composeApiUrl, getApiBaseUrl } from './runtimeApi';

const BASE = apiPath('best-buy-integration');

function assertProxyRoute() {
  const sample = composeApiUrl('best-buy-integration/status');
  if (sample && /api\.bestbuy\.com/i.test(sample)) {
    throw new Error(
      'API base URL is misconfigured (points at Best Buy). Set REACT_APP_API_URL to your Final10 Railway API host.'
    );
  }
  return getApiBaseUrl();
}

export function getBestBuyIntegrationApiBase() {
  return composeApiUrl('best-buy-integration');
}

export async function fetchBestBuyIntegrationStatus() {
  assertProxyRoute();
  const { data } = await api.get(`${BASE}/status`);
  return data;
}

export async function testBestBuyConnection() {
  assertProxyRoute();
  const { data } = await api.post(`${BASE}/test-connection`);
  return data;
}

export async function searchBestBuyIntegration(query, opts = {}) {
  assertProxyRoute();
  const { data } = await api.get(`${BASE}/search`, {
    params: { q: query, page: opts.page, pageSize: opts.pageSize },
  });
  return data;
}

export async function compareMarketplaceCandidates(params = {}) {
  assertProxyRoute();
  const { data } = await api.get(`${BASE}/compare`, { params });
  return data;
}

/** Open Box via Final10 backend only — never call api.bestbuy.com from the browser. */
export async function fetchBestBuyOpenBox(skus) {
  assertProxyRoute();
  const list = Array.isArray(skus) ? skus.join(',') : String(skus || '');
  const { data } = await api.get(`${BASE}/openbox`, { params: { skus: list } });
  return data;
}
