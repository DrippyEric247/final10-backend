# Live Auction API Documentation

## New Endpoints

### 1. Live Search (One from Each Platform)
**GET** `/api/auctions/live-search?q=searchTerm`

Returns one result from each platform (eBay, Mercari, Facebook) for the given search term.

**Example:**
```
GET /api/auctions/live-search?q=iPhone
```

**Response:**
```json
{
  "searchTerm": "iPhone",
  "results": [
    {
      "title": "iPhone 14 Pro Max 256GB",
      "currentBid": 850,
      "source": {
        "platform": "ebay",
        "url": "https://ebay.com/..."
      },
      "aiScore": {
        "dealPotential": 75,
        "trendingScore": 85
      }
    },
    {
      "title": "iPhone 13 128GB Blue",
      "currentBid": 520,
      "source": {
        "platform": "mercari",
        "url": "https://mercari.com/..."
      }
    },
    {
      "title": "iPhone 12 Pro 256GB",
      "currentBid": 400,
      "source": {
        "platform": "facebook",
        "url": "https://facebook.com/..."
      }
    }
  ],
  "totalFound": 3,
  "platforms": {
    "ebay": 1,
    "mercari": 1,
    "facebook": 1
  }
}
```

### 2. Manual Refresh
**POST** `/api/auctions/refresh`

Manually refresh auction data from all platforms. Requires authentication.

**Response:**
```json
{
  "message": "Auction data refreshed successfully",
  "totalRefreshed": 25,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## How It Works

1. **Live Search**: When you search for "iPhone", the system:
   - Scrapes eBay for iPhone auctions
   - Scrapes Mercari for iPhone items
   - Scrapes Facebook Marketplace for iPhone listings
   - Returns the best result from each platform
   - Saves results to database for future reference

2. **Automatic Refresh**: Every 30 minutes, the system:
   - Refreshes existing auction data
   - Updates prices, time remaining, and availability
   - Keeps your database current with live data

3. **AI Scoring**: Each result includes:
   - **Deal Potential**: How good of a deal it is (0-100)
   - **Competition Level**: How many people are bidding (low/medium/high)
   - **Trending Score**: How popular/trending the item is (0-100)

## Usage Examples

### Frontend Integration
```javascript
// Search for iPhone and get one result from each platform
const response = await fetch('/api/auctions/live-search?q=iPhone');
const data = await response.json();

// Display results
data.results.forEach(auction => {
  console.log(`${auction.source.platform}: ${auction.title} - $${auction.currentBid}`);
});
```

### Manual Refresh
```javascript
// Trigger manual refresh (requires auth)
const response = await fetch('/api/auctions/refresh', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token'
  }
});
```

## Features

- ✅ **Real-time scraping** from eBay, Mercari, and Facebook
- ✅ **One result per platform** for balanced results
- ✅ **AI-powered scoring** for deal potential and trending
- ✅ **Automatic refresh** every 30 minutes
- ✅ **Database caching** for faster subsequent searches
- ✅ **Error handling** and fallbacks for failed scrapes

## Notes

- Scraping may take 10-30 seconds depending on network conditions
- Results are cached in the database for faster future searches
- The system respects rate limits and includes delays between requests
- Failed scrapes are logged but don't break the entire search
