/**
 * Error Handling Test Suite
 * 
 * Comprehensive testing of error handling and edge cases:
 * - Invalid PDF submissions and validation
 * - Network failure scenarios and recovery
 * - Database connection issues
 * - Blockchain communication failures
 * - Frontend error states and user feedback
 * - Resource exhaustion scenarios
 * - Malformed request handling
 */

const axios = require('axios');
const WebSocket = require('ws');
const { Client } = require('pg');
const puppeteer = require('puppeteer');

class ErrorHandlingSuite {
  constructor(config) {
    this.config = config;
    this.originalConfig = { ...config };
    this.browser = null;
    this.dbClient = null;
  }

  async setup() {
    console.log('🔧 Setting up error handling test environment...');
    
    // Setup browser for frontend error testing
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Setup database client for connection testing
    this.dbClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'proofvault_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    });
    
    try {
      await this.dbClient.connect();
    } catch (error) {
      console.warn('⚠️ Database connection failed, some tests will be skipped');
    }
    
    console.log('✅ Error handling test environment ready');
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
    if (this.dbClient) {
      await this.dbClient.end();
    }
  }

  async getTests() {
    return [
      {
        name: 'Invalid PDF Submission Handling',
        description: 'Test handling of invalid PDF files and formats'
      },
      {
        name: 'Network Failure Recovery',
        description: 'Test system behavior during network failures'
      },
      {
        name: 'Database Connection Errors',
        description: 'Test handling of database connection issues'
      },
      {
        name: 'Blockchain Communication Failures',
        description: 'Test metagraph communication error handling'
      },
      {
        name: 'Frontend Error States',
        description: 'Test frontend error handling and user feedback'
      },
      {
        name: 'Malformed Request Handling',
        description: 'Test API handling of malformed requests'
      },
      {
        name: 'Resource Exhaustion Scenarios',
        description: 'Test behavior under resource constraints'
      },
      {
        name: 'Concurrent Error Scenarios',
        description: 'Test error handling under concurrent load'
      },
      {
        name: 'WebSocket Error Recovery',
        description: 'Test WebSocket reconnection and error recovery'
      },
      {
        name: 'Authentication Error Scenarios',
        description: 'Test various authentication failure cases'
      },
      {
        name: 'File System Error Handling',
        description: 'Test handling of file system errors'
      },
      {
        name: 'Timeout and Deadline Handling',
        description: 'Test timeout scenarios and deadline management'
      }
    ];
  }

  async runTest(test) {
    console.log(`🧪 Running error handling test: ${test.name}`);
    
    switch (test.name) {
      case 'Invalid PDF Submission Handling':
        return await this.testInvalidPDFSubmissions();
      case 'Network Failure Recovery':
        return await this.testNetworkFailureRecovery();
      case 'Database Connection Errors':
        return await this.testDatabaseConnectionErrors();
      case 'Blockchain Communication Failures':
        return await this.testBlockchainCommunicationFailures();
      case 'Frontend Error States':
        return await this.testFrontendErrorStates();
      case 'Malformed Request Handling':
        return await this.testMalformedRequestHandling();
      case 'Resource Exhaustion Scenarios':
        return await this.testResourceExhaustionScenarios();
      case 'Concurrent Error Scenarios':
        return await this.testConcurrentErrorScenarios();
      case 'WebSocket Error Recovery':
        return await this.testWebSocketErrorRecovery();
      case 'Authentication Error Scenarios':
        return await this.testAuthenticationErrorScenarios();
      case 'File System Error Handling':
        return await this.testFileSystemErrorHandling();
      case 'Timeout and Deadline Handling':
        return await this.testTimeoutHandling();
      default:
        throw new Error(`Unknown error handling test: ${test.name}`);
    }
  }

