import { api } from './api';
import { apiPath } from './runtimeApi';

const BASE = apiPath('best-buy-integration');

export async function fetchBestBuyIntegrationStatus() {
  const { data } = await api.get(`${BASE}/status`);
  return data;
}

export async function testBestBuyConnection() {
  const { data } = await api.post(`${BASE}/test-connection`);
  return data;
}

export async function searchBestBuyIntegration(query, opts = {}) {
  const { data } = await api.get(`${BASE}/search`, {
    params: { q: query, page: opts.page, pageSize: opts.pageSize },
  });
  return data;
}

export async function compareMarketplaceCandidates(params = {}) {
  const { data } = await api.get(`${BASE}/compare`, { params });
  return data;
}
