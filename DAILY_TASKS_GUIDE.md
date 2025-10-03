# Daily Tasks & Points System

## Overview
Your auction browser now has a comprehensive daily tasks system that rewards users with points for completing various activities. Users can earn up to **1,800 points per day** (800 from tasks + 1,000 bonus for completing all tasks).

## Daily Tasks

### 🏠 Daily Login (50 points)
- **Task**: Log in to claim daily points
- **Reward**: 50 points
- **Frequency**: Once per day
- **API**: `POST /api/auctions/claim-daily-login`

### 🔍 Search for a Product (25 points)
- **Task**: Search for any product
- **Reward**: 25 points
- **Frequency**: Once per day
- **Auto-completed**: When user performs a search

### 📺 Watch 5 Ads (50 points)
- **Task**: Watch 5 ads to earn bonus points
- **Reward**: 50 points
- **Frequency**: Once per day (when 5 ads watched)
- **Progress**: Tracks ads watched (1/5, 2/5, etc.)
- **Auto-completed**: When user watches ads

### 📱 Share App with 3 Users (300 points)
- **Task**: Share the app with 3 different users
- **Reward**: 300 points
- **Frequency**: Once per day (when 3 shares completed)
- **Progress**: Tracks shares (1/3, 2/3, 3/3)
- **API**: `POST /api/auctions/track-app-share`

### 🔗 Share a Product (75 points)
- **Task**: Share a product you searched with someone
- **Reward**: 75 points
- **Frequency**: Once per day
- **API**: `POST /api/auctions/track-product-share`

### 📢 Post on Social Media (300 points)
- **Task**: Post a #StayEarning #StaySavvy win on social media
- **Reward**: 300 points
- **Frequency**: Once per day
- **API**: `POST /api/auctions/complete-social-post`

### 🎊 Complete All Tasks Bonus (1,000 points)
- **Task**: Complete all 6 daily tasks
- **Reward**: 1,000 bonus points
- **Frequency**: Once per day
- **Auto-awarded**: When all tasks are completed

## API Endpoints

### 1. Get Daily Tasks Status
**GET** `/api/auctions/daily-tasks`

**Response:**
```json
{
  "userTier": "free",
  "totalPoints": 1800,
  "dailyTasks": {
    "tasks": {
      "dailyLogin": {
        "name": "Daily Login",
        "description": "Log in to claim your daily points",
        "points": 50,
        "completed": true,
        "icon": "🏠"
      },
      "searchProduct": {
        "name": "Search for a Product",
        "description": "Search for any product to earn points",
        "points": 25,
        "completed": true,
        "icon": "🔍"
      },
      "watchAds": {
        "name": "Watch 5 Ads",
        "description": "Watch 5 ads to earn bonus points",
        "points": 50,
        "completed": true,
        "progress": 5,
        "target": 5,
        "icon": "📺"
      },
      "shareApp": {
        "name": "Share App with 3 Users",
        "description": "Share the app with 3 different users",
        "points": 300,
        "completed": true,
        "progress": 3,
        "target": 3,
        "icon": "📱"
      },
      "shareProduct": {
        "name": "Share a Product",
        "description": "Share a product you searched with someone",
        "points": 75,
        "completed": true,
        "progress": 1,
        "target": 1,
        "icon": "🔗"
      },
      "socialPost": {
        "name": "Post on Social Media",
        "description": "Post a #StayEarning #StaySavvy win on social media",
        "points": 300,
        "completed": true,
        "icon": "📢"
      }
    },
    "totalPointsEarned": 1800,
    "allTasksCompleted": true,
    "bonusEligible": true
  },
  "resetTime": "2024-01-16T00:00:00.000Z"
}
```

### 2. Claim Daily Login Points
**POST** `/api/auctions/claim-daily-login`

**Response:**
```json
{
  "message": "Daily login claimed! +50 points",
  "pointsEarned": 50,
  "totalPoints": 1250,
  "dailyTasks": { /* updated task status */ }
}
```

### 3. Track App Sharing
**POST** `/api/auctions/track-app-share`

**Response:**
```json
{
  "message": "App shared! +300 points",
  "pointsEarned": 300,
  "totalPoints": 1550,
  "dailyTasks": { /* updated task status */ }
}
```

### 4. Track Product Sharing
**POST** `/api/auctions/track-product-share`

**Body:**
```json
{
  "productId": "auction123",
  "productTitle": "iPhone 14 Pro Max"
}
```

**Response:**
```json
{
  "message": "Product shared! +75 points",
  "pointsEarned": 75,
  "totalPoints": 1625,
  "dailyTasks": { /* updated task status */ },
  "sharedProduct": {
    "id": "auction123",
    "title": "iPhone 14 Pro Max"
  }
}
```

### 5. Complete Social Media Post
**POST** `/api/auctions/complete-social-post`

**Body:**
```json
{
  "platform": "twitter",
  "postUrl": "https://twitter.com/user/status/123456"
}
```

