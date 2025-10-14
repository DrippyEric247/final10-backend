const axios = require('axios');

async function testProxyFix() {
  console.log('🧪 Testing Proxy Configuration...\n');
  
  // Test 1: Backend direct access
  console.log('1️⃣ Testing Backend Direct Access (port 5000)...');
  try {
    const backendResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'demo@final10.com',
      password: 'demo123'
    });
    console.log('✅ Backend working:', backendResponse.status, backendResponse.data.token ? 'Token received' : 'No token');
  } catch (error) {
    console.log('❌ Backend error:', error.message);
    return;
  }
  
  // Test 2: Frontend proxy access
  console.log('\n2️⃣ Testing Frontend Proxy Access (port 3000)...');
  try {
    const frontendResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'demo@final10.com',
      password: 'demo123'
    });
    console.log('✅ Frontend proxy working:', frontendResponse.status, frontendResponse.data.token ? 'Token received' : 'No token');
  } catch (error) {
    console.log('❌ Frontend proxy error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. If backend works but frontend proxy fails:');
  console.log('   - Stop frontend server (Ctrl+C)');
  console.log('   - Restart frontend: cd client && npm start');
  console.log('   - Look for "🔧 Loading setupProxy.js..." in console');
  console.log('2. If both fail:');
  console.log('   - Stop all servers');
  console.log('   - Start backend: cd server && npm start');
  console.log('   - Start frontend: cd client && npm start');
}

testProxyFix().catch(console.error);
