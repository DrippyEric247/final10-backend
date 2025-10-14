# TikTok-like Product Feed with AI Video Scanning

## Overview
Your auction browser now features a comprehensive TikTok-like product feed system with AI-powered video scanning capabilities. Users can browse trending auctions, scan videos for products, and get AI-powered market insights - all integrated with your market scanner that pulls live data from eBay, Facebook Marketplace, and Mercari.

## 🎯 Key Features

### 📱 **TikTok-like Product Feed**
- **Infinite Scroll**: Continuous feed of trending auctions
- **AI Scoring**: Each auction has AI-generated deal potential and trending scores
- **Multi-Platform**: Shows auctions from eBay, Facebook, Mercari, and internal platform
- **Real-time Updates**: Live data from market scanner integration

### 🤖 **AI Video Scanning**
- **Product Detection**: Scan TikTok, Instagram, YouTube videos for products
- **Cross-Platform Search**: Automatically search detected products across all auction platforms
- **Confidence Scoring**: AI provides confidence levels for detected products
- **Price Range Estimation**: AI estimates price ranges for detected items

### 📊 **Market Intelligence**
- **Trending Analysis**: AI identifies trending categories and products
- **Deal Opportunities**: Highlights auctions with high deal potential
- **Competition Analysis**: Shows competition levels for each auction
- **Market Insights**: AI-generated insights about market trends

### 🔄 **Market Scanner Integration**
- **Live Data**: Real-time scanning of eBay, Facebook, Mercari
- **AI Scoring**: Automatic AI scoring for all discovered auctions
- **Alert System**: Notifications for matching auctions
- **Premium Features**: Manual scanner refresh for premium users

## 🚀 API Endpoints

### 1. Product Feed
**GET** `/api/feed/product-feed`

**Parameters:**
- `limit` (optional): Number of items to return (default: 20)
- `cursor` (optional): Pagination cursor
- `category` (optional): Filter by category
- `trending` (optional): Sort by trending score (true/false)

**Response:**
```json
{
  "items": [
    {
      "id": "68d88438ab805efb1918af30",
      "type": "auction",
      "title": "iPhone 14 Pro Max 256GB - Unlocked",
      "description": "Like new iPhone 14 Pro Max in Space Black",
      "currentBid": 850,
      "timeRemaining": 1800,
      "images": [{ "url": "https://example.com/image.jpg", "isPrimary": true }],
      "category": "electronics",
      "condition": "like-new",
      "platform": "ebay",
      "seller": {
        "_id": "68d88438ab805efb1918af31",
        "username": "seller123",
        "profileImage": "https://example.com/avatar.jpg"
      },
      "aiScore": {
        "dealPotential": 85,
        "competitionLevel": "high",
        "trendingScore": 92
      },
      "dealPotential": 85,
      "competitionLevel": "high",
      "trendingScore": 92,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "endTime": "2024-01-15T11:00:00.000Z",
      "source": {
        "platform": "ebay",
        "url": "https://ebay.com/iphone14"
      }
    }
  ],
  "nextCursor": "2024-01-15T10:30:00.000Z",
  "total": 20
}
```

### 2. AI Video Scanning
**POST** `/api/feed/scan-video`

**Body:**
```json
{
  "videoUrl": "https://tiktok.com/@user/video/123456789",
  "platform": "tiktok"
}
```

**Response:**
```json
{
  "message": "Video analyzed successfully",
  "detectedProducts": [
    {
      "name": "iPhone 14 Pro",
      "confidence": 0.95,
      "category": "electronics",
      "priceRange": { "min": 800, "max": 1200 },
      "keywords": ["iphone", "apple", "smartphone", "pro"]
    },
    {
      "name": "Nike Air Jordan",
      "confidence": 0.87,
      "category": "fashion",
      "priceRange": { "min": 150, "max": 300 },
      "keywords": ["nike", "jordan", "sneakers", "shoes"]
    }
  ],
  "searchResults": [
    {
      "detectedProduct": {
        "name": "iPhone 14 Pro",
        "confidence": 0.95,
        "category": "electronics",
        "priceRange": { "min": 800, "max": 1200 },
        "keywords": ["iphone", "apple", "smartphone", "pro"]
      },
      "auctions": [
        {
          "title": "iPhone 14 Pro 128GB",
          "currentBid": 850,
          "platform": "ebay",
          "aiScore": { "dealPotential": 85, "trendingScore": 92 }
        }
      ]
    }
  ],
  "totalAuctions": 3
}
```

### 3. Trending Feed
**GET** `/api/feed/trending`

**Parameters:**
- `limit` (optional): Number of items (default: 20)
- `timeRange` (optional): "24h" or "7d" (default: "24h")

**Response:**
```json
{
  "trendingAuctions": [
    {
      "_id": "68d88438ab805efb1918af30",
      "title": "Supreme Box Logo Hoodie FW22",
      "currentBid": 320,
      "aiScore": { "trendingScore": 98, "dealPotential": 95 },
      "seller": { "username": "seller123", "profileImage": "..." }
    }
  ],
  "trendingCategories": [
    {
      "_id": "electronics",
      "count": 15,
      "avgTrendingScore": 85.5
    },
    {
      "_id": "fashion",
      "count": 8,
      "avgTrendingScore": 92.3
    }
  ],
  "timeRange": "24h"
}
```

