// Test script to verify eBay API fix
// Run this in your browser console after the fixes are applied
import { buildApiUrl } from "../lib/runtimeApi";

async function testEbayFix() {
  console.log('🔧 Testing eBay API Fix...');
  
  const token = localStorage.getItem('f10_token');
  if (!token) {
    console.error('❌ No authentication token found');
    return;
  }
  
  console.log('✅ Authentication token found');
  
  // Test 1: Basic eBay search endpoint
  console.log('\n1️⃣ Testing eBay search endpoint...');
  try {
    const response = await fetch(buildApiUrl('/ebay/search?limit=5'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Search endpoint status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Search endpoint working!');
      console.log('Items found:', data.items?.length || 0);
      console.log('Pagination:', data.pagination);
    } else if (response.status === 401) {
      console.log('⚠️ Authentication required - this is expected if user is not logged in');
    } else {
      const errorData = await response.text();
      console.log('❌ Search endpoint failed:', response.status, errorData);
    }
  } catch (error) {
    console.error('❌ Search endpoint error:', error.message);
  }
  
  // Test 2: Trending endpoint
  console.log('\n2️⃣ Testing eBay trending endpoint...');
  try {
    const response = await fetch(buildApiUrl('/ebay/trending?limit=3'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Trending endpoint status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Trending endpoint working!');
      console.log('Trending items:', data.items?.length || 0);
      console.log('Categories:', data.categories?.length || 0);
    } else if (response.status === 401) {
      console.log('⚠️ Authentication required - this is expected if user is not logged in');
    } else {
      const errorData = await response.text();
      console.log('❌ Trending endpoint failed:', response.status, errorData);
    }
  } catch (error) {
    console.error('❌ Trending endpoint error:', error.message);
  }
  
  // Test 3: Categories endpoint
  console.log('\n3️⃣ Testing eBay categories endpoint...');
  try {
    const response = await fetch(buildApiUrl('/ebay/categories'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Categories endpoint status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Categories endpoint working!');
      console.log('Categories found:', data.categories?.length || 0);
    } else {
      const errorData = await response.text();
      console.log('❌ Categories endpoint failed:', response.status, errorData);
    }
  } catch (error) {
    console.error('❌ Categories endpoint error:', error.message);
  }
  
  console.log('\n🏁 eBay API Fix Test Complete!');
  console.log('\n📋 Summary:');
  console.log('• If you see 401 errors, make sure you are logged in');
  console.log('• If you see 200 responses with data, the fix is working!');
  console.log('• If you see 500 errors, there may still be backend issues');
  console.log('• Check your backend server logs for detailed error information');
}

// Run the test
testEbayFix();



