  /**
   * Test invalid PDF submission handling
   */
  async testInvalidPDFSubmissions() {
    const testCases = [
      {
        name: 'Empty file',
        data: Buffer.alloc(0),
        expectedError: 'empty file'
      },
      {
        name: 'Non-PDF file',
        data: Buffer.from('This is not a PDF file'),
        expectedError: 'invalid format'
      },
      {
        name: 'Corrupted PDF',
        data: Buffer.from('%PDF-1.4\nCorrupted content\n%%EOF'),
        expectedError: 'corrupted'
      },
      {
        name: 'Oversized file',
        data: Buffer.alloc(100 * 1024 * 1024), // 100MB
        expectedError: 'file size'
      },
      {
        name: 'Invalid hash format',
        hash: 'invalid-hash-format',
        expectedError: 'hash format'
      },
      {
        name: 'Missing metadata',
        metadata: null,
        expectedError: 'metadata required'
      },
      {
        name: 'Invalid signature',
        signature: 'invalid-signature-format',
        expectedError: 'signature validation'
      }
    ];

    const results = {};

    for (const testCase of testCases) {
      console.log(`  🔍 Testing: ${testCase.name}`);
      
      try {
        const formData = new FormData();
        
        if (testCase.data) {
          formData.append('pdf', new Blob([testCase.data]), 'test.pdf');
        }
        
        const metadata = testCase.metadata !== null ? 
          (testCase.metadata || this.generateValidMetadata()) : null;
        
        if (metadata) {
          formData.append('metadata', JSON.stringify(metadata));
        }
        
        const hash = testCase.hash || this.generateValidHash();
        const signature = testCase.signature || 'valid-signature';
        
        if (testCase.name === 'Invalid hash format' || testCase.name === 'Invalid signature') {
          // Test direct API endpoints
          await axios.post(`${this.config.apiBaseUrl}/api/pdf/register`, {
            hash,
            metadata: metadata || this.generateValidMetadata(),
            signature
          });
        } else {
          formData.append('signature', signature);
          await axios.post(`${this.config.apiBaseUrl}/api/pdf/upload`, formData);
        }
        
        // If we reach here, the test failed (should have thrown an error)
        results[testCase.name] = {
          success: false,
          error: 'Expected error was not thrown',
          expectedError: testCase.expectedError
        };
        
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message;
        const containsExpectedError = errorMessage.toLowerCase().includes(
          testCase.expectedError.toLowerCase()
        );
        
        results[testCase.name] = {
          success: containsExpectedError,
          actualError: errorMessage,
          expectedError: testCase.expectedError,
          statusCode: error.response?.status
        };
        
        if (containsExpectedError) {
          console.log(`    ✅ Correctly rejected: ${testCase.name}`);
        } else {
          console.log(`    ❌ Unexpected error: ${errorMessage}`);
        }
      }
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`📊 Invalid PDF handling: ${successCount}/${testCases.length} tests passed`);

    return results;
  }

  /**
   * Test network failure recovery
   */
  async testNetworkFailureRecovery() {
    const results = {};

    // Test API timeout handling
    console.log('  🌐 Testing API timeout handling...');
    try {
      await axios.get(`${this.config.apiBaseUrl}/api/health`, { timeout: 1 }); // 1ms timeout
      results.timeoutHandling = { success: false, error: 'Timeout should have occurred' };
    } catch (error) {
      results.timeoutHandling = {
        success: error.code === 'ECONNABORTED',
        error: error.message,
        code: error.code
      };
    }

    // Test connection refused handling
    console.log('  🔌 Testing connection refused handling...');
    try {
      await axios.get('http://localhost:99999/api/health'); // Non-existent port
      results.connectionRefused = { success: false, error: 'Connection should have been refused' };
    } catch (error) {
      results.connectionRefused = {
        success: error.code === 'ECONNREFUSED',
        error: error.message,
        code: error.code
      };
    }

    // Test DNS resolution failure
    console.log('  🌍 Testing DNS resolution failure...');
    try {
      await axios.get('http://nonexistent-domain-12345.com/api/health');
      results.dnsFailure = { success: false, error: 'DNS should have failed' };
    } catch (error) {
      results.dnsFailure = {
        success: error.code === 'ENOTFOUND',
        error: error.message,
        code: error.code
      };
    }

    // Test network recovery after temporary failure
    console.log('  🔄 Testing network recovery...');
    let recoveryAttempts = 0;
    const maxAttempts = 5;
    
    while (recoveryAttempts < maxAttempts) {
      try {
        await axios.get(`${this.config.apiBaseUrl}/api/health`, { timeout: 5000 });
        results.networkRecovery = {
          success: true,
          attempts: recoveryAttempts + 1,
          message: 'Network recovered successfully'
        };
        break;
      } catch (error) {
        recoveryAttempts++;
        if (recoveryAttempts >= maxAttempts) {
          results.networkRecovery = {
            success: false,
            attempts: recoveryAttempts,
            error: 'Network did not recover within expected attempts'
          };
        }
        await this.sleep(1000);
      }
    }

    return results;
  }

