#!/usr/bin/env node
const http = require('http');

// Test API endpoints
const tests = [
  {
    name: 'Health Check',
    path: '/api/health',
    method: 'GET'
  },
  {
    name: 'PDF List',
    path: '/api/pdf/list',
    method: 'GET'
  },
  {
    name: 'PDF List with Search',
    path: '/api/pdf/list?search=test&page=1&limit=5',
    method: 'GET'
  },
  {
    name: 'PDF Stats',
    path: '/api/pdf/stats',
    method: 'GET'
  }
];

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing ProofVault API endpoints...\n');
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`Request: ${test.method} ${test.path}`);
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: test.path,
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const result = await makeRequest(options);
      
      console.log(`Status: ${result.status}`);
      console.log(`Response structure:`, typeof result.data === 'object' ? Object.keys(result.data) : 'String');
      
      if (result.data && typeof result.data === 'object') {
        console.log(`Success field: ${result.data.success}`);
        console.log(`Status field: ${result.data.status}`);
      }
      
      console.log('✅ Test completed\n');
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}\n`);
    }
  }
  
  console.log('🏁 All tests completed');
}

// Check if API server is running first
const serverCheck = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

makeRequest(serverCheck)
  .then(() => runTests())
  .catch(() => {
    console.log('❌ API server is not running on localhost:3000');
    console.log('Please start the API server first with: cd api && npm start');
  });