# Rate Limiting & Premium Subscription System

## Overview
Your auction browser now has a rate limiting system that restricts free users to 5 searches per day, while premium users get unlimited searches.

## User Tiers

### 🆓 Free Tier
- **Base Daily Searches**: 5 per day
- **Ad-Earned Searches**: 5 searches per ad watched (max 3 ads/day = 15 extra searches)
- **Total Possible**: Up to 20 searches per day (5 base + 15 from ads)
- **Features**: Basic search functionality + ad-watching for more searches
- **Reset**: Daily at midnight

### 💎 Premium Tier  
- **Daily Searches**: Unlimited
- **Features**: Unlimited searches, priority support, advanced filters
- **Duration**: 1 month (configurable)

### 🚀 Pro Tier
- **Daily Searches**: Unlimited  
- **Features**: All premium features + API access
- **Duration**: 1 month (configurable)

## API Endpoints

### 1. Live Search (Rate Limited)
**GET** `/api/auctions/live-search?q=searchTerm`

**Headers Required:**
```
Authorization: Bearer <user-token>
```

**Free User Response (Success):**
```json
{
  "searchTerm": "iPhone",
  "results": [...],
  "searchStatus": {
    "canSearch": true,
    "remaining": 3,
    "limit": 5,
    "used": 2
  },
  "userTier": "free"
}
```

**Free User Response (Rate Limited):**
```json
{
  "message": "Daily search limit reached",
  "error": "RATE_LIMIT_EXCEEDED",
  "details": {
    "tier": "free",
    "limit": 20,
    "used": 20,
    "remaining": 0,
    "baseLimit": 5,
    "adEarned": 15,
    "resetTime": "2024-01-16T00:00:00.000Z",
    "canWatchAds": false,
    "adOptions": null,
    "upgradeMessage": "Upgrade to Premium for unlimited searches!"
  }
}
```

**Free User Response (Can Watch Ads):**
```json
{
  "message": "Daily search limit reached",
  "error": "RATE_LIMIT_EXCEEDED",
  "details": {
    "tier": "free",
    "limit": 5,
    "used": 5,
    "remaining": 0,
    "baseLimit": 5,
    "adEarned": 0,
    "resetTime": "2024-01-16T00:00:00.000Z",
    "canWatchAds": true,
    "adOptions": {
      "message": "Watch an ad to earn 5 more searches!",
      "remainingAds": 3,
      "searchesPerAd": 5
    },
    "upgradeMessage": "Upgrade to Premium for unlimited searches!"
  }
}
```

**Premium User Response:**
```json
{
  "searchTerm": "iPhone",
  "results": [...],
  "searchStatus": {
    "canSearch": true,
    "remaining": "unlimited"
  },
  "userTier": "premium"
}
```

### 2. Check Search Status
**GET** `/api/auctions/search-status`

**Response:**
```json
{
  "userTier": "free",
  "searchStatus": {
    "canSearch": true,
    "remaining": 3,
    "limit": 5,
    "used": 2
  },
  "subscriptionActive": false,
  "subscriptionExpires": null,
  "benefits": {
    "free": {
      "dailySearches": 5,
      "features": ["Basic search", "Limited results"]
    },
    "premium": {
      "dailySearches": "unlimited",
      "features": ["Unlimited searches", "Priority support", "Advanced filters"]
    },
    "pro": {
      "dailySearches": "unlimited", 
      "features": ["Unlimited searches", "Priority support", "Advanced filters", "API access"]
    }
  }
}
```

### 3. Get Ad-Watching Status
**GET** `/api/auctions/ad-status`

**Response:**
```json
{
  "userTier": "free",
  "adStatus": {
    "canWatch": true,
    "remainingAds": 3,
    "maxAdsPerDay": 3,
    "adsWatchedToday": 0,
    "searchesPerAd": 5
  },
  "searchStatus": {
    "canSearch": true,
    "remaining": 5,
    "limit": 5,
    "used": 0,
    "baseLimit": 5,
    "adEarned": 0,
    "canWatchAds": true
  },
  "benefits": {
    "searchesPerAd": 5,
    "maxAdsPerDay": 3,
    "totalPossibleSearches": 20
  }
}
```

### 4. Watch Ad to Earn Searches
**POST** `/api/auctions/watch-ad`

**Response:**
```json
{
  "message": "Ad watched! You earned 5 more searches!",
  "adStatus": {
    "canWatch": true,
    "remainingAds": 2,
    "maxAdsPerDay": 3,
    "adsWatchedToday": 1,
    "searchesPerAd": 5
  },
  "searchStatus": {
    "canSearch": true,
    "remaining": 10,
    "limit": 10,
    "used": 0,
    "baseLimit": 5,
    "adEarned": 5,
    "canWatchAds": true
  },
  "earnedSearches": 5,
  "totalSearchesNow": 10
}
```

### 5. Upgrade to Premium
**POST** `/api/auctions/upgrade-premium`

**Body:**
```json
{
  "durationMonths": 1
}
```

**Response:**
```json
{
  "message": "Successfully upgraded to Premium!",
  "userTier": "premium",
  "subscriptionExpires": "2024-02-15T10:30:00.000Z",
  "benefits": "You now have unlimited searches!"
}
```

