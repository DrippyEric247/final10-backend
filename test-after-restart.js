const axios = require('axios');

async function testAfterRestart() {
  try {
    console.log('🧪 Testing After Server Restart...\n');
    console.log('Please restart both servers first using restart-servers.bat\n');
    console.log('Waiting 10 seconds for servers to start...\n');
    
    // Wait for servers to start
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test proxy login
    console.log('Testing login through proxy...');
    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      console.log('✅ Login through proxy successful!');
      console.log('   User:', response.data.user?.username);
      console.log('   Token:', response.data.token ? 'Present' : 'Missing');
    } catch (error) {
      console.log('❌ Login through proxy failed:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
      
      if (error.response?.status === 404) {
        console.log('\n🔧 Troubleshooting Steps:');
        console.log('   1. Make sure both servers are running');
        console.log('   2. Check that setupProxy.js is in the client directory');
        console.log('   3. Restart the React dev server to pick up proxy changes');
        console.log('   4. Verify no other proxy configuration in package.json');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAfterRestart();

