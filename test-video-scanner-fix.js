const axios = require('axios');

async function testVideoScannerFix() {
  try {
    console.log('🧪 Testing Video Scanner Endpoint Fix...');
    
    // Test the correct endpoint path
    console.log('\n1️⃣ Testing /api/scanner/video endpoint...');
    try {
      // Test without auth first to see if endpoint exists
      const response = await axios.get('http://localhost:5000/api/scanner/video', {
        params: {
          url: 'https://www.tiktok.com/@user/video/1234567890'
        }
      });
      
      console.log('✅ Endpoint exists and works:', response.data);
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Endpoint exists (401 auth required):', error.response.data);
      } else {
        console.log('❌ Endpoint issue:', error.response?.status, error.response?.data);
      }
    }

    // Test the old incorrect endpoint to confirm it doesn't work
    console.log('\n2️⃣ Testing old /api/scan/video endpoint (should fail)...');
    try {
      const response = await axios.get('http://localhost:5000/api/scan/video', {
        params: {
          url: 'https://www.tiktok.com/@user/video/1234567890'
        }
      });
      
      console.log('❌ Old endpoint still works (unexpected):', response.data);
      
    } catch (error) {
      console.log('✅ Old endpoint correctly fails:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVideoScannerFix();
