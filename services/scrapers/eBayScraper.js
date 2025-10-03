const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class eBayScraper {
  constructor() {
    this.baseUrl = 'https://www.ebay.com';
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
      
      // Search for auctions only
      const searchUrl = `${this.baseUrl}/sch/i.html?_nkw=${encodeURIComponent(searchTerm)}&_sop=1&LH_Auction=1&rt=nc`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for results to load
      await page.waitForSelector('.s-item', { timeout: 10000 });
      
      const content = await page.content();
      const $ = cheerio.load(content);
      
      const auctions = [];
      
      $('.s-item').slice(0, limit).each((index, element) => {
        try {
          const $item = $(element);
          
          // Skip if it's the first item (usually a promoted item)
          if (index === 0) return;
          
          const title = $item.find('.s-item__title').text().trim();
          const priceText = $item.find('.s-item__price').text().trim();
          const imageUrl = $item.find('.s-item__image img').attr('src');
          const itemUrl = $item.find('.s-item__link').attr('href');
          const timeLeft = $item.find('.s-item__time-left').text().trim();
          const bids = $item.find('.s-item__bids').text().trim();
          
          // Skip if no title or price
          if (!title || !priceText) return;
          
          // Extract price (remove currency symbols and parse)
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          
          // Calculate time remaining in seconds
          const timeRemaining = this.parseTimeRemaining(timeLeft);
          
          // Calculate deal potential based on price and time
          const dealPotential = this.calculateDealPotential(price, timeRemaining, bids);
          
          auctions.push({
            title: title,
            description: title, // eBay doesn't show description in search results
            category: this.categorizeItem(title),
            condition: 'good', // Default condition
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
              dealPotential: dealPotential,
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
      
      await browser.close();
      return auctions;
      
    } catch (error) {
      console.error('eBay scraping error:', error);
      return [];
    }
  }

  parseTimeRemaining(timeText) {
    if (!timeText) return 86400; // Default to 1 day
    
    const now = new Date();
    const timeStr = timeText.toLowerCase();
    
    // Parse different time formats
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
    } else if (timeStr.includes('s')) {
      const seconds = parseInt(timeStr.match(/(\d+)s/)?.[1] || 0);
      return seconds;
    }
    
    return 86400; // Default to 1 day
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
    let score = 50; // Base score
    
    // Lower price = higher deal potential
    if (price < 50) score += 20;
    else if (price < 100) score += 15;
    else if (price < 500) score += 10;
    
    // Less time remaining = higher urgency
    if (timeRemaining < 3600) score += 15; // Less than 1 hour
    else if (timeRemaining < 86400) score += 10; // Less than 1 day
    
    // Fewer bids = better deal potential
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
    let score = 30; // Base score
    
    // More bids = more trending
    const bidCount = this.extractBidCount(bids);
    score += Math.min(40, bidCount * 5);
    
    // Less time = more trending
    if (timeRemaining < 3600) score += 20;
    else if (timeRemaining < 86400) score += 10;
    
    return Math.min(100, score);
  }
}

module.exports = eBayScraper;