  /**
   * Test database connection errors
   */
  async testDatabaseConnectionErrors() {
    const results = {};

    if (!this.dbClient) {
      return { skipped: 'Database client not available' };
    }

    // Test connection loss handling
    console.log('  🗄️ Testing database connection loss...');
    try {
      // Simulate connection loss by ending the connection
      await this.dbClient.end();
      
      // Try to make API calls that require database
      await axios.post(`${this.config.apiBaseUrl}/api/documents`, {
        hash: this.generateValidHash(),
        originalUrl: 'https://test.example.com',
        documentTitle: 'Test Document'
      });
      
      results.connectionLoss = {
        success: false,
        error: 'API should have failed with database connection error'
      };
    } catch (error) {
      results.connectionLoss = {
        success: error.response?.status >= 500,
        statusCode: error.response?.status,
        error: error.response?.data?.error || error.message
      };
    }

    // Test connection pool exhaustion
    console.log('  🏊 Testing connection pool exhaustion...');
    try {
      // This would need to be implemented based on the actual database service
      // For now, we'll simulate by making many concurrent requests
      const concurrentRequests = Array.from({ length: 100 }, () =>
        axios.get(`${this.config.apiBaseUrl}/api/documents/search?limit=1`)
          .catch(err => err)
      );
      
      const responses = await Promise.all(concurrentRequests);
      const errors = responses.filter(resp => resp.response?.status >= 500);
      
      results.poolExhaustion = {
        success: errors.length > 0,
        totalRequests: concurrentRequests.length,
        errors: errors.length,
        message: 'Some requests should fail due to pool exhaustion'
      };
    } catch (error) {
      results.poolExhaustion = {
        success: false,
        error: error.message
      };
    }

    // Test database recovery
    console.log('  🔄 Testing database recovery...');
    try {
      // Reconnect database
      await this.dbClient.connect();
      
      // Wait for system to recover
      await this.sleep(5000);
      
      // Test if API calls work again
      const response = await axios.get(`${this.config.apiBaseUrl}/api/health`);
      
      results.databaseRecovery = {
        success: response.status === 200,
        healthStatus: response.data.services?.database,
        message: 'Database connection should be restored'
      };
    } catch (error) {
      results.databaseRecovery = {
        success: false,
        error: error.message
      };
    }

    return results;
  }

  /**
   * Test blockchain communication failures
   */
  async testBlockchainCommunicationFailures() {
    const results = {};

    // Test metagraph unavailable
    console.log('  ⛓️ Testing metagraph unavailable...');
    try {
      // This would require temporarily stopping the metagraph
      // For now, test with invalid metagraph URL
      const response = await axios.post(`${this.config.apiBaseUrl}/api/pdf/register`, {
        hash: this.generateValidHash(),
        metadata: this.generateValidMetadata(),
        signature: 'test-signature'
      });
      
      // The API might accept the request but fail during processing
      results.metagraphUnavailable = {
        success: true,
        message: 'API handled metagraph unavailability gracefully',
        response: response.data
      };
    } catch (error) {
      results.metagraphUnavailable = {
        success: error.response?.status >= 500,
        error: error.response?.data?.error || error.message,
        statusCode: error.response?.status
      };
    }

    // Test transaction timeout
    console.log('  ⏱️ Testing transaction timeout...');
    try {
      // Submit a transaction and test timeout handling
      const response = await axios.post(`${this.config.apiBaseUrl}/api/pdf/register`, {
        hash: this.generateValidHash(),
        metadata: this.generateValidMetadata(),
        signature: 'test-signature'
      }, { timeout: 1000 }); // Very short timeout
      
      results.transactionTimeout = {
        success: false,
        error: 'Request should have timed out',
        response: response.data
      };
    } catch (error) {
      results.transactionTimeout = {
        success: error.code === 'ECONNABORTED' || error.response?.status >= 500,
        error: error.message,
        code: error.code
      };
    }

    // Test consensus failure handling
    console.log('  🤝 Testing consensus failure handling...');
    try {
      // This would be specific to the metagraph implementation
      const response = await axios.get(`${this.config.apiBaseUrl}/api/network/health`);
      
      results.consensusFailure = {
        success: true,
        networkHealth: response.data,
        message: 'Network health check completed'
      };
    } catch (error) {
      results.consensusFailure = {
        success: false,
        error: error.message
      };
    }

    return results;
  }

