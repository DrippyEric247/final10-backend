import api from './authService';
import {
  fetchEbaySearch,
  fetchEbayFinal10,
  fetchEbayTrending,
} from "../lib/ebayClient";

// SEARCH (real)
async function searchEbay(query) {
  return fetchEbaySearch({ q: query });
}

// ITEM DETAIL (real)
async function getItemDetails(id) {
  const { data } = await api.get(`/ebay/item/${id}`);
  return data;
}

// SEARCH ITEMS (for pages that need more flexible search)
async function searchItems(params) {
  const merged = { ...params };
  if (merged.keywords && !merged.q) merged.q = merged.keywords;
  return fetchEbaySearch(merged);
}

async function getFinal10(params = {}) {
  return fetchEbayFinal10(params);
}

// GET TRENDING ITEMS
async function getTrendingItems(category = 'all', limit = 20) {
  return fetchEbayTrending(category, limit);
}

// GET CATEGORIES
async function getCategories() {
  const { data } = await api.get(`/ebay/categories`);
  return data;
}

async function getConnectionStatus() {
  const { data } = await api.get(`/ebay-auth/status`);
  return data;
}

async function getConnectLink(returnTo = '/auctions?ebay=connected') {
  const { data } = await api.get(`/ebay-auth/link`, { params: { returnTo } });
  return data?.url;
}

async function placeBid(params) {
  const { data } = await api.post(`/ebay/bids/place`, params);
  return data;
}

const ebayService = {
  searchEbay,
  getItemDetails,
  searchItems,
  getFinal10,
  getTrendingItems,
  getCategories,
  getConnectionStatus,
  getConnectLink,
  placeBid,
  // keep the rest if you want, but stop using generateMockEbayItems in pages
};

export default ebayService;
