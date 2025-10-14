const axios = require('axios');

async function testWelcomeSignup() {
  try {
    console.log('🧪 Testing signup with "welcome" referral code...');
    
    // Test signup with welcome referral code
    console.log('\n1️⃣ Testing signup with "welcome" referral code...');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/signup', {
        firstName: 'Test',
        lastName: 'User',
        username: 'test_welcome_user',
        email: 'test_welcome@example.com',
        password: 'password123',
        referralCode: 'welcome'
      });
      
      console.log('✅ Signup successful!');
      console.log(`- Username: ${response.data.user.username}`);
      console.log(`- Points: ${response.data.user.points}`);
      console.log(`- Membership Tier: ${response.data.user.membershipTier}`);
      console.log(`- Referral Code Used: ${response.data.user.referralCodeUsed}`);
      console.log(`- Token: ${response.data.token ? 'Generated' : 'None'}`);
      
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.message.includes('already in use')) {
        console.log('ℹ️ User already exists, trying with different email...');
        
        // Try with different email
        const response2 = await axios.post('http://localhost:5000/api/auth/signup', {
          firstName: 'Test',
          lastName: 'User2',
          username: 'test_welcome_user2',
          email: 'test_welcome2@example.com',
          password: 'password123',
          referralCode: 'welcome'
        });
        
        console.log('✅ Signup successful with different email!');
        console.log(`- Username: ${response2.data.user.username}`);
        console.log(`- Points: ${response2.data.user.points}`);
        console.log(`- Membership Tier: ${response2.data.user.membershipTier}`);
        console.log(`- Referral Code Used: ${response2.data.user.referralCodeUsed}`);
      } else {
        console.log('❌ Signup failed:', error.response?.data || error.message);
      }
    }
    
    // Test signup without referral code
    console.log('\n2️⃣ Testing signup without referral code...');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/signup', {
        firstName: 'Test',
        lastName: 'User3',
        username: 'test_no_referral',
        email: 'test_no_referral@example.com',
        password: 'password123'
      });
      
      console.log('✅ Signup successful!');
      console.log(`- Username: ${response.data.user.username}`);
      console.log(`- Points: ${response.data.user.points}`);
      console.log(`- Membership Tier: ${response.data.user.membershipTier}`);
      console.log(`- Referral Code Used: ${response.data.user.referralCodeUsed || 'None'}`);
      
    } catch (error) {
      console.log('❌ Signup failed:', error.response?.data || error.message);
    }
    
    // Test signup with invalid referral code
    console.log('\n3️⃣ Testing signup with invalid referral code...');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/signup', {
        firstName: 'Test',
        lastName: 'User4',
        username: 'test_invalid_referral',
        email: 'test_invalid_referral@example.com',
        password: 'password123',
        referralCode: 'invalid_code'
      });
      
      console.log('✅ Signup successful (invalid referral code ignored)!');
      console.log(`- Username: ${response.data.user.username}`);
      console.log(`- Points: ${response.data.user.points}`);
      console.log(`- Membership Tier: ${response.data.user.membershipTier}`);
      console.log(`- Referral Code Used: ${response.data.user.referralCodeUsed || 'None'}`);
      
    } catch (error) {
      console.log('❌ Signup failed:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWelcomeSignup();