### 4. AI Market Insights
**GET** `/api/feed/ai-insights`

**Response:**
```json
{
  "insights": [
    {
      "type": "trending_category",
      "title": "Hot Category",
      "description": "\"electronics\" is trending this week",
      "confidence": 0.85
    },
    {
      "type": "price_opportunity",
      "title": "Price Opportunity",
      "description": "5 low-priced auctions ending soon - great deals available!",
      "confidence": 0.78
    },
    {
      "type": "platform_insight",
      "title": "Platform Activity",
      "description": "Most active platform: ebay",
      "confidence": 0.92
    }
  ],
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 5. Refresh Market Scanner
**POST** `/api/feed/refresh-scanner`

**Requirements:** Premium or Pro subscription

**Response:**
```json
{
  "message": "Market scanner refreshed successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🎨 Frontend Integration

### TikTok-like Feed Component
```javascript
// Product Feed Component
const ProductFeed = () => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);

  const loadFeed = async (reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        trending: 'true'
      });
      
      if (cursor && !reset) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`/api/feed/product-feed?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (reset) {
        setFeedItems(data.items);
      } else {
        setFeedItems(prev => [...prev, ...data.items]);
      }
      
      setCursor(data.nextCursor);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(true);
  }, []);

  return (
    <div className="product-feed">
      {feedItems.map((item, index) => (
        <FeedItem key={item.id} item={item} index={index} />
      ))}
      
      {loading && <div className="loading">Loading more items...</div>}
      
      <InfiniteScroll
        loadMore={() => loadFeed()}
        hasMore={!!cursor}
        threshold={1000}
      >
        <div></div>
      </InfiniteScroll>
    </div>
  );
};

