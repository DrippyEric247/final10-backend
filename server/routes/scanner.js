const express = require('express');
const marketScanner = require('../services/marketScanner');
const auth = require('../middleware/auth');

const router = express.Router();

// Start market scanner (admin only)
router.post('/start', auth, async (req, res) => {
  try {
    // In a real app, you'd check if user is admin
    // For now, we'll allow any authenticated user to start/stop scanner
    
    await marketScanner.startScanning();
    
    res.json({ message: 'Market scanner started successfully' });
  } catch (error) {
    console.error('Start scanner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Stop market scanner (admin only)
router.post('/stop', auth, async (req, res) => {
  try {
    await marketScanner.stopScanning();
    
    res.json({ message: 'Market scanner stopped successfully' });
  } catch (error) {
    console.error('Stop scanner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get scanner status
router.get('/status', auth, async (req, res) => {
  try {
    res.json({ 
      isScanning: marketScanner.isScanning,
      lastScan: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get scanner status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manual scan trigger (admin only)
router.post('/scan', auth, async (req, res) => {
  try {
    await marketScanner.scanAllPlatforms();
    
    res.json({ message: 'Manual scan completed successfully' });
  } catch (error) {
    console.error('Manual scan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Video scanner endpoint - scan video for products
router.get('/video', auth, async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ message: 'Video URL is required' });
    }

    // Mock video scanning implementation
    // In a real app, you'd integrate with video processing services
    const mockResults = {
      framesAnalyzed: Math.floor(Math.random() * 100) + 50,
      products: [
        {
          title: 'iPhone 14 Pro Max',
          image: 'https://via.placeholder.com/300x200/000000/FFFFFF?text=iPhone+14+Pro+Max',
          price: 999,
          url: 'https://example.com/iphone',
          auctionId: null,
          platform: 'Apple Store',
          confidence: 0.95
        },
        {
          title: 'Nike Air Jordan 1',
          image: 'https://via.placeholder.com/300x200/FF0000/FFFFFF?text=Jordan+1',
          price: 150,
          url: 'https://example.com/jordan',
          auctionId: null,
          platform: 'Nike',
          confidence: 0.87
        },
        {
          title: 'MacBook Pro 16"',
          image: 'https://via.placeholder.com/300x200/808080/FFFFFF?text=MacBook+Pro',
          price: 2499,
          url: 'https://example.com/macbook',
          auctionId: null,
          platform: 'Apple Store',
          confidence: 0.92
        }
      ]
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json(mockResults);
  } catch (error) {
    console.error('Video scan error:', error);
    res.status(500).json({ message: 'Video scan failed' });
  }
});

// Generate sample auction data for testing (temporarily without auth for testing)
router.post('/generate-sample-data', async (req, res) => {
  try {
    const Auction = require('../models/Auction');
    
    // Sample auction data
    const sampleAuctions = [
      {
        title: 'iPhone 14 Pro Max 256GB - Space Black',
        description: 'Brand new iPhone 14 Pro Max in Space Black. Still sealed in original packaging.',
        category: 'electronics',
        condition: 'new',
        startingPrice: 800,
        currentBid: 850,
        buyItNowPrice: 1200,
        endTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        images: ['https://via.placeholder.com/400x300/000000/FFFFFF?text=iPhone+14+Pro+Max'],
        tags: ['iphone', 'apple', 'smartphone', 'pro max'],
        source: { platform: 'ebay', url: 'https://ebay.com/example' },
        aiScore: {
          dealPotential: 95,
          competitionLevel: 'low',
          trendingScore: 88
        },
        timeRemaining: 300,
        bidCount: 3,
        views: 45,
        status: 'active'
      },
      {
        title: 'Nike Air Jordan 1 Retro High OG - Chicago',
        description: 'Classic Air Jordan 1 in the iconic Chicago colorway. Size 10.5, excellent condition.',
        category: 'fashion',
        condition: 'excellent',
        startingPrice: 100,
        currentBid: 120,
        buyItNowPrice: 200,
        endTime: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
        images: ['https://via.placeholder.com/400x300/FF0000/FFFFFF?text=Jordan+1+Chicago'],
        tags: ['nike', 'jordan', 'sneakers', 'chicago'],
        source: { platform: 'mercari', url: 'https://mercari.com/example' },
        aiScore: {
          dealPotential: 87,
          competitionLevel: 'medium',
          trendingScore: 92
        },
        timeRemaining: 180,
        bidCount: 7,
        views: 78,
        status: 'active'
      },
      {
        title: 'PlayStation 5 Console - Brand New',
        description: 'Brand new PlayStation 5 console, never opened. Includes original packaging and all accessories.',
        category: 'electronics',
        condition: 'new',
        startingPrice: 400,
        currentBid: 450,
        buyItNowPrice: 600,
        endTime: new Date(Date.now() + 8 * 60 * 1000), // 8 minutes from now
        images: ['https://via.placeholder.com/400x300/003791/FFFFFF?text=PlayStation+5'],
        tags: ['playstation', 'ps5', 'gaming', 'console'],
        source: { platform: 'facebook', url: 'https://facebook.com/example' },
        aiScore: {
          dealPotential: 78,
          competitionLevel: 'high',
          trendingScore: 95
        },
        timeRemaining: 480,
        bidCount: 12,
        views: 156,
        status: 'active'
      },
      {
        title: 'Vintage Rolex Submariner - 1960s',
        description: 'Authentic vintage Rolex Submariner from the 1960s. Serviced and in excellent working condition.',
        category: 'collectibles',
        condition: 'excellent',
        startingPrice: 8000,
        currentBid: 8500,
        buyItNowPrice: 12000,
        endTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        images: ['https://via.placeholder.com/400x300/000000/FFFFFF?text=Vintage+Rolex'],
        tags: ['rolex', 'vintage', 'watch', 'submariner'],
        source: { platform: 'ebay', url: 'https://ebay.com/example2' },
        aiScore: {
          dealPotential: 92,
          competitionLevel: 'low',
          trendingScore: 76
        },
        timeRemaining: 900,
        bidCount: 5,
        views: 234,
        status: 'active'
      },
      {
        title: 'MacBook Pro 16" M2 Max - Space Gray',
        description: '2023 MacBook Pro 16" with M2 Max chip, 32GB RAM, 1TB SSD. Like new condition.',
        category: 'electronics',
        condition: 'like new',
        startingPrice: 2000,
        currentBid: 2100,
        buyItNowPrice: 2800,
        endTime: new Date(Date.now() + 12 * 60 * 1000), // 12 minutes from now
        images: ['https://via.placeholder.com/400x300/808080/FFFFFF?text=MacBook+Pro+16'],
        tags: ['macbook', 'apple', 'laptop', 'm2 max'],
        source: { platform: 'mercari', url: 'https://mercari.com/example2' },
        aiScore: {
          dealPotential: 85,
          competitionLevel: 'medium',
          trendingScore: 89
        },
        timeRemaining: 720,
        bidCount: 8,
        views: 189,
        status: 'active'
      }
    ];

    // Clear existing auctions (optional - remove this if you want to keep existing data)
    // await Auction.deleteMany({});

    // Create sample auctions
    const createdAuctions = await Auction.insertMany(sampleAuctions);
    
    res.json({ 
      message: 'Sample auction data generated successfully',
      count: createdAuctions.length,
      auctions: createdAuctions
    });
  } catch (error) {
    console.error('Generate sample data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;






























