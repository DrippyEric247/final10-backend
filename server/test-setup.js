const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function setupTestData() {
  try {
    console.log('🚀 Setting up test data...');

    // First, let's register a test user
    console.log('📝 Creating test user...');
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };

    try {
      const registerResponse = await axios.post(`${API_URL}/auth/signup`, userData);
      console.log('✅ Test user created:', registerResponse.data.message);
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('already in use')) {
        console.log('ℹ️  Test user already exists, proceeding...');
      } else {
        throw error;
      }
    }

    // Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: userData.email,
      password: userData.password
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Generate sample auction data
    console.log('🎯 Generating sample auction data...');
    console.log('Using token:', token ? 'Present' : 'Missing');
    
    try {
      const sampleDataResponse = await axios.post(
        `${API_URL}/scanner/generate-sample-data`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('✅ Sample data generated:', sampleDataResponse.data.message);
      console.log(`📊 Created ${sampleDataResponse.data.count} auctions`);
    } catch (error) {
      console.error('❌ Error generating sample data:', error.response?.data || error.message);
      throw error;
    }

    // Test the auctions endpoint
    console.log('🔍 Testing auctions endpoint...');
    const auctionsResponse = await axios.get(`${API_URL}/auctions`);
    console.log(`✅ Found ${auctionsResponse.data.auctions.length} auctions`);

    console.log('🎉 Test setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Navigate to the Auctions page');
    console.log('3. You should see the sample auction data');

  } catch (error) {
    console.error('❌ Error setting up test data:', error.response?.data || error.message);
  }
}

setupTestData();
