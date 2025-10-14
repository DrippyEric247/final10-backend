const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const Auction = require('../models/Auction');
const Alert = require('../models/Alert');
const User = require('../models/User');

class MarketScanner {
  constructor() {
    this.isScanning = false;
    this.scanInterval = null;
    this.browser = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async startScanning() {
    if (this.isScanning) return;
    
    this.isScanning = true;
    console.log('Starting market scanner...');
    
    // Scan every 30 seconds
    this.scanInterval = setInterval(async () => {
      try {
        await this.scanAllPlatforms();
      } catch (error) {
        console.error('Scanning error:', error);
      }
    }, 30000);

    // Initial scan
    await this.scanAllPlatforms();
  }

  async stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scanAllPlatforms() {
    const platforms = [
      { name: 'eBay', scanner: this.scanEbay.bind(this) },
      { name: 'Mercari', scanner: this.scanMercari.bind(this) },
      { name: 'Facebook', scanner: this.scanFacebook.bind(this) }
    ];

    for (const platform of platforms) {
      try {
        console.log(`Scanning ${platform.name}...`);
        await platform.scanner();
      } catch (error) {
        console.error(`Error scanning ${platform.name}:`, error);
      }
    }
  }

  async scanEbay() {
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Search for auctions ending soon
      const searchUrl = 'https://www.ebay.com/sch/i.html?_nkw=&_sacat=0&_sop=10&_dmd=1&rt=nc&LH_Auction=1&_pgn=1';
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      const auctions = await page.evaluate(() => {
        const items = [];
        const listings = document.querySelectorAll('.s-item');
        
        listings.forEach(listing => {
          try {
            const titleEl = listing.querySelector('.s-item__title');
            const priceEl = listing.querySelector('.s-item__price');
            const timeEl = listing.querySelector('.s-item__time-left');
            const linkEl = listing.querySelector('.s-item__link');
            const imageEl = listing.querySelector('.s-item__image img');
            
            if (titleEl && priceEl && timeEl && linkEl) {
              const title = titleEl.textContent.trim();
              const price = priceEl.textContent.replace(/[^0-9.]/g, '');
              const timeText = timeEl.textContent.trim();
              const link = linkEl.href;
              const image = imageEl ? imageEl.src : null;
              
              // Parse time remaining
              let timeRemaining = 0;
              if (timeText.includes('d')) {
                const days = parseInt(timeText.match(/(\d+)d/)?.[1] || 0);
                timeRemaining += days * 24 * 60 * 60;
              }
              if (timeText.includes('h')) {
                const hours = parseInt(timeText.match(/(\d+)h/)?.[1] || 0);
                timeRemaining += hours * 60 * 60;
              }
              if (timeText.includes('m')) {
                const minutes = parseInt(timeText.match(/(\d+)m/)?.[1] || 0);
                timeRemaining += minutes * 60;
              }
              
              // Only include auctions ending in 10 minutes or less
              if (timeRemaining <= 600) {
                items.push({
                  title,
                  currentBid: parseFloat(price) || 0,
                  timeRemaining,
                  url: link,
                  image,
                  platform: 'ebay'
                });
              }
            }
          } catch (error) {
            console.error('Error parsing listing:', error);
          }
        });
        
        return items;
      });
      
      await page.close();
      
      // Process and save auctions
      for (const auctionData of auctions) {
        await this.processAuction(auctionData);
      }
      
    } catch (error) {
      console.error('eBay scanning error:', error);
    }
  }

  async scanMercari() {
    try {
      const page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Mercari doesn't have traditional auctions, but we can scan for deals
      const searchUrl = 'https://www.mercari.com/search/?keyword=&category_id=0&brand_id=&size_id=&item_condition_id=&color_id=&price_min=&price_max=&sort=created_time&order=desc&status=on_sale';
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Mercari implementation would go here
      // For now, we'll skip as it requires more complex handling
      
      await page.close();
      
    } catch (error) {
      console.error('Mercari scanning error:', error);
    }
  }

  async scanFacebook() {
    try {
      // Facebook Marketplace scanning would require authentication
      // For now, we'll implement a placeholder
      console.log('Facebook Marketplace scanning not implemented yet');
      
    } catch (error) {
      console.error('Facebook scanning error:', error);
    }
  }

