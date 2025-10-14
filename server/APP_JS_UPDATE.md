# Step 3: Update Your App.js

## 📝 Complete App.js Update

Here's how to update your main App.js file to include the TikTok-like product feed routes:

### Option A: If you already have an App.js with routes

```javascript
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';

// Import your existing components
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
// ... other existing imports

// Import NEW TikTok-like feed components
import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';
import VideoScanner from './components/VideoScanner';

// Import the CSS
import './styles/ProductFeed.css';

// Create a client for react-query
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            {/* Your existing routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/auctions" element={<AuctionsPage />} />
            {/* Add more existing routes as needed */}
            
            {/* NEW TikTok-like feed routes */}
            <Route path="/feed" element={<ProductFeed />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/scanner" element={<VideoScanner />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
```

### Option B: If you need a complete App.js from scratch

```javascript
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';

// Import components (create these if they don't exist)
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';

// Import NEW TikTok-like feed components
import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';
import VideoScanner from './components/VideoScanner';

// Import the CSS
import './styles/ProductFeed.css';

// Create a client for react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          {/* Add your navigation component here if you have one */}
          {/* <Navigation /> */}
          
          <Routes>
            {/* Main routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            
            {/* NEW TikTok-like feed routes */}
            <Route path="/feed" element={<ProductFeed />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/scanner" element={<VideoScanner />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
```

### Option C: If you want to add to existing routes without changing much

```javascript
// Just add these lines to your existing Routes section:

// Add these imports at the top
import ProductFeed from './pages/ProductFeed';
import Trending from './pages/Trending';
import VideoScanner from './components/VideoScanner';
import './styles/ProductFeed.css';

// Add these routes inside your existing <Routes> component:
<Route path="/feed" element={<ProductFeed />} />
<Route path="/trending" element={<Trending />} />
<Route path="/scanner" element={<VideoScanner />} />
```

## 🔧 What This Does:

1. **Imports the new components** you created in Step 2
2. **Adds the CSS styling** for the TikTok-like interface
3. **Sets up React Query** for data fetching
4. **Creates the routes** for your new pages
5. **Wraps everything** in the QueryClientProvider

## ⚠️ Important Notes:

- Make sure you have `react-router-dom` installed: `npm install react-router-dom`
- The `QueryClientProvider` is required for the infinite scroll to work
- If you don't have a HomePage, LoginPage, or ProfilePage, you can create simple placeholder components or remove those routes

## 🎯 Next: Step 4 - Update Navigation

After updating App.js, we'll move to Step 4 to update your navigation component!
