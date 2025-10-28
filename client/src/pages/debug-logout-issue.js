// Debug script to identify why auction tab logs user out
// Run this in your browser console

async function debugLogoutIssue() {
  console.log('🔍 Debugging Logout Issue on Auction Tab...');
  console.log('==========================================');
  
  // Check initial state
  const token = localStorage.getItem('f10_token');
  console.log('Initial token present:', !!token);
  console.log('Token length:', token?.length || 0);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 30) + '...');
  }
  
  // Test 1: Check auth status before going to auction tab
  console.log('\n1️⃣ Testing Auth Status Before Auction Tab...');
  try {
    const authResponse = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Auth status before auction tab:', authResponse.status);
    
    if (authResponse.ok) {
      const userData = await authResponse.json();
      console.log('✅ User authenticated before auction tab:', userData.email || 'Unknown');
    } else {
      console.log('❌ Auth failed before auction tab:', authResponse.status);
      const errorText = await authResponse.text();
      console.log('Auth error:', errorText);
    }
  } catch (error) {
    console.error('❌ Auth test error:', error.message);
  }
  
  // Test 2: Test eBay search endpoint (what auction tab calls)
  console.log('\n2️⃣ Testing eBay Search Endpoint (Auction Tab Call)...');
  try {
    const searchResponse = await fetch('/api/ebay/search?limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('eBay search status:', searchResponse.status);
    
    if (searchResponse.ok) {
      const data = await searchResponse.json();
      console.log('✅ eBay search working - Items found:', data.items?.length || 0);
    } else {
      console.log('❌ eBay search failed:', searchResponse.status);
      const errorText = await searchResponse.text();
      console.log('eBay search error:', errorText);
      
      // Check if this is an auth error that might trigger logout
      if (searchResponse.status === 401) {
        console.log('🚨 401 Unauthorized - This might trigger logout!');
      }
    }
  } catch (error) {
    console.error('❌ eBay search error:', error.message);
  }
  
  // Test 3: Check token after eBay call
  console.log('\n3️⃣ Checking Token After eBay Call...');
  const tokenAfter = localStorage.getItem('f10_token');
  console.log('Token present after eBay call:', !!tokenAfter);
  console.log('Token changed:', token !== tokenAfter);
  
  // Test 4: Check auth status after eBay call
  console.log('\n4️⃣ Testing Auth Status After eBay Call...');
  try {
    const authResponseAfter = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${tokenAfter}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Auth status after eBay call:', authResponseAfter.status);
    
    if (authResponseAfter.ok) {
      const userData = await authResponseAfter.json();
      console.log('✅ User still authenticated after eBay call:', userData.email || 'Unknown');
    } else {
      console.log('❌ Auth failed after eBay call:', authResponseAfter.status);
      const errorText = await authResponseAfter.text();
      console.log('Auth error after eBay call:', errorText);
    }
  } catch (error) {
    console.error('❌ Auth test error after eBay call:', error.message);
  }
  
  // Test 5: Check for any error handlers that might clear tokens
  console.log('\n5️⃣ Checking for Token Clearing...');
  console.log('Current localStorage keys:', Object.keys(localStorage));
  
  // Monitor localStorage changes
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;
  
  localStorage.setItem = function(key, value) {
    if (key === 'f10_token') {
      console.log('🔍 Token being set:', value ? 'Present' : 'Empty');
    }
    return originalSetItem.apply(this, arguments);
  };
  
  localStorage.removeItem = function(key) {
    if (key === 'f10_token') {
      console.log('🚨 Token being removed!');
      console.trace('Token removal stack trace:');
    }
    return originalRemoveItem.apply(this, arguments);
  };
  
  localStorage.clear = function() {
    console.log('🚨 localStorage being cleared!');
    console.trace('localStorage clear stack trace:');
    return originalClear.apply(this, arguments);
  };
  
  console.log('✅ Monitoring localStorage changes enabled');
  
  console.log('\n📋 Debug Summary:');
  console.log('==================');
  console.log('• Check if eBay search returns 401 (unauthorized)');
  console.log('• Check if token is being removed from localStorage');
  console.log('• Check if auth middleware is causing issues');
  console.log('• Look for any error handlers that clear tokens');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Navigate to the auction tab and watch the console');
  console.log('2. Look for any 401 errors or token removal messages');
  console.log('3. Check if the eBay routes are properly handling auth');
  console.log('4. Verify the auth middleware is not too strict');
  
  console.log('\n🏁 Logout Debug Complete!');
  console.log('Now try navigating to the auction tab and watch for messages...');
}

// Run the debug
debugLogoutIssue();
























