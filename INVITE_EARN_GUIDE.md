# Invite & Earn System

## Overview
Your auction browser now has a comprehensive invite and earn system that allows users to generate referral links, invite friends, and earn points for successful referrals. Users earn **100 points** for each friend they refer, and new users get **50 bonus points** when they sign up with a referral link.

## Key Features

### 🔗 **Referral Link Generation**
- **Automatic Generation**: Each user gets a unique referral code
- **Shareable Links**: Generate shareable URLs for easy distribution
- **Trackable**: All referrals are tracked and rewarded

### 💰 **Reward System**
- **Referrer Reward**: 100 points per successful referral
- **New User Reward**: 50 points for signing up with referral link
- **Daily Tracking**: Track daily referral counts
- **Leaderboards**: See top referrers

### 📊 **Analytics & Tracking**
- **Referral Stats**: View total referrals and points earned
- **Referred Users**: See list of users you've referred
- **Daily Limits**: Track daily referral activity
- **Leaderboards**: Compare with other users

## API Endpoints

### 1. Get Invite & Earn Information
**GET** `/api/users/invite-earn`

**Response:**
```json
{
  "referralStats": {
    "referralCode": "68d88438ab805efb1918af30",
    "referralLink": "http://localhost:3000/signup?ref=68d88438ab805efb1918af30",
    "totalReferrals": 5,
    "dailyReferrals": 3,
    "referredBy": null
  },
  "referredUsers": [
    {
      "_id": "68d88438ab805efb1918af31",
      "username": "friend_1",
      "profileImage": "https://example.com/avatar.jpg",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "rewards": {
    "referrerReward": 100,
    "newUserReward": 50,
    "description": "Earn 100 points for each friend you refer, they get 50 points too!"
  }
}
```

### 2. Generate Referral Link
**POST** `/api/users/generate-referral-link`

**Response:**
```json
{
  "message": "Referral link generated successfully",
  "referralLink": "http://localhost:3000/signup?ref=68d88438ab805efb1918af30",
  "referralCode": "68d88438ab805efb1918af30",
  "referralStats": {
    "referralCode": "68d88438ab805efb1918af30",
    "referralLink": "http://localhost:3000/signup?ref=68d88438ab805efb1918af30",
    "totalReferrals": 5,
    "dailyReferrals": 3,
    "referredBy": null
  }
}
```

### 3. Share Referral Link
**POST** `/api/users/share-referral`

**Body:**
```json
{
  "platform": "twitter",
  "shareType": "link"
}
```

**Response:**
```json
{
  "message": "Referral shared successfully",
  "referralLink": "http://localhost:3000/signup?ref=68d88438ab805efb1918af30",
  "platform": "twitter",
  "shareType": "link",
  "dailyTasks": { /* updated daily tasks */ },
  "shareMessage": "Check out Final10 - the smart auction browser! Use my link to get 50 bonus points: http://localhost:3000/signup?ref=68d88438ab805efb1918af30"
}
```

### 4. Get Referral Leaderboard
**GET** `/api/users/referral-leaderboard?period=week&limit=20`

**Response:**
```json
{
  "leaderboard": [
    {
      "_id": "68d88438ab805efb1918af30",
      "username": "top_referrer",
      "profileImage": "https://example.com/avatar.jpg",
      "totalReferrals": 15,
      "points": 2500
    }
  ],
  "period": "week",
  "totalUsers": 20
}
```

### 5. Process Referral Signup
**POST** `/api/users/process-referral`

**Body:**
```json
{
  "userId": "68d88438ab805efb1918af31",
  "referralCode": "68d88438ab805efb1918af30"
}
```

**Response:**
```json
{
  "message": "Referral processed successfully",
  "referrer": "referrer_user",
  "newUser": "new_user",
  "referrerPoints": 100,
  "newUserPoints": 50
}
```

## Frontend Integration

### Invite & Earn Dashboard
```javascript
// Get invite and earn information
const getInviteEarnInfo = async () => {
  const response = await fetch('/api/users/invite-earn', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data;
};

// Display invite dashboard
const displayInviteDashboard = (data) => {
  const dashboardHtml = `
    <div class="invite-dashboard">
      <div class="referral-stats">
        <h3>Your Referral Stats</h3>
        <div class="stat-item">
          <span class="stat-label">Total Referrals:</span>
          <span class="stat-value">${data.referralStats.totalReferrals}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Daily Referrals:</span>
          <span class="stat-value">${data.referralStats.dailyReferrals}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Points Earned:</span>
          <span class="stat-value">${data.referralStats.totalReferrals * 100}</span>
        </div>
      </div>
      
      <div class="referral-link">
        <h3>Your Referral Link</h3>
        <div class="link-container">
          <input type="text" value="${data.referralStats.referralLink}" readonly>
          <button onclick="copyReferralLink()">Copy</button>
        </div>
      </div>
      
      <div class="rewards-info">
        <h3>Rewards</h3>
        <p>${data.rewards.description}</p>
        <ul>
          <li>You earn: ${data.rewards.referrerReward} points per referral</li>
          <li>Your friend gets: ${data.rewards.newUserReward} bonus points</li>
        </ul>
      </div>
    </div>
  `;
  
  document.getElementById('invite-container').innerHTML = dashboardHtml;
};
```

