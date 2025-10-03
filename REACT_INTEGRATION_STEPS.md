# Step-by-Step React Integration Guide

## 🚀 How to Add TikTok-like Product Feed to Your React App

### Step 1: Install Required Dependencies

First, navigate to your React app directory and install the required packages:

```bash
# Navigate to your React app (usually the parent directory of server)
cd c:\Users\ericv\final10

# Install required dependencies
npm install react-query axios
```

### Step 2: Create the Component Files

Create these files in your React app:

#### A. Create `src/pages/ProductFeed.js`

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from 'react-query';

const ProductFeed = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState([]);

  const fetchFeed = async ({ pageParam = null }) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      limit: '10',
      trending: 'true'
    });
    
    if (pageParam) params.append('cursor', pageParam);

    const response = await fetch(`http://localhost:5000/api/feed/product-feed?${params}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch feed');
    return response.json();
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery('productFeed', fetchFeed, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data) {
      const allItems = data.pages.flatMap(page => page.items);
      setItems(allItems);
    }
  }, [data]);

  const handleSwipe = useCallback((direction) => {
    if (direction === 'up' && currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (direction === 'down' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, items.length]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowUp') handleSwipe('up');
    if (e.key === 'ArrowDown') handleSwipe('down');
  }, [handleSwipe]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (currentIndex >= items.length - 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [currentIndex, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <div className="loading">Loading feed...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="product-feed-container">
      <div className="feed-header">
        <h1>📱 Product Feed</h1>
        <div className="feed-stats">
          <span>Item {currentIndex + 1} of {items.length}</span>
        </div>
      </div>
      
      <div className="feed-viewport">
        {items[currentIndex] && (
          <FeedItem 
            item={items[currentIndex]} 
            onSwipe={handleSwipe}
            isActive={true}
          />
        )}
      </div>
      
      <div className="feed-controls">
        <button 
          onClick={() => handleSwipe('down')}
          disabled={currentIndex === 0}
          className="nav-btn prev"
        >
          ⬆️ Previous
        </button>
        <button 
          onClick={() => handleSwipe('up')}
          disabled={currentIndex >= items.length - 1}
          className="nav-btn next"
        >
          ⬇️ Next
        </button>
      </div>
    </div>
  );
};

const FeedItem = ({ item, onSwipe, isActive }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(item.timeRemaining);

  useEffect(() => {
    if (!isActive) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  const handleLike = async () => {
    setIsLiked(!isLiked);
  };

  const handleBookmark = async () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleBid = () => {
    window.open(`/auction/${item.id}`, '_blank');
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="feed-item" style={{ height: '100vh' }}>
      <div className="item-image-container">
        <img 
          src={item.images[0]?.url || '/placeholder-product.jpg'} 
          alt={item.title}
          className="item-image"
        />
        
        <div className="ai-scores">
          <div className={`score-badge deal ${item.dealPotential > 80 ? 'high' : 'medium'}`}>
            🔥 {item.dealPotential}% Deal
          </div>
          <div className={`score-badge trending ${item.trendingScore > 80 ? 'high' : 'medium'}`}>
            📈 {item.trendingScore}% Trending
          </div>
        </div>
        
        <div className="platform-badge">
          {item.platform === 'ebay' && '🛒 eBay'}
          {item.platform === 'mercari' && '🛍️ Mercari'}
          {item.platform === 'facebook' && '📘 Facebook'}
          {item.platform === 'final10' && '🏠 Final10'}
        </div>
        
        <div className="time-badge">
          ⏰ {formatTime(timeRemaining)}
        </div>
      </div>
      
      <div className="item-info">
        <h2 className="item-title">{item.title}</h2>
        <p className="item-description">{item.description}</p>
        
        <div className="auction-details">
          <div className="detail-item">
            <span className="label">Current Bid:</span>
            <span className="value current-bid">${item.currentBid}</span>
          </div>
          
          <div className="detail-item">
            <span className="label">Category:</span>
            <span className="value category">{item.category}</span>
          </div>
          
          <div className="detail-item">
            <span className="label">Condition:</span>
            <span className="value condition">{item.condition}</span>
          </div>
        </div>
        
        <div className="competition-indicator">
          <div 
            className="competition-bar"
            style={{ 
              backgroundColor: item.competitionLevel === 'high' ? '#ff4444' : 
                              item.competitionLevel === 'medium' ? '#ffaa00' : '#44ff44',
              width: `${item.competitionLevel === 'high' ? 100 : item.competitionLevel === 'medium' ? 60 : 30}%`
            }}
          />
          <span className="competition-text">
            {item.competitionLevel} competition
          </span>
        </div>
      </div>
      
      <div className="item-actions">
        <button 
          className={`action-btn like ${isLiked ? 'active' : ''}`}
          onClick={handleLike}
        >
          {isLiked ? '❤️' : '🤍'} {isLiked ? 'Liked' : 'Like'}
        </button>
        
        <button 
          className={`action-btn bookmark ${isBookmarked ? 'active' : ''}`}
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

#### B. Create `src/pages/Trending.js`

```javascript
import React, { useState, useEffect } from 'react';

const Trending = () => {
  const [trendingData, setTrendingData] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(false);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/feed/trending?timeRange=${timeRange}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to load trending');
      
      const data = await response.json();
      setTrendingData(data);
    } catch (error) {
      console.error('Error:', error);
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
        <div className="time-selector">
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
          <section className="trending-auctions">
            <h2>🔥 Hot Auctions</h2>
            <div className="auctions-grid">
              {trendingData.trendingAuctions.map((auction) => (
                <div key={auction._id} className="auction-card">
                  <img 
                    src={auction.images?.[0]?.url || '/placeholder.jpg'} 
                    alt={auction.title}
                  />
                  <div className="auction-info">
                    <h3>{auction.title}</h3>
                    <p className="bid">${auction.currentBid}</p>
                    <div className="scores">
                      <span className="trending">🔥 {auction.aiScore.trendingScore}%</span>
                      <span className="deal">💰 {auction.aiScore.dealPotential}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          <section className="trending-categories">
            <h2>📊 Hot Categories</h2>
            <div className="categories-list">
              {trendingData.trendingCategories.map((category) => (
                <div key={category._id} className="category-item">
                  <span className="name">{category._id}</span>
                  <span className="count">{category.count} auctions</span>
                  <span className="score">{Math.round(category.avgTrendingScore)}% trending</span>
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

#### C. Create `src/components/VideoScanner.js`

```javascript
import React, { useState } from 'react';

const VideoScanner = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);

  const scanVideo = async () => {
    if (!videoUrl) return;
    
    setScanning(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/feed/scan-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoUrl, platform })
      });
      
      if (!response.ok) throw new Error('Scan failed');
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Scan error:', error);
      alert('Failed to scan video');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="video-scanner">
      <div className="scanner-header">
        <h2>🤖 AI Video Scanner</h2>
        <p>Scan TikTok, Instagram, or YouTube videos to find products</p>
      </div>
      
      <div className="scanner-input">
        <input
          type="url"
          placeholder="Paste video URL here..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="url-input"
        />
        
        <select 
          value={platform} 
          onChange={(e) => setPlatform(e.target.value)}
          className="platform-select"
        >
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
        </select>
        
        <button 
          onClick={scanVideo} 
          disabled={scanning || !videoUrl}
          className="scan-button"
        >
          {scanning ? '🤖 Scanning...' : '🔍 Scan Video'}
        </button>
      </div>
      
      {results && (
        <div className="scan-results">
          <h3>🎯 Detected Products ({results.detectedProducts.length})</h3>
          
          <div className="detected-products">
            {results.detectedProducts.map((product, index) => (
              <div key={index} className="product-card">
                <h4>{product.name}</h4>
                <div className="product-details">
                  <span className="confidence">
                    {Math.round(product.confidence * 100)}% confidence
                  </span>
                  <span className="category">{product.category}</span>
                  <span className="price-range">
                    ${product.priceRange.min} - ${product.priceRange.max}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <h3>🛒 Found Auctions ({results.totalAuctions})</h3>
          
          <div className="auction-results">
            {results.searchResults.map((result, index) => (
              <div key={index} className="search-result">
                <h4>Searching for: {result.detectedProduct.name}</h4>
                
                {result.auctions.map((auction, auctionIndex) => (
                  <div key={auctionIndex} className="auction-card">
                    <h5>{auction.title}</h5>
                    <div className="auction-details">
                      <span>${auction.currentBid}</span>
                      <span>{auction.platform}</span>
                      <span>{auction.aiScore.dealPotential}% deal</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoScanner;
```

### Step 3: Add CSS Styles

Create `src/styles/ProductFeed.css`:

```css
/* Product Feed Styles */
.product-feed-container {
  height: 100vh;
  background: #000;
  color: #fff;
  overflow: hidden;
}

.feed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.9);
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feed-viewport {
  height: 100vh;
  padding-top: 60px;
}

.feed-item {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

.item-image-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 12px;
}

.ai-scores {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-badge {
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: bold;
  text-align: center;
  backdrop-filter: blur(10px);
}

.score-badge.high {
  background: rgba(255, 0, 0, 0.8);
}

.score-badge.medium {
  background: rgba(255, 165, 0, 0.8);
}

.platform-badge {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: bold;
}

.time-badge {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 0, 0, 0.8);
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: bold;
}

.item-info {
  padding: 20px 0;
}

.item-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.item-description {
  color: #ccc;
  margin-bottom: 20px;
  line-height: 1.5;
}

.auction-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
}

.label {
  color: #aaa;
}

.value {
  font-weight: bold;
}

.current-bid {
  color: #4CAF50;
  font-size: 18px;
}

.competition-indicator {
  margin-bottom: 20px;
}

.competition-bar {
  height: 4px;
  border-radius: 2px;
  margin-bottom: 5px;
}

.competition-text {
  font-size: 14px;
  color: #aaa;
}

.item-actions {
  display: flex;
  gap: 15px;
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

.action-btn.like.active {
  background: rgba(255, 0, 0, 0.2);
  color: #ff4444;
  border-color: #ff4444;
}

.action-btn.bookmark {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.action-btn.bookmark.active {
  background: rgba(255, 165, 0, 0.2);
  color: #ffaa00;
  border-color: #ffaa00;
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

.feed-controls {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
}

.nav-btn {
  padding: 15px 25px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  cursor: pointer;
  font-weight: bold;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.time-selector {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.time-selector button {
  padding: 10px 20px;
  border: 1px solid #333;
  background: transparent;
  color: #fff;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.time-selector button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
}

.auctions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.auction-card {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.auction-card:hover {
  transform: translateY(-5px);
}

.auction-card img {
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

.bid {
  font-size: 18px;
  font-weight: bold;
  color: #4CAF50;
  margin: 5px 0;
}

.scores {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.scores span {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
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

.category-item .name {
  font-weight: bold;
  text-transform: capitalize;
}

.category-item .count {
  color: #aaa;
}

.category-item .score {
  color: #4CAF50;
  font-weight: bold;
}

/* Video Scanner Styles */
.video-scanner {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

.scanner-header {
  text-align: center;
  margin-bottom: 30px;
}

.scanner-input {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 30px;
}

.url-input, .platform-select {
  padding: 15px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #111;
  color: #fff;
  font-size: 16px;
}

.scan-button {
  padding: 15px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.scan-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.scan-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scan-results {
  margin-top: 30px;
}

.detected-products, .auction-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.product-card, .auction-card {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  padding: 20px;
  border-radius: 12px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #fff;
}

.error {
  text-align: center;
  padding: 40px;
  color: #ff4444;
}
```

### Step 4: Update Your App.js

Add the new routes to your main App.js:

```javascript
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';
import VideoScanner from './components/VideoScanner';
import './styles/ProductFeed.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Your existing routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* New TikTok-like feed routes */}
          <Route path="/feed" element={<ProductFeed />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/scanner" element={<VideoScanner />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

### Step 5: Update Your Navigation

Add the new navigation items:

```javascript
// In your navigation component
const navItems = [
  { name: 'Home', path: '/', icon: '🏠' },
  { name: 'Auctions', path: '/auctions', icon: '🔨' },
  { name: 'Product Feed', path: '/feed', icon: '📱' }, // NEW!
  { name: 'Trending', path: '/trending', icon: '🔥' }, // NEW!
  { name: 'Scanner', path: '/scanner', icon: '🤖' }, // NEW!
  { name: 'Profile', path: '/profile', icon: '👤' }
];
```

### Step 6: Test Your Integration

1. **Start your React app:**
```bash
npm start
```

2. **Make sure your server is running** (should be on port 5000)

3. **Login to get your JWT token**

4. **Navigate to:**
   - `http://localhost:3000/feed` - TikTok-like product feed
   - `http://localhost:3000/trending` - Trending auctions
   - `http://localhost:3000/scanner` - AI video scanner

### 🎉 You're Done!

Your TikTok-like product feed is now fully integrated into your React app! Users can:

- **Browse auctions** in a TikTok-like interface
- **See AI scores** for deal potential and trending
- **Scan videos** to find products
- **View trending** auctions and categories
- **Navigate** with keyboard arrows or buttons

The feed will automatically load more items as users scroll, and all data comes from your live auction scanner! 🚀

