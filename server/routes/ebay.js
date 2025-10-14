const express = require('express');
const axios = require('axios');
const { getAccessTokenForUser } = require('../services/ebaySession');
const auth = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all eBay routes
router.use(auth);

// CORS is handled globally in index.js

// Old search endpoint removed - using the improved one below

/** You’ll need to implement getEbayAccessToken() using your PRD keys
 *  and either Client Credentials or the OAuth user flow.
 */
const { getEbayAccessToken, isAuthEnabled } = require('../services/ebayAuth');

// Mock data generator for when eBay API is not available
function generateMockEbayData(query, limit) {
  // Generate random images using multiple fallback sources
  const getRandomImage = (seed) => {
    const sources = [
      `https://picsum.photos/300/200?random=${seed}`,
      `https://source.unsplash.com/300x200/?electronics&sig=${seed}`,
      `https://loremflickr.com/300/200/electronics?random=${seed}`
    ];
    return sources[seed % sources.length];
  };

  const mockItems = [
    {
      itemId: '123456789',
      title: `iPhone 13 Pro Max 256GB - ${query || 'Electronics'}`,
      image: { imageUrl: getRandomImage(1) },
      price: { value: '899.99', currency: 'USD' },
      itemEndDate: new Date(Date.now() + 3600000).toISOString(),
      bidCount: 15,
      itemWebUrl: 'https://www.ebay.com/itm/123456789'
    },
    {
      itemId: '987654321',
      title: `MacBook Pro 14" M2 Chip - ${query || 'Electronics'}`,
      image: { imageUrl: getRandomImage(2) },
      price: { value: '1899.99', currency: 'USD' },
      itemEndDate: new Date(Date.now() + 7200000).toISOString(),
      bidCount: 8,
      itemWebUrl: 'https://www.ebay.com/itm/987654321'
    },
    {
      itemId: '456789123',
      title: `Samsung Galaxy S23 Ultra - ${query || 'Electronics'}`,
      image: { imageUrl: getRandomImage(3) },
      price: { value: '1099.99', currency: 'USD' },
      itemEndDate: new Date(Date.now() + 5400000).toISOString(),
      bidCount: 22,
      itemWebUrl: 'https://www.ebay.com/itm/456789123'
    },
    {
      itemId: '789123456',
      title: `AirPods Pro 2nd Generation - ${query || 'Electronics'}`,
      image: { imageUrl: getRandomImage(4) },
      price: { value: '199.99', currency: 'USD' },
      itemEndDate: new Date(Date.now() + 1800000).toISOString(),
      bidCount: 35,
      itemWebUrl: 'https://www.ebay.com/itm/789123456'
    },
    {
      itemId: '321654987',
      title: `Nintendo Switch OLED - ${query || 'Gaming'}`,
      image: { imageUrl: getRandomImage(5) },
      price: { value: '349.99', currency: 'USD' },
      itemEndDate: new Date(Date.now() + 9000000).toISOString(),
      bidCount: 12,
      itemWebUrl: 'https://www.ebay.com/itm/321654987'
    }
  ];

  return {
    itemSummaries: mockItems.slice(0, Math.min(limit, mockItems.length)),
    total: mockItems.length
  };
}

