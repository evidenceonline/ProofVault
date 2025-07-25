/**
 * Enhanced Metagraph Service
 * 
 * Comprehensive blockchain communication service with advanced error handling,
 * retry logic, circuit breaker patterns, and performance monitoring.
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { 
  BlockchainError, 
  TimeoutError, 
  ExternalServiceError,
  CircuitBreakerError,
  ConfigurationError 
} = require('../types/errors');

// Import base metagraph service
const baseMetagraphService = require('./metagraph');

/**
 * Enhanced Metagraph Service with comprehensive error handling
 */
class EnhancedMetagraphService {
  constructor() {
    // Inherit base configuration
    this.baseUrl = process.env.METAGRAPH_BASE_URL || 'http://localhost:9000';
    this.l0Url = process.env.METAGRAPH_L0_URL || 'http://localhost:9000';
    this.l1Url = process.env.METAGRAPH_L1_URL || 'http://localhost:9100';
    this.globalL0Url = process.env.GLOBAL_L0_URL || 'http://localhost:9200';
    this.currencyL1Url = process.env.CURRENCY_L1_URL || 'http://localhost:9300';
    this.dataL1Url = process.env.DATA_L1_URL || 'http://localhost:9400';
    
    this.network = process.env.BLOCKCHAIN_NETWORK || 'integrationnet';
    this.metagraphId = process.env.METAGRAPH_ID;
    
    // Enhanced configuration
    this.config = {
      timeout: parseInt(process.env.METAGRAPH_TIMEOUT) || 30000,
      retries: parseInt(process.env.METAGRAPH_RETRIES) || 3,
      backoffMs: parseInt(process.env.METAGRAPH_BACKOFF) || 1000,
      maxBackoffMs: parseInt(process.env.METAGRAPH_MAX_BACKOFF) || 30000,
      circuitBreakerThreshold: parseInt(process.env.CB_THRESHOLD) || 5,
      circuitBreakerTimeout: parseInt(process.env.CB_TIMEOUT) || 30000
    };
    
    // Circuit breakers for each service endpoint
    this.circuitBreakers = new Map();
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimes: [],
      errorsByCategory: new Map(),
      recentErrors: []
    };
    
    // Request tracking for monitoring
    this.activeRequests = new Map();
    
    // Initialize clients with enhanced configuration
    this.clients = this.initializeClients();
    
