import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Loader2, Server, Database, Key } from 'lucide-react';
import api from '../services/authService';
import ebayService from '../services/ebayService';

const APIDebugTest = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);

  const runAPITests = async () => {
    setLoading(true);
    setTestResults({});

    // Test 1: Basic API connectivity
    await testBasicConnectivity();
    
    // Test 2: Authentication endpoint
    await testAuthEndpoint();
    
    // Test 3: eBay search endpoint
    await testEbaySearchEndpoint();
    
    // Test 4: Token validation
    await testTokenValidation();

    setLoading(false);
  };

  const testBasicConnectivity = async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setTestResults(prev => ({
        ...prev,
        basicConnectivity: {
          success: true,
          message: `API server reachable - Status: ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            url: '/api/health'
          }
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        basicConnectivity: {
          success: false,
          message: `API connectivity failed: ${error.message}`,
          details: {
            error: error.message,
            type: error.name
          }
        }
      }));
    }
  };

  const testAuthEndpoint = async () => {
    try {
      const token = localStorage.getItem('f10_token');
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestResults(prev => ({
          ...prev,
          authEndpoint: {
            success: true,
            message: `Auth endpoint working - User: ${data.email || 'Unknown'}`,
            details: {
              status: response.status,
              user: data
            }
          }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          authEndpoint: {
            success: false,
            message: `Auth endpoint failed - Status: ${response.status}`,
            details: {
              status: response.status,
              statusText: response.statusText
            }
          }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        authEndpoint: {
          success: false,
          message: `Auth endpoint error: ${error.message}`,
          details: {
            error: error.message
          }
        }
      }));
    }
  };

  const testEbaySearchEndpoint = async () => {
    try {
      const response = await fetch('/api/ebay/search?limit=1', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('f10_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestResults(prev => ({
          ...prev,
          ebaySearch: {
            success: true,
            message: `eBay search endpoint working - Found ${data.items?.length || 0} items`,
            details: {
              status: response.status,
              itemsCount: data.items?.length || 0,
              hasPagination: !!data.pagination
            }
          }
        }));
      } else {
        const errorData = await response.text();
        setTestResults(prev => ({
          ...prev,
          ebaySearch: {
            success: false,
            message: `eBay search failed - Status: ${response.status}`,
            details: {
              status: response.status,
              statusText: response.statusText,
              errorData: errorData
            }
          }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        ebaySearch: {
          success: false,
          message: `eBay search error: ${error.message}`,
          details: {
            error: error.message,
            type: error.name
          }
        }
      }));
    }
  };

  const testTokenValidation = async () => {
    const token = localStorage.getItem('f10_token');
    
    if (!token) {
      setTestResults(prev => ({
        ...prev,
        tokenValidation: {
          success: false,
          message: 'No token found in localStorage',
          details: {
            tokenPresent: false
          }
        }
      }));
      return;
    }

    try {
      // Try to decode JWT if possible
      const parts = token.split('.');
      let tokenInfo = null;
      
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(atob(parts[1]));
          tokenInfo = {
            type: 'JWT',
            scopes: payload.scope || payload.scopes || 'Not specified',
            expires: payload.exp ? new Date(payload.exp * 1000) : 'Not specified',
            issuer: payload.iss || 'Not specified'
          };
        } catch (e) {
          tokenInfo = { type: 'JWT', error: 'Could not decode payload' };
        }
      } else {
        tokenInfo = { type: 'Bearer Token', format: 'Opaque' };
      }

      setTestResults(prev => ({
        ...prev,
        tokenValidation: {
          success: true,
          message: `Token found - Type: ${tokenInfo.type}`,
          details: {
            tokenPresent: true,
            tokenLength: token.length,
            tokenInfo: tokenInfo
          }
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        tokenValidation: {
          success: false,
          message: `Token validation error: ${error.message}`,
          details: {
            error: error.message
          }
        }
      }));
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
            API <span className="text-gradient">Debug Test</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Debug the 500 error and test API connectivity
          </p>
        </motion.div>

        {/* Test Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <button
            onClick={runAPITests}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Server className="w-5 h-5" />
            )}
            {loading ? 'Running Tests...' : 'Run API Debug Tests'}
          </button>
        </motion.div>

        {/* Test Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-4"
        >
          {/* Basic Connectivity */}
          <div className={`card ${getStatusColor(testResults.basicConnectivity)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(testResults.basicConnectivity)}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Basic API Connectivity
                </h3>
                <p className="text-gray-400">
                  {testResults.basicConnectivity?.message || 'Not tested yet'}
                </p>
                {testResults.basicConnectivity?.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-gray-500 cursor-pointer">View Details</summary>
                    <pre className="text-xs text-gray-400 mt-2 bg-gray-800 p-2 rounded overflow-auto">
                      {JSON.stringify(testResults.basicConnectivity.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>

          {/* Auth Endpoint */}
          <div className={`card ${getStatusColor(testResults.authEndpoint)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(testResults.authEndpoint)}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Authentication Endpoint
                </h3>
                <p className="text-gray-400">
                  {testResults.authEndpoint?.message || 'Not tested yet'}
                </p>
                {testResults.authEndpoint?.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-gray-500 cursor-pointer">View Details</summary>
                    <pre className="text-xs text-gray-400 mt-2 bg-gray-800 p-2 rounded overflow-auto">
                      {JSON.stringify(testResults.authEndpoint.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>

          {/* eBay Search Endpoint */}
          <div className={`card ${getStatusColor(testResults.ebaySearch)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(testResults.ebaySearch)}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  eBay Search Endpoint
                </h3>
                <p className="text-gray-400">
                  {testResults.ebaySearch?.message || 'Not tested yet'}
                </p>
                {testResults.ebaySearch?.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-gray-500 cursor-pointer">View Details</summary>
                    <pre className="text-xs text-gray-400 mt-2 bg-gray-800 p-2 rounded overflow-auto">
                      {JSON.stringify(testResults.ebaySearch.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>

          {/* Token Validation */}
          <div className={`card ${getStatusColor(testResults.tokenValidation)}`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(testResults.tokenValidation)}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Token Validation
                </h3>
                <p className="text-gray-400">
                  {testResults.tokenValidation?.message || 'Not tested yet'}
                </p>
                {testResults.tokenValidation?.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-gray-500 cursor-pointer">View Details</summary>
                    <pre className="text-xs text-gray-400 mt-2 bg-gray-800 p-2 rounded overflow-auto">
                      {JSON.stringify(testResults.tokenValidation.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Debug Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8"
        >
          <div className="card bg-blue-900/20 border-blue-500/50">
            <h3 className="text-lg font-semibold text-white mb-4">Debug Information</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Current URL:</p>
                <p className="text-white font-mono">{window.location.href}</p>
              </div>
              <div>
                <p className="text-gray-400">API Base URL:</p>
                <p className="text-white font-mono">{process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}</p>
              </div>
              <div>
                <p className="text-gray-400">Token Present:</p>
                <p className="text-white font-mono">{localStorage.getItem('f10_token') ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-gray-400">Token Length:</p>
                <p className="text-white font-mono">{localStorage.getItem('f10_token')?.length || 0} characters</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default APIDebugTest;



















