/**
 * Jest Test Setup
 * 
 * Configuration and utilities for ProofVault Backend API tests.
 */

require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock external services in test environment
jest.mock('../src/services/metagraph', () => ({
  registerPDF: jest.fn(),
  verifyPDF: jest.fn(),
  getNetworkInfo: jest.fn(),
  healthCheck: jest.fn()
}));

// Global test utilities
global.testUtils = {
  /**
   * Generate test PDF hash
   */
  generateTestHash() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Generate test user address
   */
  generateTestAddress() {
    const crypto = require('crypto');
    return 'DAG' + crypto.randomBytes(20).toString('hex');
  },

  /**
   * Create test evidence record data
   */
  createTestEvidenceData(overrides = {}) {
    return {
      hash: this.generateTestHash(),
      originalUrl: 'https://example.com/test-document',
      documentTitle: 'Test Document',
      mimeType: 'application/pdf',
      fileSize: 1024000,
      captureTimestamp: new Date().toISOString(),
      captureUserAgent: 'Test Agent',
      captureViewportSize: { width: 1920, height: 1080 },
      submitterAddress: this.generateTestAddress(),
      submitterSignature: 'test-signature',
      metadata: {
        test: true,
        originalUrl: 'https://example.com/test-document',
        captureTimestamp: new Date().toISOString(),
        submitterAddress: this.generateTestAddress()
      },
      ...overrides
    };
  },

  /**
   * Create test PDF buffer
   */
  createTestPDFBuffer() {
    // Minimal PDF structure for testing
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
230
%%EOF`;
    
    return Buffer.from(pdfContent);
  },

  /**
   * Wait for a condition to be true
   */
  async waitFor(conditionFn, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await conditionFn()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};

// Cleanup after tests
afterAll(async () => {
  // Close any open connections
  const { closePool } = require('../database/config/database');
  if (closePool) {
    await closePool();
  }
});