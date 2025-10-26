// Debug 500 Error Script
// Run this in your browser console to debug the API issue

async function debug500Error() {
  console.log('🔍 Debugging 500 Error...');
  
  const token = localStorage.getItem('f10_token');
  console.log('Token present:', !!token);
  console.log('Token length:', token?.length || 0);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 50) + '...');
  }
  
  // Test 1: Check if backend is running
  console.log('\n1️⃣ Testing backend connectivity...');
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
  console.log('\n2️⃣ Testing auth endpoint...');
  try {
    const authResponse = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Auth endpoint status:', authResponse.status);
    if (authResponse.ok) {
      const userData = await authResponse.json();
      console.log('✅ Auth working - User:', userData.email || 'Unknown');
    } else {
      console.log('❌ Auth failed:', authResponse.status, authResponse.statusText);
      const errorText = await authResponse.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ Auth endpoint error:', error.message);
  }
  
  // Test 3: Test eBay search endpoint directly
  console.log('\n3️⃣ Testing eBay search endpoint...');
  try {
    const searchResponse = await fetch('/api/ebay/search?limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('eBay search status:', searchResponse.status);
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('✅ eBay search working - Items found:', searchData.items?.length || 0);
    } else {
      console.log('❌ eBay search failed:', searchResponse.status, searchResponse.statusText);
      const errorText = await searchResponse.text();
      console.log('Error details:', errorText);
      
      if (searchResponse.status === 500) {
        console.log('\n🚨 500 ERROR DETECTED!');
        console.log('This suggests a server-side issue. Possible causes:');
        console.log('• eBay API credentials not configured');
        console.log('• OAuth token invalid or expired');
        console.log('• Backend eBay service not properly initialized');
        console.log('• Database connection issues');
        console.log('• Missing environment variables');
      }
    }
  } catch (error) {
    console.error('❌ eBay search endpoint error:', error.message);
  }
  
  // Test 4: Test with different parameters
  console.log('\n4️⃣ Testing with minimal parameters...');
  try {
    const minimalResponse = await fetch('/api/ebay/search', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Minimal search status:', minimalResponse.status);
    
    if (minimalResponse.ok) {
      console.log('✅ Minimal search working');
    } else {
      const errorText = await minimalResponse.text();
      console.log('❌ Minimal search failed:', errorText);
    }
  } catch (error) {
    console.error('❌ Minimal search error:', error.message);
  }
  
  // Test 5: Check network tab
  console.log('\n5️⃣ Network Analysis:');
  console.log('💡 Open Developer Tools → Network tab');
  console.log('💡 Try loading the Auctions page again');
  console.log('💡 Look for the failed request to /api/ebay/search');
  console.log('💡 Check the Response tab for detailed error information');
  
  console.log('\n🏁 Debug complete!');
  console.log('If you see 500 errors, check your backend server logs for more details.');
}

// Run the debug
debug500Error();




