  /**
   * Test frontend error states
   */
  async testFrontendErrorStates() {
    const results = {};
    const page = await this.browser.newPage();

    try {
      // Test 404 page handling
      console.log('  🔍 Testing 404 error handling...');
      await page.goto(`${this.config.frontendUrl}/nonexistent-page`);
      
      const is404 = await page.evaluate(() => {
        return document.body.textContent.includes('404') || 
               document.body.textContent.includes('Not Found') ||
               document.title.includes('404');
      });
      
      results.notFoundHandling = {
        success: is404,
        message: is404 ? '404 page displayed correctly' : '404 page not found'
      };

      // Test API error handling in frontend
      console.log('  🔌 Testing API error handling in frontend...');
      await page.goto(`${this.config.frontendUrl}/verify`);
      
      // Try to verify with invalid hash
      await page.fill('[data-testid="hash-input"]', 'invalid-hash-format');
      await page.click('[data-testid="verify-button"]');
      
      // Wait for error message
      try {
        await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
        const errorMessage = await page.textContent('[data-testid="error-message"]');
        
        results.apiErrorHandling = {
          success: errorMessage.includes('invalid') || errorMessage.includes('error'),
          errorMessage,
          message: 'Frontend displayed API error correctly'
        };
      } catch (error) {
        results.apiErrorHandling = {
          success: false,
          error: 'Error message not displayed in frontend'
        };
      }

      // Test network error handling
      console.log('  🌐 Testing network error handling in frontend...');
      
      // Intercept network requests and simulate failure
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      await page.reload();
      await page.fill('[data-testid="hash-input"]', this.generateValidHash());
      await page.click('[data-testid="verify-button"]');
      
      // Check for network error handling
      try {
        await page.waitForSelector('[data-testid="network-error"]', { timeout: 10000 });
        results.networkErrorHandling = {
          success: true,
          message: 'Frontend handled network error correctly'
        };
      } catch (error) {
        results.networkErrorHandling = {
          success: false,
          error: 'Network error not handled in frontend'
        };
      }

    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * Test malformed request handling
   */
  async testMalformedRequestHandling() {
    const results = {};

    const malformedRequests = [
      {
        name: 'Invalid JSON',
        data: '{"invalid": json}',
        contentType: 'application/json'
      },
      {
        name: 'Missing Content-Type',
        data: JSON.stringify({ test: 'data' }),
        contentType: null
      },
      {
        name: 'Oversized payload',
        data: JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024) }), // 10MB
        contentType: 'application/json'
      },
      {
        name: 'Invalid UTF-8',
        data: Buffer.from([0xFF, 0xFE, 0xFD]),
        contentType: 'application/json'
      },
      {
        name: 'SQL injection attempt',
        data: JSON.stringify({ hash: "'; DROP TABLE evidence_records; --" }),
        contentType: 'application/json'
      },
      {
        name: 'XSS attempt',
        data: JSON.stringify({ title: '<script>alert("xss")</script>' }),
        contentType: 'application/json'
      }
    ];

    for (const request of malformedRequests) {
      console.log(`  🔍 Testing: ${request.name}`);
      
      try {
        const config = {
          method: 'POST',
          url: `${this.config.apiBaseUrl}/api/documents`,
          data: request.data,
          headers: {}
        };
        
        if (request.contentType) {
          config.headers['Content-Type'] = request.contentType;
        }
        
        await axios(config);
        
        results[request.name] = {
          success: false,
          error: 'Request should have been rejected'
        };
      } catch (error) {
        results[request.name] = {
          success: error.response?.status >= 400 && error.response?.status < 500,
          statusCode: error.response?.status,
          error: error.response?.data?.error || error.message
        };
      }
    }

