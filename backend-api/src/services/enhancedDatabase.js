/**
 * Enhanced Database Service
 * 
 * Enhanced database operations with comprehensive error handling, retry logic,
 * connection management, and performance monitoring for ProofVault.
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { 
  DatabaseError, 
  TimeoutError, 
  IntegrityError,
  NotFoundError,
  ErrorFactory 
} = require('../types/errors');

// Import existing database functions
const { 
  pool, 
  query: baseQuery, 
  withTransaction: baseWithTransaction,
  getClient,
  healthCheck,
  getPoolStats 
} = require('./database');

/**
 * Enhanced database service with comprehensive error handling
 */
class EnhancedDatabaseService {
  constructor() {
    this.pool = pool;
    this.connectionRetries = new Map(); // Track connection retry attempts
    this.queryMetrics = {
      totalQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      averageResponseTime: 0,
      queryTimes: []
    };
    
    // Circuit breaker state for database operations
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      lastFailureTime: null,
      timeout: 30000, // 30 seconds
      threshold: 5 // failures before opening
    };
    
    this.initializeEventHandlers();
  }

  /**
   * Initialize database event handlers
   */
  initializeEventHandlers() {
    this.pool.on('error', (err, client) => {
      logger.error('Database pool error:', {
        error: err.message,
        code: err.code,
        severity: err.severity,
        stack: err.stack
      });
      
      this.incrementCircuitBreakerFailure();
    });

    this.pool.on('connect', (client) => {
      logger.debug('New database client connected');
      this.resetCircuitBreakerOnSuccess();
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed from pool');
    });
  }

  /**
   * Enhanced query method with comprehensive error handling
   */
  async query(text, params = [], options = {}) {
    const {
      timeout = 30000,
      retries = 3,
      backoffMs = 1000,
      skipCircuitBreaker = false
    } = options;

    // Check circuit breaker
    if (!skipCircuitBreaker && this.isCircuitBreakerOpen()) {
      throw new DatabaseError(
        'Database circuit breaker is open',
        { state: this.circuitBreaker.state },
        false
      );
    }

    const startTime = Date.now();
    const queryId = uuidv4().substring(0, 8);
    
    logger.debug(`Query ${queryId} starting:`, {
      query: text.substring(0, 100),
      paramCount: params.length
    });

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Add query timeout
        const queryPromise = baseQuery(text, params);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new TimeoutError(`Query`, timeout)), timeout);
        });

        const result = await Promise.race([queryPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        this.updateQueryMetrics(duration, true);
        
        logger.debug(`Query ${queryId} completed:`, {
          duration: `${duration}ms`,
          rows: result.rowCount,
          attempt
        });

        this.resetCircuitBreakerOnSuccess();
        return result;

      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;
        
        logger.warn(`Query ${queryId} attempt ${attempt} failed:`, {
          error: error.message,
          code: error.code,
          duration: `${duration}ms`,
          query: text.substring(0, 100)
        });

        // Categorize the error
        const categorizedError = this.categorizeError(error);
        
        // Don't retry for certain error types
        if (!categorizedError.retryable || attempt === retries) {
          this.updateQueryMetrics(duration, false);
          this.incrementCircuitBreakerFailure();
          throw categorizedError;
        }

        // Exponential backoff
        if (attempt < retries) {
          const delay = backoffMs * Math.pow(2, attempt - 1);
          logger.debug(`Query ${queryId} retrying in ${delay}ms`);
          await this.delay(delay);
        }
      }
    }

    this.updateQueryMetrics(Date.now() - startTime, false);
    this.incrementCircuitBreakerFailure();
    throw lastError;
  }

  /**
   * Enhanced transaction wrapper with retry logic and proper cleanup
   */
  async withTransaction(callback, options = {}) {
    const {
      timeout = 60000,
      retries = 2,
      isolationLevel = null
    } = options;

    let client;
    let attempt = 0;
    let lastError;

    while (attempt <= retries) {
      attempt++;
      
      try {
        client = await this.getClientWithRetry();
        
        // Set isolation level if specified
        if (isolationLevel) {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
        }

        // Start transaction with timeout
        await client.query('BEGIN');
        
        // Set transaction timeout
        if (timeout > 0) {
          await client.query(`SET LOCAL statement_timeout = ${timeout}`);
        }

        const result = await callback(client);
        await client.query('COMMIT');
        
        logger.debug(`Transaction completed successfully on attempt ${attempt}`);
        return result;

      } catch (error) {
        lastError = error;
        
        if (client) {
          try {
            await client.query('ROLLBACK');
            logger.debug(`Transaction rolled back on attempt ${attempt}`);
          } catch (rollbackError) {
            logger.error('Transaction rollback failed:', rollbackError);
          }
        }

        const categorizedError = this.categorizeError(error);
        
        logger.warn(`Transaction attempt ${attempt} failed:`, {
          error: error.message,
          code: error.code,
          retryable: categorizedError.retryable
        });

        // Don't retry for non-retryable errors
        if (!categorizedError.retryable || attempt > retries) {
          throw categorizedError;
        }

        // Exponential backoff between retries
        if (attempt <= retries) {
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }

      } finally {
        if (client) {
          client.release();
        }
      }
    }

    throw lastError;
  }

  /**
   * Get database client with retry logic
   */
  async getClientWithRetry(retries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const client = await this.pool.connect();
        return client;
      } catch (error) {
        lastError = error;
        
        logger.warn(`Client acquisition attempt ${attempt} failed:`, {
          error: error.message,
          code: error.code,
          poolStats: getPoolStats()
        });

        if (attempt < retries) {
          await this.delay(500 * attempt);
        }
      }
    }

    throw new DatabaseError(
      'Failed to acquire database client',
      { attempts: retries, lastError: lastError.message },
      true
    );
  }

  /**
   * Batch query execution with transaction management
   */
  async batchQuery(queries, options = {}) {
    const { useTransaction = true, continueOnError = false } = options;

    if (!useTransaction) {
      const results = [];
      
      for (const queryObj of queries) {
        try {
          const result = await this.query(queryObj.text, queryObj.params);
          results.push({ success: true, result });
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          results.push({ success: false, error: error.message });
        }
      }
      
      return results;
    }

    return this.withTransaction(async (client) => {
      const results = [];
      
      for (const queryObj of queries) {
        try {
          const result = await client.query(queryObj.text, queryObj.params);
          results.push({ success: true, result });
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          results.push({ success: false, error: error.message });
        }
      }
      
      return results;
    });
  }

  /**
   * Enhanced evidence record operations with better error handling
   */
  async createEvidenceRecord(data) {
    try {
      const validatedData = this.validateEvidenceData(data);
      
      const result = await this.query(`
        INSERT INTO evidence_records (
          id, hash, original_url, document_title, mime_type, file_size,
          capture_timestamp, capture_user_agent, capture_viewport_size,
          submitter_address, submitter_signature, local_file_path,
          ipfs_hash, storage_backend, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *
      `, [
        validatedData.id,
        validatedData.hash,
        validatedData.originalUrl,
        validatedData.documentTitle,
        validatedData.mimeType,
        validatedData.fileSize,
        validatedData.captureTimestamp,
        validatedData.captureUserAgent,
        JSON.stringify(validatedData.captureViewportSize),
        validatedData.submitterAddress,
        validatedData.submitterSignature,
        validatedData.localFilePath,
        validatedData.ipfsHash,
        validatedData.storageBackend,
        JSON.stringify(validatedData.metadata)
      ]);

      logger.info('Evidence record created:', { 
        id: validatedData.id, 
        hash: validatedData.hash.substring(0, 16) + '...' 
      });
      
      return this.formatEvidenceRecord(result.rows[0]);

    } catch (error) {
      if (error instanceof DatabaseError || error instanceof IntegrityError) {
        throw error;
      }
      
      const dbError = this.categorizeError(error);
      logger.error('Failed to create evidence record:', {
        error: error.message,
        code: error.code,
        data: { ...data, signature: '[REDACTED]' }
      });
      
      throw dbError;
    }
  }

  /**
   * Safe evidence record retrieval with proper error handling
   */
  async findEvidenceRecordByHash(hash) {
    if (!this.isValidHash(hash)) {
      throw new IntegrityError('Invalid hash format', { hash });
    }

    try {
      const result = await this.query(
        'SELECT * FROM evidence_records WHERE hash = $1',
        [hash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatEvidenceRecord(result.rows[0]);

    } catch (error) {
      logger.error('Failed to find evidence record by hash:', {
        error: error.message,
        hash: hash.substring(0, 16) + '...'
      });
      
      throw this.categorizeError(error);
    }
  }

  /**
   * Enhanced evidence record search with pagination and filtering
   */
  async searchEvidenceRecords(criteria = {}, pagination = {}) {
    try {
      const {
        hash,
        submitterAddress,
        status,
        dateFrom,
        dateTo,
        searchTerm
      } = criteria;

      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = pagination;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        throw new IntegrityError('Invalid pagination parameters');
      }

      const offset = (page - 1) * limit;
      const allowedSortFields = ['created_at', 'updated_at', 'document_title', 'file_size'];
      const allowedSortOrders = ['asc', 'desc'];

      if (!allowedSortFields.includes(sortBy) || !allowedSortOrders.includes(sortOrder.toLowerCase())) {
        throw new IntegrityError('Invalid sort parameters');
      }

      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      // Build WHERE conditions safely
      if (hash) {
        if (!this.isValidHash(hash)) {
          throw new IntegrityError('Invalid hash format');
        }
        whereConditions.push(`hash = $${++paramCount}`);
        queryParams.push(hash);
      }

      if (submitterAddress) {
        whereConditions.push(`submitter_address = $${++paramCount}`);
        queryParams.push(submitterAddress);
      }

      if (status && Array.isArray(status)) {
        const statusPlaceholders = status.map(() => `$${++paramCount}`).join(',');
        whereConditions.push(`status IN (${statusPlaceholders})`);
        queryParams.push(...status);
      }

      if (dateFrom) {
        whereConditions.push(`created_at >= $${++paramCount}`);
        queryParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push(`created_at <= $${++paramCount}`);
        queryParams.push(dateTo);
      }

      if (searchTerm) {
        whereConditions.push(`(
          document_title ILIKE $${++paramCount} OR
          original_url ILIKE $${++paramCount}
        )`);
        const searchPattern = `%${searchTerm}%`;
        queryParams.push(searchPattern, searchPattern);
        paramCount++; // Account for the second parameter
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countResult = await this.query(`
        SELECT COUNT(*) as total FROM evidence_records ${whereClause}
      `, queryParams);

      // Get records with pagination
      queryParams.push(limit, offset);
      const result = await this.query(`
        SELECT * FROM evidence_records 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, queryParams);

      const totalCount = parseInt(countResult.rows[0].total);
      const records = result.rows.map(row => this.formatEvidenceRecord(row));

      return {
        records,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      logger.error('Evidence record search failed:', {
        error: error.message,
        criteria,
        pagination
      });
      
      throw this.categorizeError(error);
    }
  }

  /**
   * Validate evidence record data
   */
  validateEvidenceData(data) {
    const required = ['hash', 'originalUrl', 'submitterAddress'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new IntegrityError(`Missing required field: ${field}`);
      }
    }

    if (!this.isValidHash(data.hash)) {
      throw new IntegrityError('Invalid hash format');
    }

    return {
      id: data.id || uuidv4(),
      hash: data.hash,
      originalUrl: data.originalUrl,
      documentTitle: data.documentTitle || 'Untitled Document',
      mimeType: data.mimeType || 'application/pdf',
      fileSize: data.fileSize || 0,
      captureTimestamp: data.captureTimestamp || new Date(),
      captureUserAgent: data.captureUserAgent || '',
      captureViewportSize: data.captureViewportSize || {},
      submitterAddress: data.submitterAddress,
      submitterSignature: data.submitterSignature || '',
      localFilePath: data.localFilePath || null,
      ipfsHash: data.ipfsHash || null,
      storageBackend: data.storageBackend || 'local',
      metadata: data.metadata || {}
    };
  }

  /**
   * Format database record for API response
   */
  formatEvidenceRecord(row) {
    try {
      return {
        id: row.id,
        hash: row.hash,
        originalUrl: row.original_url,
        documentTitle: row.document_title,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        captureTimestamp: row.capture_timestamp,
        captureUserAgent: row.capture_user_agent,
        captureViewportSize: this.safeJsonParse(row.capture_viewport_size),
        submitterAddress: row.submitter_address,
        submitterSignature: row.submitter_signature,
        metagraphTxHash: row.metagraph_tx_hash,
        metagraphBlockHeight: row.metagraph_block_height,
        blockchainTimestamp: row.blockchain_timestamp,
        consensusConfirmationCount: row.consensus_confirmation_count,
        status: row.status,
        processingStartedAt: row.processing_started_at,
        processingCompletedAt: row.processing_completed_at,
        errorMessage: row.error_message,
        retryCount: row.retry_count,
        localFilePath: row.local_file_path,
        ipfsHash: row.ipfs_hash,
        storageBackend: row.storage_backend,
        metadata: this.safeJsonParse(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('Failed to format evidence record:', {
        error: error.message,
        recordId: row.id
      });
      throw new IntegrityError('Failed to format database record');
    }
  }

  /**
   * Safe JSON parsing with error handling
   */
  safeJsonParse(jsonString, defaultValue = {}) {
    if (!jsonString) return defaultValue;
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn('JSON parse failed:', { jsonString: jsonString.substring(0, 100) });
      return defaultValue;
    }
  }

  /**
   * Categorize database errors for proper handling
   */
  categorizeError(error) {
    if (error instanceof DatabaseError || error instanceof IntegrityError) {
      return error;
    }

    return ErrorFactory.createFromDatabaseError(error);
  }

  /**
   * Circuit breaker management
   */
  isCircuitBreakerOpen() {
    if (this.circuitBreaker.state === 'CLOSED') {
      return false;
    }

    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }

    return false; // HALF_OPEN allows requests
  }

  incrementCircuitBreakerFailure() {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      logger.warn('Database circuit breaker opened', {
        failureCount: this.circuitBreaker.failureCount,
        threshold: this.circuitBreaker.threshold
      });
    }
  }

  resetCircuitBreakerOnSuccess() {
    if (this.circuitBreaker.state !== 'CLOSED') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.lastFailureTime = null;
      logger.info('Database circuit breaker closed');
    }
  }

  /**
   * Update query performance metrics
   */
  updateQueryMetrics(duration, success) {
    this.queryMetrics.totalQueries++;
    
    if (!success) {
      this.queryMetrics.failedQueries++;
    }

    if (duration > 1000) { // Slow query threshold
      this.queryMetrics.slowQueries++;
    }

    // Keep rolling average of query times
    this.queryMetrics.queryTimes.push(duration);
    if (this.queryMetrics.queryTimes.length > 1000) {
      this.queryMetrics.queryTimes.shift();
    }

    this.queryMetrics.averageResponseTime = 
      this.queryMetrics.queryTimes.reduce((a, b) => a + b, 0) / 
      this.queryMetrics.queryTimes.length;
  }

  /**
   * Get comprehensive database health and performance metrics
   */
  async getHealthMetrics() {
    try {
      const baseHealth = await healthCheck();
      const poolStats = getPoolStats();

      return {
        ...baseHealth,
        pool: {
          ...poolStats,
          circuitBreaker: {
            state: this.circuitBreaker.state,
            failureCount: this.circuitBreaker.failureCount
          }
        },
        performance: {
          ...this.queryMetrics,
          queryTimes: undefined // Don't expose raw data
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Utility methods
   */
  isValidHash(hash) {
    return typeof hash === 'string' && 
           hash.length === 64 && 
           /^[a-fA-F0-9]{64}$/.test(hash);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const enhancedDatabaseService = new EnhancedDatabaseService();

module.exports = enhancedDatabaseService;