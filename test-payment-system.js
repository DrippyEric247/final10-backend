const axios = require('axios');

async function testPaymentSystem() {
  try {
    console.log('🧪 Testing Payment System...');
    
    // First, let's login to get a token
    console.log('\n1️⃣ Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'demo@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Test 1: Get available plans
    console.log('\n2️⃣ Testing get plans...');
    try {
      const response = await axios.get('http://localhost:5000/api/payments/plans');
      console.log('✅ Plans retrieved successfully:');
      response.data.plans.forEach(plan => {
        console.log(`- ${plan.name}: $${plan.price}/${plan.interval}`);
        console.log(`  Features: ${plan.features.join(', ')}`);
      });
    } catch (error) {
      console.log('❌ Get plans failed:', error.response?.data || error.message);
    }
    
    // Test 2: Get subscription status
    console.log('\n3️⃣ Testing subscription status...');
    try {
      const response = await axios.get('http://localhost:5000/api/payments/subscription-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Subscription status retrieved:');
      console.log(`- Is Premium: ${response.data.isPremium}`);
      console.log(`- Membership Tier: ${response.data.membershipTier}`);
      console.log(`- Days Remaining: ${response.data.daysRemaining}`);
    } catch (error) {
      console.log('❌ Subscription status failed:', error.response?.data || error.message);
    }
    
    // Test 3: Create payment intent (this will fail without Stripe keys, but we can test the endpoint)
    console.log('\n4️⃣ Testing create payment intent...');
    try {
      const response = await axios.post('http://localhost:5000/api/payments/create-payment-intent', {
        planId: 'monthly'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Payment intent created successfully');
      console.log(`- Client Secret: ${response.data.clientSecret ? 'Generated' : 'None'}`);
      console.log(`- Plan: ${response.data.plan.name} - $${response.data.plan.price}/${response.data.plan.interval}`);
    } catch (error) {
      if (error.response?.status === 500 && error.response.data.message.includes('Stripe')) {
        console.log('ℹ️ Payment intent creation failed (expected without Stripe keys):', error.response.data.message);
      } else {
        console.log('❌ Payment intent creation failed:', error.response?.data || error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPaymentSystem();