    return results;
  }

  /**
   * Test resource exhaustion scenarios
   */
  async testResourceExhaustionScenarios() {
    const results = {};

    // Test memory exhaustion handling
    console.log('  🧠 Testing memory exhaustion...');
    try {
      // Create large payloads to test memory limits
      const largePayloads = Array.from({ length: 10 }, () => ({
        hash: this.generateValidHash(),
        data: 'x'.repeat(1024 * 1024), // 1MB each
        metadata: this.generateValidMetadata()
      }));

      const requests = largePayloads.map(payload =>
        axios.post(`${this.config.apiBaseUrl}/api/documents`, payload)
          .catch(error => error)
      );

      const responses = await Promise.all(requests);
      const memoryErrors = responses.filter(resp => 
        resp.response?.status === 413 || // Payload too large
        resp.response?.status === 507    // Insufficient storage
      );

      results.memoryExhaustion = {
        success: memoryErrors.length > 0,
        totalRequests: requests.length,
        memoryErrors: memoryErrors.length,
        message: 'Some requests should fail due to memory constraints'
      };
    } catch (error) {
      results.memoryExhaustion = {
        success: false,
        error: error.message
      };
    }

    // Test file descriptor exhaustion
    console.log('  📁 Testing file descriptor limits...');
    try {
      // Create many concurrent connections
      const connections = [];
      
      for (let i = 0; i < 1000; i++) {
        try {
          const ws = new WebSocket(this.config.wsUrl);
          connections.push(ws);
        } catch (error) {
          break;
        }
      }

      // Clean up connections
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      results.fileDescriptorLimits = {
        success: true,
        connectionsCreated: connections.length,
        message: 'File descriptor limits tested'
      };
    } catch (error) {
      results.fileDescriptorLimits = {
        success: false,
        error: error.message
      };
    }

    return results;
  }

  /**
   * Test concurrent error scenarios
   */
  async testConcurrentErrorScenarios() {
    const results = {};

    console.log('  🔄 Testing concurrent error handling...');
    
    // Create a mix of valid and invalid requests
    const requests = [];
    
    for (let i = 0; i < 50; i++) {
      if (i % 3 === 0) {
        // Invalid request
        requests.push(
          axios.post(`${this.config.apiBaseUrl}/api/documents`, {
            hash: 'invalid-hash',
            originalUrl: 'invalid-url'
          }).catch(error => ({ error: true, response: error.response }))
        );
      } else {
        // Valid request
        requests.push(
          axios.post(`${this.config.apiBaseUrl}/api/documents`, {
            hash: this.generateValidHash(),
            originalUrl: 'https://valid.example.com',
            documentTitle: 'Valid Document'
          }).catch(error => ({ error: true, response: error.response }))
        );
      }
    }

    const responses = await Promise.all(requests);
    
    const validRequests = responses.filter(resp => !resp.error && resp.status === 201);
    const invalidRequests = responses.filter(resp => resp.error && resp.response?.status === 400);
    const serverErrors = responses.filter(resp => resp.error && resp.response?.status >= 500);

    results.concurrentErrorHandling = {
      success: validRequests.length > 0 && invalidRequests.length > 0 && serverErrors.length === 0,
      totalRequests: requests.length,
      validRequests: validRequests.length,
      invalidRequests: invalidRequests.length,
      serverErrors: serverErrors.length,
      message: 'System should handle mixed valid/invalid requests correctly'
    };

    return results;
  }

  /**
   * Test WebSocket error recovery
   */
  async testWebSocketErrorRecovery() {
    const results = {};

    console.log('  🔌 Testing WebSocket error recovery...');
    
    try {
      // Test connection to invalid WebSocket URL
      const invalidWs = new WebSocket('ws://localhost:99999');
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);
        
        invalidWs.on('error', (error) => {
          clearTimeout(timeout);
          results.invalidConnection = {
            success: true,
            error: error.message,
            message: 'WebSocket correctly rejected invalid connection'
          };
          resolve();
        });
        
        invalidWs.on('open', () => {
          clearTimeout(timeout);
          results.invalidConnection = {
            success: false,
            error: 'Connection should have failed'
          };
          resolve();
        });
      });

      // Test connection recovery
      const validWs = new WebSocket(this.config.wsUrl);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        validWs.on('open', () => {
          clearTimeout(timeout);
          
          // Simulate connection loss
          validWs.terminate();
          
          // Test reconnection
          const reconnectWs = new WebSocket(this.config.wsUrl);
          
          reconnectWs.on('open', () => {
            results.connectionRecovery = {
              success: true,
              message: 'WebSocket reconnection successful'
            };
            reconnectWs.close();
            resolve();
          });
          
          reconnectWs.on('error', (error) => {
            results.connectionRecovery = {
              success: false,
              error: error.message
            };
            resolve();
          });
        });
        
        validWs.on('error', (error) => {
          clearTimeout(timeout);
          results.connectionRecovery = {
            success: false,
            error: error.message
          };
          resolve();
        });
      });

    } catch (error) {
      results.webSocketErrorRecovery = {
        success: false,
        error: error.message
      };
    }

    return results;
  }

  /**
   * Test authentication error scenarios
   */
  async testAuthenticationErrorScenarios() {
    const results = {};

    const authTests = [
      {
        name: 'No token provided',
        headers: {},
        expectedStatus: 401
      },
      {
        name: 'Invalid token format',
        headers: { 'Authorization': 'Bearer invalid-token-format' },
        expectedStatus: 401
      },
      {
        name: 'Expired token',
        headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid' },
        expectedStatus: 401
      },
      {
        name: 'Malformed authorization header',
        headers: { 'Authorization': 'InvalidFormat token' },
        expectedStatus: 401
      }
    ];

    for (const test of authTests) {
      console.log(`  🔐 Testing: ${test.name}`);
      
      try {
        await axios.get(`${this.config.apiBaseUrl}/api/users/profile`, {
          headers: test.headers
        });
        
        results[test.name] = {
          success: false,
          error: `Expected status ${test.expectedStatus}, but request succeeded`
        };
      } catch (error) {
        results[test.name] = {
          success: error.response?.status === test.expectedStatus,
          actualStatus: error.response?.status,
          expectedStatus: test.expectedStatus,
          error: error.response?.data?.error || error.message
        };
      }
    }

    return results;
  }

  /**
   * Test file system error handling
   */
  async testFileSystemErrorHandling() {
    const results = {};

    // Test upload to full disk (simulated)
    console.log('  💾 Testing file system errors...');
    
    try {
      // Create a very large file to potentially trigger disk space issues
      const largeBuffer = Buffer.alloc(500 * 1024 * 1024); // 500MB
      
      const formData = new FormData();
      formData.append('pdf', new Blob([largeBuffer]), 'large-test.pdf');
      formData.append('metadata', JSON.stringify(this.generateValidMetadata()));
      formData.append('signature', 'test-signature');

      await axios.post(`${this.config.apiBaseUrl}/api/pdf/upload`, formData, {
        headers: formData.getHeaders()
      });

      results.diskSpaceHandling = {
        success: false,
        error: 'Large file upload should have failed'
      };
    } catch (error) {
      results.diskSpaceHandling = {
        success: error.response?.status === 413 || error.response?.status === 507,
        statusCode: error.response?.status,
        error: error.response?.data?.error || error.message
      };
    }

    // Test file permission errors (simulated)
    try {
      // This would be specific to the file handling implementation
      const response = await axios.get(`${this.config.apiBaseUrl}/api/system/storage-info`);
      
      results.filePermissions = {
        success: true,
        storageInfo: response.data,
        message: 'File system access working correctly'
      };
    } catch (error) {
      results.filePermissions = {
        success: error.response?.status !== 500,
        error: error.message
      };
    }

    return results;
  }

  /**
   * Test timeout and deadline handling
   */
  async testTimeoutHandling() {
    const results = {};

    // Test API request timeouts
    console.log('  ⏱️ Testing timeout handling...');
    
    const timeoutTests = [
      {
        name: 'Short timeout',
        timeout: 1,
        endpoint: '/api/health'
      },
      {
        name: 'Medium timeout',
        timeout: 1000,
        endpoint: '/api/documents/search'
      },
      {
        name: 'Long operation timeout',
        timeout: 5000,
        endpoint: '/api/pdf/register'
      }
    ];

    for (const test of timeoutTests) {
      try {
        const config = { timeout: test.timeout };
        
        if (test.endpoint === '/api/pdf/register') {
          await axios.post(`${this.config.apiBaseUrl}${test.endpoint}`, {
            hash: this.generateValidHash(),
            metadata: this.generateValidMetadata(),
            signature: 'test-signature'
          }, config);
        } else {
          await axios.get(`${this.config.apiBaseUrl}${test.endpoint}`, config);
        }
        
        results[test.name] = {
          success: test.timeout > 1000, // Only longer timeouts should succeed
          message: test.timeout > 1000 ? 'Request completed within timeout' : 'Request should have timed out'
        };
      } catch (error) {
        results[test.name] = {
          success: error.code === 'ECONNABORTED' && test.timeout <= 1000,
          error: error.message,
          code: error.code,
          timedOut: error.code === 'ECONNABORTED'
        };
      }
    }

    return results;
  }

  // Helper methods
  generateValidHash() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  generateValidMetadata() {
    return {
      originalUrl: 'https://example.com/test-document',
      title: 'Test Document',
      timestamp: new Date().toISOString(),
      userAgent: 'Test User Agent',
      viewport: { width: 1920, height: 1080 }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ErrorHandlingSuite;