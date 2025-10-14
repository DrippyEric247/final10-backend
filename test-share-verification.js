const axios = require('axios');

async function testShareVerification() {
  try {
    console.log('🧪 Testing Share Verification System...');
    
    // First, let's login to get a token
    console.log('\n1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'demo@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Test 1: Try to share app without URL (should fail)
    console.log('\n2️⃣ Testing app share without URL (should fail)...');
    try {
      await axios.post('http://localhost:5000/api/auctions/track-app-share', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('❌ Should have failed but succeeded');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correctly rejected: ' + error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }
    
    // Test 2: Try to share app with invalid URL (should fail)
    console.log('\n3️⃣ Testing app share with invalid URL (should fail)...');
    try {
      await axios.post('http://localhost:5000/api/auctions/track-app-share', {
        shareUrl: 'https://invalid-url.com',
        platform: 'invalid'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('❌ Should have failed but succeeded');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correctly rejected: ' + error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }
    
    // Test 3: Try to share app with valid URL (should succeed)
    console.log('\n4️⃣ Testing app share with valid URL (should succeed)...');
    try {
      const response = await axios.post('http://localhost:5000/api/auctions/track-app-share', {
        shareUrl: 'https://twitter.com/user/status/1234567890',
        platform: 'twitter'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Share verified successfully:', response.data.message);
    } catch (error) {
      console.log('❌ Valid share failed:', error.response?.data);
    }
    
    // Test 4: Try social media post without hashtags (should fail)
    console.log('\n5️⃣ Testing social post without hashtags (should fail)...');
    try {
      await axios.post('http://localhost:5000/api/auctions/complete-social-post', {
        platform: 'twitter',
        postUrl: 'https://twitter.com/user/status/1234567890'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('❌ Should have failed but succeeded');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correctly rejected: ' + error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }
    
    // Test 5: Try social media post with hashtags (should succeed)
    console.log('\n6️⃣ Testing social post with hashtags (should succeed)...');
    try {
      const response = await axios.post('http://localhost:5000/api/auctions/complete-social-post', {
        platform: 'twitter',
        postUrl: 'https://twitter.com/user/status/1234567890?hashtag=StayEarning'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Social post verified successfully:', response.data.message);
    } catch (error) {
      console.log('❌ Valid social post failed:', error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testShareVerification();


