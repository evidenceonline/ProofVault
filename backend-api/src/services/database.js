/**
 * Database Service
 * 
 * Provides high-level database operations for ProofVault evidence records,
 * built on top of the PostgreSQL connection pool.
 */

const { query, withTransaction, getClient } = require('../../database/config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  /**
   * Evidence Records Operations
   */

  /**
   * Create a new evidence record
   */
  async createEvidenceRecord(data) {
    try {
      const id = uuidv4();
      const {
        hash,
        originalUrl,
        documentTitle,
        mimeType = 'application/pdf',
        fileSize,
        captureTimestamp,
        captureUserAgent,
        captureViewportSize,
        submitterAddress,
        submitterSignature,
        localFilePath,
        ipfsHash,
        storageBackend = 'local',
        metadata = {}
      } = data;

      const result = await query(`
        INSERT INTO evidence_records (
          id, hash, original_url, document_title, mime_type, file_size,
          capture_timestamp, capture_user_agent, capture_viewport_size,
          submitter_address, submitter_signature, local_file_path,
          ipfs_hash, storage_backend, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *
      `, [
        id, hash, originalUrl, documentTitle, mimeType, fileSize,
        captureTimestamp, captureUserAgent, JSON.stringify(captureViewportSize),
        submitterAddress, submitterSignature, localFilePath,
        ipfsHash, storageBackend, JSON.stringify(metadata)
      ]);

      logger.info(`Created evidence record: ${id} (hash: ${hash.substring(0, 16)}...)`);
      return this.formatEvidenceRecord(result.rows[0]);

    } catch (error) {
      logger.error('Failed to create evidence record:', error);
      throw error;
    }
  }

  /**
   * Update evidence record with blockchain information
   */
  async updateEvidenceRecordBlockchain(id, blockchainData) {
    try {
      const {
        metagraphTxHash,
        metagraphBlockHeight,
        blockchainTimestamp,
        consensusConfirmationCount = 0,
        status = 'confirmed',
        processingCompletedAt = new Date().toISOString()
      } = blockchainData;

      const result = await query(`
        UPDATE evidence_records 
        SET 
          metagraph_tx_hash = $2,
          metagraph_block_height = $3,
          blockchain_timestamp = $4,
          consensus_confirmation_count = $5,
          status = $6,
          processing_completed_at = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        id, metagraphTxHash, metagraphBlockHeight, blockchainTimestamp,
        consensusConfirmationCount, status, processingCompletedAt
      ]);

      if (result.rows.length === 0) {
        throw new Error(`Evidence record not found: ${id}`);
      }

      logger.info(`Updated evidence record blockchain data: ${id}`);
      return this.formatEvidenceRecord(result.rows[0]);

    } catch (error) {
      logger.error('Failed to update evidence record blockchain data:', error);
      throw error;
    }
  }

  /**
   * Update evidence record processing status
   */
  async updateEvidenceRecordStatus(id, status, errorMessage = null) {
    try {
      const updateFields = ['status = $2', 'updated_at = NOW()'];
      const values = [id, status];

      if (status === 'processing' && !errorMessage) {
        updateFields.push('processing_started_at = NOW()');
      }

      if (status === 'failed' && errorMessage) {
        updateFields.push('error_message = $' + (values.length + 1));
        updateFields.push('retry_count = retry_count + 1');
        values.push(errorMessage);
      }

      const result = await query(`
        UPDATE evidence_records 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error(`Evidence record not found: ${id}`);
      }

      logger.info(`Updated evidence record status: ${id} -> ${status}`);
      return this.formatEvidenceRecord(result.rows[0]);

    } catch (error) {
      logger.error('Failed to update evidence record status:', error);
      throw error;
    }
  }

  /**
   * Find evidence record by hash
   */
  async findEvidenceRecordByHash(hash) {
    try {
      const result = await query(`
        SELECT * FROM evidence_records 
        WHERE hash = $1
      `, [hash]);

      return result.rows.length > 0 ? this.formatEvidenceRecord(result.rows[0]) : null;

    } catch (error) {
      logger.error('Failed to find evidence record by hash:', error);
      throw error;
    }
  }

  /**
   * Find evidence record by ID
   */
  async findEvidenceRecordById(id) {
    try {
      const result = await query(`
        SELECT * FROM evidence_records 
        WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.formatEvidenceRecord(result.rows[0]) : null;

    } catch (error) {
      logger.error('Failed to find evidence record by ID:', error);
      throw error;
    }
  }

  /**
   * Get evidence records by submitter address with pagination
   */
  async getEvidenceRecordsBySubmitter(address, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
        status = null
      } = options;

      const offset = (page - 1) * limit;
      const orderBy = `${sortBy} ${sortOrder.toUpperCase()}`;

      let whereClause = 'WHERE submitter_address = $1';
      let queryParams = [address];

      if (status) {
        whereClause += ' AND status = $' + (queryParams.length + 1);
        queryParams.push(status);
      }

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM evidence_records ${whereClause}
      `, queryParams);

      // Get records
      queryParams.push(limit, offset);
      const result = await query(`
        SELECT * FROM evidence_records 
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
      `, queryParams);

      const totalCount = parseInt(countResult.rows[0].total);
      const records = result.rows.map(row => this.formatEvidenceRecord(row));

      return {
        records,
        totalCount,
        page,
        limit,
        hasMore: offset + limit < totalCount
      };

    } catch (error) {
      logger.error('Failed to get evidence records by submitter:', error);
      throw error;
    }
  }

  /**
   * Browse evidence records with filters
   */
  async browseEvidenceRecords(filters = {}, pagination = {}) {
    try {
      const {
        status,
        submitter,
        dateFrom,
        dateTo,
        search
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = pagination;

      const offset = (page - 1) * limit;
      const orderBy = `${sortBy} ${sortOrder.toUpperCase()}`;

      let whereConditions = [];
      let queryParams = [];

      // Build WHERE conditions
      if (status && status.length > 0) {
        const statusPlaceholders = status.map((_, i) => `$${queryParams.length + i + 1}`).join(',');
        whereConditions.push(`status IN (${statusPlaceholders})`);
        queryParams.push(...status);
      }

      if (submitter) {
        whereConditions.push(`submitter_address = $${queryParams.length + 1}`);
        queryParams.push(submitter);
      }

      if (dateFrom) {
        whereConditions.push(`created_at >= $${queryParams.length + 1}`);
        queryParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push(`created_at <= $${queryParams.length + 1}`);
        queryParams.push(dateTo);
      }

      if (search) {
        whereConditions.push(`(
          document_title ILIKE $${queryParams.length + 1} OR 
          original_url ILIKE $${queryParams.length + 1} OR
          hash ILIKE $${queryParams.length + 1}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM evidence_records ${whereClause}
      `, queryParams);

      // Get records
      queryParams.push(limit, offset);
      const result = await query(`
        SELECT * FROM evidence_records 
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
      `, queryParams);

      const totalCount = parseInt(countResult.rows[0].total);
      const records = result.rows.map(row => this.formatEvidenceRecord(row));

      return {
        records,
        totalCount,
        page,
        limit,
        hasMore: offset + limit < totalCount
      };

    } catch (error) {
      logger.error('Failed to browse evidence records:', error);
      throw error;
    }
  }

  /**
   * Blockchain Transactions Operations
   */

  /**
   * Create blockchain transaction record
   */
  async createBlockchainTransaction(data) {
    try {
      const id = uuidv4();
      const {
        txHash,
        evidenceRecordId,
        transactionType,
        blockHeight,
        blockHash,
        transactionIndex,
        gasUsed,
        gasPrice,
        transactionFee,
        rawTransaction,
        receiptData
      } = data;

      const result = await query(`
        INSERT INTO blockchain_transactions (
          id, tx_hash, evidence_record_id, transaction_type,
          block_height, block_hash, transaction_index,
          gas_used, gas_price, transaction_fee,
          raw_transaction, receipt_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `, [
        id, txHash, evidenceRecordId, transactionType,
        blockHeight, blockHash, transactionIndex,
        gasUsed, gasPrice, transactionFee,
        JSON.stringify(rawTransaction), JSON.stringify(receiptData)
      ]);

      logger.info(`Created blockchain transaction: ${id} (tx: ${txHash})`);
      return this.formatBlockchainTransaction(result.rows[0]);

    } catch (error) {
      logger.error('Failed to create blockchain transaction:', error);
      throw error;
    }
  }

  /**
   * Update blockchain transaction confirmation status
   */
  async updateTransactionConfirmation(txHash, confirmationData) {
    try {
      const {
        confirmationCount,
        isConfirmed,
        isFinalized,
        confirmedAt,
        finalizedAt
      } = confirmationData;

      const result = await query(`
        UPDATE blockchain_transactions
        SET 
          confirmation_count = $2,
          is_confirmed = $3,
          is_finalized = $4,
          confirmed_at = $5,
          finalized_at = $6
        WHERE tx_hash = $1
        RETURNING *
      `, [txHash, confirmationCount, isConfirmed, isFinalized, confirmedAt, finalizedAt]);

      if (result.rows.length === 0) {
        throw new Error(`Blockchain transaction not found: ${txHash}`);
      }

      return this.formatBlockchainTransaction(result.rows[0]);

    } catch (error) {
      logger.error('Failed to update transaction confirmation:', error);
      throw error;
    }
  }

  /**
   * Verification Attempts Operations
   */

  /**
   * Log verification attempt
   */
  async logVerificationAttempt(data) {
    try {
      const id = uuidv4();
      const {
        submittedHash,
        matchedEvidenceId,
        verificationResult,
        requesterIp,
        requesterUserAgent,
        requesterAddress,
        verificationMethod = 'api',
        additionalData = {},
        verificationDurationMs
      } = data;

      const result = await query(`
        INSERT INTO verification_attempts (
          id, submitted_hash, matched_evidence_id, verification_result,
          requester_ip, requester_user_agent, requester_address,
          verification_method, additional_data, verification_duration_ms
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *
      `, [
        id, submittedHash, matchedEvidenceId, verificationResult,
        requesterIp, requesterUserAgent, requesterAddress,
        verificationMethod, JSON.stringify(additionalData), verificationDurationMs
      ]);

      return this.formatVerificationAttempt(result.rows[0]);

    } catch (error) {
      logger.error('Failed to log verification attempt:', error);
      throw error;
    }
  }

  /**
   * Format database records to match frontend types
   */
  formatEvidenceRecord(row) {
    return {
      id: row.id,
      hash: row.hash,
      originalUrl: row.original_url,
      documentTitle: row.document_title,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      captureTimestamp: row.capture_timestamp,
      captureUserAgent: row.capture_user_agent,
      captureViewportSize: row.capture_viewport_size,
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
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  formatBlockchainTransaction(row) {
    return {
      id: row.id,
      txHash: row.tx_hash,
      evidenceRecordId: row.evidence_record_id,
      transactionType: row.transaction_type,
      blockHeight: row.block_height,
      blockHash: row.block_hash,
      transactionIndex: row.transaction_index,
      gasUsed: row.gas_used,
      gasPrice: row.gas_price,
      transactionFee: row.transaction_fee,
      submittedAt: row.submitted_at,
      confirmedAt: row.confirmed_at,
      finalizedAt: row.finalized_at,
      confirmationCount: row.confirmation_count,
      isConfirmed: row.is_confirmed,
      isFinalized: row.is_finalized,
      rawTransaction: row.raw_transaction,
      receiptData: row.receipt_data,
      errorCode: row.error_code,
      errorMessage: row.error_message
    };
  }

  formatVerificationAttempt(row) {
    return {
      id: row.id,
      submittedHash: row.submitted_hash,
      matchedEvidenceId: row.matched_evidence_id,
      verificationResult: row.verification_result,
      verificationTimestamp: row.verification_timestamp,
      requesterIp: row.requester_ip,
      requesterUserAgent: row.requester_user_agent,
      requesterAddress: row.requester_address,
      verificationMethod: row.verification_method,
      additionalData: row.additional_data,
      verificationDurationMs: row.verification_duration_ms
    };
  }

  /**
   * Execute query within a transaction
   */
  async executeTransaction(callback) {
    return withTransaction(callback);
  }

  /**
   * Enhanced PDF Evidence Operations for Scala Integration
   */

  /**
   * Sync PDF record from blockchain to database
   */
  async syncPDFFromBlockchain(pdfRecord, transactionData = {}) {
    try {
      return await this.executeTransaction(async (client) => {
        // Check if record already exists
        const existingQuery = await client.query(
          'SELECT id FROM evidence_records WHERE hash = $1',
          [pdfRecord.hash]
        );

        if (existingQuery.rows.length > 0) {
          return this.formatEvidenceRecord(existingQuery.rows[0]);
        }

        // Create evidence record from blockchain data
        const evidenceId = uuidv4();
        const evidenceResult = await client.query(`
          INSERT INTO evidence_records (
            id, hash, original_url, document_title, mime_type,
            capture_timestamp, submitter_address, status,
            storage_backend, metadata, 
            metagraph_tx_hash, metagraph_block_height, blockchain_timestamp
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) RETURNING *
        `, [
          evidenceId, pdfRecord.hash, pdfRecord.url, pdfRecord.title,
          'application/pdf', new Date(pdfRecord.captureTimestamp),
          pdfRecord.submitterAddress, 'confirmed', 'blockchain',
          JSON.stringify({
            ...pdfRecord.metadata,
            syncedFromBlockchain: true,
            registrationId: pdfRecord.registrationId
          }),
          transactionData.transactionHash,
          transactionData.blockNumber,
          transactionData.timestamp
        ]);

        // Create blockchain transaction record if provided
        if (transactionData.transactionHash) {
          await client.query(`
            INSERT INTO blockchain_transactions (
              id, tx_hash, evidence_record_id, transaction_type,
              block_height, raw_transaction
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            uuidv4(),
            transactionData.transactionHash,
            evidenceId,
            'register_pdf',
            transactionData.blockNumber,
            JSON.stringify(transactionData)
          ]);
        }

        logger.info(`Synced PDF from blockchain: ${pdfRecord.hash.substring(0, 16)}...`);
        return this.formatEvidenceRecord(evidenceResult.rows[0]);
      });

    } catch (error) {
      logger.error('Failed to sync PDF from blockchain:', error);
      throw error;
    }
  }

  /**
   * Get evidence statistics for dashboard
   */
  async getEvidenceStatistics(timeframe = '30d') {
    try {
      const timeCondition = this.getTimeCondition(timeframe);
      
      const results = await Promise.all([
        // Total records
        query('SELECT COUNT(*) as total FROM evidence_records'),
        
        // Records by status
        query(`
          SELECT status, COUNT(*) as count 
          FROM evidence_records 
          GROUP BY status
        `),
        
        // Recent activity
        query(`
          SELECT COUNT(*) as recent_count 
          FROM evidence_records 
          WHERE created_at >= NOW() - INTERVAL '${timeCondition}'
        `),
        
        // Top submitters
        query(`
          SELECT submitter_address, COUNT(*) as submission_count
          FROM evidence_records
          WHERE created_at >= NOW() - INTERVAL '${timeCondition}'
          GROUP BY submitter_address
          ORDER BY submission_count DESC
          LIMIT 10
        `),
        
        // Verification statistics
        query(`
          SELECT 
            verification_result,
            COUNT(*) as count
          FROM verification_attempts
          WHERE verification_timestamp >= NOW() - INTERVAL '${timeCondition}'
          GROUP BY verification_result
        `)
      ]);

      return {
        total: parseInt(results[0].rows[0].total),
        byStatus: results[1].rows,
        recentActivity: parseInt(results[2].rows[0].recent_count),
        topSubmitters: results[3].rows,
        verificationStats: results[4].rows,
        timeframe,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get evidence statistics:', error);
      throw error;
    }
  }

  /**
   * Check data consistency between database and blockchain
   */
  async checkDataConsistency(options = {}) {
    try {
      const { limit = 100, includeDetails = false } = options;
      
      // Get confirmed records that should be on blockchain
      const confirmedRecords = await query(`
        SELECT id, hash, metagraph_tx_hash, status
        FROM evidence_records 
        WHERE status = 'confirmed' AND metagraph_tx_hash IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      const inconsistencies = [];
      const metagraphService = require('./metagraph');

      for (const record of confirmedRecords.rows) {
        try {
          const blockchainResult = await metagraphService.verifyPDF(record.hash);
          
          if (!blockchainResult.verified) {
            inconsistencies.push({
              type: 'MISSING_ON_BLOCKCHAIN',
              evidenceId: record.id,
              hash: record.hash,
              txHash: record.metagraph_tx_hash,
              details: includeDetails ? record : null
            });
          }
        } catch (error) {
          inconsistencies.push({
            type: 'VERIFICATION_ERROR',
            evidenceId: record.id,
            hash: record.hash,
            error: error.message,
            details: includeDetails ? record : null
          });
        }
      }

      return {
        checkedRecords: confirmedRecords.rows.length,
        inconsistencies: inconsistencies,
        consistencyScore: ((confirmedRecords.rows.length - inconsistencies.length) / confirmedRecords.rows.length) * 100,
        checkedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to check data consistency:', error);
      throw error;
    }
  }

  /**
   * Create comprehensive audit log entry
   */
  async createAuditLog(auditData) {
    try {
      const {
        action,
        resourceType,
        resourceId,
        actorType = 'system',
        actorId,
        actorAddress,
        sourceIp,
        userAgent,
        oldValues = null,
        newValues = null,
        contextData = {}
      } = auditData;

      const result = await query(`
        INSERT INTO audit_logs (
          id, action, resource_type, resource_id,
          actor_type, actor_id, actor_address,
          source_ip, user_agent, old_values, new_values, context_data
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `, [
        uuidv4(), action, resourceType, resourceId,
        actorType, actorId, actorAddress,
        sourceIp, userAgent,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        JSON.stringify(contextData)
      ]);

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Helper function to convert timeframe to SQL interval
   */
  getTimeCondition(timeframe) {
    const timeframes = {
      '1d': '1 day',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '1y': '1 year'
    };
    return timeframes[timeframe] || '30 days';
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;