// GET /api/ebay/search?q=...
router.get('/search', async (req, res) => {
  try {
    const { 
      q = '', 
      keywords = '', 
      limit = 20, 
      page = 1, 
      categoryId = '',
      sortOrder = 'EndTimeSoonest',
      minPrice = '',
      maxPrice = ''
    } = req.query;
    
    // Check if user is authenticated and has eBay connected
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let token = null;
    let useRealAPI = false;
    
    try {
      // Try to get user's eBay access token
      token = await getAccessTokenForUser(req.user);
      useRealAPI = true;
    } catch (tokenError) {
      console.log('⚠️ User eBay token not available, using mock data:', tokenError.message);
      useRealAPI = false;
      // Don't throw the error - just use mock data instead
    }
    
    const searchQuery = q || keywords;

    let data;
    
    if (useRealAPI && token) {
      // Use real eBay API
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search`;
      
      const params = {
        q: searchQuery,
        limit: Math.min(parseInt(limit), 200), // eBay max is 200
        filter: 'buyingOptions:{AUCTION}', // auctions only
        sort: sortOrder,
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      // Add optional filters
      if (categoryId) params.category_ids = categoryId;
      if (minPrice) params.filter += `,price:[${minPrice}..]`;
      if (maxPrice) params.filter += `,price:[..${maxPrice}]`;

      try {
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        data = response.data;
      } catch (apiError) {
        // Handle specific eBay API errors
        if (apiError.response?.data?.errors) {
          const error = apiError.response.data.errors[0];
          if (error.errorId === 1100 && error.message === 'Access denied') {
            console.log('❌ eBay API access denied - insufficient permissions for buy.browse scope');
            console.log('📦 Falling back to mock data');
            data = generateMockEbayData(searchQuery, parseInt(limit));
          } else {
            throw apiError;
          }
        } else {
          throw apiError;
        }
      }
    } else {
      // Use mock data when authentication fails
      console.log('📦 Using mock eBay data');
      data = generateMockEbayData(searchQuery, parseInt(limit));
    }

    const items = (data.itemSummaries || []).map(it => ({
      id: it.itemId,
      _id: it.itemId, // For compatibility with frontend
      title: it.title,
      image: it.image?.imageUrl,
      images: it.image ? [{ url: it.image.imageUrl, alt: it.title }] : [],
      currentBid: it.price?.value,
      currentPrice: it.price?.value,
      price: it.price?.value,
      currency: it.price?.currency,
      endTime: it.itemEndDate,
      endsIn: it.itemEndDate,
      endsAtHuman: new Date(it.itemEndDate).toLocaleString(),
      bidCount: it.bidCount,
      bids: it.bidCount,
      itemUrl: it.itemWebUrl,
      url: it.itemWebUrl,
      platform: 'eBay',
      timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
      aiScore: {
        dealPotential: Math.floor(Math.random() * 30) + 70, // Mock AI scores
        trendingScore: Math.floor(Math.random() * 40) + 60,
        competitionLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
      },
      competition: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
    }));

    // Calculate pagination info
    const totalItems = data.total || items.length;
    const totalPages = Math.ceil(totalItems / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;

    res.json({ 
      items,
      pagination: {
        current: parseInt(page),
        pages: totalPages,
        total: totalItems,
        limit: parseInt(limit),
        hasNextPage
      }
    });
  } catch (err) {
    console.error('eBay search error', err.response?.data || err.message);
    res.status(500).json({ error: 'ebay_search_failed' });
  }
});

// GET /api/ebay/item/:id
router.get('/item/:id', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let token = null;
    let useRealAPI = false;
    
    try {
      // Try to get user's eBay access token
      token = await getAccessTokenForUser(req.user);
      useRealAPI = true;
    } catch (tokenError) {
      console.log('⚠️ User eBay token not available for item details, using mock data:', tokenError.message);
      useRealAPI = false;
      // Don't throw the error - just use mock data instead
    }

    if (useRealAPI && token) {
      const url = `https://api.ebay.com/buy/browse/v1/item/${req.params.id}`;
      const { data: it } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const item = {
        id: it.itemId,
        title: it.title,
        image: it.image?.imageUrl,
        currentBid: it.price?.value,
        startingPrice: it.price?.value * 0.5, // Estimate starting price
        currency: it.price?.currency,
        itemUrl: it.itemWebUrl,
        seller: {
          username: it.seller?.username || 'eBay Seller',
          profileImage: 'https://picsum.photos/100/100?random=888'
        },
        description: it.shortDescription || it.description || 'No description available.',
        bidCount: it.bidCount || 0,
        timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
        dealPotential: Math.floor(Math.random() * 40) + 60, // Random 60-100%
        competitionLevel: it.bidCount > 10 ? 'High' : it.bidCount > 5 ? 'Medium' : 'Low',
        trendingScore: Math.floor(Math.random() * 30) + 70, // Random 70-100%
        bids: [] // Real eBay API doesn't provide bid history in item details
      };

      res.json({ item });
    } else {
      // Return mock item data when API is not available
      const getRandomImage = (seed) => {
        const sources = [
          `https://picsum.photos/300/200?random=${seed}`,
          `https://source.unsplash.com/300x200/?electronics&sig=${seed}`,
          `https://loremflickr.com/300/200/electronics?random=${seed}`
        ];
        return sources[seed % sources.length];
      };

      const mockItem = {
        id: req.params.id,
        title: `Mock Item ${req.params.id}`,
        image: getRandomImage(99),
        currentBid: '99.99',
        startingPrice: '49.99',
        currency: 'USD',
        itemUrl: `https://www.ebay.com/itm/${req.params.id}`,
        seller: {
          username: 'mock_seller',
          profileImage: 'https://picsum.photos/100/100?random=999'
        },
        description: 'This is a mock item for testing purposes. It includes all the features you would expect from a real auction item.',
        bidCount: 5,
        timeRemaining: 3600, // 1 hour in seconds
        dealPotential: 85,
        competitionLevel: 'Medium',
        trendingScore: 72,
        bids: [
          {
            bidder: 'bidder1',
            amount: 99.99,
            timestamp: new Date(Date.now() - 300000) // 5 minutes ago
          },
          {
            bidder: 'bidder2', 
            amount: 95.50,
            timestamp: new Date(Date.now() - 600000) // 10 minutes ago
          },
          {
            bidder: 'bidder3',
            amount: 89.99,
            timestamp: new Date(Date.now() - 900000) // 15 minutes ago
          }
        ]
      };

      res.json({ item: mockItem });
    }
  } catch (err) {
    console.error('eBay item error', err.response?.data || err.message);
    res.status(500).json({ error: 'ebay_item_failed' });
  }
});

