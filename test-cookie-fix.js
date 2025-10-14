// Test script to verify cookie expiration format fix
const express = require('express');
const app = express();

// Import the fixed cookie security middleware
const { cookieSecurity } = require('./server/middleware/security');

// Apply the middleware
app.use(cookieSecurity);

// Test route that sets a cookie
app.get('/test-cookie', (req, res) => {
  // Test with maxAge (should work)
  res.cookie('test1', 'value1', { maxAge: 24 * 60 * 60 * 1000 });
  
  // Test with expires as Date object (should work)
  res.cookie('test2', 'value2', { expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  
  // Test with expires as string (should be converted to Date)
  res.cookie('test3', 'value3', { expires: '2024-12-31' });
  
  // Test with invalid expires (should fallback to maxAge)
  res.cookie('test4', 'value4', { expires: 'invalid-date' });
  
  res.json({ message: 'Cookies set successfully' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test the cookie fix at: http://localhost:3001/test-cookie');
  console.log('Check the response headers for proper cookie expiration formats');
});

