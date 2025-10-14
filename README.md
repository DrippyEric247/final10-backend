# Final10 - AI-Powered Auction Platform

Final10 is an AI-powered auction platform built for the next generation of buyers and sellers. Instead of wasting hours scrolling through listings, Final10 uses AI to scan live marketplaces like eBay, Mercari, and Facebook Marketplace, surfacing only the auctions that matter—those with 10 minutes left, low competition, and high deal potential.

## 🚀 Features

### For Buyers
- **AI Market Scanner**: Continuously monitors eBay, Mercari, and Facebook Marketplace
- **10-Minute Filter**: Shows only auctions ending in 10 minutes or less
- **Deal Potential Scoring**: AI calculates deal potential and competition level
- **Smart Alerts**: Personalized notifications for matching auctions
- **Bid Automation**: Automated bid assistance tools
- **Savvy Points**: Loyalty system rewarding purchases, shares, and referrals

### For Sellers
- **Enhanced Visibility**: Reach competitive buyers actively seeking deals
- **Sales Velocity**: Faster auction completion with engaged buyers
- **AI Optimization**: Get suggestions for better auction performance

### Social Features
- **TikTok-Style Content**: Discover trending products in real-time
- **Social Integration**: Connect with other auction enthusiasts
- **Referral System**: Earn points for bringing friends to the platform

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time updates
- **JWT** for authentication
- **Puppeteer** for web scraping
- **Axios** for HTTP requests
- **Cheerio** for HTML parsing

### Frontend
- **React 18** with modern hooks
- **React Router** for navigation
- **Framer Motion** for animations
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **React Hook Form** for form handling
- **Socket.io Client** for real-time features

### AI & Automation
- **Market Scanner Service**: Automated auction discovery
- **AI Scoring Algorithm**: Deal potential and competition analysis
- **Alert System**: Smart notification matching
- **Bid Automation**: Assisted bidding tools

## 📁 Project Structure

```
final10/
├── server/                 # Backend API
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
├── client/                # Frontend React app
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context
│   │   ├── services/      # API services
│   │   └── hooks/         # Custom hooks
│   └── public/            # Static assets
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd final10
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp server/env.example server/.env
   
   # Edit the .env file with your configuration
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on http://localhost:5000
   - Frontend app on http://localhost:3000

### Environment Variables

Create a `.env` file in the `server` directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/final10

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=5000
NODE_ENV=development

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000

# External API Keys (for future integrations)
EBAY_API_KEY=your-ebay-api-key
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password

### Auctions
- `GET /api/auctions` - Get all auctions with filters
- `GET /api/auctions/:id` - Get single auction
- `POST /api/auctions/:id/bid` - Place a bid
- `POST /api/auctions/:id/watch` - Watch/unwatch auction
- `GET /api/auctions/trending` - Get trending auctions
- `GET /api/auctions/ending-soon` - Get auctions ending soon

### Alerts
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

### Points
- `GET /api/points/history` - Get point history
- `GET /api/points/balance` - Get current balance
- `POST /api/points/redeem` - Redeem points
- `GET /api/points/leaderboard` - Get leaderboard

## 🤖 AI Features

### Market Scanner
The AI market scanner continuously monitors multiple platforms:
- **eBay**: Scans for auctions ending soon
- **Mercari**: Identifies trending deals
- **Facebook Marketplace**: Finds local opportunities

### Deal Scoring
Each auction is scored on:
- **Deal Potential** (0-100): Price vs market value
- **Competition Level**: Low/Medium/High based on bid activity
- **Trending Score**: Popularity and search volume

### Smart Alerts
Users can create personalized alerts based on:
- Keywords and categories
- Price ranges
- Condition preferences
- Time remaining filters
- Platform preferences

## 🎨 UI/UX Features

- **Dark Theme**: Modern dark interface optimized for extended use
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Smooth Animations**: Framer Motion for engaging interactions
- **Real-time Updates**: Live auction updates via WebSocket
- **Intuitive Navigation**: Clean, organized interface

## 🔒 Security

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt for password security
- **Input Validation**: Comprehensive form validation
- **CORS Protection**: Configured for secure cross-origin requests
- **Rate Limiting**: Protection against abuse

## 📈 Future Enhancements

- **Mobile App**: React Native version
- **Advanced AI**: Machine learning for better predictions
- **Payment Integration**: Stripe for secure transactions
- **Social Features**: Enhanced community features
- **Analytics Dashboard**: Detailed user analytics
- **API Documentation**: Swagger/OpenAPI docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@final10.com or join our Discord community.
## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB (running locally or in the cloud, e.g., MongoDB Atlas)
- npm or yarn

### Installation
```bash
git clone https://github.com/yourusername/final10.git
cd final10/server
npm install
cd ../client
npm install
## 🔑 Environment Variables

Create a `.env` file inside the `server/` folder:

```env
MONGODB_URI=mongodb://localhost:27017/final10
JWT_SECRET=supersecret123
PORT=5000
CLIENT_URL=http://localhost:3000
## 📡 API Endpoints

### Auth Routes
- **POST** `/api/auth/signup`
  ```json
  {
    "email": "newuser@example.com",
    "username": "newuser",
    "firstName": "New",
    "lastName": "User",
    "password": "password123"
  }
{
  "message": "User created successfully",
  "token": "JWT_TOKEN_HERE",
  "user": { "id": "...", "email": "newuser@example.com" }
}
{
  "email": "newuser@example.com",
  "password": "password123"
}
## 📬 Contact
Built by Eric Vasquez (Final10 Founder)  
Email: your-email@example.com  

---

**Final10** - Where AI meets auctions, and deals are never missed! 🚀









































