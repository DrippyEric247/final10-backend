const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class FacebookScraper {
  constructor() {
    this.baseUrl = 'https://www.facebook.com/marketplace';
  }

  async searchAuctions(searchTerm, limit = 10) {
    try {
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Facebook Marketplace search
      const searchUrl = `${this.baseUrl}/search/?query=${encodeURIComponent(searchTerm)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for results to load
      await page.waitForSelector('[data-testid="marketplace-search-results"]', { timeout: 15000 });
      
      const content = await page.content();
      const $ = cheerio.load(content);
      
      const auctions = [];
      
      $('[data-testid="marketplace-search-results"] a[href*="/marketplace/item/"]').slice(0, limit).each((index, element) => {
        try {
          const $item = $(element);
          
          const title = $item.find('[data-testid="marketplace-search-result-item-title"]').text().trim() ||
                       $item.find('span[dir="auto"]').first().text().trim();
          const priceText = $item.find('[data-testid="marketplace-search-result-item-price"]').text().trim() ||
                           $item.find('span[dir="auto"]').eq(1).text().trim();
          const imageUrl = $item.find('img').attr('src');
          const itemUrl = $item.attr('href');
          const location = $item.find('[data-testid="marketplace-search-result-item-location"]').text().trim();
          
          // Skip if no title or price
          if (!title || !priceText) return;
          
          // Extract price
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          
          // Facebook Marketplace items are typically available for immediate purchase
          // We'll simulate auction behavior with random time remaining
          const timeRemaining = this.generateRandomTimeRemaining();
          
          // Calculate deal potential
          const dealPotential = this.calculateDealPotential(price, location);
          
          auctions.push({
            title: title,
            description: title, // Facebook doesn't show full description in search
            category: this.categorizeItem(title),
            condition: 'good', // Default condition for Facebook
            startingPrice: price,
            currentBid: price,
            endTime: new Date(Date.now() + timeRemaining * 1000),
            timeRemaining: timeRemaining,
            images: imageUrl ? [{ url: imageUrl, alt: title }] : [],
            tags: this.extractTags(title),
            location: this.parseLocation(location),
            source: {
              platform: 'facebook',
              externalId: this.extractItemId(itemUrl),
              url: itemUrl ? `https://www.facebook.com${itemUrl}` : null
            },
            aiScore: {
              dealPotential: dealPotential,
              competitionLevel: 'medium', // Facebook is moderately competitive
              trendingScore: this.calculateTrendingScore(price, location)
            },
            status: 'active',
            bidCount: 0 // Facebook doesn't have bidding
          });
        } catch (error) {
          console.error('Error parsing Facebook item:', error);
        }
      });
      
      await browser.close();
      return auctions;
      
    } catch (error) {
      console.error('Facebook scraping error:', error);
      return [];
    }
  }

  generateRandomTimeRemaining() {
    // Generate random time between 2 hours and 5 days
    const minHours = 2;
    const maxHours = 120; // 5 days
    const randomHours = Math.random() * (maxHours - minHours) + minHours;
    return Math.floor(randomHours * 3600);
  }

  extractItemId(url) {
    if (!url) return null;
    const match = url.match(/\/marketplace\/item\/(\d+)/);
    return match ? match[1] : null;
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
    } else if (titleLower.includes('car') || titleLower.includes('vehicle') || titleLower.includes('auto')) {
      return 'automotive';
    }
    
    return 'other';
  }

  extractTags(title) {
    const words = title.toLowerCase().split(/\s+/);
    return words.filter(word => word.length > 3);
  }

  parseLocation(locationText) {
    if (!locationText) return null;
    
    const parts = locationText.split(',');
    return {
      city: parts[0]?.trim() || '',
      state: parts[1]?.trim() || '',
      country: 'US'
    };
  }

  calculateDealPotential(price, location) {
    let score = 55; // Base score (Facebook can have good local deals)
    
    // Lower price = higher deal potential
    if (price < 50) score += 20;
    else if (price < 100) score += 15;
    else if (price < 500) score += 10;
    
    // Local deals often have better potential
    if (location && location.toLowerCase().includes('local')) {
      score += 10;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  calculateTrendingScore(price, location) {
    let score = 35; // Base score
    
    // Popular price ranges get higher trending scores
    if (price >= 25 && price <= 100) score += 25;
    else if (price >= 100 && price <= 300) score += 20;
    else if (price >= 300 && price <= 1000) score += 15;
    
    // Local items tend to be more trending
    if (location && location.toLowerCase().includes('local')) {
      score += 15;
    }
    
    return Math.min(100, score);
  }
}

module.exports = FacebookScraper;
