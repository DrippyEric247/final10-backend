# Frontend Integration for TikTok-like Product Feed

## 🎯 Your TikTok-like Product Feed is Now Live!

The TikTok-like product feed with AI video scanning is now fully integrated into your server. Here's how to access it from your frontend:

## 🔗 Available Endpoints

All endpoints are now live and protected with authentication:

```
✅ GET  /api/feed/product-feed     - TikTok-like infinite scroll feed
✅ GET  /api/feed/trending         - Trending auctions and categories  
✅ GET  /api/feed/ai-insights      - AI-powered market insights
✅ POST /api/feed/scan-video       - AI video scanning for products
✅ POST /api/feed/refresh-scanner  - Manual scanner refresh (Premium)
```

## 🚀 Quick Frontend Integration

### 1. Add a "Product Feed" Tab to Your Navigation

```javascript
// Add this to your navigation component
const navigationItems = [
  { name: 'Home', path: '/', icon: '🏠' },
  { name: 'Auctions', path: '/auctions', icon: '🔨' },
  { name: 'Product Feed', path: '/feed', icon: '📱' }, // NEW!
  { name: 'Trending', path: '/trending', icon: '🔥' }, // NEW!
  { name: 'Profile', path: '/profile', icon: '👤' }
];
```

### 2. Create the Product Feed Page