// Individual Feed Item Component
const FeedItem = ({ item, index }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleLike = async () => {
    setIsLiked(!isLiked);
    // API call to like/unlike auction
  };

  const handleBookmark = async () => {
    setIsBookmarked(!isBookmarked);
    // API call to bookmark/unbookmark auction
  };

  const handleBid = () => {
    // Navigate to auction details or open bid modal
  };

  return (
    <div className="feed-item" style={{ height: '100vh' }}>
      <div className="item-content">
        <div className="item-image">
          <img src={item.images[0]?.url} alt={item.title} />
          <div className="ai-score-badge">
            <span className="deal-score">{item.dealPotential}% Deal</span>
            <span className="trending-score">{item.trendingScore}% Trending</span>
          </div>
        </div>
        
        <div className="item-info">
          <h3>{item.title}</h3>
          <p className="description">{item.description}</p>
          
          <div className="auction-details">
            <div className="current-bid">
              <span className="label">Current Bid:</span>
              <span className="amount">${item.currentBid}</span>
            </div>
            
            <div className="time-remaining">
              <span className="label">Time Left:</span>
              <span className="time">{Math.floor(item.timeRemaining / 60)}m</span>
            </div>
            
            <div className="platform">
              <span className="label">Platform:</span>
              <span className="platform-name">{item.platform}</span>
            </div>
          </div>
          
          <div className="competition-level">
            <span className={`competition ${item.competitionLevel}`}>
              {item.competitionLevel} competition
            </span>
          </div>
        </div>
      </div>
      
      <div className="item-actions">
        <button 
          className={`action-btn like ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          ❤️ {isLiked ? 'Liked' : 'Like'}
        </button>
        
        <button 
          className={`action-btn bookmark ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={handleBookmark}
        >
          🔖 {isBookmarked ? 'Saved' : 'Save'}
        </button>
        
        <button className="action-btn bid" onClick={handleBid}>
          💰 Bid Now
        </button>
      </div>
    </div>
  );
};
```

### AI Video Scanner Component
```javascript
// Video Scanner Component
const VideoScanner = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);

  const scanVideo = async () => {
    if (!videoUrl) return;
    
    setScanning(true);
    try {
      const response = await fetch('/api/feed/scan-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl,
          platform
        })
      });
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error scanning video:', error);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="video-scanner">
      <div className="scanner-input">
        <input
          type="url"
          placeholder="Paste video URL (TikTok, Instagram, YouTube)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
        </select>
        
        <button 
          onClick={scanVideo} 
          disabled={scanning || !videoUrl}
          className="scan-btn"
        >
          {scanning ? '🤖 Scanning...' : '🔍 Scan Video'}
        </button>
      </div>
      
      {results && (
        <div className="scan-results">
          <h3>Detected Products ({results.detectedProducts.length})</h3>
          
          {results.detectedProducts.map((product, index) => (
            <div key={index} className="detected-product">
              <h4>{product.name}</h4>
              <p>Confidence: {Math.round(product.confidence * 100)}%</p>
              <p>Category: {product.category}</p>
              <p>Price Range: ${product.priceRange.min} - ${product.priceRange.max}</p>
            </div>
          ))}
          
          <h3>Found Auctions ({results.totalAuctions})</h3>
          
          {results.searchResults.map((result, index) => (
            <div key={index} className="search-result">
              <h4>Searching for: {result.detectedProduct.name}</h4>
              
              {result.auctions.map((auction, auctionIndex) => (
                <div key={auctionIndex} className="auction-result">
                  <h5>{auction.title}</h5>
                  <p>Current Bid: ${auction.currentBid}</p>
                  <p>Platform: {auction.platform}</p>
                  <p>Deal Potential: {auction.aiScore.dealPotential}%</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Trending Feed Component
```javascript
// Trending Feed Component
const TrendingFeed = () => {
  const [trendingData, setTrendingData] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');

  const loadTrending = async () => {
    try {
      const response = await fetch(`/api/feed/trending?timeRange=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      setTrendingData(data);
    } catch (error) {
      console.error('Error loading trending:', error);
    }
  };

  useEffect(() => {
    loadTrending();
  }, [timeRange]);

  return (
    <div className="trending-feed">
      <div className="trending-header">
        <h2>🔥 Trending Now</h2>
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>
      
      {trendingData && (
        <>
          <div className="trending-auctions">
            <h3>Hot Auctions</h3>
            {trendingData.trendingAuctions.map((auction, index) => (
              <div key={auction._id} className="trending-auction">
                <img src={auction.images[0]?.url} alt={auction.title} />
                <div className="auction-info">
                  <h4>{auction.title}</h4>
                  <p>${auction.currentBid}</p>
                  <div className="trending-score">
                    🔥 {auction.aiScore.trendingScore}% trending
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="trending-categories">
            <h3>Hot Categories</h3>
            {trendingData.trendingCategories.map((category, index) => (
              <div key={category._id} className="trending-category">
                <span className="category-name">{category._id}</span>
                <span className="category-count">{category.count} auctions</span>
                <span className="category-score">
                  {Math.round(category.avgTrendingScore)}% trending
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
```

## 🧠 AI Features

### AI Scoring System
- **Deal Potential**: 0-100% score based on price, time remaining, and market data
- **Trending Score**: 0-100% score based on search volume, social mentions, and category trends
- **Competition Level**: Low/Medium/High based on bid activity and time remaining

### Video Analysis
- **Product Detection**: AI identifies products in videos
- **Confidence Scoring**: 0-100% confidence for each detected product
- **Category Classification**: Automatic categorization of detected items
- **Price Estimation**: AI estimates price ranges based on market data

### Market Insights
- **Trending Categories**: AI identifies hot categories
- **Price Opportunities**: Highlights deals and opportunities
- **Platform Activity**: Shows most active platforms
- **Competition Analysis**: Analyzes bidding patterns

## 🔄 Market Scanner Integration

### Automatic Scanning
- **Real-time Updates**: Scanner runs every 30 minutes
- **Multi-Platform**: Scans eBay, Facebook Marketplace, Mercari
- **AI Scoring**: Automatic AI scoring for all discovered auctions
- **Alert Matching**: Checks alerts against new auctions

### Manual Refresh
- **Premium Feature**: Premium users can manually refresh scanner
- **Immediate Results**: Get latest auctions instantly
- **Rate Limited**: Prevents abuse of scanning resources

## 📱 User Experience

### TikTok-like Interface
- **Full-screen Items**: Each auction takes full screen height
- **Swipe Navigation**: Swipe up/down to navigate
- **Quick Actions**: Like, save, bid buttons
- **AI Badges**: Visual indicators for deal potential and trending

### Infinite Scroll
- **Continuous Loading**: Load more items as user scrolls
- **Smooth Performance**: Optimized for mobile devices
- **Caching**: Smart caching for better performance

### Real-time Updates
- **Live Data**: Shows real-time auction data
- **Time Remaining**: Live countdown timers
- **Bid Updates**: Real-time bid information

## 🎯 Business Benefits

- ✅ **Viral Growth**: TikTok-like interface encourages sharing
- ✅ **User Engagement**: AI-powered feed keeps users engaged
- ✅ **Market Intelligence**: AI insights help users find better deals
- ✅ **Cross-Platform**: Aggregates data from multiple sources
- ✅ **Premium Features**: Scanner refresh for premium users
- ✅ **Social Integration**: Video scanning for social media content
- ✅ **Real-time Data**: Live market scanner integration

## 🚀 Production Considerations

1. **AI Integration**: Integrate with real AI services (Google Vision, AWS Rekognition)
2. **Video Processing**: Handle large video files and processing queues
3. **Rate Limiting**: Implement proper rate limiting for video scanning
4. **Caching**: Implement Redis caching for better performance
5. **WebSocket**: Real-time updates for live auction data
6. **Analytics**: Track user engagement and feed performance
7. **A/B Testing**: Test different AI scoring algorithms
8. **Mobile Optimization**: Ensure smooth performance on mobile devices

