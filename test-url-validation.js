// Test URL validation
function testUrlValidation() {
  const testUrl = 'http://localhost:3003/api/health';
  
  try {
    const urlObj = new URL(testUrl);
    console.log('URL object:', {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname
    });
    
    // Test the validation logic
    const allowedHosts = [
      'proofvault.net',
      'proofvault.com', 
      'api.proofvault.com',
      'localhost',
      '127.0.0.1'
    ];
    
    const isAllowed = allowedHosts.some(host => urlObj.hostname === host);
    console.log('Is allowed:', isAllowed);
    console.log('Hostname matches localhost:', urlObj.hostname === 'localhost');
    
  } catch (error) {
    console.error('URL validation test failed:', error);
  }
}

testUrlValidation();