// GET /api/ebay/trending
router.get('/trending', async (req, res) => {
  try {
    const { category = 'all', limit = 20 } = req.query;
    
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let token = null;
    let useRealAPI = false;
    
    try {
      // Try to get user's eBay access token
      token = await getAccessTokenForUser(req.user);
      useRealAPI = true;
    } catch (tokenError) {
      console.log('⚠️ User eBay token not available for trending, using mock data:', tokenError.message);
      useRealAPI = false;
      // Don't throw the error - just use mock data instead
    }

    let trendingItems = [];
    let categories = [];

    if (useRealAPI && token) {
      // Use real eBay API
      const trendingQueries = [
        'iPhone', 'laptop', 'watch', 'headphones', 'camera',
        'gaming', 'fitness', 'home', 'fashion', 'collectibles'
      ];

      // Get trending items from multiple categories
      for (const query of trendingQueries.slice(0, Math.ceil(limit / 2))) {
        try {
          const url = `https://api.ebay.com/buy/browse/v1/item_summary/search`;
          const { data } = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              q: query,
              limit: 2,
              filter: 'buyingOptions:{AUCTION}',
              sort: 'endTimeSoonest'
            },
          });

          const items = (data.itemSummaries || []).map(it => ({
            id: it.itemId,
            title: it.title,
            image: it.image?.imageUrl,
            currentBid: it.price?.value,
            currency: it.price?.currency,
            endTime: it.itemEndDate,
            bidCount: it.bidCount,
            itemUrl: it.itemWebUrl,
            platform: 'eBay',
            timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
            aiScore: {
              dealPotential: Math.floor(Math.random() * 30) + 70, // Mock AI scores
              trendingScore: Math.floor(Math.random() * 40) + 60,
              competitionLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
            }
          }));

          trendingItems.push(...items);
        } catch (err) {
          console.error(`Error fetching trending for ${query}:`, err.message);
        }
      }

      categories = trendingQueries.map(cat => ({ _id: cat, count: Math.floor(Math.random() * 100) + 50 }));
    } else {
      // Use mock data
      console.log('📦 Using mock trending data');
      const mockData = generateMockEbayData('trending', parseInt(limit));
      trendingItems = (mockData.itemSummaries || []).map(it => ({
        id: it.itemId,
        title: it.title,
        image: it.image?.imageUrl,
        currentBid: it.price?.value,
        currency: it.price?.currency,
        endTime: it.itemEndDate,
        bidCount: it.bidCount,
        itemUrl: it.itemWebUrl,
        platform: 'eBay',
        timeRemaining: Math.floor((new Date(it.itemEndDate) - new Date()) / 1000),
        aiScore: {
          dealPotential: Math.floor(Math.random() * 30) + 70,
          trendingScore: Math.floor(Math.random() * 40) + 60,
          competitionLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        }
      }));

      categories = [
        { _id: 'iPhone', count: 125 },
        { _id: 'laptop', count: 98 },
        { _id: 'watch', count: 87 },
        { _id: 'headphones', count: 76 },
        { _id: 'camera', count: 65 }
      ];
    }

    res.json({ 
      items: trendingItems.slice(0, limit),
      categories
    });
  } catch (err) {
    console.error('eBay trending error', err.response?.data || err.message);
    res.status(500).json({ error: 'ebay_trending_failed' });
  }
});

// GET /api/ebay/categories
router.get('/categories', async (req, res) => {
  try {
    // Return a list of popular eBay categories
    const categories = [
      { _id: 'electronics', name: 'Electronics', count: 1250 },
      { _id: 'fashion', name: 'Fashion', count: 980 },
      { _id: 'home', name: 'Home & Garden', count: 750 },
      { _id: 'sports', name: 'Sports & Outdoors', count: 650 },
      { _id: 'collectibles', name: 'Collectibles', count: 580 },
      { _id: 'automotive', name: 'Automotive', count: 420 },
      { _id: 'toys', name: 'Toys & Games', count: 380 },
      { _id: 'books', name: 'Books', count: 320 }
    ];

    res.json({ categories });
  } catch (err) {
    console.error('eBay categories error', err.message);
    res.status(500).json({ error: 'ebay_categories_failed' });
  }
});

module.exports = router;



