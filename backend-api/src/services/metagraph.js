/**
 * Metagraph Service
 * 
 * Handles all interactions with the Constellation Network metagraph,
 * including PDF registration, verification, and network queries.
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Custom error class for blockchain communication issues
 */
class BlockchainCommunicationError extends Error {
  constructor(message, category = 'UNKNOWN_ERROR', attempts = [], originalError = null) {
    super(message);
    this.name = 'BlockchainCommunicationError';
    this.category = category;
    this.attempts = attempts;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.retryable = this.isRetryableCategory(category);
  }

  isRetryableCategory(category) {
    const retryableCategories = ['NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMITED'];
    return retryableCategories.includes(category);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      retryable: this.retryable,
      attempts: this.attempts,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

class MetagraphService {
  constructor() {
    this.baseUrl = process.env.METAGRAPH_BASE_URL || 'http://localhost:9000';
    this.l0Url = process.env.METAGRAPH_L0_URL || 'http://localhost:9000';
    this.l1Url = process.env.METAGRAPH_L1_URL || 'http://localhost:9100';
    this.globalL0Url = process.env.GLOBAL_L0_URL || 'http://localhost:9200';
    this.currencyL1Url = process.env.CURRENCY_L1_URL || 'http://localhost:9300';
    this.dataL1Url = process.env.DATA_L1_URL || 'http://localhost:9400';
    
    this.network = process.env.BLOCKCHAIN_NETWORK || 'integrationnet';
    this.metagraphId = process.env.METAGRAPH_ID;
    
    // Configure axios instances for different layers
    this.l0Client = this.createClient(this.l0Url, 'L0');
    this.l1Client = this.createClient(this.l1Url, 'L1');
    this.dataL1Client = this.createClient(this.dataL1Url, 'DataL1');
    this.globalL0Client = this.createClient(this.globalL0Url, 'GlobalL0');
  }

  /**
   * Create configured axios client for a specific layer
   */
  createClient(baseURL, layer) {
    const client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ProofVault-Backend/1.0.0'
      }
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        logger.debug(`${layer} Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`${layer} Request Error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        logger.debug(`${layer} Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`${layer} Response Error:`, {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Register PDF evidence on the metagraph using Scala PDFRegistrationData format
   */
  async registerPDF(evidenceData) {
    try {
      const { hash, metadata, signature, submitterAddress } = evidenceData;
      
      logger.info(`Registering PDF evidence: ${hash.substring(0, 16)}...`);

      // Create PDFMetadata object matching Scala format
      const pdfMetadata = {
        originalUrl: metadata.originalUrl,
        captureTimestamp: new Date(metadata.captureTimestamp).getTime(),
        title: metadata.documentTitle || metadata.title || 'Unknown Document',
        submitterAddress: submitterAddress,
        contentType: 'application/pdf'
      };

      // Create PDFRecord object matching Scala format
      const pdfRecord = {
        hash: hash,
        url: metadata.originalUrl,
        title: pdfMetadata.title,
        captureTimestamp: pdfMetadata.captureTimestamp,
        submitterAddress: submitterAddress,
        metadata: pdfMetadata,
        registrationId: this.generateUUID()
      };

      // Create PDFRegistrationData matching Scala format
      const pdfRegistrationData = {
        pdfRecord: pdfRecord,
        signature: signature,
        version: '1.0'
      };

      // Prepare metagraph transaction data
      const transactionData = {
        source: submitterAddress,
        destination: submitterAddress, // Self-transaction for data storage
        amount: 0, // No currency transfer
        fee: 0, // No fee for evidence registration
        salt: Date.now(), // Unique salt for transaction
        parent: {
          ordinal: 0,
          hash: ''
        },
        data: {
          type: 'PDFRegistrationData',
          value: JSON.stringify(pdfRegistrationData)
        }
      };

      // Submit transaction to Data L1 with retry logic and circuit breaker
      const response = await this.executeWithCircuitBreaker(
        () => this.submitTransactionWithRetry(transactionData),
        'pdf_registration'
      );
      
      const result = {
        transactionHash: response.hash,
        registrationId: pdfRecord.registrationId,
        blockNumber: response.ordinal || 0,
        timestamp: new Date().toISOString(),
        status: 'submitted',
        layer: 'DataL1',
        pdfRecord: pdfRecord
      };

      logger.info(`PDF registration submitted: ${result.transactionHash}`);
      return result;

    } catch (error) {
      logger.error('PDF registration failed:', error);
      throw new Error(`Metagraph registration failed: ${error.message}`);
    }
  }

  /**
   * Verify PDF hash on the metagraph using Scala data structures
   */
  async verifyPDF(hash) {
    try {
      logger.info(`Verifying PDF hash: ${hash.substring(0, 16)}...`);

      // First try to get the PDF state directly from the metagraph L0
      let verificationResult = await this.queryPDFRegistryState(hash);
      
      if (verificationResult.verified) {
        return verificationResult;
      }

      // Fallback: Search through transaction history for PDFRegistrationData
      const searchResult = await this.searchPDFTransactions(hash);
      
      if (searchResult.verified) {
        return searchResult;
      }

      return {
        verified: false,
        message: 'Hash not found on blockchain',
        searchedLayers: ['metagraphL0', 'dataL1']
      };

    } catch (error) {
      if (error.response?.status === 404) {
        return {
          verified: false,
          message: 'Hash not found on blockchain'
        };
      }
      
      logger.error('PDF verification failed:', error);
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction(txHash) {
    try {
      const response = await this.dataL1Client.get(`/transactions/${txHash}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get confirmation count for a transaction
   */
  async getConfirmationCount(txHash) {
    try {
      const response = await this.dataL1Client.get(`/transactions/${txHash}/confirmations`);
      return response.data.confirmations || 0;
    } catch (error) {
      logger.warn(`Could not get confirmation count for ${txHash}:`, error.message);
      return 0;
    }
  }

  /**
   * Get current network information
   */
  async getNetworkInfo() {
    try {
      // Get info from multiple layers
      const [l0Info, dataL1Info] = await Promise.allSettled([
        this.l0Client.get('/cluster/info'),
        this.dataL1Client.get('/info')
      ]);

      const l0Data = l0Info.status === 'fulfilled' ? l0Info.value.data : null;
      const dataL1Data = dataL1Info.status === 'fulfilled' ? dataL1Info.value.data : null;

      return {
        networkName: this.network,
        chainId: this.metagraphId || 'unknown',
        blockHeight: dataL1Data?.ordinal || 0,
        nodeVersion: l0Data?.version || 'unknown',
        status: (l0Data && dataL1Data) ? 'healthy' : 'degraded',
        lastBlockTimestamp: dataL1Data?.lastSnapshotTimestamp || new Date().toISOString(),
        peerCount: l0Data?.peers?.length || 0,
        layers: {
          l0: l0Data ? 'healthy' : 'unavailable',
          dataL1: dataL1Data ? 'healthy' : 'unavailable'
        }
      };

    } catch (error) {
      logger.error('Failed to get network info:', error);
      return {
        networkName: this.network,
        chainId: 'unknown',
        blockHeight: 0,
        nodeVersion: 'unknown',
        status: 'offline',
        lastBlockTimestamp: new Date().toISOString(),
        peerCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Get cluster information
   */
  async getClusterInfo() {
    try {
      const response = await this.l0Client.get('/cluster/info');
      return response.data;
    } catch (error) {
      logger.error('Failed to get cluster info:', error);
      throw error;
    }
  }

  /**
   * Get node metrics
   */
  async getNodeMetrics() {
    try {
      const response = await this.l0Client.get('/metrics');
      return response.data;
    } catch (error) {
      logger.error('Failed to get node metrics:', error);
      throw error;
    }
  }

  /**
   * Search transactions by criteria
   */
  async searchTransactions(criteria) {
    try {
      const response = await this.dataL1Client.get('/transactions/search', {
        params: criteria
      });
      return response.data;
    } catch (error) {
      logger.error('Transaction search failed:', error);
      throw error;
    }
  }

  /**
   * Get transactions for a specific address
   */
  async getAddressTransactions(address, options = {}) {
    try {
      const params = {
        address,
        limit: options.limit || 20,
        offset: options.offset || 0,
        ...options
      };

      const response = await this.dataL1Client.get('/addresses/transactions', {
        params
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get address transactions:', error);
      throw error;
    }
  }

  /**
   * Enhanced health check with detailed diagnostics
   */
  async healthCheck() {
    const results = {};
    const diagnostics = {
      networkLatency: {},
      endpointAvailability: {},
      transactionCapability: false
    };
    
    const checks = [
      { name: 'l0', client: this.l0Client, endpoint: '/cluster/info', critical: true },
      { name: 'dataL1', client: this.dataL1Client, endpoint: '/info', critical: true },
      { name: 'globalL0', client: this.globalL0Client, endpoint: '/cluster/info', critical: false }
    ];

    let healthyCount = 0;
    let criticalHealthyCount = 0;
    let totalCritical = 0;

    for (const check of checks) {
      if (check.critical) totalCritical++;
      
      try {
        const start = Date.now();
        const response = await check.client.get(check.endpoint, { timeout: 5000 });
        const responseTime = Date.now() - start;
        
        results[check.name] = {
          status: 'healthy',
          responseTime,
          lastChecked: new Date().toISOString(),
          version: response.data?.version || 'unknown'
        };
        
        diagnostics.networkLatency[check.name] = responseTime;
        diagnostics.endpointAvailability[check.name] = true;
        
        healthyCount++;
        if (check.critical) criticalHealthyCount++;
        
      } catch (error) {
        const errorInfo = this.categorizeError(error);
        
        results[check.name] = {
          status: 'unhealthy',
          error: errorInfo.message,
          category: errorInfo.category,
          lastChecked: new Date().toISOString(),
          critical: check.critical
        };
        
        diagnostics.endpointAvailability[check.name] = false;
      }
    }

    // Test transaction capability if L0 and DataL1 are healthy
    if (results.l0?.status === 'healthy' && results.dataL1?.status === 'healthy') {
      try {
        // Simple test to see if we can query transactions
        await this.dataL1Client.get('/transactions', { 
          params: { limit: 1 },
          timeout: 3000 
        });
        diagnostics.transactionCapability = true;
      } catch (error) {
        diagnostics.transactionCapability = false;
        logger.warn('Transaction capability test failed:', error.message);
      }
    }

    // Determine overall status
    let overallStatus;
    if (criticalHealthyCount === totalCritical) {
      overallStatus = 'healthy';
    } else if (criticalHealthyCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }
    
    return {
      status: overallStatus,
      layers: results,
      diagnostics,
      summary: {
        totalLayers: checks.length,
        healthyLayers: healthyCount,
        criticalLayers: totalCritical,
        criticalHealthy: criticalHealthyCount,
        canProcessTransactions: diagnostics.transactionCapability
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enhanced error recovery with circuit breaker pattern
   */
  async executeWithCircuitBreaker(operation, operationName = 'unknown') {
    const circuitState = this.getCircuitState(operationName);
    
    // Circuit is open, reject immediately
    if (circuitState.state === 'OPEN') {
      const timeSinceOpen = Date.now() - circuitState.lastFailure;
      const timeout = circuitState.timeout || 30000; // 30 second default
      
      if (timeSinceOpen < timeout) {
        throw new Error(`Circuit breaker OPEN for ${operationName}. Try again in ${Math.ceil((timeout - timeSinceOpen) / 1000)}s`);
      } else {
        // Move to half-open state
        this.setCircuitState(operationName, 'HALF_OPEN');
      }
    }
    
    try {
      const result = await operation();
      
      // Success - close circuit if it was open/half-open
      if (circuitState.state !== 'CLOSED') {
        this.setCircuitState(operationName, 'CLOSED');
        logger.info(`Circuit breaker CLOSED for ${operationName}`);
      }
      
      return result;
      
    } catch (error) {
      // Failure - update circuit state
      this.incrementFailureCount(operationName);
      
      const currentState = this.getCircuitState(operationName);
      const failureThreshold = 5; // Open circuit after 5 failures
      
      if (currentState.failureCount >= failureThreshold) {
        this.setCircuitState(operationName, 'OPEN');
        logger.warn(`Circuit breaker OPENED for ${operationName} after ${currentState.failureCount} failures`);
      }
      
      throw error;
    }
  }

  /**
   * Circuit breaker state management
   */
  getCircuitState(operationName) {
    if (!this.circuitStates) {
      this.circuitStates = new Map();
    }
    
    if (!this.circuitStates.has(operationName)) {
      this.circuitStates.set(operationName, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailure: null,
        timeout: 30000
      });
    }
    
    return this.circuitStates.get(operationName);
  }

  setCircuitState(operationName, state) {
    const currentState = this.getCircuitState(operationName);
    currentState.state = state;
    
    if (state === 'CLOSED') {
      currentState.failureCount = 0;
      currentState.lastFailure = null;
    } else if (state === 'OPEN') {
      currentState.lastFailure = Date.now();
    }
  }

  incrementFailureCount(operationName) {
    const state = this.getCircuitState(operationName);
    state.failureCount++;
    state.lastFailure = Date.now();
  }

  /**
   * Query PDF Registry State directly from metagraph L0
   */
  async queryPDFRegistryState(hash) {
    try {
      const response = await this.l0Client.get('/data-application/state/latest');
      const state = response.data;
      
      if (state && state.registeredPDFs && state.registeredPDFs[hash]) {
        const pdfRecord = state.registeredPDFs[hash];
        return {
          verified: true,
          data: {
            hash: pdfRecord.hash,
            submitterAddress: pdfRecord.submitterAddress,
            registrationTimestamp: new Date(pdfRecord.captureTimestamp).toISOString(),
            blockNumber: state.lastOrdinal || 0,
            transactionHash: pdfRecord.registrationId,
            metadata: pdfRecord.metadata,
            pdfRecord: pdfRecord,
            source: 'metagraphL0State'
          }
        };
      }
      
      return { verified: false };
    } catch (error) {
      logger.debug('Could not query metagraph L0 state:', error.message);
      return { verified: false };
    }
  }

  /**
   * Search for PDF transactions in Data L1
   */
  async searchPDFTransactions(hash) {
    try {
      // Search for transactions containing PDFRegistrationData
      const response = await this.dataL1Client.get('/transactions', {
        params: {
          limit: 100,
          orderBy: 'ordinal',
          orderDirection: 'desc'
        }
      });

      if (!response.data || !response.data.transactions) {
        return { verified: false };
      }

      // Filter transactions for PDF registrations matching our hash
      for (const tx of response.data.transactions) {
        if (tx.data && tx.data.type === 'PDFRegistrationData') {
          try {
            const pdfData = JSON.parse(tx.data.value);
            if (pdfData.pdfRecord && pdfData.pdfRecord.hash === hash) {
              return {
                verified: true,
                data: {
                  hash: pdfData.pdfRecord.hash,
                  submitterAddress: pdfData.pdfRecord.submitterAddress,
                  registrationTimestamp: new Date(pdfData.pdfRecord.captureTimestamp).toISOString(),
                  blockNumber: tx.ordinal,
                  transactionHash: tx.hash,
                  metadata: pdfData.pdfRecord.metadata,
                  pdfRecord: pdfData.pdfRecord,
                  confirmations: await this.getConfirmationCount(tx.hash),
                  source: 'dataL1Transaction'
                }
              };
            }
          } catch (parseError) {
            logger.debug('Could not parse transaction data:', parseError.message);
            continue;
          }
        }
      }
      
      return { verified: false };
    } catch (error) {
      logger.debug('Could not search PDF transactions:', error.message);
      return { verified: false };
    }
  }

  /**
   * Submit transaction with exponential backoff retry logic and comprehensive error handling
   */
  async submitTransactionWithRetry(transactionData, maxRetries = 3) {
    const errors = [];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Transaction submission attempt ${attempt}/${maxRetries}`);
        
        const response = await this.dataL1Client.post('/transactions', transactionData);
        
        // Validate response
        if (!response.data || !response.data.hash) {
          throw new Error('Invalid response from metagraph: missing transaction hash');
        }
        
        logger.info(`Transaction submitted successfully on attempt ${attempt}: ${response.data.hash}`);
        return response.data;
        
      } catch (error) {
        const errorInfo = this.categorizeError(error);
        errors.push({ attempt, error: errorInfo, timestamp: new Date().toISOString() });
        
        logger.warn(`Transaction submission attempt ${attempt}/${maxRetries} failed:`, {
          category: errorInfo.category,
          message: errorInfo.message,
          retryable: errorInfo.retryable,
          statusCode: errorInfo.statusCode
        });
        
        // Don't retry for non-retryable errors
        if (!errorInfo.retryable || attempt === maxRetries) {
          const aggregatedError = new BlockchainCommunicationError(
            `Transaction submission failed after ${attempt} attempts`,
            errorInfo.category,
            errors
          );
          throw aggregatedError;
        }
        
        // Exponential backoff with jitter: base delay * 2^(attempt-1) + random jitter
        const baseDelay = 1000;
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 500; // Up to 500ms jitter
        const delayMs = exponentialDelay + jitter;
        
        logger.debug(`Waiting ${delayMs}ms before retry ${attempt + 1}`);
        await this.delay(delayMs);
      }
    }
  }

  /**
   * Categorize errors for proper handling and retry logic
   */
  categorizeError(error) {
    const statusCode = error.response?.status;
    const message = error.message || 'Unknown error';
    const responseData = error.response?.data;
    
    // Network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'TIMEOUT') {
      return {
        category: 'NETWORK_ERROR',
        message: `Network connection failed: ${message}`,
        retryable: true,
        statusCode: null
      };
    }
    
    // HTTP status code based categorization
    if (statusCode) {
      if (statusCode >= 500) {
        return {
          category: 'SERVER_ERROR',
          message: `Server error: ${statusCode} - ${responseData?.message || message}`,
          retryable: true,
          statusCode
        };
      }
      
      if (statusCode === 429) {
        return {
          category: 'RATE_LIMITED',
          message: 'Rate limited by metagraph node',
          retryable: true,
          statusCode
        };
      }
      
      if (statusCode >= 400 && statusCode < 500) {
        return {
          category: 'CLIENT_ERROR',
          message: `Client error: ${statusCode} - ${responseData?.message || message}`,
          retryable: false, // Client errors are typically not retryable
          statusCode
        };
      }
    }
    
    // Timeout errors
    if (message.includes('timeout')) {
      return {
        category: 'TIMEOUT_ERROR',
        message: 'Request timed out',
        retryable: true,
        statusCode: null
      };
    }
    
    // Default categorization
    return {
      category: 'UNKNOWN_ERROR',
      message: message,
      retryable: false,
      statusCode: statusCode || null
    };
  }

  /**
   * Get PDFs by submitter address using Scala state structure
   */
  async getPDFsBySubmitter(submitterAddress, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;
      
      // Query the metagraph state for PDFs by submitter
      const response = await this.l0Client.get('/data-application/state/latest');
      const state = response.data;
      
      if (!state || !state.registeredPDFs) {
        return {
          pdfs: [],
          total: 0,
          hasMore: false
        };
      }
      
      // Filter PDFs by submitter address
      const submitterPDFs = Object.values(state.registeredPDFs)
        .filter(pdf => pdf.submitterAddress === submitterAddress)
        .sort((a, b) => b.captureTimestamp - a.captureTimestamp); // Sort by timestamp descending
      
      const paginatedPDFs = submitterPDFs.slice(offset, offset + limit);
      
      return {
        pdfs: paginatedPDFs,
        total: submitterPDFs.length,
        hasMore: offset + limit < submitterPDFs.length
      };
      
    } catch (error) {
      logger.error('Failed to get PDFs by submitter:', error);
      throw error;
    }
  }

  /**
   * Generate UUID for registration IDs
   */
  generateUUID() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate hash for PDF data (server-side verification)
   */
  calculateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate PDF hash format (matches Scala validation)
   */
  isValidHash(hash) {
    return typeof hash === 'string' && /^[a-fA-F0-9]{64}$/.test(hash);
  }

  /**
   * Validate transaction signature
   */
  validateSignature(data, signature, publicKey) {
    // TODO: Implement signature validation using Constellation Network's signature scheme
    // This is a simplified version - real implementation would use DAG signature validation
    try {
      if (!signature || signature.length === 0) {
        return false;
      }
      
      const hash = this.calculateHash(JSON.stringify(data));
      // Placeholder for actual signature verification
      // In production, this would validate using Constellation's cryptographic scheme
      return true;
    } catch (error) {
      logger.error('Signature validation failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const metagraphService = new MetagraphService();

module.exports = metagraphService;