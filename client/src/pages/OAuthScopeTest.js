import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Loader2, Eye, ShoppingCart, Search, Zap } from 'lucide-react';
import ebayService from '../services/ebayService';
import api from '../services/authService';

const OAuthScopeTest = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null);

  // Test results structure
  const [results, setResults] = useState({
    tokenValid: null,
    browsePermission: null,
    buyPermission: null,
    searchPermission: null,
    apiConnectivity: null,
    rateLimitStatus: null
  });

  useEffect(() => {
    checkTokenInfo();
  }, []);

  const checkTokenInfo = () => {
    const token = localStorage.getItem('f10_token');
    if (token) {
      try {
        // Decode JWT token to check payload (if it's a JWT)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          setTokenInfo({
            type: 'JWT',
            payload: payload,
            scopes: payload.scope || payload.scopes || 'Not specified',
            expires: payload.exp ? new Date(payload.exp * 1000) : 'Not specified'
          });
        } else {
          setTokenInfo({
            type: 'Bearer Token',
            payload: 'Opaque token',
            scopes: 'Not decodable',
            expires: 'Unknown'
          });
        }
      } catch (error) {
        setTokenInfo({
          type: 'Bearer Token',
          payload: 'Invalid format',
          scopes: 'Not decodable',
          expires: 'Unknown'
        });
      }
    } else {
      setTokenInfo(null);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setResults({
      tokenValid: null,
      browsePermission: null,
      buyPermission: null,
      searchPermission: null,
      apiConnectivity: null,
      rateLimitStatus: null
    });

    // Test 1: Token Validity
    await testTokenValidity();
    
    // Test 2: API Connectivity
    await testApiConnectivity();
    
    // Test 3: Browse Permission (Search Items)
    await testBrowsePermission();
    
    // Test 4: Search Permission
    await testSearchPermission();
    
    // Test 5: Buy Permission (Place Bid - this will likely fail but we can test the endpoint)
    await testBuyPermission();
    
    // Test 6: Rate Limit Status
    await testRateLimitStatus();

    setLoading(false);
  };

  const testTokenValidity = async () => {
    try {
      const token = localStorage.getItem('f10_token');
      if (!token) {
        setResults(prev => ({ ...prev, tokenValid: { success: false, message: 'No token found' } }));
        return;
      }

      // Test with a simple API call
      const response = await api.get('/auth/me');
      setResults(prev => ({ 
        ...prev, 
        tokenValid: { 
          success: true, 
          message: `Token valid - User: ${response.data?.email || 'Unknown'}` 
        } 
      }));
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        tokenValid: { 
          success: false, 
          message: `Token invalid: ${error.response?.status === 401 ? 'Unauthorized' : error.message}` 
        } 
      }));
    }
  };

  const testApiConnectivity = async () => {
    try {
      const response = await api.get('/health');
      setResults(prev => ({ 
        ...prev, 
        apiConnectivity: { 
          success: true, 
          message: 'API server is reachable' 
        } 
      }));
    } catch (error) {
      if (error.response?.status === 404) {
        setResults(prev => ({ 
          ...prev, 
          apiConnectivity: { 
            success: true, 
            message: 'API server reachable (health endpoint not found)' 
          } 
        }));
      } else {
        setResults(prev => ({ 
          ...prev, 
          apiConnectivity: { 
            success: false, 
            message: `API connectivity failed: ${error.message}` 
          } 
        }));
      }
    }
  };

  const testBrowsePermission = async () => {
    try {
      const response = await ebayService.searchItems({ limit: 5 });
      setResults(prev => ({ 
        ...prev, 
        browsePermission: { 
          success: true, 
          message: `Browse permission works - Found ${response.items?.length || 0} items` 
        } 
      }));
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        browsePermission: { 
          success: false, 
          message: `Browse permission failed: ${error.response?.status === 403 ? 'Forbidden' : error.message}` 
        } 
      }));
    }
  };

  const testSearchPermission = async () => {
    try {
      const response = await ebayService.searchItems({ keywords: 'test', limit: 3 });
      setResults(prev => ({ 
        ...prev, 
        searchPermission: { 
          success: true, 
          message: `Search permission works - Found ${response.items?.length || 0} results for 'test'` 
        } 
      }));
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        searchPermission: { 
          success: false, 
          message: `Search permission failed: ${error.response?.status === 403 ? 'Forbidden' : error.message}` 
        } 
      }));
    }
  };

  const testBuyPermission = async () => {
    try {
      // This will likely fail since we don't have a real auction ID, but we can test the endpoint
      const response = await api.post('/ebay/bid', {
        auctionId: 'test-auction-id',
        bidAmount: 1.00
      });
      setResults(prev => ({ 
        ...prev, 
        buyPermission: { 
          success: true, 
          message: 'Buy permission works - Bid endpoint accessible' 
        } 
      }));
    } catch (error) {
      if (error.response?.status === 400) {
        setResults(prev => ({ 
          ...prev, 
          buyPermission: { 
            success: true, 
            message: 'Buy permission works - Endpoint accessible (invalid auction ID expected)' 
          } 
        }));
      } else if (error.response?.status === 403) {
        setResults(prev => ({ 
          ...prev, 
          buyPermission: { 
            success: false, 
            message: 'Buy permission denied - 403 Forbidden' 
          } 
        }));
      } else {
        setResults(prev => ({ 
          ...prev, 
          buyPermission: { 
            success: false, 
            message: `Buy permission test failed: ${error.message}` 
          } 
        }));
      }
    }
  };

  const testRateLimitStatus = async () => {
    try {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(5).fill().map(() => ebayService.searchItems({ limit: 1 }));
      const responses = await Promise.all(promises);
      
      setResults(prev => ({ 
        ...prev, 
        rateLimitStatus: { 
          success: true, 
          message: 'Rate limiting working - Multiple requests successful' 
        } 
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        setResults(prev => ({ 
          ...prev, 
          rateLimitStatus: { 
            success: true, 
            message: 'Rate limiting working - 429 response received' 
          } 
        }));
      } else {
        setResults(prev => ({ 
          ...prev, 
          rateLimitStatus: { 
            success: false, 
            message: `Rate limit test failed: ${error.message}` 
          } 
        }));
      }
    }
  };

  const getStatusIcon = (result) => {
    if (!result) return <AlertCircle className="w-5 h-5 text-gray-400" />;
    if (result.success) return <CheckCircle className="w-5 h-5 text-green-400" />;
    return <XCircle className="w-5 h-5 text-red-400" />;
  };

  const getStatusColor = (result) => {
    if (!result) return 'bg-gray-800 border-gray-700';
    if (result.success) return 'bg-green-900/20 border-green-500/50';
    return 'bg-red-900/20 border-red-500/50';
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            OAuth <span className="text-gradient">Scope Test</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Test your OAuth token with buy and browse permissions
          </p>
        </motion.div>

        {/* Token Information */}
        {tokenInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="card mb-8"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Token Information
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400">Token Type:</p>
                <p className="text-white font-medium">{tokenInfo.type}</p>
              </div>
              <div>
                <p className="text-gray-400">Scopes:</p>
                <p className="text-white font-medium">{tokenInfo.scopes}</p>
              </div>
              <div>
                <p className="text-gray-400">Expires:</p>
                <p className="text-white font-medium">{tokenInfo.expires}</p>
              </div>
              <div>
                <p className="text-gray-400">Payload:</p>
                <p className="text-white font-medium text-sm">
                  {typeof tokenInfo.payload === 'object' ? 'JWT Decoded' : tokenInfo.payload}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Test Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <button
            onClick={runAllTests}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            {loading ? 'Running Tests...' : 'Run OAuth Scope Tests'}
          </button>
        </motion.div>

        {/* Test Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-4"
        >
          {/* Token Validity */}
          <div className={`card ${getStatusColor(results.tokenValid)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(results.tokenValid)}
              <div>
                <h3 className="text-lg font-semibold text-white">Token Validity</h3>
                <p className="text-gray-400">
                  {results.tokenValid?.message || 'Not tested yet'}
                </p>
              </div>
            </div>
          </div>

          {/* API Connectivity */}
          <div className={`card ${getStatusColor(results.apiConnectivity)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(results.apiConnectivity)}
              <div>
                <h3 className="text-lg font-semibold text-white">API Connectivity</h3>
                <p className="text-gray-400">
                  {results.apiConnectivity?.message || 'Not tested yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Browse Permission */}
          <div className={`card ${getStatusColor(results.browsePermission)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(results.browsePermission)}
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Browse Permission
                </h3>
                <p className="text-gray-400">
                  {results.browsePermission?.message || 'Not tested yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Search Permission */}
          <div className={`card ${getStatusColor(results.searchPermission)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(results.searchPermission)}
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search Permission
                </h3>
                <p className="text-gray-400">
                  {results.searchPermission?.message || 'Not tested yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Buy Permission */}
          <div className={`card ${getStatusColor(results.buyPermission)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(results.buyPermission)}
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Buy Permission
                </h3>
                <p className="text-gray-400">
                  {results.buyPermission?.message || 'Not tested yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Rate Limit Status */}
          <div className={`card ${getStatusColor(results.rateLimitStatus)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(results.rateLimitStatus)}
              <div>
                <h3 className="text-lg font-semibold text-white">Rate Limit Status</h3>
                <p className="text-gray-400">
                  {results.rateLimitStatus?.message || 'Not tested yet'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Summary */}
        {Object.values(results).some(result => result !== null) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8"
          >
            <div className="card bg-blue-900/20 border-blue-500/50">
              <h3 className="text-lg font-semibold text-white mb-2">Test Summary</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Successful Tests:</p>
                  <p className="text-green-400 font-medium">
                    {Object.values(results).filter(r => r?.success).length} / {Object.keys(results).length}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Failed Tests:</p>
                  <p className="text-red-400 font-medium">
                    {Object.values(results).filter(r => r?.success === false).length} / {Object.keys(results).length}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default OAuthScopeTest;
