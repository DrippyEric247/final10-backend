const axios = require('axios');

async function testProxyLogin() {
  try {
    console.log('🧪 Testing Login Through Proxy...\n');

    // Test 1: Direct backend access (should work)
    console.log('1️⃣ Testing direct backend access...');
    try {
      const directResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      console.log('✅ Direct backend access works');
      console.log('   User:', directResponse.data.user?.username);
    } catch (error) {
      console.log('❌ Direct backend access failed:', error.message);
    }

    // Test 2: Through React dev server proxy (should work)
    console.log('\n2️⃣ Testing through React dev server proxy...');
    try {
      const proxyResponse = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      console.log('✅ Proxy access works');
      console.log('   User:', proxyResponse.data.user?.username);
    } catch (error) {
      console.log('❌ Proxy access failed:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
      console.log('   URL:', error.config?.url);
      
      if (error.response?.status === 404) {
        console.log('\n🔍 404 Error Analysis:');
        console.log('   - The proxy might not be configured correctly');
        console.log('   - Check if setupProxy.js is in the client directory');
        console.log('   - Verify the proxy is only handling /api routes');
      }
    }

    // Test 3: Check if React dev server is serving static files
    console.log('\n3️⃣ Testing React dev server static files...');
    try {
      const staticResponse = await axios.get('http://localhost:3000/');
      console.log('✅ React dev server is serving static files');
      console.log('   Status:', staticResponse.status);
    } catch (error) {
      console.log('❌ React dev server static files failed:', error.message);
    }

    // Test 4: Check proxy configuration
    console.log('\n4️⃣ Testing proxy configuration...');
    try {
      // Try to access a non-API route (should be served by React)
      const nonApiResponse = await axios.get('http://localhost:3000/some-non-api-route');
      console.log('❌ Non-API route was served by React (unexpected)');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Non-API routes properly return 404 (React routing)');
      } else {
        console.log('❌ Unexpected response for non-API route:', error.response?.status);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProxyLogin();

