const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SimpleScraper = require('../services/scrapers/SimpleScraper');

const scraper = new SimpleScraper();

/**
 * GET /api/local-deals/search
 * Search for local deals on OfferUp and other local marketplaces
 */
router.get('/search', auth, async (req, res) => {
  try {
    const { q: searchTerm, limit = 10, radius = 25 } = req.query;

    if (!searchTerm) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    console.log(`🏠 Searching local deals for "${searchTerm}" within ${radius} miles...`);

    // Search OfferUp for local deals
    const offerUpResults = await scraper.searchOfferUp(searchTerm, limit);
    
    // Filter and enhance local deals
    const localDeals = offerUpResults.map(item => ({
      ...item,
      localAdvantage: {
        pickupAvailable: true,
        noShipping: true,
        instantBuy: true,
        localNegotiation: true,
        cashDeals: true,
        sameDayPickup: true
      },
      dealScore: calculateLocalDealScore(item),
      savings: calculateLocalSavings(item),
      urgency: calculateLocalUrgency(item)
    }));

    // Sort by local deal score (highest first)
    localDeals.sort((a, b) => b.dealScore - a.dealScore);

    res.json({
      searchTerm,
      radius,
      totalResults: localDeals.length,
      localDeals,
      advantages: {
        noShipping: 'No shipping costs or delays',
        instantBuy: 'Buy immediately without bidding',
        localPickup: 'Pick up same day or next day',
        cashDeals: 'Negotiate cash prices',
        localSupport: 'Support local sellers'
      }
    });

  } catch (error) {
    console.error('Local deals search error:', error);
    res.status(500).json({ message: 'Failed to search local deals' });
  }
});

/**
 * GET /api/local-deals/trending
 * Get trending local deals by category
 */
router.get('/trending', auth, async (req, res) => {
  try {
    const { category = 'all', limit = 20 } = req.query;

    // Popular search terms for local deals
    const trendingTerms = [
      'iPhone', 'Samsung Galaxy', 'MacBook', 'iPad',
      'Nintendo Switch', 'PlayStation', 'Xbox',
      'furniture', 'bike', 'car parts', 'tools',
      'clothing', 'shoes', 'jewelry', 'books'
    ];

    const trendingDeals = [];

    // Search for trending items
    for (const term of trendingTerms.slice(0, 5)) {
      try {
        const results = await scraper.searchOfferUp(term, 3);
        const enhancedResults = results.map(item => ({
          ...item,
          trendingTerm: term,
          localAdvantage: {
            pickupAvailable: true,
            noShipping: true,
            instantBuy: true,
            localNegotiation: true
          },
          dealScore: calculateLocalDealScore(item),
          savings: calculateLocalSavings(item)
        }));
        trendingDeals.push(...enhancedResults);
      } catch (error) {
        console.error(`Error searching trending term "${term}":`, error);
      }
    }

    // Sort by trending score and deal potential
    trendingDeals.sort((a, b) => {
      const scoreA = a.trendingScore + a.dealScore;
      const scoreB = b.trendingScore + b.dealScore;
      return scoreB - scoreA;
    });

    res.json({
      category,
      totalResults: trendingDeals.length,
      trendingDeals: trendingDeals.slice(0, limit),
      categories: {
        electronics: 'Phones, laptops, gaming consoles',
        furniture: 'Tables, chairs, sofas, decor',
        vehicles: 'Cars, bikes, motorcycles, parts',
        fashion: 'Clothing, shoes, accessories',
        tools: 'Power tools, hand tools, equipment'
      }
    });

  } catch (error) {
    console.error('Trending local deals error:', error);
    res.status(500).json({ message: 'Failed to get trending local deals' });
  }
});

/**
 * GET /api/local-deals/categories
 * Get local deals by specific category
 */