```javascript
// pages/ProductFeed.js
import React, { useState, useEffect } from 'react';

const ProductFeed = () => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);

  const loadFeed = async (reset = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        limit: '20',
        trending: 'true'
      });
      
      if (cursor && !reset) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`/api/feed/product-feed?${params}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load feed');
      }
      
      const data = await response.json();
      
      if (reset) {
        setFeedItems(data.items);
      } else {
        setFeedItems(prev => [...prev, ...data.items]);
      }
      
      setCursor(data.nextCursor);
    } catch (error) {
      console.error('Error loading feed:', error);
      alert('Failed to load product feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(true);
  }, []);

  return (
    <div className="product-feed-page">
      <div className="feed-header">
        <h1>📱 Product Feed</h1>
        <p>Discover trending auctions with AI-powered insights</p>
      </div>
      
      <div className="feed-container">
        {feedItems.map((item, index) => (
          <FeedItem key={item.id} item={item} index={index} />
        ))}
        
        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading more items...</p>
          </div>
        )}
        
        {cursor && !loading && (
          <button 
            className="load-more-btn"
            onClick={() => loadFeed()}
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
};

// Individual Feed Item Component
const FeedItem = ({ item, index }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    // TODO: Add API call to like/unlike
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: Add API call to bookmark/unbookmark
  };

  const handleBid = () => {
    // Navigate to auction details
    window.location.href = `/auction/${item.id}`;
  };

  const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="feed-item" style={{ height: '100vh' }}>
      <div className="item-content">
        {/* Product Image */}
        <div className="item-image">
          <img 
            src={item.images[0]?.url || '/placeholder-product.jpg'} 
            alt={item.title}
            onError={(e) => {
              e.target.src = '/placeholder-product.jpg';
            }}
          />
          
          {/* AI Score Badges */}
          <div className="ai-score-badges">
            <div className={`score-badge deal ${item.dealPotential > 80 ? 'high' : item.dealPotential > 60 ? 'medium' : 'low'}`}>
              🔥 {item.dealPotential}% Deal
            </div>
            <div className={`score-badge trending ${item.trendingScore > 80 ? 'high' : item.trendingScore > 60 ? 'medium' : 'low'}`}>
              📈 {item.trendingScore}% Trending
            </div>
          </div>
          
          {/* Platform Badge */}
          <div className="platform-badge">
            {item.platform === 'ebay' && '🛒 eBay'}
            {item.platform === 'mercari' && '🛍️ Mercari'}
            {item.platform === 'facebook' && '📘 Facebook'}
            {item.platform === 'final10' && '🏠 Final10'}
          </div>
        </div>
        
        {/* Product Info */}
        <div className="item-info">
          <h2 className="item-title">{item.title}</h2>
          <p className="item-description">{item.description}</p>
          
          <div className="auction-details">
            <div className="detail-row">
              <span className="label">Current Bid:</span>
              <span className="value current-bid">${item.currentBid}</span>
            </div>
            
            <div className="detail-row">
              <span className="label">Time Left:</span>
              <span className="value time-remaining">
                {formatTimeRemaining(item.timeRemaining)}
              </span>
            </div>
            
            <div className="detail-row">
              <span className="label">Category:</span>
              <span className="value category">{item.category}</span>
            </div>
            
            <div className="detail-row">
              <span className="label">Condition:</span>
              <span className="value condition">{item.condition}</span>
            </div>
          </div>
          
          {/* Competition Level */}
          <div className="competition-indicator">
            <span className={`competition-level ${item.competitionLevel}`}>
              {item.competitionLevel === 'high' && '🔥 High Competition'}
              {item.competitionLevel === 'medium' && '⚡ Medium Competition'}
              {item.competitionLevel === 'low' && '💚 Low Competition'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="item-actions">
        <button 
          className={`action-btn like ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          {isLiked ? '❤️' : '🤍'} {isLiked ? 'Liked' : 'Like'}
        </button>
        
        <button 
          className={`action-btn bookmark ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={handleBookmark}
        >
          {isBookmarked ? '🔖' : '📖'} {isBookmarked ? 'Saved' : 'Save'}
        </button>
        
        <button className="action-btn bid primary" onClick={handleBid}>
          💰 Bid Now
        </button>
      </div>
    </div>
  );
};

export default ProductFeed;
```

### 3. Create the Trending Page

```javascript
// pages/Trending.js
import React, { useState, useEffect } from 'react';

const Trending = () => {
  const [trendingData, setTrendingData] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(false);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/feed/trending?timeRange=${timeRange}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load trending data');
      }
      
      const data = await response.json();
      setTrendingData(data);
    } catch (error) {
      console.error('Error loading trending:', error);
      alert('Failed to load trending data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrending();
  }, [timeRange]);

  return (
    <div className="trending-page">
      <div className="trending-header">
        <h1>🔥 Trending Now</h1>
        <div className="time-range-selector">
          <button 
            className={timeRange === '24h' ? 'active' : ''}
            onClick={() => setTimeRange('24h')}
          >
            Last 24 Hours
          </button>
          <button 
            className={timeRange === '7d' ? 'active' : ''}
            onClick={() => setTimeRange('7d')}
          >
            Last 7 Days
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="loading">Loading trending data...</div>
      ) : trendingData ? (
        <>
          {/* Trending Auctions */}
          <section className="trending-auctions">
            <h2>🔥 Hot Auctions</h2>
            <div className="auctions-grid">
              {trendingData.trendingAuctions.map((auction) => (
                <div key={auction._id} className="trending-auction-card">
                  <img 
                    src={auction.images?.[0]?.url || '/placeholder-product.jpg'} 
                    alt={auction.title}
                  />
                  <div className="auction-info">
                    <h3>{auction.title}</h3>
                    <p className="current-bid">${auction.currentBid}</p>
                    <div className="trending-score">
                      🔥 {auction.aiScore.trendingScore}% trending
                    </div>
                    <div className="deal-score">
                      💰 {auction.aiScore.dealPotential}% deal potential
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {/* Trending Categories */}
          <section className="trending-categories">
            <h2>📊 Hot Categories</h2>
            <div className="categories-list">
              {trendingData.trendingCategories.map((category) => (
                <div key={category._id} className="category-item">
                  <span className="category-name">{category._id}</span>
                  <span className="category-count">{category.count} auctions</span>
                  <span className="category-score">
                    {Math.round(category.avgTrendingScore)}% trending
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="no-data">No trending data available</div>
      )}
    </div>
  );
};

export default Trending;
```

### 4. Add CSS Styling

```css
/* Product Feed Styles */
.product-feed-page {
  max-width: 100%;
  margin: 0 auto;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

.feed-header {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.feed-container {
  position: relative;
}

.feed-item {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #333;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

.item-content {
  flex: 1;
  display: flex;
  gap: 20px;
}

.item-image {
  position: relative;
  flex: 0 0 300px;
}

.item-image img {
  width: 100%;
  height: 300px;
  object-fit: cover;
  border-radius: 12px;
}

.ai-score-badges {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.score-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}

.score-badge.high {
  background: rgba(255, 0, 0, 0.8);
  color: white;
}

.score-badge.medium {
  background: rgba(255, 165, 0, 0.8);
  color: white;
}

.score-badge.low {
  background: rgba(0, 255, 0, 0.8);
  color: white;
}

.platform-badge {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.item-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  color: #fff;
}

.item-description {
  color: #ccc;
  line-height: 1.5;
  margin: 0;
}

.auction-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #aaa;
  font-weight: 500;
}

.value {
  color: #fff;
  font-weight: bold;
}

.current-bid {
  color: #4CAF50;
  font-size: 18px;
}

.time-remaining {
  color: #FF9800;
  font-size: 16px;
}

.competition-indicator {
  margin-top: 10px;
}

.competition-level {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
}

.competition-level.high {
  background: rgba(255, 0, 0, 0.2);
  color: #ff4444;
  border: 1px solid #ff4444;
}

.competition-level.medium {
  background: rgba(255, 165, 0, 0.2);
  color: #ffaa00;
  border: 1px solid #ffaa00;
}

.competition-level.low {
  background: rgba(0, 255, 0, 0.2);
  color: #44ff44;
  border: 1px solid #44ff44;
}

.item-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: center;
}

.action-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 25px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}

.action-btn.like {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn.like.liked {
  background: rgba(255, 0, 0, 0.2);
  color: #ff4444;
  border: 1px solid #ff4444;
}

.action-btn.bookmark {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn.bookmark.bookmarked {
  background: rgba(255, 165, 0, 0.2);
  color: #ffaa00;
  border: 1px solid #ffaa00;
}

.action-btn.bid.primary {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
  border: none;
  font-size: 16px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  text-align: center;
  padding: 40px;
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #fff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.load-more-btn {
  display: block;
  margin: 20px auto;
  padding: 15px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.load-more-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Trending Page Styles */
.trending-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

.trending-header {
  text-align: center;
  margin-bottom: 40px;
}

.time-range-selector {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.time-range-selector button {
  padding: 10px 20px;
  border: 1px solid #333;
  background: transparent;
  color: #fff;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.time-range-selector button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
}

.auctions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.trending-auction-card {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.trending-auction-card:hover {
  transform: translateY(-5px);
}

.trending-auction-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.auction-info {
  padding: 15px;
}

.auction-info h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.current-bid {
  font-size: 18px;
  font-weight: bold;
  color: #4CAF50;
  margin: 5px 0;
}

.trending-score, .deal-score {
  font-size: 12px;
  margin: 5px 0;
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  border-radius: 8px;
}

.category-name {
  font-weight: bold;
  text-transform: capitalize;
}

.category-count {
  color: #aaa;
}

.category-score {
  color: #4CAF50;
  font-weight: bold;
}
```

## 🎯 How to Access Your TikTok-like Product Feed

1. **Add the routes to your React Router:**
```javascript
import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';

// In your router configuration
<Route path="/feed" element={<ProductFeed />} />
<Route path="/trending" element={<Trending />} />
```

2. **Make sure you're logged in** - All endpoints require authentication

3. **Access the endpoints:**
   - **Product Feed**: `http://localhost:3000/feed`
   - **Trending**: `http://localhost:3000/trending`

4. **Test the API directly:**
   - **Product Feed**: `GET http://localhost:5000/api/feed/product-feed`
   - **Trending**: `GET http://localhost:5000/api/feed/trending`
   - **AI Insights**: `GET http://localhost:5000/api/feed/ai-insights`

## 🔐 Authentication Required

All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🎉 You're All Set!

Your TikTok-like product feed with AI video scanning is now fully integrated and ready to use! The feed will show trending auctions with AI scores, and users can discover products through an engaging TikTok-like interface.