  async processAuction(auctionData) {
    try {
      // Check if auction already exists
      const existingAuction = await Auction.findOne({
        'source.platform': auctionData.platform,
        'source.url': auctionData.url
      });

      if (existingAuction) {
        // Update existing auction
        existingAuction.currentBid = auctionData.currentBid;
        existingAuction.timeRemaining = auctionData.timeRemaining;
        existingAuction.lastUpdated = new Date();
        await existingAuction.save();
        return;
      }

      // Calculate AI scores
      const aiScore = await this.calculateAIScore(auctionData);

      // Create new auction
      const auction = new Auction({
        title: auctionData.title,
        description: `Auction from ${auctionData.platform}`,
        images: auctionData.image ? [{ url: auctionData.image, isPrimary: true }] : [],
        category: 'other', // Default category, could be improved with AI classification
        condition: 'good', // Default condition
        startingPrice: auctionData.currentBid,
        currentBid: auctionData.currentBid,
        startTime: new Date(Date.now() - (3600 * 1000)), // Assume started 1 hour ago
        endTime: new Date(Date.now() + (auctionData.timeRemaining * 1000)),
        timeRemaining: auctionData.timeRemaining,
        status: 'active',
        seller: null, // External auction, no internal seller
        source: {
          platform: auctionData.platform,
          url: auctionData.url
        },
        aiScore: aiScore
      });

      await auction.save();

      // Check alerts for this auction
      await this.checkAlerts(auction);

    } catch (error) {
      console.error('Error processing auction:', error);
    }
  }

  async calculateAIScore(auctionData) {
    // Simple AI scoring algorithm
    // In a real implementation, this would use machine learning models
    
    let dealPotential = 50; // Base score
    let competitionLevel = 'medium';
    let trendingScore = 30;

    // Adjust deal potential based on price and time remaining
    if (auctionData.currentBid < 50) {
      dealPotential += 20; // Lower price = higher deal potential
    }
    
    if (auctionData.timeRemaining < 300) { // Less than 5 minutes
      dealPotential += 15;
    }

    // Adjust competition level
    if (auctionData.timeRemaining < 300) {
      competitionLevel = 'high';
    } else if (auctionData.timeRemaining < 600) {
      competitionLevel = 'medium';
    } else {
      competitionLevel = 'low';
    }

    // Trending score based on keywords (simplified)
    const trendingKeywords = ['iphone', 'nike', 'supreme', 'yeezy', 'playstation', 'xbox'];
    const titleLower = auctionData.title.toLowerCase();
    const hasTrendingKeyword = trendingKeywords.some(keyword => 
      titleLower.includes(keyword)
    );
    
    if (hasTrendingKeyword) {
      trendingScore += 40;
    }

    return {
      dealPotential: Math.min(100, dealPotential),
      competitionLevel,
      trendingScore: Math.min(100, trendingScore)
    };
  }

  async checkAlerts(auction) {
    try {
      const alerts = await Alert.find({ isActive: true });
      
      for (const alert of alerts) {
        if (alert.matchesAuction(auction)) {
          // Add match to alert
          alert.matches.push({
            auction: auction._id,
            matchedAt: new Date(),
            reason: 'Matches alert criteria'
          });
          
          alert.triggerCount += 1;
          alert.lastTriggered = new Date();
          await alert.save();

          // Send notification to user
          await this.sendAlertNotification(alert.user, auction, alert);
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  async sendAlertNotification(userId, auction, alert) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // In a real implementation, this would send push notifications, emails, etc.
      console.log(`Alert triggered for user ${user.username}: ${auction.title}`);
      
      // Award points for alert trigger
      const SavvyPoint = require('../models/SavvyPoint');
      await SavvyPoint.awardPoints(
        userId,
        5,
        'alert_trigger',
        `Alert "${alert.name}" found a match!`,
        auction._id,
        'Auction',
        1
      );

    } catch (error) {
      console.error('Error sending alert notification:', error);
    }
  }
}

module.exports = new MarketScanner();


































