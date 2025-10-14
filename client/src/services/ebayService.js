import api from './authService'; // you already have this axios instance

// SEARCH (real)
async function searchEbay(query) {
  const { data } = await api.get(`/ebay/search`, { params: { q: query } });
  return data; // { items: [...] }
}

// ITEM DETAIL (real)
async function getItemDetails(id) {
  const { data } = await api.get(`/ebay/item/${id}`);
  return data; // { item, bids, seller, ... }
}

// SEARCH ITEMS (for pages that need more flexible search)
async function searchItems(params) {
  const { data } = await api.get(`/ebay/search`, { params });
  return data; // { items: [...], pagination: {...} }
}

// GET TRENDING ITEMS
async function getTrendingItems(category = 'all', limit = 20) {
  const { data } = await api.get(`/ebay/trending`, { 
    params: { category, limit } 
  });
  return data; // { items: [...], categories: [...] }
}

// GET CATEGORIES
async function getCategories() {
  const { data } = await api.get(`/ebay/categories`);
  return data; // { categories: [...] }
}

const ebayService = {
  searchEbay,
  getItemDetails,
  searchItems,
  getTrendingItems,
  getCategories,
  // keep the rest if you want, but stop using generateMockEbayItems in pages
};

export default ebayService;
