// Comprehensive 500 Error Debug Script
// Run this in your browser console to debug persistent 500 errors

async function debugPersistent500() {
  console.log('🔍 Debugging Persistent 500 Errors...');
  console.log('=====================================');
  
  const token = localStorage.getItem('f10_token');
  console.log('Token present:', !!token);
  console.log('Token length:', token?.length || 0);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 30) + '...');
  }
  
  // Test 1: Check if backend is running
  console.log('\n1️⃣ Testing Backend Connectivity...');
  try {
    const healthResponse = await fetch('/api/health');
    console.log('Health check status:', healthResponse.status);
    if (healthResponse.ok) {
      console.log('✅ Backend is running');
    } else {
      console.log('⚠️ Backend responded with:', healthResponse.status);
    }
  } catch (error) {
    console.error('❌ Backend not reachable:', error.message);
    console.log('💡 Make sure your backend server is running on port 5000');
    return;
  }
  
  // Test 2: Test auth endpoint
  console.log('\n2️⃣ Testing Authentication...');
  try {
    const authResponse = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Auth status:', authResponse.status);
    
    if (authResponse.ok) {
      const userData = await authResponse.json();
      console.log('✅ User authenticated:', userData.email || 'Unknown');
      console.log('User ID:', userData._id || 'Unknown');
    } else {
      console.log('❌ Auth failed:', authResponse.status);
      const errorText = await authResponse.text();
      console.log('Auth error:', errorText);
    }
  } catch (error) {
    console.error('❌ Auth error:', error.message);
  }
  
  // Test 3: Test eBay search with detailed error info
  console.log('\n3️⃣ Testing eBay Search Endpoint...');
  try {
    const searchResponse = await fetch('/api/ebay/search?limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('eBay search status:', searchResponse.status);
    console.log('Response headers:', Object.fromEntries(searchResponse.headers.entries()));
    
    if (searchResponse.ok) {
      const data = await searchResponse.json();
      console.log('✅ eBay search working!');
      console.log('Items found:', data.items?.length || 0);
    } else {
      console.log('❌ eBay search failed:', searchResponse.status);
      const errorText = await searchResponse.text();
      console.log('Error response:', errorText);
      
      // Try to parse as JSON for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Parsed error:', errorJson);
      } catch (e) {
        console.log('Raw error text:', errorText);
      }
    }
  } catch (error) {
    console.error('❌ eBay search error:', error.message);
    console.log('Error type:', error.name);
    console.log('Error stack:', error.stack);
  }
  
  // Test 4: Test with different parameters
  console.log('\n4️⃣ Testing with Different Parameters...');
  const testParams = [
    '/api/ebay/search',
    '/api/ebay/search?limit=5',
    '/api/ebay/search?q=test',
    '/api/ebay/trending',
    '/api/ebay/categories'
  ];
  
  for (const endpoint of testParams) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`${endpoint}: ERROR - ${error.message}`);
    }
  }
  
  // Test 5: Check for CORS issues
  console.log('\n5️⃣ Testing CORS and Headers...');
  try {
    const corsResponse = await fetch('/api/ebay/search?limit=1', {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      }
    });
    console.log('CORS preflight status:', corsResponse.status);
    console.log('CORS headers:', Object.fromEntries(corsResponse.headers.entries()));
  } catch (error) {
    console.log('CORS test error:', error.message);
  }
  
  console.log('\n📋 Debug Summary:');
  console.log('==================');
  console.log('1. Check if backend server is running');
  console.log('2. Check if backend server was restarted after code changes');
  console.log('3. Check backend server logs for detailed error information');
  console.log('4. Verify User model changes are applied');
  console.log('5. Check if eBay environment variables are set');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Restart your backend server');
  console.log('2. Check backend console/logs for error details');
  console.log('3. Verify .env file has required eBay credentials');
  console.log('4. Test with a simple endpoint first');
  
  console.log('\n🏁 Debug Complete!');
}

// Run the debug
debugPersistent500();






















