const crypto = require('crypto');
const SimpleScraper = require('./scrapers/SimpleScraper');
const Auction = require('../models/Auction');
const { isEbayVerboseLogEnabled } = require('../lib/backgroundJobFlags');

function aggLog(...args) {
  if (isEbayVerboseLogEnabled()) console.log(...args);
}

const ALLOWED_PLATFORMS = new Set(['ebay', 'mercari', 'facebook', 'internal']);

function stableExternalId(...parts) {
  return crypto.createHash('sha1').update(parts.map(String).join('|')).digest('hex').slice(0, 24);
}

/**
 * Scrapers sometimes omit `source` (e.g. OfferUp mock used root `platform` only).
 * Auction schema requires source.platform in enum: ebay | mercari | facebook | internal.
 */
function normalizeAuctionForDb(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const data = { ...raw };

  if (!data.aiScore || typeof data.aiScore !== 'object') {
    data.aiScore = {
      dealPotential: Math.min(100, Math.max(0, Number(data.dealPotential) || 50)),
      competitionLevel: ['low', 'medium', 'high'].includes(data.competitionLevel)
        ? data.competitionLevel
        : 'medium',
      trendingScore: Math.min(100, Math.max(0, Number(data.trendingScore) || 50)),
    };
  }

  const url = (data.source && data.source.url) || data.itemUrl || data.url || '';
  const prevSource = data.source && typeof data.source === 'object' ? { ...data.source } : {};
  let platform = prevSource.platform;
  let externalId = prevSource.externalId;

  const topPlatform = String(data.platform || '').toLowerCase();
  if (!platform) {
    if (topPlatform === 'offerup') {
      platform = 'internal';
      externalId = externalId || `offerup_${stableExternalId(url, data.title)}`;
    } else if (ALLOWED_PLATFORMS.has(topPlatform) && topPlatform !== 'internal') {
      platform = topPlatform;
      externalId = externalId || (url ? stableExternalId(url) : null);
    } else {
      platform = 'internal';
      externalId = externalId || `agg_${stableExternalId(data.title, url, Date.now())}`;
    }
  }

  if (platform && !ALLOWED_PLATFORMS.has(platform)) {
    platform = 'internal';
    externalId = externalId || `ext_${stableExternalId(platform, url, data.title)}`;
  }

  if (!externalId) {
    externalId = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  data.source = { platform, externalId, url: url || undefined };

  if (!data.startTime) {
    const endMs = data.endTime ? new Date(data.endTime).getTime() : Date.now() + 86400000;
    data.startTime = new Date(endMs - 7 * 86400000);
    if (!data.endTime) data.endTime = new Date(endMs);
  }

  if (!Array.isArray(data.images) || data.images.length === 0) {
    if (data.imageUrl) {
      data.images = [{ url: data.imageUrl, alt: data.title || 'Listing' }];
    }
  }

  return data;
}

class AuctionAggregator {
  constructor() {
    this.scraper = new SimpleScraper();
  }

  async searchAllPlatforms(searchTerm, limitPerPlatform = 5) {
    try {
      aggLog(`🔍 Searching for "${searchTerm}" across all platforms...`);
      
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
        aggLog(`✅ eBay: Found ${eBayResults.value.length} results`);
        allResults.push(...eBayResults.value);
      } else {
        aggLog('❌ eBay: Failed to fetch results');
      }

      // Process Mercari results
      if (mercariResults.status === 'fulfilled' && mercariResults.value) {
        aggLog(`✅ Mercari: Found ${mercariResults.value.length} results`);
        allResults.push(...mercariResults.value);
      } else {
        aggLog('❌ Mercari: Failed to fetch results');
      }

      // Process Facebook results
      if (facebookResults.status === 'fulfilled' && facebookResults.value) {
        aggLog(`✅ Facebook: Found ${facebookResults.value.length} results`);
        allResults.push(...facebookResults.value);
      } else {
        aggLog('❌ Facebook: Failed to fetch results');
      }

      // Process OfferUp results
      if (offerUpResults.status === 'fulfilled' && offerUpResults.value) {
        aggLog(`✅ OfferUp: Found ${offerUpResults.value.length} local results`);
        allResults.push(...offerUpResults.value);
      } else {
        aggLog('❌ OfferUp: Failed to fetch results');
      }

      aggLog(`🎯 Total results: ${allResults.length}`);
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
          const normalized = normalizeAuctionForDb(auctionData);
          if (!normalized || !normalized.source) {
            console.warn('Skipping auction: could not normalize payload', auctionData?.title);
            continue;
          }

          // Check if auction already exists (by external ID and platform)
          const existingAuction = await Auction.findOne({
            'source.platform': normalized.source.platform,
            'source.externalId': normalized.source.externalId
          });

          if (existingAuction) {
            // Update existing auction
            Object.assign(existingAuction, normalized);
            existingAuction.lastUpdated = new Date();
            await existingAuction.save();
            savedAuctions.push(existingAuction);
          } else {
            // Create new auction
            const auction = new Auction(normalized);
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
        const scoreA =
          (((a.aiScore && a.aiScore.dealPotential) || a.dealPotential || 0) +
            ((a.aiScore && a.aiScore.trendingScore) || a.trendingScore || 0)) /
          2;
        const scoreB =
          (((b.aiScore && b.aiScore.dealPotential) || b.dealPotential || 0) +
            ((b.aiScore && b.aiScore.trendingScore) || b.trendingScore || 0)) /
          2;
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
      aggLog('🔄 Refreshing auction data...');
      
      // Get all unique search terms from existing auctions
      const existingAuctions = await Auction.find({ status: 'active' });
      const searchTerms = [...new Set(existingAuctions.map(a => a.title.split(' ')[0]))];
      
      let totalRefreshed = 0;
      
      for (const term of searchTerms.slice(0, 10)) { // Limit to 10 terms to avoid rate limiting
        try {
          const result = await this.searchAndSave(term, 3);
          totalRefreshed += result.totalSaved;
          aggLog(`✅ Refreshed ${term}: ${result.totalSaved} auctions`);
          
          // Add delay between searches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error refreshing ${term}:`, error?.message || error);
        }
      }
      
      aggLog(`🎯 Total refreshed: ${totalRefreshed} auctions`);
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
        ebay: results.filter((r) => r.source && r.source.platform === 'ebay'),
        mercari: results.filter((r) => r.source && r.source.platform === 'mercari'),
        facebook: results.filter((r) => r.source && r.source.platform === 'facebook')
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
