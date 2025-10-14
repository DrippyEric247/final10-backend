// Utility function to clear invalid authentication data
export function clearInvalidAuth() {
  try {
    // Clear localStorage token
    localStorage.removeItem('f10_token');
    
    // Clear any other auth-related data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    
    // Clear sessionStorage as well
    sessionStorage.removeItem('f10_token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    
    console.log('✅ Cleared all authentication data from storage');
    
    // Reload the page to reset the app state
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
}

// Function to check if current token is valid
export async function validateCurrentToken() {
  try {
    const token = localStorage.getItem('f10_token');
    if (!token) {
      console.log('ℹ️ No token found in localStorage');
      return false;
    }
    
    // Test the token by making a request to /auth/me
    const response = await fetch('http://localhost:5000/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log('✅ Token is valid for user:', userData.username);
      return true;
    } else {
      console.log('❌ Token is invalid, status:', response.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error validating token:', error);
    return false;
  }
}

// Auto-clear invalid auth on import (for development) - DISABLED to prevent infinite refresh
// This was causing infinite refresh loops when token validation failed
// if (process.env.NODE_ENV === 'development') {
//   // Check token validity on page load
//   validateCurrentToken().then(isValid => {
//     if (!isValid) {
//       console.log('🧹 Invalid token detected, clearing auth data...');
//       clearInvalidAuth();
//     }
//   });
// }