**Response:**
```json
{
  "message": "Social post completed! +300 points",
  "pointsEarned": 300,
  "totalPoints": 1925,
  "dailyTasks": { /* updated task status */ },
  "postDetails": {
    "platform": "twitter",
    "url": "https://twitter.com/user/status/123456"
  }
}
```

## Frontend Integration

### Daily Tasks Dashboard
```javascript
// Get daily tasks status
const getDailyTasks = async () => {
  const response = await fetch('/api/auctions/daily-tasks', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.dailyTasks;
};

// Display tasks dashboard
const displayTasksDashboard = (dailyTasks) => {
  const tasksHtml = Object.values(dailyTasks.tasks).map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}">
      <div class="task-icon">${task.icon}</div>
      <div class="task-info">
        <h4>${task.name}</h4>
        <p>${task.description}</p>
        ${task.progress ? `<div class="progress">${task.progress}/${task.target}</div>` : ''}
      </div>
      <div class="task-points">${task.points} pts</div>
    </div>
  `).join('');
  
  document.getElementById('tasks-container').innerHTML = tasksHtml;
};
```

### Daily Login Button
```javascript
const claimDailyLogin = async () => {
  const response = await fetch('/api/auctions/claim-daily-login', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  if (data.pointsEarned > 0) {
    showSuccessMessage(`Daily login claimed! +${data.pointsEarned} points`);
    updatePointsDisplay(data.totalPoints);
  }
};
```

### Share App Functionality
```javascript
const shareApp = async () => {
  // Native sharing or custom share modal
  if (navigator.share) {
    await navigator.share({
      title: 'Final10 - Smart Auction Browser',
      text: 'Check out this amazing auction browser!',
      url: 'https://final10.com'
    });
  }
  
  // Track the share
  const response = await fetch('/api/auctions/track-app-share', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  if (data.pointsEarned > 0) {
    showSuccessMessage(`App shared! +${data.pointsEarned} points`);
  }
};
```

### Share Product Functionality
```javascript
const shareProduct = async (productId, productTitle) => {
  // Share the product
  const shareUrl = `https://final10.com/product/${productId}`;
  
  if (navigator.share) {
    await navigator.share({
      title: productTitle,
      text: `Check out this great deal on ${productTitle}!`,
      url: shareUrl
    });
  }
  
  // Track the share
  const response = await fetch('/api/auctions/track-product-share', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId,
      productTitle
    })
  });
  
  const data = await response.json();
  if (data.pointsEarned > 0) {
    showSuccessMessage(`Product shared! +${data.pointsEarned} points`);
  }
};
```

## Database Schema

### User Model Updates
```javascript
{
  points: { type: Number, default: 0 },
  dailyTasks: {
    day: String,                    // 'YYYY-MM-DD'
    lastReset: Date,
    completed: {
      dailyLogin: Boolean,
      searchProduct: Boolean,
      watchAds: Number,             // track ads watched for task
      shareApp: Number,             // track app shares
      shareProduct: Number,         // track product shares
      socialPost: Boolean
    },
    pointsEarned: Number,
    allTasksCompleted: Boolean
  }
}
```

## Task Reset Logic

1. **Daily Reset**: All tasks reset at midnight
2. **Automatic Tracking**: Some tasks auto-complete (search, ads)
3. **Manual Tracking**: Some tasks require API calls (shares, social posts)
4. **Bonus Award**: 1,000 points automatically awarded when all tasks complete
5. **Progress Tracking**: Multi-step tasks show progress (ads, shares)

## Points Summary

| Task | Points | Frequency | Total Daily |
|------|--------|-----------|-------------|
| Daily Login | 50 | Once | 50 |
| Search Product | 25 | Once | 25 |
| Watch 5 Ads | 50 | Once | 50 |
| Share App (3x) | 300 | Once | 300 |
| Share Product | 75 | Once | 75 |
| Social Post | 300 | Once | 300 |
| **All Tasks Bonus** | **1,000** | **Once** | **1,000** |
| **TOTAL** | | | **1,800** |

## Benefits

- ✅ **User Engagement**: Daily tasks keep users coming back
- ✅ **Viral Growth**: Sharing tasks encourage user acquisition
- ✅ **Social Proof**: Social media posts promote the app
- ✅ **Retention**: Daily login rewards increase retention
- ✅ **Monetization**: Points can be used for premium features
- ✅ **Gamification**: Progress tracking makes it fun
- ✅ **Community**: Social sharing builds community

## Production Considerations

1. **Analytics**: Track task completion rates
2. **A/B Testing**: Test different point values
3. **Fraud Prevention**: Validate social media posts
4. **Rate Limiting**: Prevent task completion abuse
5. **Notifications**: Remind users of incomplete tasks
6. **Leaderboards**: Show top point earners
7. **Rewards**: Allow points to be redeemed for benefits
