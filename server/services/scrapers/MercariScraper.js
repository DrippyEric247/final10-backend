const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class MercariScraper {
  constructor() {
    this.baseUrl = 'https://www.mercari.com';
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
      
      // Search for items
      const searchUrl = `${this.baseUrl}/search/?keyword=${encodeURIComponent(searchTerm)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for results to load
      await page.waitForSelector('[data-testid="item-cell"]', { timeout: 10000 });
      
      const content = await page.content();
      const $ = cheerio.load(content);
      
      const auctions = [];
      
      $('[data-testid="item-cell"]').slice(0, limit).each((index, element) => {
        try {
          const $item = $(element);
          
          const title = $item.find('[data-testid="item-name"]').text().trim();
          const priceText = $item.find('[data-testid="item-price"]').text().trim();
          const imageUrl = $item.find('img').attr('src');
          const itemUrl = $item.find('a').attr('href');
          const condition = $item.find('[data-testid="item-condition"]').text().trim();
          
          // Skip if no title or price
          if (!title || !priceText) return;
          
          // Extract price
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          
          // Mercari items are typically available for immediate purchase
          // We'll simulate auction behavior with random time remaining
          const timeRemaining = this.generateRandomTimeRemaining();
          
          // Calculate deal potential
          const dealPotential = this.calculateDealPotential(price, condition);
          
          auctions.push({
            title: title,
            description: title, // Mercari doesn't show full description in search
            category: this.categorizeItem(title),
            condition: this.mapCondition(condition),
            startingPrice: price,
            currentBid: price,
            endTime: new Date(Date.now() + timeRemaining * 1000),
            timeRemaining: timeRemaining,
            images: imageUrl ? [{ url: imageUrl, alt: title }] : [],
            tags: this.extractTags(title),
            source: {
              platform: 'mercari',
              externalId: this.extractItemId(itemUrl),
              url: itemUrl ? `${this.baseUrl}${itemUrl}` : null
            },
            aiScore: {
              dealPotential: dealPotential,
              competitionLevel: 'low', // Mercari is typically less competitive
              trendingScore: this.calculateTrendingScore(price, condition)
            },
            status: 'active',
            bidCount: 0 // Mercari doesn't have bidding
          });
        } catch (error) {
          console.error('Error parsing Mercari item:', error);
        }
      });
      
      await browser.close();
      return auctions;
      
    } catch (error) {
      console.error('Mercari scraping error:', error);
      return [];
    }
  }

  generateRandomTimeRemaining() {
    // Generate random time between 1 hour and 7 days
    const minHours = 1;
    const maxHours = 168; // 7 days
    const randomHours = Math.random() * (maxHours - minHours) + minHours;
    return Math.floor(randomHours * 3600);
  }

  extractItemId(url) {
    if (!url) return null;
    const match = url.match(/\/items\/(\d+)/);
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
    }
    
    return 'other';
  }

  extractTags(title) {
    const words = title.toLowerCase().split(/\s+/);
    return words.filter(word => word.length > 3);
  }

  mapCondition(condition) {
    if (!condition) return 'good';
    
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('new') || conditionLower.includes('unused')) return 'new';
    if (conditionLower.includes('like') || conditionLower.includes('excellent')) return 'like-new';
    if (conditionLower.includes('good')) return 'good';
    if (conditionLower.includes('fair') || conditionLower.includes('used')) return 'fair';
    return 'poor';
  }

  calculateDealPotential(price, condition) {
    let score = 60; // Base score (Mercari typically has good deals)
    
    // Lower price = higher deal potential
    if (price < 50) score += 20;
    else if (price < 100) score += 15;
    else if (price < 500) score += 10;
    
    // Better condition = higher deal potential
    const conditionScore = this.getConditionScore(condition);
    score += conditionScore;
    
    return Math.min(100, Math.max(0, score));
  }

  getConditionScore(condition) {
    const conditionLower = condition ? condition.toLowerCase() : '';
    if (conditionLower.includes('new')) return 15;
    if (conditionLower.includes('like') || conditionLower.includes('excellent')) return 10;
    if (conditionLower.includes('good')) return 5;
    return 0;
  }

  calculateTrendingScore(price, condition) {
    let score = 40; // Base score
    
    // Popular price ranges get higher trending scores
    if (price >= 50 && price <= 200) score += 20;
    else if (price >= 200 && price <= 500) score += 15;
    
    // Better condition = more trending
    const conditionScore = this.getConditionScore(condition);
    score += conditionScore;
    
    return Math.min(100, score);
  }
}

module.exports = MercariScraper;
