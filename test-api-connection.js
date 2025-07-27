// Test script to verify API connectivity from Chrome extension context
const API_CONFIG = {
  BASE_URL: 'http://localhost:3003/api',
  ENDPOINTS: {
    HEALTH: '/health'
  },
  TIMEOUT: 5000
};

async function testConnection() {
  try {
    console.log('Testing connection to:', API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.HEALTH);
    
    const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.HEALTH, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! API Response:', data);
      return true;
    } else {
      console.error('API returned error status:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('Connection failed:', error);
    return false;
  }
}

// Run the test
testConnection();