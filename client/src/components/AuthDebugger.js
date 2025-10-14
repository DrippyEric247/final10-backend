import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const AuthDebugger = () => {
  const { user, token, loading, error, logout } = useAuth();
  const [debugInfo, setDebugInfo] = useState(null);

  const checkAuthStatus = () => {
    const token = localStorage.getItem('f10_token');
    const debugData = {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'None',
      user: user ? {
        id: user.id,
        username: user.username,
        email: user.email
      } : null,
      loading,
      error,
      localStorageKeys: Object.keys(localStorage).filter(key => 
        key.includes('token') || key.includes('auth') || key.includes('user')
      )
    };
    setDebugInfo(debugData);
  };

  const clearAllAuth = () => {
    // Clear all possible auth-related localStorage items
    const keysToRemove = [
      'f10_token',
      'token', 
      'user',
      'authToken',
      'auth_token',

    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Also clear sessionStorage
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });
    
    // Logout from context
    logout();
    
    // Reload the page
    window.location.reload();
  };

  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '10px',
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      padding: '16px',
      color: 'white',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa' }}>Auth Debugger</h4>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Status:</strong> {loading ? 'Loading...' : user ? 'Logged In' : 'Not Logged In'}
      </div>
      
      {error && (
        <div style={{ marginBottom: '8px', color: '#f87171' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{ marginBottom: '12px' }}>
        <button 
          onClick={checkAuthStatus}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Check Status
        </button>
        
        <button 
          onClick={clearAllAuth}
          style={{
            background: '#ef4444',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Auth
        </button>
      </div>
      
      {debugInfo && (
        <div style={{ fontSize: '10px' }}>
          <div><strong>Token:</strong> {debugInfo.hasToken ? 'Yes' : 'No'}</div>
          <div><strong>Token Preview:</strong> {debugInfo.tokenPreview}</div>
          <div><strong>User:</strong> {debugInfo.user ? debugInfo.user.username : 'None'}</div>
          <div><strong>Storage Keys:</strong> {debugInfo.localStorageKeys.join(', ') || 'None'}</div>
        </div>
      )}
    </div>
  );
};

export default AuthDebugger;