    // Health check intervals
    this.healthCheckInterval = null;
    this.startHealthMonitoring();
  }

  /**
   * Initialize axios clients with enhanced configuration
   */
  initializeClients() {
    const endpoints = [
      { name: 'l0', url: this.l0Url },
      { name: 'l1', url: this.l1Url },
      { name: 'dataL1', url: this.dataL1Url },
      { name: 'globalL0', url: this.globalL0Url }
    ];

    const clients = {};
    
    endpoints.forEach(({ name, url }) => {
      clients[name] = this.createEnhancedClient(url, name);
      this.circuitBreakers.set(name, this.createCircuitBreaker(name));
    });

    return clients;
  }

  /**
   * Create enhanced axios client with comprehensive error handling
   */
  createEnhancedClient(baseURL, serviceName) {
    const client = axios.create({
      baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ProofVault-Enhanced/1.0.0',
        'X-Service-Name': serviceName,
        'X-Request-ID': () => crypto.randomUUID()
      },
      // Enable response compression
      decompress: true,
      // Connection pooling
      httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 10,
        timeout: this.config.timeout
      }),
      httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 10,
        timeout: this.config.timeout
      })
    });

    // Enhanced request interceptor
    client.interceptors.request.use(
      (config) => {
        const requestId = crypto.randomUUID();
        config.metadata = {
          requestId,
          startTime: Date.now(),
          serviceName,
          retryCount: 0
        };
        
        // Track active request
        this.activeRequests.set(requestId, {
          serviceName,
          endpoint: config.url,
          method: config.method,
          startTime: Date.now()
        });

        logger.debug(`${serviceName} request starting:`, {
          requestId,
          method: config.method?.toUpperCase(),
          url: config.url,
          timeout: config.timeout
        });

        return config;
      },
      (error) => {
        logger.error(`${serviceName} request setup error:`, error);
        return Promise.reject(this.enhanceError(error, serviceName));
      }
    );

    // Enhanced response interceptor
    client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        const requestId = response.config.metadata.requestId;
        
        // Remove from active requests
        this.activeRequests.delete(requestId);
        
        // Update metrics
        this.updateMetrics(serviceName, duration, true);
        
        logger.debug(`${serviceName} request completed:`, {
          requestId,
          status: response.status,
          duration: `${duration}ms`,
          dataSize: JSON.stringify(response.data).length
        });

        return response;
      },
      (error) => {
        const requestId = error.config?.metadata?.requestId;
        const duration = error.config?.metadata ? 
          Date.now() - error.config.metadata.startTime : 0;
        
        // Remove from active requests
        if (requestId) {
          this.activeRequests.delete(requestId);
        }
        
        // Update metrics
        this.updateMetrics(serviceName, duration, false);
        
        const enhancedError = this.enhanceError(error, serviceName);
        
        logger.error(`${serviceName} request failed:`, {
          requestId,
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          duration: `${duration}ms`,
          category: enhancedError.category,
          retryable: enhancedError.retryable
        });

        return Promise.reject(enhancedError);
      }
    );

    return client;
  }

  /**
   * Create circuit breaker for service endpoint
   */
  createCircuitBreaker(serviceName) {
    return {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      lastFailureTime: null,
      threshold: this.config.circuitBreakerThreshold,
      timeout: this.config.circuitBreakerTimeout,
      serviceName
    };
  }

  /**
   * Execute request with circuit breaker protection
   */
  async executeWithCircuitBreaker(serviceName, operation) {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!circuitBreaker) {
      throw new ConfigurationError(`Circuit breaker not found for service: ${serviceName}`);
    }

    // Check if circuit is open
    if (circuitBreaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - circuitBreaker.lastFailureTime;
      
      if (timeSinceFailure < circuitBreaker.timeout) {
        const retryAfter = Math.ceil((circuitBreaker.timeout - timeSinceFailure) / 1000);
        throw new CircuitBreakerError(serviceName, retryAfter);
      } else {
        // Move to half-open state
        circuitBreaker.state = 'HALF_OPEN';
        logger.info(`Circuit breaker for ${serviceName} moved to HALF_OPEN`);
      }
    }

    try {
      const result = await operation();
      
      // Success - close circuit if needed
      if (circuitBreaker.state !== 'CLOSED') {
        circuitBreaker.state = 'CLOSED';
        circuitBreaker.failureCount = 0;
        circuitBreaker.lastFailureTime = null;
        logger.info(`Circuit breaker for ${serviceName} CLOSED after success`);
      }
      
      return result;
      
    } catch (error) {
      // Failure - update circuit breaker
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = Date.now();
      
      if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
        circuitBreaker.state = 'OPEN';
        logger.warn(`Circuit breaker for ${serviceName} OPENED`, {
          failureCount: circuitBreaker.failureCount,
          threshold: circuitBreaker.threshold
        });
      }
      
      throw error;
    }
  }

  /**
   * Enhanced PDF registration with comprehensive error handling
   */
  async registerPDF(evidenceData) {
    const startTime = Date.now();
    const operationId = crypto.randomUUID();
    
    logger.info(`PDF registration starting:`, {
      operationId,
      hash: evidenceData.hash?.substring(0, 16) + '...',
      submitter: evidenceData.submitterAddress
    });

    try {
      // Validate input data
      this.validateRegistrationData(evidenceData);
      
      // Prepare transaction data with enhanced metadata
      const transactionData = this.prepareTransactionData(evidenceData, operationId);
      
      // Execute with circuit breaker and retry logic
      const result = await this.executeWithCircuitBreaker('dataL1', () =>
        this.submitTransactionWithEnhancedRetry(transactionData, operationId)
      );
      
      const duration = Date.now() - startTime;
      
      logger.info(`PDF registration completed:`, {
        operationId,
        transactionHash: result.hash,
        duration: `${duration}ms`
      });
      
      return {
        ...result,
        operationId,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`PDF registration failed:`, {
        operationId,
        error: error.message,
        category: error.category || 'unknown',
        duration: `${duration}ms`
      });
      
      // Track error for monitoring
      this.trackError(error, 'registerPDF', { operationId, evidenceData });
      
      throw error;
    }
  }

  /**
   * Enhanced PDF verification with fallback strategies
   */
  async verifyPDF(hash) {
    const startTime = Date.now();
    const operationId = crypto.randomUUID();
    
    logger.info(`PDF verification starting:`, {
      operationId,
      hash: hash?.substring(0, 16) + '...'
    });

    try {
      // Validate hash format
      if (!this.isValidHash(hash)) {
        throw new BlockchainError('Invalid PDF hash format', 'VALIDATION_ERROR');
      }

      // Try multiple verification strategies with circuit breaker
      const verificationStrategies = [
        () => this.verifyFromMetagraphState(hash),
        () => this.verifyFromTransactionHistory(hash),
        () => this.verifyFromBackupIndex(hash)
      ];

      let lastError;
      
      for (const [index, strategy] of verificationStrategies.entries()) {
        try {
          const result = await this.executeWithCircuitBreaker('l0', strategy);
          
          if (result.verified) {
            const duration = Date.now() - startTime;
            
            logger.info(`PDF verification completed:`, {
              operationId,
              verified: true,
              strategy: index + 1,
              duration: `${duration}ms`
            });
            
            return {
              ...result,
              operationId,
              duration,
              verificationStrategy: index + 1
            };
          }
        } catch (error) {
          lastError = error;
          logger.warn(`Verification strategy ${index + 1} failed:`, {
            operationId,
            error: error.message,
            strategy: index + 1
          });
        }
      }

      // All strategies failed
      const duration = Date.now() - startTime;
      
      logger.info(`PDF verification completed - not found:`, {
        operationId,
        verified: false,
        duration: `${duration}ms`
      });

      return {
        verified: false,
        message: 'PDF hash not found on blockchain',
        operationId,
        duration,
        searchedStrategies: verificationStrategies.length
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`PDF verification failed:`, {
        operationId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      this.trackError(error, 'verifyPDF', { operationId, hash });
      throw error;
    }
  }

  /**
   * Enhanced transaction submission with comprehensive retry logic
   */
  async submitTransactionWithEnhancedRetry(transactionData, operationId) {
    const maxRetries = this.config.retries;
    const errors = [];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Transaction submission attempt ${attempt}/${maxRetries}:`, {
          operationId,
          attempt
        });
        
        // Add jitter to prevent thundering herd
        if (attempt > 1) {
          const jitter = Math.random() * 1000;
          await this.delay(this.calculateBackoff(attempt) + jitter);
        }
        
        const response = await this.clients.dataL1.post('/transactions', transactionData);
        
        // Enhanced response validation
        this.validateTransactionResponse(response.data);
        
        logger.info(`Transaction submitted successfully:`, {
          operationId,
          attempt,
          transactionHash: response.data.hash
        });
        
        return response.data;
        
      } catch (error) {
        const enhancedError = this.enhanceError(error, 'dataL1');
        errors.push({
          attempt,
          error: enhancedError,
          timestamp: new Date().toISOString(),
          backoffMs: this.calculateBackoff(attempt)
        });
        
        logger.warn(`Transaction submission attempt ${attempt} failed:`, {
          operationId,
          attempt,
          error: enhancedError.message,
          category: enhancedError.category,
          retryable: enhancedError.retryable
        });
        
        // Don't retry for non-retryable errors
        if (!enhancedError.retryable || attempt === maxRetries) {
          throw new BlockchainError(
            `Transaction submission failed after ${attempt} attempts`,
            enhancedError.category,
            errors,
            false
          );
        }
      }
    }
  }

  /**
   * Enhanced network information retrieval
   */
  async getNetworkInfo() {
    try {
      const networkInfoPromises = [
        this.executeWithCircuitBreaker('l0', () => 
          this.clients.l0.get('/cluster/info').catch(() => null)
        ),
        this.executeWithCircuitBreaker('dataL1', () => 
          this.clients.dataL1.get('/info').catch(() => null)
        ),
        this.executeWithCircuitBreaker('globalL0', () => 
          this.clients.globalL0.get('/cluster/info').catch(() => null)
        )
      ];

      const [l0Info, dataL1Info, globalL0Info] = await Promise.allSettled(networkInfoPromises);
      
      const l0Data = l0Info.status === 'fulfilled' ? l0Info.value?.data : null;
      const dataL1Data = dataL1Info.status === 'fulfilled' ? dataL1Info.value?.data : null;
      const globalL0Data = globalL0Info.status === 'fulfilled' ? globalL0Info.value?.data : null;

      // Calculate network health score
      const healthScore = this.calculateNetworkHealthScore(l0Data, dataL1Data, globalL0Data);

      return {
        networkName: this.network,
        chainId: this.metagraphId || 'unknown',
        blockHeight: dataL1Data?.ordinal || 0,
        nodeVersion: l0Data?.version || 'unknown',
        status: healthScore > 0.7 ? 'healthy' : healthScore > 0.3 ? 'degraded' : 'unhealthy',
        healthScore,
        lastBlockTimestamp: dataL1Data?.lastSnapshotTimestamp || new Date().toISOString(),
        peerCount: l0Data?.peers?.length || 0,
        layers: {
          l0: l0Data ? 'healthy' : 'unavailable',
          dataL1: dataL1Data ? 'healthy' : 'unavailable',
          globalL0: globalL0Data ? 'healthy' : 'unavailable'
        },
        performance: {
          averageResponseTime: this.metrics.averageResponseTime,
          successRate: this.metrics.totalRequests > 0 ? 
            (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0
        },
        activeRequests: this.activeRequests.size
      };

    } catch (error) {
      logger.error('Failed to get network info:', error);
      
      return {
        networkName: this.network,
        chainId: 'unknown',
        blockHeight: 0,
        nodeVersion: 'unknown',
        status: 'offline',
        healthScore: 0,
        lastBlockTimestamp: new Date().toISOString(),
        peerCount: 0,
        error: error.message,
        layers: {
          l0: 'unavailable',
          dataL1: 'unavailable',
          globalL0: 'unavailable'
        }
      };
    }
  }

  /**
   * Comprehensive health check with detailed diagnostics
   */
  async healthCheck() {
    const healthChecks = [
      { name: 'l0', client: this.clients.l0, endpoint: '/cluster/info' },
      { name: 'dataL1', client: this.clients.dataL1, endpoint: '/info' },
      { name: 'globalL0', client: this.clients.globalL0, endpoint: '/cluster/info' }
    ];

    const results = {};
    let healthyCount = 0;
    
    for (const check of healthChecks) {
      try {
        const startTime = Date.now();
        const response = await check.client.get(check.endpoint, { timeout: 5000 });
        const responseTime = Date.now() - startTime;
        
        results[check.name] = {
          status: 'healthy',
          responseTime,
          lastChecked: new Date().toISOString(),
          data: response.data
        };
        
        healthyCount++;
        
      } catch (error) {
        const enhancedError = this.enhanceError(error, check.name);
        
        results[check.name] = {
          status: 'unhealthy',
          error: enhancedError.message,
          category: enhancedError.category,
          lastChecked: new Date().toISOString()
        };
      }
    }

    const overallStatus = healthyCount === healthChecks.length ? 'healthy' :
                         healthyCount > 0 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      services: results,
      metrics: {
        ...this.metrics,
        responseTimes: undefined // Don't expose raw data
      },
      circuitBreakers: this.getCircuitBreakerStatus(),
      activeRequests: this.activeRequests.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Utility and helper methods
   */
  
  validateRegistrationData(data) {
    const required = ['hash', 'metadata', 'submitterAddress'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new BlockchainError(`Missing required field: ${field}`, 'VALIDATION_ERROR');
      }
    }

    if (!this.isValidHash(data.hash)) {
      throw new BlockchainError('Invalid hash format', 'VALIDATION_ERROR');
    }
  }

  prepareTransactionData(evidenceData, operationId) {
    const { hash, metadata, signature, submitterAddress } = evidenceData;
    
    // Enhanced metadata with operation tracking
    const enhancedMetadata = {
      ...metadata,
      operationId,
      timestamp: new Date().toISOString(),
      version: '1.1',
      sdk: 'ProofVault-Enhanced/1.0.0'
    };

    return {
      source: submitterAddress,
      destination: submitterAddress,
      amount: 0,
      fee: 0,
      salt: Date.now(),
      parent: { ordinal: 0, hash: '' },
      data: {
        type: 'PDFRegistrationData',
        value: JSON.stringify({
          pdfRecord: {
            hash,
            url: metadata.originalUrl,
            title: metadata.documentTitle || 'Unknown Document',
            captureTimestamp: new Date(metadata.captureTimestamp).getTime(),
            submitterAddress,
            metadata: enhancedMetadata,
            registrationId: operationId
          },
          signature,
          version: '1.1'
        })
      }
    };
  }

  validateTransactionResponse(response) {
    if (!response || !response.hash) {
      throw new BlockchainError('Invalid response from metagraph: missing transaction hash');
    }
    
    if (!this.isValidHash(response.hash)) {
      throw new BlockchainError('Invalid transaction hash format in response');
    }
  }

  enhanceError(error, serviceName) {
    if (error instanceof BlockchainError) {
      return error;
    }

    // Network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new ExternalServiceError(
        serviceName,
        'Connection refused - service may be down',
        true
      );
    }
    
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return new TimeoutError(
        `${serviceName} request`,
        error.timeout || this.config.timeout
      );
    }
    
    // HTTP status-based errors
    const status = error.response?.status;
    const data = error.response?.data;
    
    if (status >= 500) {
      return new ExternalServiceError(
        serviceName,
        data?.message || error.message,
        true
      );
    }
    
    if (status === 429) {
      return new BlockchainError(
        'Rate limited by blockchain node',
        'RATE_LIMITED',
        [],
        true
      );
    }
    
    if (status >= 400 && status < 500) {
      return new BlockchainError(
        data?.message || error.message,
        'CLIENT_ERROR',
        [],
        false
      );
    }
    
    return new BlockchainError(
      error.message || 'Unknown blockchain error',
      'UNKNOWN_ERROR',
      [],
      false
    );
  }

  calculateBackoff(attempt) {
    const exponentialBackoff = this.config.backoffMs * Math.pow(2, attempt - 1);
    return Math.min(exponentialBackoff, this.config.maxBackoffMs);
  }

  calculateNetworkHealthScore(l0Data, dataL1Data, globalL0Data) {
    let score = 0;
    
    if (l0Data) score += 0.4;
    if (dataL1Data) score += 0.4;
    if (globalL0Data) score += 0.2;
    
    // Adjust based on response times
    if (this.metrics.averageResponseTime < 1000) score += 0.1;
    else if (this.metrics.averageResponseTime > 5000) score -= 0.1;
    
    // Adjust based on success rate
    const successRate = this.metrics.totalRequests > 0 ? 
      this.metrics.successfulRequests / this.metrics.totalRequests : 1;
    
    if (successRate > 0.9) score += 0.1;
    else if (successRate < 0.7) score -= 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  updateMetrics(serviceName, duration, success) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update response times (keep last 1000)
    this.metrics.responseTimes.push(duration);
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }
    
    // Calculate rolling average
    this.metrics.averageResponseTime = 
      this.metrics.responseTimes.reduce((a, b) => a + b, 0) / 
      this.metrics.responseTimes.length;
  }

  trackError(error, operation, context) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: {
        message: error.message,
        category: error.category || 'unknown',
        code: error.code
      },
      context
    };
    
    this.metrics.recentErrors.unshift(errorEntry);
    if (this.metrics.recentErrors.length > 100) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(0, 100);
    }
    
    // Update error category metrics
    const category = error.category || 'unknown';
    const count = this.metrics.errorsByCategory.get(category) || 0;
    this.metrics.errorsByCategory.set(category, count + 1);
  }

  getCircuitBreakerStatus() {
    const status = {};
    
    for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
      status[serviceName] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime
      };
    }
    
    return status;
  }

  startHealthMonitoring() {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000);
  }

  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Delegate methods to base service for backward compatibility
  async verifyFromMetagraphState(hash) {
    return baseMetagraphService.queryPDFRegistryState(hash);
  }

  async verifyFromTransactionHistory(hash) {
    return baseMetagraphService.searchPDFTransactions(hash);
  }

  async verifyFromBackupIndex(hash) {
    // Placeholder for additional verification method
    return { verified: false };
  }

  isValidHash(hash) {
    return baseMetagraphService.isValidHash(hash);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const enhancedMetagraphService = new EnhancedMetagraphService();

// Graceful shutdown
process.on('SIGINT', () => {
  enhancedMetagraphService.stopHealthMonitoring();
});

process.on('SIGTERM', () => {
  enhancedMetagraphService.stopHealthMonitoring();
});

module.exports = enhancedMetagraphService;