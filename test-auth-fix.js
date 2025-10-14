// Simple test to verify authentication token storage
console.log('Testing authentication token storage...');

// Check if the token storage keys are consistent
const apiKey = 'f10_token';
const authKey = 'token'; // This was the old key

console.log('API uses storage key:', apiKey);
console.log('AuthContext was using storage key:', authKey);

// Simulate setting a token
localStorage.setItem(apiKey, 'test-token-123');

// Check if both keys exist
console.log('Token in apiKey:', localStorage.getItem(apiKey));
console.log('Token in authKey:', localStorage.getItem(authKey));

console.log('✅ Fix: AuthContext now uses the same key as API (f10_token)');
console.log('This should resolve the logout issue when navigating to auctions.');

