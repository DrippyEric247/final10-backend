const axios = require('axios');

async function testMockPayment() {
  try {
    console.log('🧪 Testing Mock Payment System...');
    
    // First, let's login to get a token
    console.log('\n1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'demo@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Test mock payment confirmation
    console.log('\n2️⃣ Testing mock payment confirmation...');
    try {
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;
      const response = await axios.post('http://localhost:5000/api/payments/confirm-payment', {
        paymentIntentId: mockPaymentIntentId
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('✅ Mock payment confirmed successfully!');
      console.log(`- Message: ${response.data.message}`);
      console.log(`- Subscription Expires: ${response.data.subscriptionExpires}`);
      console.log(`- Bonus Points: ${response.data.bonusPoints}`);
      
    } catch (error) {
      console.log('❌ Mock payment confirmation failed:', error.response?.data || error.message);
    }
    
    // Check updated subscription status
    console.log('\n3️⃣ Checking updated subscription status...');
    try {
      const response = await axios.get('http://localhost:5000/api/payments/subscription-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Updated subscription status:');
      console.log(`- Is Premium: ${response.data.isPremium}`);
      console.log(`- Membership Tier: ${response.data.membershipTier}`);
      console.log(`- Days Remaining: ${response.data.daysRemaining}`);
    } catch (error) {
      console.log('❌ Subscription status check failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMockPayment();