## Frontend Integration

### Check Search Limits Before Searching
```javascript
// Check if user can search
const checkSearchStatus = async () => {
  const response = await fetch('/api/auctions/search-status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (!data.searchStatus.canSearch) {
    showUpgradeModal(data.searchStatus);
    return false;
  }
  return true;
};

// Perform search
const performSearch = async (searchTerm) => {
  if (!(await checkSearchStatus())) return;
  
  const response = await fetch(`/api/auctions/live-search?q=${searchTerm}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.status === 429) {
    const error = await response.json();
    showRateLimitModal(error.details);
    return;
  }
  
  const data = await response.json();
  displayResults(data.results);
};
```

### Show Ad/Upgrade Modal
```javascript
const showAdUpgradeModal = (errorDetails) => {
  let modalContent = `
    <div class="ad-upgrade-modal">
      <h3>Search Limit Reached</h3>
      <p>You've used ${errorDetails.used}/${errorDetails.limit} searches today.</p>
  `;
  
  if (errorDetails.canWatchAds && errorDetails.adOptions) {
    modalContent += `
      <div class="ad-option">
        <h4>🎬 Watch an Ad</h4>
        <p>${errorDetails.adOptions.message}</p>
        <p>You have ${errorDetails.adOptions.remainingAds} ads remaining today</p>
        <button onclick="watchAd()" class="ad-button">Watch Ad (+${errorDetails.adOptions.searchesPerAd} searches)</button>
      </div>
    `;
  }
  
  modalContent += `
      <div class="upgrade-option">
        <h4>💎 Upgrade to Premium</h4>
        <p>Get unlimited searches forever!</p>
        <button onclick="upgradeToPremium()" class="upgrade-button">Upgrade Now</button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalContent);
};

// Watch ad function
const watchAd = async () => {
  try {
    const response = await fetch('/api/auctions/watch-ad', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      showSuccessMessage(`Ad watched! You earned ${data.earnedSearches} more searches!`);
      closeModal();
      // Refresh search status
      updateSearchStatus();
    } else {
      const error = await response.json();
      showErrorMessage(error.message);
    }
  } catch (error) {
    showErrorMessage('Failed to watch ad');
  }
};
```

## Database Schema

### User Model Updates
```javascript
{
  membershipTier: { type: String, enum: ['free', 'premium', 'pro'], default: 'free' },
  subscriptionExpires: Date,
  searchUsage: {
    day: String,           // 'YYYY-MM-DD'
    searchesToday: Number,
    lastSearchReset: Date
  },
  dailySearchLimit: { type: Number, default: 5 },
  adWatching: {
    day: String,           // 'YYYY-MM-DD'
    adsWatchedToday: Number,
    maxAdsPerDay: { type: Number, default: 3 },
    searchesPerAd: { type: Number, default: 5 },
    lastAdReset: Date
  }
}
```

## Rate Limiting Logic

1. **Free Users**: 
   - Base: 5 searches per day
   - Ad-earned: 5 searches per ad watched (max 3 ads/day)
   - Total possible: Up to 20 searches per day
2. **Premium/Pro Users**: Unlimited searches
3. **Daily Reset**: All counters reset at midnight
4. **Real-time Tracking**: Search count incremented after each successful search
5. **Ad System**: Users can watch ads to earn additional searches
6. **Graceful Degradation**: Rate limit errors include ad and upgrade options

## Error Handling

### Rate Limit Exceeded (429)
```json
{
  "message": "Daily search limit reached",
  "error": "RATE_LIMIT_EXCEEDED",
  "details": {
    "tier": "free",
    "limit": 5,
    "used": 5,
    "remaining": 0,
    "resetTime": "2024-01-16T00:00:00.000Z",
    "upgradeMessage": "Upgrade to Premium for unlimited searches!"
  }
}
```

## Testing

### Test Rate Limits
```bash
# Test with free user (will hit limit after 5 searches)
curl -H "Authorization: Bearer <free-user-token>" \
     "http://localhost:5000/api/auctions/live-search?q=iPhone"

# Test with premium user (unlimited)
curl -H "Authorization: Bearer <premium-user-token>" \
     "http://localhost:5000/api/auctions/live-search?q=iPhone"
```

## Production Considerations

1. **Payment Integration**: Add Stripe/PayPal for real premium upgrades
2. **Analytics**: Track search usage patterns
3. **A/B Testing**: Test different free tier limits
4. **Caching**: Cache search results to reduce API calls
5. **Monitoring**: Monitor rate limit hit rates and conversion rates

## Benefits

- ✅ **Dual Monetization**: Ad revenue + premium subscriptions
- ✅ **User Retention**: Free users can earn more searches via ads
- ✅ **Resource Management**: Prevents abuse of scraping resources  
- ✅ **User Experience**: Clear limits with multiple options (ads + upgrade)
- ✅ **Scalability**: System can handle growth with dual revenue streams
- ✅ **Engagement**: Ad-watching increases user engagement
- ✅ **Conversion**: Users who watch ads are more likely to upgrade