### Generate and Share Referral Link
```javascript
// Generate referral link
const generateReferralLink = async () => {
  const response = await fetch('/api/users/generate-referral-link', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  return data.referralLink;
};

// Share referral link
const shareReferralLink = async (platform) => {
  const response = await fetch('/api/users/share-referral', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      platform: platform,
      shareType: 'link'
    })
  });
  
  const data = await response.json();
  
  // Use native sharing if available
  if (navigator.share) {
    await navigator.share({
      title: 'Final10 - Smart Auction Browser',
      text: data.shareMessage,
      url: data.referralLink
    });
  } else {
    // Fallback to copying to clipboard
    await navigator.clipboard.writeText(data.shareMessage);
    showSuccessMessage('Referral link copied to clipboard!');
  }
  
  return data;
};

// Copy referral link to clipboard
const copyReferralLink = async () => {
  const link = await generateReferralLink();
  await navigator.clipboard.writeText(link);
  showSuccessMessage('Referral link copied to clipboard!');
};
```

### Social Media Sharing
```javascript
// Share on different platforms
const shareOnTwitter = async () => {
  const data = await shareReferralLink('twitter');
  const tweetText = encodeURIComponent(data.shareMessage);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  window.open(twitterUrl, '_blank');
};

const shareOnFacebook = async () => {
  const data = await shareReferralLink('facebook');
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.referralLink)}`;
  window.open(facebookUrl, '_blank');
};

const shareOnWhatsApp = async () => {
  const data = await shareReferralLink('whatsapp');
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(data.shareMessage)}`;
  window.open(whatsappUrl, '_blank');
};
```

### Referral Leaderboard
```javascript
// Get referral leaderboard
const getReferralLeaderboard = async (period = 'week') => {
  const response = await fetch(`/api/users/referral-leaderboard?period=${period}&limit=20`);
  const data = await response.json();
  return data;
};

// Display leaderboard
const displayLeaderboard = (leaderboard) => {
  const leaderboardHtml = `
    <div class="leaderboard">
      <h3>Top Referrers</h3>
      <div class="leaderboard-list">
        ${leaderboard.leaderboard.map((user, index) => `
          <div class="leaderboard-item">
            <div class="rank">#${index + 1}</div>
            <div class="user-info">
              <img src="${user.profileImage || '/default-avatar.png'}" alt="${user.username}">
              <span class="username">${user.username}</span>
            </div>
            <div class="stats">
              <span class="referrals">${user.totalReferrals} referrals</span>
              <span class="points">${user.points} points</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.getElementById('leaderboard-container').innerHTML = leaderboardHtml;
};
```

## Database Schema

### User Model Updates
```javascript
{
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralDay: { type: String, default: null },
  referralCountToday: { type: Number, default: 0 }
}
```

### SavvyPoint Model Updates
```javascript
{
  type: {
    type: String,
    enum: [
      'referral',           // Points for referring someone
      'signup_referral',    // Points for signing up with referral
      // ... other types
    ]
  }
}
```

## Referral Flow

### 1. User Generates Referral Link
```javascript
// User clicks "Generate Link" button
const link = await generateReferralLink();
// Link: http://localhost:3000/signup?ref=68d88438ab805efb1918af30
```

### 2. User Shares Link
```javascript
// User shares on social media or with friends
await shareReferralLink('twitter');
// Tracks for daily tasks and provides share message
```

### 3. Friend Signs Up
```javascript
// Friend clicks link and signs up
// During registration, process referral
await fetch('/api/users/process-referral', {
  method: 'POST',
  body: JSON.stringify({
    userId: newUserId,
    referralCode: '68d88438ab805efb1918af30'
  })
});
```

### 4. Points Awarded
- **Referrer**: Gets 100 points
- **New User**: Gets 50 bonus points
- **Daily Tasks**: App sharing task progress updated

## Integration with Daily Tasks

The invite and earn system integrates with the daily tasks system:

- **Share App Task**: Sharing referral links counts toward the "Share App with 3 Users" daily task
- **Points Tracking**: All referral points are tracked in the daily tasks system
- **Progress Updates**: Referral sharing updates daily task progress

## Benefits

- ✅ **Viral Growth**: Users incentivized to invite friends
- ✅ **User Acquisition**: New users get bonus points for signing up
- ✅ **Engagement**: Referral tracking and leaderboards increase engagement
- ✅ **Retention**: Referred users have higher retention rates
- ✅ **Social Proof**: Leaderboards create competition
- ✅ **Daily Tasks**: Integrates with existing gamification system

## Production Considerations

1. **Fraud Prevention**: Validate referral codes and prevent self-referrals
2. **Rate Limiting**: Limit referral processing to prevent abuse
3. **Analytics**: Track referral conversion rates and user acquisition
4. **A/B Testing**: Test different reward amounts and messaging
5. **Notifications**: Notify users when someone signs up with their link
6. **Social Integration**: Deep linking for better social media sharing
7. **Referral Codes**: Allow custom referral codes for premium users

