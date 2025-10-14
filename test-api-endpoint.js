const axios = require('axios');

async function testAPIEndpoint() {
  try {
    console.log('🧪 Testing API Endpoints...');
    
    // Test 1: Check if server is responding
    console.log('\n1️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get('http://localhost:5000/api/health');
      console.log('✅ Server is running:', healthResponse.data);
    } catch (error) {
      console.log('❌ Server health check failed:', error.message);
    }

    // Test 2: Test daily tasks endpoint without auth
    console.log('\n2️⃣ Testing daily tasks endpoint without auth...');
    try {
      const response = await axios.get('http://localhost:5000/api/auctions/daily-tasks');
      console.log('✅ Daily tasks endpoint accessible:', response.data);
    } catch (error) {
      console.log('❌ Daily tasks endpoint failed:', error.response?.status, error.response?.data);
    }

    // Test 3: Test watch ad endpoint without auth
    console.log('\n3️⃣ Testing watch ad endpoint without auth...');
    try {
      const response = await axios.post('http://localhost:5000/api/auctions/watch-ad');
      console.log('✅ Watch ad endpoint accessible:', response.data);
    } catch (error) {
      console.log('❌ Watch ad endpoint failed:', error.response?.status, error.response?.data);
    }

    // Test 4: Test with a mock token
    console.log('\n4️⃣ Testing with mock token...');
    try {
      const response = await axios.get('http://localhost:5000/api/auctions/daily-tasks', {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      });
      console.log('✅ Daily tasks with mock token:', response.data);
    } catch (error) {
      console.log('❌ Daily tasks with mock token failed:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIEndpoint();

