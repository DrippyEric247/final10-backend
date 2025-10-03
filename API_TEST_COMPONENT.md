# API Testing Component

## 🧪 Quick API Test Component

Add this component to test your TikTok-like product feed endpoints:

```javascript
// src/components/APITester.js
import React, { useState } from 'react';

const APITester = () => {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const testEndpoint = async (endpoint, method = 'GET', body = null) => {
    setLoading(prev => ({ ...prev, [endpoint]: true }));
    
    try {
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`/api${endpoint}`, options);
      const data = await response.json();
      
      setResults(prev => ({
        ...prev,
        [endpoint]: {
          status: response.status,
          data: data,
          success: response.ok
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [endpoint]: {
          status: 'ERROR',
          data: error.message,
          success: false
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [endpoint]: false }));
    }
  };

  const endpoints = [
    {
      name: 'Product Feed',
      endpoint: '/feed/product-feed',
      method: 'GET',
      description: 'TikTok-like infinite scroll feed'
    },
    {
      name: 'Trending Feed',
      endpoint: '/feed/trending',
      method: 'GET',
      description: 'Trending auctions and categories'
    },
    {
      name: 'AI Insights',
      endpoint: '/feed/ai-insights',
      method: 'GET',
      description: 'AI-powered market insights'
    },
    {
      name: 'Video Scanner',
      endpoint: '/feed/scan-video',
      method: 'POST',
      body: {
        videoUrl: 'https://tiktok.com/@test/video/123',
        platform: 'tiktok'
      },
      description: 'AI video scanning for products'
    },
    {
      name: 'Invite & Earn',
      endpoint: '/users/invite-earn',
      method: 'GET',
      description: 'Referral system information'
    },
    {
      name: 'Daily Tasks',
      endpoint: '/auctions/daily-tasks',
      method: 'GET',
      description: 'Daily tasks and points'
    }
  ];

  return (
    <div className="api-tester">
      <div className="tester-header">
        <h2>🧪 API Endpoint Tester</h2>
        <div className="token-input">
          <input
            type="text"
            placeholder="Enter your JWT token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="token-field"
          />
          <button 
            onClick={() => localStorage.setItem('token', token)}
            className="save-token"
          >
            Save Token
          </button>
        </div>
      </div>
      
      <div className="endpoints-grid">
        {endpoints.map((endpoint) => (
          <div key={endpoint.endpoint} className="endpoint-card">
            <div className="endpoint-header">
              <h3>{endpoint.name}</h3>
              <span className="method">{endpoint.method}</span>
            </div>
            
            <p className="description">{endpoint.description}</p>
            <p className="endpoint-path">{endpoint.endpoint}</p>
            
            <button
              onClick={() => testEndpoint(endpoint.endpoint, endpoint.method, endpoint.body)}
              disabled={loading[endpoint.endpoint] || !token}
              className="test-button"
            >
              {loading[endpoint.endpoint] ? 'Testing...' : 'Test Endpoint'}
            </button>
            
            {results[endpoint.endpoint] && (
              <div className={`result ${results[endpoint.endpoint].success ? 'success' : 'error'}`}>
                <div className="result-header">
                  <span className="status">
                    Status: {results[endpoint.endpoint].status}
                  </span>
                  <span className="success-indicator">
                    {results[endpoint.endpoint].success ? '✅' : '❌'}
                  </span>
                </div>
                <pre className="result-data">
                  {JSON.stringify(results[endpoint.endpoint].data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default APITester;
```

## 🎯 Usage Instructions

1. **Add the component to your app:**
```javascript
import APITester from './components/APITester';

// Add a route for testing
<Route path="/api-test" element={<APITester />} />
```

2. **Get your JWT token:**
   - Login to your app
   - Open browser dev tools
   - Go to Application/Storage > Local Storage
   - Find your JWT token
   - Copy and paste it into the tester

3. **Test each endpoint:**
   - Click "Test Endpoint" for each API
   - Check the results to see if they're working
   - Green ✅ means success, Red ❌ means error

## 🔧 CSS for API Tester

```css
.api-tester {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background: #000;
  color: #fff;
  min-height: 100vh;
}

.tester-header {
  text-align: center;
  margin-bottom: 30px;
}

.token-input {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.token-field {
  padding: 10px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #111;
  color: #fff;
  width: 400px;
}

.save-token {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.endpoints-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.endpoint-card {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  padding: 20px;
  border-radius: 12px;
}

.endpoint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.endpoint-header h3 {
  margin: 0;
}

.method {
  background: #4CAF50;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.description {
  color: #ccc;
  margin-bottom: 10px;
}

.endpoint-path {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 15px;
  color: #4CAF50;
}

.test-button {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.test-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.test-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result {
  margin-top: 15px;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid;
}

.result.success {
  background: rgba(76, 175, 80, 0.1);
  border-color: #4CAF50;
}

.result.error {
  background: rgba(244, 67, 54, 0.1);
  border-color: #f44336;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
}

.result-data {
  background: rgba(0, 0, 0, 0.3);
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  max-height: 300px;
  overflow-y: auto;
}
```

## 🎉 Quick Start

1. **Start your server:** `npm start` (should be running on port 5000)
2. **Add the APITester component** to your React app
3. **Login to get your JWT token**
4. **Test all endpoints** to verify they're working
5. **Start building your TikTok-like feed!**

Your TikTok-like product feed with AI video scanning is now fully integrated and ready to use! 🚀

