const SimpleScraper = require('./scrapers/SimpleScraper');
const Auction = require('../models/Auction');

class AuctionAggregator {
  constructor() {
    this.scraper = new SimpleScraper();
  }

  async searchAllPlatforms(searchTerm, limitPerPlatform = 5) {
    try {
      console.log(`🔍 Searching for "${searchTerm}" across all platforms...`);
      
      // Search all platforms in parallel
      const [eBayResults, mercariResults, facebookResults, offerUpResults] = await Promise.allSettled([
        this.scraper.searchEBay(searchTerm, limitPerPlatform),
        this.scraper.searchMercari(searchTerm, limitPerPlatform),
        this.scraper.searchFacebook(searchTerm, limitPerPlatform),
        this.scraper.searchOfferUp(searchTerm, limitPerPlatform)
      ]);

      const allResults = [];
      
      // Process eBay results
      if (eBayResults.status === 'fulfilled' && eBayResults.value) {
        console.log(`✅ eBay: Found ${eBayResults.value.length} results`);
        allResults.push(...eBayResults.value);
      } else {
        console.log('❌ eBay: Failed to fetch results');
      }

      // Process Mercari results
      if (mercariResults.status === 'fulfilled' && mercariResults.value) {
        console.log(`✅ Mercari: Found ${mercariResults.value.length} results`);
        allResults.push(...mercariResults.value);
      } else {
        console.log('❌ Mercari: Failed to fetch results');
      }

      // Process Facebook results
      if (facebookResults.status === 'fulfilled' && facebookResults.value) {
        console.log(`✅ Facebook: Found ${facebookResults.value.length} results`);
        allResults.push(...facebookResults.value);
      } else {
        console.log('❌ Facebook: Failed to fetch results');
      }

      // Process OfferUp results
      if (offerUpResults.status === 'fulfilled' && offerUpResults.value) {
        console.log(`✅ OfferUp: Found ${offerUpResults.value.length} local results`);
        allResults.push(...offerUpResults.value);
      } else {
        console.log('❌ OfferUp: Failed to fetch results');
      }

      console.log(`🎯 Total results: ${allResults.length}`);
      return allResults;

    } catch (error) {
      console.error('Error in auction aggregation:', error);
      return [];
    }
  }

  async saveToDatabase(auctions) {
    try {
      const savedAuctions = [];
      
      for (const auctionData of auctions) {
        try {
          // Check if auction already exists (by external ID and platform)
          const existingAuction = await Auction.findOne({
            'source.platform': auctionData.source.platform,
            'source.externalId': auctionData.source.externalId
          });

          if (existingAuction) {
            // Update existing auction
            Object.assign(existingAuction, auctionData);
            existingAuction.lastUpdated = new Date();
            await existingAuction.save();
            savedAuctions.push(existingAuction);
          } else {
            // Create new auction
            const auction = new Auction(auctionData);
            await auction.save();
            savedAuctions.push(auction);
          }
        } catch (error) {
          console.error('Error saving auction:', error);
        }
      }

      return savedAuctions;
    } catch (error) {
      console.error('Error saving auctions to database:', error);
      return [];
    }
  }

  async searchAndSave(searchTerm, limitPerPlatform = 5) {
    try {
      // Search all platforms
      const liveResults = await this.searchAllPlatforms(searchTerm, limitPerPlatform);
      
      // Save to database
      const savedAuctions = await this.saveToDatabase(liveResults);
      
      return {
        liveResults,
        savedAuctions,
        totalFound: liveResults.length,
        totalSaved: savedAuctions.length
      };
    } catch (error) {
      console.error('Error in search and save:', error);
      return {
        liveResults: [],
        savedAuctions: [],
        totalFound: 0,
        totalSaved: 0
      };
    }
  }

  async getLiveSearchResults(searchTerm, limitPerPlatform = 5) {
    try {
      // Get live results without saving to database
      const liveResults = await this.searchAllPlatforms(searchTerm, limitPerPlatform);
      
      // Sort by deal potential and trending score
      liveResults.sort((a, b) => {
        const scoreA = (a.aiScore.dealPotential + a.aiScore.trendingScore) / 2;
        const scoreB = (b.aiScore.dealPotential + b.aiScore.trendingScore) / 2;
        return scoreB - scoreA;
      });

      return liveResults;
    } catch (error) {
      console.error('Error getting live search results:', error);
      return [];
    }
  }

  async refreshAuctionData() {
    try {
      console.log('🔄 Refreshing auction data...');
      
      // Get all unique search terms from existing auctions
      const existingAuctions = await Auction.find({ status: 'active' });
      const searchTerms = [...new Set(existingAuctions.map(a => a.title.split(' ')[0]))];
      
      let totalRefreshed = 0;
      
      for (const term of searchTerms.slice(0, 10)) { // Limit to 10 terms to avoid rate limiting
        try {
          const result = await this.searchAndSave(term, 3);
          totalRefreshed += result.totalSaved;
          console.log(`✅ Refreshed ${term}: ${result.totalSaved} auctions`);
          
          // Add delay between searches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error refreshing ${term}:`, error);
        }
      }
      
      console.log(`🎯 Total refreshed: ${totalRefreshed} auctions`);
      return totalRefreshed;
    } catch (error) {
      console.error('Error refreshing auction data:', error);
      return 0;
    }
  }

  // Get one result from each platform for a search term
  async getOneFromEach(searchTerm) {
    try {
      const results = await this.searchAllPlatforms(searchTerm, 1);
      
      // Group by platform
      const byPlatform = {
        ebay: results.filter(r => r.source.platform === 'ebay'),
        mercari: results.filter(r => r.source.platform === 'mercari'),
        facebook: results.filter(r => r.source.platform === 'facebook')
      };

      // Return one from each platform
      const oneFromEach = [];
      if (byPlatform.ebay.length > 0) oneFromEach.push(byPlatform.ebay[0]);
      if (byPlatform.mercari.length > 0) oneFromEach.push(byPlatform.mercari[0]);
      if (byPlatform.facebook.length > 0) oneFromEach.push(byPlatform.facebook[0]);

      return oneFromEach;
    } catch (error) {
      console.error('Error getting one from each platform:', error);
      return [];
    }
  }
}

module.exports = AuctionAggregator;