router.get('/categories/:category', auth, async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 15 } = req.query;

    // Category-specific search terms
    const categoryTerms = {
      electronics: ['iPhone', 'Samsung', 'MacBook', 'iPad', 'laptop', 'tablet'],
      furniture: ['sofa', 'table', 'chair', 'dresser', 'bed', 'desk'],
      vehicles: ['car', 'truck', 'motorcycle', 'bike', 'scooter', 'parts'],
      fashion: ['clothing', 'shoes', 'dress', 'jacket', 'jeans', 'accessories'],
      tools: ['drill', 'saw', 'wrench', 'toolbox', 'equipment', 'machinery'],
      toys: ['toy', 'game', 'puzzle', 'doll', 'action figure', 'board game'],
      books: ['book', 'textbook', 'novel', 'magazine', 'comic', 'manual']
    };

    const searchTerms = categoryTerms[category] || ['item', 'product', 'deal'];
    const categoryDeals = [];

    // Search for category-specific items
    for (const term of searchTerms.slice(0, 3)) {
      try {
        const results = await scraper.searchOfferUp(term, 5);
        const enhancedResults = results.map(item => ({
          ...item,
          category: category,
          localAdvantage: {
            pickupAvailable: true,
            noShipping: true,
            instantBuy: true,
            localNegotiation: true
          },
          dealScore: calculateLocalDealScore(item),
          savings: calculateLocalSavings(item)
        }));
        categoryDeals.push(...enhancedResults);
      } catch (error) {
        console.error(`Error searching category "${category}" term "${term}":`, error);
      }
    }

    // Sort by deal score
    categoryDeals.sort((a, b) => b.dealScore - a.dealScore);

    res.json({
      category,
      totalResults: categoryDeals.length,
      deals: categoryDeals.slice(0, limit),
      searchTerms: searchTerms,
      advantages: getCategoryAdvantages(category)
    });

  } catch (error) {
    console.error('Category local deals error:', error);
    res.status(500).json({ message: 'Failed to get category local deals' });
  }
});

// Helper functions
function calculateLocalDealScore(item) {
  let score = 50; // Base score for local deals
  
  // Price-based scoring
  if (item.currentBid < 25) score += 30;
  else if (item.currentBid < 50) score += 25;
  else if (item.currentBid < 100) score += 20;
  else if (item.currentBid < 200) score += 15;
  
  // Local advantage bonus
  if (item.isLocal) score += 20;
  
  // No shipping cost bonus
  score += 15;
  
  // Instant buy bonus
  score += 10;
  
  return Math.min(100, score);
}

function calculateLocalSavings(item) {
  // Estimate savings from no shipping, taxes, and potential negotiation
  const basePrice = item.currentBid;
  const shippingSavings = Math.min(15, basePrice * 0.1); // 10% or $15 max
  const taxSavings = basePrice * 0.08; // 8% tax savings
  const negotiationPotential = basePrice * 0.1; // 10% negotiation potential
  
  return {
    shipping: shippingSavings,
    taxes: taxSavings,
    negotiation: negotiationPotential,
    total: shippingSavings + taxSavings + negotiationPotential
  };
}

function calculateLocalUrgency(item) {
  // Local deals have different urgency factors
  let urgency = 'medium';
  
  if (item.currentBid < 50) urgency = 'high'; // Cheap items go fast
  if (item.location && item.location.includes('near')) urgency = 'high';
  
  return urgency;
}

function getCategoryAdvantages(category) {
  const advantages = {
    electronics: [
      'Test before buying',
      'No shipping damage risk',
      'Immediate warranty discussion',
      'Cash negotiation possible'
    ],
    furniture: [
      'See condition in person',
      'No assembly required',
      'Immediate pickup',
      'Bulk discount potential'
    ],
    vehicles: [
      'Test drive available',
      'Inspect before buying',
      'Title transfer assistance',
      'Local mechanic recommendations'
    ],
    fashion: [
      'Try on before buying',
      'Check for defects',
      'Immediate exchange',
      'Seasonal deals'
    ],
    tools: [
      'Test functionality',
      'Check wear and tear',
      'Immediate use',
      'Professional advice'
    ]
  };
  
  return advantages[category] || [
    'Local pickup',
    'No shipping costs',
    'Immediate purchase',
    'Cash negotiation'
  ];
}

module.exports = router;


