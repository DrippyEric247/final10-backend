const axios = require('axios');
const cheerio = require('cheerio');

class SimpleScraper {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
    };
  }

  async searchEBay(searchTerm, limit = 5) {
    try {
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}&_sop=1&LH_Auction=1&rt=nc`;
      
      const response = await axios.get(searchUrl, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      const $ = cheerio.load(response.data);
      const auctions = [];
      
      $('.s-item').slice(1, limit + 1).each((index, element) => {
        try {
          const $item = $(element);
          
          const title = $item.find('.s-item__title').text().trim();
          const priceText = $item.find('.s-item__price').text().trim();
          const imageUrl = $item.find('.s-item__image img').attr('src');
          const itemUrl = $item.find('.s-item__link').attr('href');
          const timeLeft = $item.find('.s-item__time-left').text().trim();
          const bids = $item.find('.s-item__bids').text().trim();
          
          if (!title || !priceText) return;
          
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          const timeRemaining = this.parseTimeRemaining(timeLeft);
          
          auctions.push({
            title: title,
            description: title,
            category: this.categorizeItem(title),
            condition: 'good',
            startingPrice: price,
            currentBid: price,
            endTime: new Date(Date.now() + timeRemaining * 1000),
            timeRemaining: timeRemaining,
            images: imageUrl ? [{ url: imageUrl, alt: title }] : [],
            tags: this.extractTags(title),
            source: {
              platform: 'ebay',
              externalId: this.extractItemId(itemUrl),
              url: itemUrl
            },
            aiScore: {
              dealPotential: this.calculateDealPotential(price, timeRemaining, bids),
              competitionLevel: this.getCompetitionLevel(bids),
              trendingScore: this.calculateTrendingScore(timeRemaining, bids)
            },
            status: 'active',
            bidCount: this.extractBidCount(bids)
          });
        } catch (error) {
          console.error('Error parsing eBay item:', error);
        }
      });
      
      return auctions;
    } catch (error) {
      console.error('eBay scraping error:', error);
      return [];
    }
  }

  async searchMercari(searchTerm, limit = 5) {
    try {
      // For demo purposes, we'll create mock Mercari results
      // In production, you'd need to handle Mercari's anti-bot measures
      const mockResults = [
        {
          title: `${searchTerm} - Mercari Item 1`,
          description: `Great condition ${searchTerm} from Mercari`,
          category: this.categorizeItem(searchTerm),
          condition: 'like-new',
          startingPrice: Math.floor(Math.random() * 200) + 50,
          currentBid: Math.floor(Math.random() * 200) + 50,
          endTime: new Date(Date.now() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000),
          timeRemaining: Math.floor((Math.random() * 7 + 1) * 24 * 60 * 60),
          images: [{ url: 'https://via.placeholder.com/300x300', alt: searchTerm }],
          tags: this.extractTags(searchTerm),
          source: {
            platform: 'mercari',
            externalId: `mercari_${Date.now()}_${Math.random()}`,
            url: `https://mercari.com/item/${Date.now()}`
          },
          aiScore: {
            dealPotential: Math.floor(Math.random() * 30) + 60,
            competitionLevel: 'low',
            trendingScore: Math.floor(Math.random() * 40) + 40
          },
          status: 'active',
          bidCount: 0
        }
      ];
      
      return mockResults.slice(0, limit);
    } catch (error) {
      console.error('Mercari scraping error:', error);
      return [];
    }
  }

  async searchFacebook(searchTerm, limit = 5) {
    try {
      // For demo purposes, we'll create mock Facebook results
      // In production, you'd need to handle Facebook's anti-bot measures
      const mockResults = [
        {
          title: `${searchTerm} - Facebook Marketplace`,
          description: `Local ${searchTerm} available on Facebook Marketplace`,
          category: this.categorizeItem(searchTerm),
          condition: 'good',
          startingPrice: Math.floor(Math.random() * 150) + 25,
          currentBid: Math.floor(Math.random() * 150) + 25,
          endTime: new Date(Date.now() + (Math.random() * 5 + 1) * 24 * 60 * 60 * 1000),
          timeRemaining: Math.floor((Math.random() * 5 + 1) * 24 * 60 * 60),
          images: [{ url: 'https://via.placeholder.com/300x300', alt: searchTerm }],
          tags: this.extractTags(searchTerm),
          location: {
            city: 'Local',
            state: 'CA',
            country: 'US'
          },
          source: {
            platform: 'facebook',
            externalId: `facebook_${Date.now()}_${Math.random()}`,
            url: `https://facebook.com/marketplace/item/${Date.now()}`
          },
          aiScore: {
            dealPotential: Math.floor(Math.random() * 25) + 55,
            competitionLevel: 'medium',
            trendingScore: Math.floor(Math.random() * 35) + 35
          },
          status: 'active',
          bidCount: 0
        }
      ];
      
      return mockResults.slice(0, limit);
    } catch (error) {
      console.error('Facebook scraping error:', error);
      return [];
    }
  }

  parseTimeRemaining(timeText) {
    if (!timeText) return 86400;
    
    const timeStr = timeText.toLowerCase();
    
    if (timeStr.includes('d') && timeStr.includes('h')) {
      const days = parseInt(timeStr.match(/(\d+)d/)?.[1] || 0);
      const hours = parseInt(timeStr.match(/(\d+)h/)?.[1] || 0);
      return (days * 24 + hours) * 3600;
    } else if (timeStr.includes('h') && timeStr.includes('m')) {
      const hours = parseInt(timeStr.match(/(\d+)h/)?.[1] || 0);
      const minutes = parseInt(timeStr.match(/(\d+)m/)?.[1] || 0);
      return (hours * 60 + minutes) * 60;
    } else if (timeStr.includes('m')) {
      const minutes = parseInt(timeStr.match(/(\d+)m/)?.[1] || 0);
      return minutes * 60;
    }
    
    return 86400;
  }

  extractItemId(url) {
    if (!url) return null;
    const match = url.match(/\/itm\/(\d+)/);
    return match ? match[1] : null;
  }

  extractBidCount(bidText) {
    if (!bidText) return 0;
    const match = bidText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  categorizeItem(title) {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('iphone') || titleLower.includes('samsung') || titleLower.includes('phone')) {
      return 'electronics';
    } else if (titleLower.includes('nike') || titleLower.includes('adidas') || titleLower.includes('shoe')) {
      return 'fashion';
    } else if (titleLower.includes('laptop') || titleLower.includes('computer') || titleLower.includes('macbook')) {
      return 'electronics';
    } else if (titleLower.includes('book')) {
      return 'books';
    } else if (titleLower.includes('toy') || titleLower.includes('game')) {
      return 'toys';
    }
    
    return 'other';
  }

  extractTags(title) {
    const words = title.toLowerCase().split(/\s+/);
    return words.filter(word => word.length > 3);
  }

  calculateDealPotential(price, timeRemaining, bids) {
    let score = 50;
    
    if (price < 50) score += 20;
    else if (price < 100) score += 15;
    else if (price < 500) score += 10;
    
    if (timeRemaining < 3600) score += 15;
    else if (timeRemaining < 86400) score += 10;
    
    const bidCount = this.extractBidCount(bids);
    if (bidCount === 0) score += 15;
    else if (bidCount < 3) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  getCompetitionLevel(bids) {
    const bidCount = this.extractBidCount(bids);
    if (bidCount === 0) return 'low';
    if (bidCount < 5) return 'medium';
    return 'high';
  }

  calculateTrendingScore(timeRemaining, bids) {
    let score = 30;
    
    const bidCount = this.extractBidCount(bids);
    score += Math.min(40, bidCount * 5);
    
    if (timeRemaining < 3600) score += 20;
    else if (timeRemaining < 86400) score += 10;
    
    return Math.min(100, score);
  }

  async searchOfferUp(searchTerm, limit = 5) {
    try {
      // For now, return mock data since OfferUp has strong anti-scraping measures
      // In production, you would use their official API or a more sophisticated scraping solution
      console.log(`📱 OfferUp: Generating mock local listings for "${searchTerm}"`);
      
      const mockListings = this.generateMockOfferUpListings(searchTerm, limit);
      console.log(`📱 OfferUp: Found ${mockListings.length} local listings (mock data)`);
      return mockListings;
      
    } catch (error) {
      console.error('OfferUp scraping error:', error.message);
      return [];
    }
  }

  generateMockOfferUpListings(searchTerm, limit) {
    const mockData = {
      'iphone': [
        { title: 'iPhone 13 Pro Max 256GB', price: 650, location: 'Downtown, 2 miles away' },
        { title: 'iPhone 12 128GB Unlocked', price: 450, location: 'Northside, 5 miles away' },
        { title: 'iPhone 11 64GB Good Condition', price: 300, location: 'Eastside, 3 miles away' },
        { title: 'iPhone SE 2020 64GB', price: 200, location: 'Westside, 4 miles away' },
        { title: 'iPhone XR 128GB', price: 350, location: 'Southside, 6 miles away' }
      ],
      'laptop': [
        { title: 'MacBook Pro 13" M1 256GB', price: 800, location: 'Downtown, 1 mile away' },
        { title: 'Dell XPS 13 512GB SSD', price: 600, location: 'Northside, 3 miles away' },
        { title: 'HP Pavilion 15" 1TB HDD', price: 400, location: 'Eastside, 4 miles away' },
        { title: 'Lenovo ThinkPad T480', price: 500, location: 'Westside, 2 miles away' },
        { title: 'ASUS ROG Gaming Laptop', price: 700, location: 'Southside, 5 miles away' }
      ],
      'furniture': [
        { title: 'IKEA Sofa Bed 3-Seater', price: 200, location: 'Downtown, 2 miles away' },
        { title: 'Wooden Dining Table Set', price: 150, location: 'Northside, 4 miles away' },
        { title: 'Office Chair Ergonomic', price: 80, location: 'Eastside, 3 miles away' },
        { title: 'Bookshelf 5-Tier White', price: 60, location: 'Westside, 2 miles away' },
        { title: 'Coffee Table Glass Top', price: 120, location: 'Southside, 5 miles away' }
      ],
      'car': [
        { title: '2018 Honda Civic 50K miles', price: 15000, location: 'Downtown, 3 miles away' },
        { title: '2015 Toyota Camry 80K miles', price: 12000, location: 'Northside, 6 miles away' },
        { title: '2019 Nissan Altima 40K miles', price: 18000, location: 'Eastside, 4 miles away' },
        { title: '2016 Ford Focus 70K miles', price: 10000, location: 'Westside, 5 miles away' },
        { title: '2020 Hyundai Elantra 30K miles', price: 16000, location: 'Southside, 7 miles away' }
      ]
    };

    // Find matching category or use default
    const searchLower = searchTerm.toLowerCase();
    let categoryData = [];
    
    for (const [category, items] of Object.entries(mockData)) {
      if (searchLower.includes(category)) {
        categoryData = items;
        break;
      }
    }
    
    // If no specific category found, use iPhone data as default
    if (categoryData.length === 0) {
      categoryData = mockData['iphone'];
    }

    // Generate listings
    const listings = [];
    for (let i = 0; i < Math.min(limit, categoryData.length); i++) {
      const item = categoryData[i];
      const price = item.price;
      const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      listings.push({
        title: item.title,
        description: item.title,
        category: this.categorizeItem(item.title),
        condition: 'good',
        startingPrice: price,
        currentBid: price,
        endTime: endTime,
        seller: 'Local Seller',
        platform: 'offerup',
        imageUrl: `https://via.placeholder.com/300x200?text=${encodeURIComponent(item.title.substring(0, 20))}`,
        itemUrl: `https://offerup.com/item/${Date.now()}-${i}`,
        bids: 0,
        timeRemaining: 7 * 24 * 60 * 60, // 7 days in seconds
        dealPotential: this.calculateOfferUpDealPotential(price, item.location),
        competitionLevel: 'low',
        trendingScore: this.calculateOfferUpTrendingScore(price, item.location),
        tags: this.extractTags(item.title),
        location: item.location,
        isLocal: true,
        platformType: 'marketplace'
      });
    }

    return listings;
  }

  calculateOfferUpDealPotential(price, location) {
    let score = 60; // Base score higher for local deals
    
    // Lower prices = better deals
    if (price < 25) score += 25;
    else if (price < 50) score += 20;
    else if (price < 100) score += 15;
    else if (price < 200) score += 10;
    
    // Local deals get bonus points
    if (location && location.toLowerCase().includes('near')) {
      score += 15;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  calculateOfferUpTrendingScore(price, location) {
    let score = 40; // Base score for local marketplace
    
    // Popular price ranges get higher trending scores
    if (price >= 20 && price <= 100) score += 30;
    else if (price >= 100 && price <= 500) score += 20;
    
    // Local items trend better
    if (location) score += 20;
    
    return Math.min(100, score);
  }
}

module.exports = SimpleScraper;
