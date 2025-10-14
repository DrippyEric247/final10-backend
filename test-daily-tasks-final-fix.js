const axios = require('axios');

async function testDailyTasksFinalFix() {
  try {
    console.log('🧪 Testing Daily Tasks Endpoint After Server Restart...');
    
    // First, let's try to login to get a token
    console.log('\n1️⃣ Attempting to login...');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@example.com',
        password: 'password123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful, token received');
      
      // Now test the daily tasks endpoint with authentication
      console.log('\n2️⃣ Testing /api/auctions/daily-tasks with auth...');
      try {
        const response = await axios.get('http://localhost:5000/api/auctions/daily-tasks', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('✅ Daily tasks endpoint works!');
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
      } catch (error) {
        if (error.response?.status === 500) {
          console.log('❌ Daily tasks endpoint has 500 error:', error.response.data);
        } else {
          console.log('❌ Daily tasks endpoint error:', error.response?.status, error.response?.data);
        }
      }
      
    } catch (loginError) {
      console.log('❌ Login failed:', loginError.response?.status, loginError.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDailyTasksFinalFix();
