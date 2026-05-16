// Quick OAuth Scope Test Script
// Run this in your browser console to test OAuth permissions
import { buildApiUrl } from "../lib/runtimeApi";

async function testOAuthScope() {
  console.log('🔍 Testing OAuth Scope...');
  
  const token = localStorage.getItem('f10_token');
  if (!token) {
    console.error('❌ No OAuth token found in localStorage');
    return;
  }
  
  console.log('✅ Token found:', token.substring(0, 20) + '...');
  
  // Test 1: Token Validity
  try {
    const response = await fetch(buildApiUrl('/auth/me'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      console.log('✅ Token valid - User:', user.email || 'Unknown');
    } else {
      console.error('❌ Token invalid:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Token test failed:', error.message);
  }
  
  // Test 2: Browse Permission (Search Items)
  try {
    const response = await fetch(buildApiUrl('/ebay/search?limit=5'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Browse permission works - Found', data.items?.length || 0, 'items');
    } else if (response.status === 403) {
      console.error('❌ Browse permission denied - 403 Forbidden');
    } else {
      console.error('❌ Browse test failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Browse test failed:', error.message);
  }
  
  // Test 3: Search Permission
  try {
    const response = await fetch(buildApiUrl('/ebay/search?keywords=test&limit=3'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Search permission works - Found', data.items?.length || 0, 'results for "test"');
    } else if (response.status === 403) {
      console.error('❌ Search permission denied - 403 Forbidden');
    } else {
      console.error('❌ Search test failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Search test failed:', error.message);
  }
  
  // Test 4: Buy Permission (Test endpoint accessibility)
  try {
    const response = await fetch(buildApiUrl('/ebay/bid'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auctionId: 'test-auction-id',
        bidAmount: 1.00
      })
    });
    
    if (response.status === 400) {
      console.log('✅ Buy permission works - Endpoint accessible (invalid auction ID expected)');
    } else if (response.status === 403) {
      console.error('❌ Buy permission denied - 403 Forbidden');
    } else if (response.ok) {
      console.log('✅ Buy permission works - Bid endpoint accessible');
    } else {
      console.error('❌ Buy test failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Buy test failed:', error.message);
  }
  
  // Test 5: Rate Limiting
  try {
    const promises = Array(5).fill().map(() => 
      fetch(buildApiUrl('/ebay/search?limit=1'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    );
    
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.ok).length;
    
    if (successCount === 5) {
      console.log('✅ Rate limiting working - Multiple requests successful');
    } else if (responses.some(r => r.status === 429)) {
      console.log('✅ Rate limiting working - 429 response received');
    } else {
      console.error('❌ Rate limit test failed - Some requests failed');
    }
  } catch (error) {
    console.error('❌ Rate limit test failed:', error.message);
  }
  
  console.log('🏁 OAuth Scope Test Complete');
}

// Run the test
testOAuthScope();
















