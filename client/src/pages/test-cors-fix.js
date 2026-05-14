// Test CORS fix
// Run this in your browser console to test CORS

async function testCorsFix() {
  console.log('🔧 Testing CORS Fix...');
  
  const token = localStorage.getItem('f10_token');
  if (!token) {
    console.error('❌ No authentication token found');
    return;
  }
  
  // Test 1: Simple OPTIONS request (preflight)
  console.log('\n1️⃣ Testing CORS Preflight (OPTIONS)...');
  try {
    const optionsResponse = await fetch('/api/ebay/search', {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });
    
    console.log('OPTIONS status:', optionsResponse.status);
    console.log('CORS headers:', {
      'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': optionsResponse.headers.get('Access-Control-Allow-Credentials')
    });
    
    if (optionsResponse.status === 200) {
      console.log('✅ CORS preflight working');
    } else {
      console.log('❌ CORS preflight failed');
    }
  } catch (error) {
    console.error('❌ CORS preflight error:', error.message);
  }
  
  // Test 2: Actual GET request
  console.log('\n2️⃣ Testing Actual GET Request...');
  try {
    const getResponse = await fetch('/api/ebay/search?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('GET status:', getResponse.status);
    console.log('Response headers:', {
      'Access-Control-Allow-Origin': getResponse.headers.get('Access-Control-Allow-Origin'),
      'Content-Type': getResponse.headers.get('Content-Type')
    });
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('✅ GET request working!');
      console.log('Items found:', data.items?.length || 0);
    } else {
      const errorText = await getResponse.text();
      console.log('❌ GET request failed:', getResponse.status, errorText);
    }
  } catch (error) {
    console.error('❌ GET request error:', error.message);
  }
  
  // Test 3: Test with different endpoints
  console.log('\n3️⃣ Testing Other Endpoints...');
  const endpoints = [
    '/api/ebay/trending?limit=1',
    '/api/ebay/categories'
  ];
  
  for (const endpoint of endpoints) {
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
  
  console.log('\n📋 CORS Test Summary:');
  console.log('====================');
  console.log('• If OPTIONS returns 200, CORS preflight is working');
  console.log('• If GET returns 200, the actual request is working');
  console.log('• If you still get CORS errors, restart your backend server');
  console.log('• Check that your backend server is running on port 5000');
  
  console.log('\n🏁 CORS Test Complete!');
}

// Run the test
testCorsFix();



























