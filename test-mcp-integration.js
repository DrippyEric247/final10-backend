/**
 * Test script for MCP (Model Context Protocol) integration
 * Run this script to test the MCP connection with Render
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testMCPIntegration() {
  console.log('🧪 Testing MCP Integration with Render...\n');

  try {
    // Test 1: Test MCP connection
    console.log('1️⃣ Testing MCP connection...');
    const connectionTest = await axios.get(`${API_BASE}/mcp/test`);
    console.log('✅ Connection test result:', connectionTest.data);
    console.log('');

    // Test 2: Test with a sample service ID (this will likely fail but shows the structure)
    console.log('2️⃣ Testing deployment info (with sample service ID)...');
    try {
      const deploymentTest = await axios.get(`${API_BASE}/mcp/deployment/sample-service-id`);
      console.log('✅ Deployment test result:', deploymentTest.data);
    } catch (error) {
      console.log('⚠️  Deployment test failed (expected with sample ID):', error.response?.data || error.message);
    }
    console.log('');

    console.log('🎉 MCP integration test completed!');
    console.log('');
    console.log('📋 Available MCP endpoints:');
    console.log('   GET  /api/mcp/test                    - Test connection');
    console.log('   GET  /api/mcp/deployment/:serviceId   - Get deployment info');
    console.log('   POST /api/mcp/deploy/:serviceId       - Trigger deployment');
    console.log('   GET  /api/mcp/logs/:serviceId         - Get service logs');
    console.log('   GET  /api/mcp/metrics/:serviceId      - Get service metrics');

  } catch (error) {
    console.error('❌ MCP integration test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('💡 Make sure your server is running:');
      console.log('   cd server && npm run dev');
    }
  }
}

// Run the test
testMCPIntegration();




















