/**
 * End-to-End Integration Test Suite
 * 
 * Tests the complete workflow from Chrome extension PDF capture
 * through blockchain registration to frontend verification.
 * 
 * Test Flow:
 * 1. Chrome Extension captures PDF
 * 2. Extension calls Backend API
 * 3. Backend processes and calls Scala Metagraph
 * 4. Metagraph registers on blockchain
 * 5. Database stores confirmation
 * 6. Frontend verifies document
 * 7. WebSocket updates propagate
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class E2ETestSuite {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.wsConnection = null;
    this.testResults = [];
    this.extensionId = null;
  }

  async setup() {
    console.log('🔧 Setting up E2E test environment...');
    
    // Launch browser with extension
    this.browser = await puppeteer.launch({
      headless: false, // Need to see extension UI
      devtools: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        `--load-extension=${path.join(__dirname, '../../../chrome-extension')}`,
        '--disable-extensions-except=' + path.join(__dirname, '../../../chrome-extension')
      ]
    });

    // Get extension page
    const pages = await this.browser.pages();
    this.page = pages[0];
    
    // Get extension ID
    await this.getExtensionId();
    
    // Setup WebSocket connection for real-time updates
    await this.setupWebSocketConnection();
    
    console.log('✅ E2E environment ready');
  }

  async teardown() {
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  async getExtensionId() {
    const extensionTargets = await this.browser.targets();
    const extensionPages = extensionTargets.filter(target => 
      target.type() === 'background_page' && target.url().includes('chrome-extension://')
    );
    
    if (extensionPages.length > 0) {
      const url = extensionPages[0].url();
      this.extensionId = url.split('//')[1].split('/')[0];
      console.log(`📱 Extension ID: ${this.extensionId}`);
    } else {
      throw new Error('Could not find ProofVault extension');
    }
  }

  async setupWebSocketConnection() {
    return new Promise((resolve, reject) => {
      this.wsConnection = new WebSocket(this.config.wsUrl);
      
      this.wsConnection.on('open', () => {
        console.log('🔌 WebSocket connected');
        resolve();
      });
      
      this.wsConnection.on('error', (error) => {
        console.error('WebSocket connection failed:', error);
        reject(error);
      });
    });
  }

  async getTests() {
    return [
      {
        name: 'Complete PDF Registration Workflow',
        description: 'Test end-to-end PDF capture, registration, and verification',
        timeout: 60000
      },
      {
        name: 'Real-time Updates via WebSocket',
        description: 'Verify real-time status updates through WebSocket',
        timeout: 30000
      },
      {
        name: 'Cross-Component Data Consistency',
        description: 'Verify data consistency across all system components',
        timeout: 45000
      },
      {
        name: 'Blockchain Transaction Confirmation',
        description: 'Verify blockchain transaction submission and confirmation',
        timeout: 90000
      },
      {
        name: 'Frontend Verification Interface',
        description: 'Test complete verification workflow in frontend',
        timeout: 30000
      },
      {
        name: 'Multi-Document Batch Processing',
        description: 'Test concurrent processing of multiple documents',
        timeout: 120000
      }
    ];
  }

  async runTest(test) {
    console.log(`🎯 Running E2E test: ${test.name}`);
    
    switch (test.name) {
      case 'Complete PDF Registration Workflow':
        return await this.testCompletePDFWorkflow();
      case 'Real-time Updates via WebSocket':
        return await this.testRealTimeUpdates();
      case 'Cross-Component Data Consistency':
        return await this.testDataConsistency();
      case 'Blockchain Transaction Confirmation':
        return await this.testBlockchainConfirmation();
      case 'Frontend Verification Interface':
        return await this.testFrontendVerification();
      case 'Multi-Document Batch Processing':
        return await this.testBatchProcessing();
      default:
        throw new Error(`Unknown test: ${test.name}`);
    }
  }

  /**
   * Test complete PDF registration workflow
   */
  async testCompletePDFWorkflow() {
    const testData = {
      url: 'https://example.com/test-document',
      expectedHash: null,
      transactionId: null,
      documentId: null
    };

    // Step 1: Navigate to test page and capture PDF
    await this.page.goto(testData.url);
    await this.page.waitForLoadState('networkidle');
    
    // Step 2: Trigger extension PDF capture
    const captureResult = await this.triggerExtensionCapture();
    testData.expectedHash = captureResult.hash;
    testData.documentId = captureResult.documentId;
    
    console.log(`📄 PDF captured with hash: ${testData.expectedHash}`);
    
    // Step 3: Wait for backend processing
    await this.waitForBackendProcessing(testData.documentId);
    
    // Step 4: Verify API registration
    const apiResult = await this.verifyAPIRegistration(testData.expectedHash);
    testData.transactionId = apiResult.transactionId;
    
    // Step 5: Verify metagraph registration
    await this.verifyMetagraphRegistration(testData.transactionId);
    
    // Step 6: Verify database storage
    await this.verifyDatabaseStorage(testData.expectedHash);
    
    // Step 7: Test frontend verification
    await this.verifyFrontendAccess(testData.expectedHash);
    
    console.log('✅ Complete PDF workflow test passed');
    return testData;
  }

  /**
   * Trigger PDF capture through Chrome extension
   */
  async triggerExtensionCapture() {
    // Simulate right-click context menu activation
    await this.page.mouse.click(100, 100, { button: 'right' });
    
    // Wait for context menu and click capture option
    await this.page.waitForTimeout(1000);
    
    // Execute extension content script
    const captureResult = await this.page.evaluate(async () => {
      // Simulate extension content script execution
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Create test PDF data
      const pdfData = new ArrayBuffer(1024);
      const uint8Array = new Uint8Array(pdfData);
      for (let i = 0; i < uint8Array.length; i++) {
        uint8Array[i] = Math.floor(Math.random() * 256);
      }
      
      // Calculate hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', pdfData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return {
        hash,
        documentId: 'test-doc-' + Date.now(),
        pdfData: Array.from(uint8Array),
        metadata: {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };
    });
    
    return captureResult;
  }

  /**
   * Wait for backend processing to complete
   */
  async waitForBackendProcessing(documentId, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(
          `${this.config.apiBaseUrl}/api/documents/${documentId}/status`
        );
        
        if (response.data.status === 'processing') {
          await this.sleep(1000);
          continue;
        } else if (response.data.status === 'confirmed') {
          return response.data;
        } else if (response.data.status === 'failed') {
          throw new Error(`Document processing failed: ${response.data.error}`);
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
        await this.sleep(1000);
      }
    }
    
    throw new Error('Backend processing timeout');
  }

  /**
   * Verify API registration completed successfully
   */
  async verifyAPIRegistration(hash) {
    const response = await axios.get(
      `${this.config.apiBaseUrl}/api/evidence/${hash}`
    );
    
    if (response.status !== 200) {
      throw new Error(`API registration failed: ${response.status}`);
    }
    
    const evidence = response.data;
    if (!evidence.transaction_id) {
      throw new Error('No transaction ID found in evidence record');
    }
    
    console.log(`🔗 API registration confirmed: ${evidence.transaction_id}`);
    return { transactionId: evidence.transaction_id };
  }

  /**
   * Verify metagraph registration
   */
  async verifyMetagraphRegistration(transactionId) {
    const response = await axios.get(
      `${this.config.metagraphUrl}/transactions/${transactionId}`
    );
    
    if (response.status !== 200) {
      throw new Error(`Metagraph transaction not found: ${transactionId}`);
    }
    
    const transaction = response.data;
    if (!transaction.hash || transaction.status !== 'accepted') {
      throw new Error(`Invalid transaction status: ${transaction.status}`);
    }
    
    console.log(`⛓️ Blockchain registration confirmed: ${transaction.hash}`);
    return transaction;
  }

  /**
   * Verify database storage
   */
  async verifyDatabaseStorage(hash) {
    const response = await axios.get(
      `${this.config.apiBaseUrl}/api/evidence/${hash}/verify`
    );
    
    if (response.status !== 200) {
      throw new Error(`Database verification failed: ${response.status}`);
    }
    
    const verification = response.data;
    if (!verification.database_record || !verification.blockchain_record) {
      throw new Error('Incomplete database or blockchain records');
    }
    
    console.log('🗄️ Database storage verified');
    return verification;
  }

  /**
   * Verify frontend access and verification
   */
  async verifyFrontendAccess(hash) {
    // Navigate to frontend verification page
    await this.page.goto(`${this.config.frontendUrl}/verify/${hash}`);
    await this.page.waitForLoadState('networkidle');
    
    // Check if verification results are displayed
    const verificationResult = await this.page.evaluate(() => {
      const statusElement = document.querySelector('[data-testid="verification-status"]');
      const hashElement = document.querySelector('[data-testid="document-hash"]');
      const timestampElement = document.querySelector('[data-testid="registration-timestamp"]');
      
      return {
        status: statusElement?.textContent,
        hash: hashElement?.textContent,
        timestamp: timestampElement?.textContent,
        isValid: statusElement?.classList.contains('valid')
      };
    });
    
    if (!verificationResult.isValid) {
      throw new Error('Frontend verification failed');
    }
    
    console.log('🖥️ Frontend verification confirmed');
    return verificationResult;
  }

  /**
   * Test real-time updates via WebSocket
   */
  async testRealTimeUpdates() {
    const updates = [];
    
    // Listen for WebSocket updates
    this.wsConnection.on('message', (data) => {
      const update = JSON.parse(data);
      updates.push(update);
      console.log('📡 WebSocket update received:', update.type);
    });
    
    // Trigger a document registration
    const testDoc = await this.triggerExtensionCapture();
    
    // Wait for expected updates
    await this.waitForUpdates(updates, [
      'document_submitted',
      'processing_started',
      'blockchain_submitted',
      'registration_confirmed'
    ], 30000);
    
    console.log(`📊 Received ${updates.length} real-time updates`);
    return { updates };
  }

  /**
   * Test cross-component data consistency
   */
  async testDataConsistency() {
    const testDoc = await this.triggerExtensionCapture();
    const hash = testDoc.hash;
    
    // Wait for processing
    await this.sleep(10000);
    
    // Get data from all components
    const [apiData, dbData, blockchainData] = await Promise.all([
      this.getAPIData(hash),
      this.getDatabaseData(hash),
      this.getBlockchainData(hash)
    ]);
    
    // Verify consistency
    this.verifyDataConsistency(apiData, dbData, blockchainData);
    
    console.log('🔄 Data consistency verified across all components');
    return { apiData, dbData, blockchainData };
  }

  /**
   * Test blockchain transaction confirmation
   */
  async testBlockchainConfirmation() {
    const testDoc = await this.triggerExtensionCapture();
    await this.sleep(5000); // Wait for initial processing
    
    // Get transaction details
    const apiResponse = await axios.get(
      `${this.config.apiBaseUrl}/api/evidence/${testDoc.hash}`
    );
    const transactionId = apiResponse.data.transaction_id;
    
    // Monitor blockchain confirmation
    const confirmation = await this.waitForBlockchainConfirmation(transactionId);
    
    console.log('⛓️ Blockchain transaction confirmed');
    return confirmation;
  }

  /**
   * Test frontend verification interface
   */
  async testFrontendVerification() {
    // Create a test document first
    const testDoc = await this.triggerExtensionCapture();
    await this.sleep(15000); // Wait for full processing
    
    // Test verification interface
    await this.page.goto(`${this.config.frontendUrl}/verify`);
    
    // Enter hash and verify
    await this.page.fill('[data-testid="hash-input"]', testDoc.hash);
    await this.page.click('[data-testid="verify-button"]');
    
    // Wait for results
    await this.page.waitForSelector('[data-testid="verification-result"]', { timeout: 10000 });
    
    const result = await this.page.evaluate(() => {
      const resultElement = document.querySelector('[data-testid="verification-result"]');
      return {
        isValid: resultElement.classList.contains('valid'),
        status: resultElement.textContent,
        details: document.querySelector('[data-testid="verification-details"]')?.textContent
      };
    });
    
    if (!result.isValid) {
      throw new Error('Frontend verification failed');
    }
    
    console.log('🖥️ Frontend verification interface working correctly');
    return result;
  }

  /**
   * Test multi-document batch processing
   */
  async testBatchProcessing() {
    const batchSize = 5;
    const testDocs = [];
    
    console.log(`📦 Processing batch of ${batchSize} documents...`);
    
    // Create multiple test documents
    for (let i = 0; i < batchSize; i++) {
      const testDoc = await this.triggerExtensionCapture();
      testDocs.push(testDoc);
      await this.sleep(2000); // Stagger submissions
    }
    
    // Wait for all to process
    await this.sleep(30000);
    
    // Verify all documents were processed
    const verifications = await Promise.all(
      testDocs.map(doc => this.verifyDocumentProcessed(doc.hash))
    );
    
    const successCount = verifications.filter(v => v.success).length;
    
    if (successCount !== batchSize) {
      throw new Error(`Batch processing failed: ${successCount}/${batchSize} succeeded`);
    }
    
    console.log(`✅ Batch processing completed: ${successCount}/${batchSize} documents`);
    return { processedCount: successCount, total: batchSize };
  }

  // Helper methods
  async getAPIData(hash) {
    const response = await axios.get(`${this.config.apiBaseUrl}/api/evidence/${hash}`);
    return response.data;
  }

  async getDatabaseData(hash) {
    const response = await axios.get(`${this.config.apiBaseUrl}/api/evidence/${hash}/database`);
    return response.data;
  }

  async getBlockchainData(hash) {
    const response = await axios.get(`${this.config.apiBaseUrl}/api/evidence/${hash}/blockchain`);
    return response.data;
  }

  verifyDataConsistency(apiData, dbData, blockchainData) {
    if (apiData.hash !== dbData.hash || apiData.hash !== blockchainData.hash) {
      throw new Error('Hash mismatch between components');
    }
    
    if (apiData.transaction_id !== dbData.transaction_id) {
      throw new Error('Transaction ID mismatch between API and database');
    }
    
    // Add more consistency checks as needed
  }

  async waitForBlockchainConfirmation(transactionId, timeout = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(
          `${this.config.metagraphUrl}/transactions/${transactionId}`
        );
        
        if (response.data.status === 'accepted' && response.data.confirmations >= 1) {
          return response.data;
        }
        
        await this.sleep(2000);
      } catch (error) {
        await this.sleep(2000);
      }
    }
    
    throw new Error('Blockchain confirmation timeout');
  }

  async verifyDocumentProcessed(hash) {
    try {
      const response = await axios.get(`${this.config.apiBaseUrl}/api/evidence/${hash}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async waitForUpdates(updates, expectedTypes, timeout) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const receivedTypes = updates.map(u => u.type);
      const hasAllTypes = expectedTypes.every(type => receivedTypes.includes(type));
      
      if (hasAllTypes) {
        return updates;
      }
      
      await this.sleep(1000);
    }
    
    throw new Error(`Timeout waiting for WebSocket updates: ${expectedTypes.join(', ')}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = E2ETestSuite;