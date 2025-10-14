const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function createSimpleAuction() {
  try {
    console.log('🚀 Creating a simple auction...');

    // First, let's register a test user
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123'
    };

    try {
      const registerResponse = await axios.post(`${API_URL}/auth/signup`, userData);
      console.log('✅ Test user created');
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('already in use')) {
        console.log('ℹ️  Test user already exists, proceeding...');
      } else {
        throw error;
      }
    }

    // Login to get token
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: userData.email,
      password: userData.password
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Create a simple auction
    const auctionData = {
      title: 'Test iPhone 14 Pro Max',
      description: 'A test auction for demonstration',
      category: 'electronics',
      condition: 'new',
      startingPrice: 800,
      buyItNowPrice: 1200,
      endTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      images: ['https://via.placeholder.com/400x300/000000/FFFFFF?text=iPhone+14+Pro+Max'],
      tags: ['iphone', 'apple', 'smartphone']
    };

    console.log('🎯 Creating auction...');
    const auctionResponse = await axios.post(
      `${API_URL}/auctions`,
      auctionData,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log('✅ Auction created:', auctionResponse.data.message);

    // Test the auctions endpoint
    console.log('🔍 Testing auctions endpoint...');
    const auctionsResponse = await axios.get(`${API_URL}/auctions`);
    console.log(`✅ Found ${auctionsResponse.data.auctions.length} auctions`);

    console.log('🎉 Test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Navigate to the Auctions page');
    console.log('3. You should see the test auction');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createSimpleAuction();











