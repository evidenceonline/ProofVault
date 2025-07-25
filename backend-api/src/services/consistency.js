/**
 * Data Consistency Service
 * 
 * Ensures data consistency between the PostgreSQL database and the
 * Constellation Network metagraph for ProofVault evidence records.
 */

const logger = require('../utils/logger');
const databaseService = require('./database');
const metagraphService = require('./metagraph');
const { webSocketService } = require('./websocket');
const AuditMiddleware = require('../middleware/audit');

class ConsistencyService {
  constructor() {
    this.consistencyCheckInterval = null;
    this.isRunning = false;
    this.lastFullCheck = null;
    this.checkIntervalMs = parseInt(process.env.CONSISTENCY_CHECK_INTERVAL_MS) || 60000; // 1 minute default
  }

  /**
   * Start periodic consistency checks
   */
  start() {
    if (this.isRunning) {
      logger.warn('Consistency service is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting consistency service with ${this.checkIntervalMs}ms interval`);

    // Run initial check
    this.performConsistencyCheck();

    // Schedule periodic checks
    this.consistencyCheckInterval = setInterval(() => {
      this.performConsistencyCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop periodic consistency checks
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.consistencyCheckInterval) {
      clearInterval(this.consistencyCheckInterval);
      this.consistencyCheckInterval = null;
    }

    logger.info('Consistency service stopped');
  }

  /**
   * Perform comprehensive consistency check
   */
  async performConsistencyCheck() {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    logger.debug('Starting consistency check...');

    try {
      const checkResult = await this.runConsistencyChecks();
      const processingTime = Date.now() - startTime;

      // Log system event
      await AuditMiddleware.logSystemEvent('CONSISTENCY_CHECK_COMPLETED', {
        processingTimeMs: processingTime,
        checkedRecords: checkResult.totalChecked,
        inconsistencies: checkResult.inconsistencyCount,
        consistencyScore: checkResult.consistencyScore
      });

      // Notify via WebSocket if there are significant issues
      if (checkResult.consistencyScore < 95) {
        webSocketService.broadcastToSubscribers('system_alerts', {
          type: 'consistency_alert',
          severity: checkResult.consistencyScore < 90 ? 'high' : 'medium',
          message: `Data consistency score: ${checkResult.consistencyScore}%`,
          inconsistencies: checkResult.inconsistencyCount,
          timestamp: new Date().toISOString()
        });
      }

      this.lastFullCheck = new Date().toISOString();
      logger.debug(`Consistency check completed in ${processingTime}ms: ${checkResult.consistencyScore}% consistent`);

    } catch (error) {
      logger.error('Consistency check failed:', error);
      
      await AuditMiddleware.logSystemEvent('CONSISTENCY_CHECK_FAILED', {
        error: error.message,
        processingTimeMs: Date.now() - startTime
      });
    }
  }

  /**
   * Run all consistency checks
   */
  async runConsistencyChecks() {
    const checks = await Promise.allSettled([
      this.checkConfirmedRecordsOnBlockchain(),
      this.checkBlockchainRecordsInDatabase(),
      this.checkTransactionIntegrity(),
      this.checkHashDuplicates()
    ]);

    let totalChecked = 0;
    let totalInconsistencies = 0;
    const inconsistencies = [];

    for (let i = 0; i < checks.length; i++) {
      if (checks[i].status === 'fulfilled') {
        const result = checks[i].value;
        totalChecked += result.checkedCount || 0;
        totalInconsistencies += result.inconsistencies?.length || 0;
        if (result.inconsistencies) {
          inconsistencies.push(...result.inconsistencies);
        }
      } else {
        logger.error(`Consistency check ${i} failed:`, checks[i].reason);
        inconsistencies.push({
          type: 'CHECK_FAILED',
          checkIndex: i,
          error: checks[i].reason.message
        });
      }
    }

    const consistencyScore = totalChecked > 0 
      ? Math.round(((totalChecked - totalInconsistencies) / totalChecked) * 100)
      : 100;

    return {
      totalChecked,
      inconsistencyCount: totalInconsistencies,
      inconsistencies,
      consistencyScore,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check that confirmed database records exist on blockchain
   */
  async checkConfirmedRecordsOnBlockchain() {
    const limit = 50; // Check 50 records at a time
    let checkedCount = 0;
    const inconsistencies = [];

    try {
      // Get recently confirmed records
      const confirmedRecords = await databaseService.query(`
        SELECT id, hash, metagraph_tx_hash, status, created_at
        FROM evidence_records 
        WHERE status = 'confirmed' 
          AND metagraph_tx_hash IS NOT NULL
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      for (const record of confirmedRecords.rows) {
        checkedCount++;
        
        try {
          const blockchainResult = await metagraphService.verifyPDF(record.hash);
          
          if (!blockchainResult.verified) {
            inconsistencies.push({
              type: 'MISSING_ON_BLOCKCHAIN',
              evidenceId: record.id,
              hash: record.hash,
              txHash: record.metagraph_tx_hash,
              message: 'Record marked as confirmed in database but not found on blockchain'
            });

            // Auto-heal: Update status to failed if blockchain verification fails
            await this.autoHealRecord(record.id, 'blockchain_verification_failed');
          }
        } catch (verificationError) {
          inconsistencies.push({
            type: 'VERIFICATION_ERROR',
            evidenceId: record.id,
            hash: record.hash,
            error: verificationError.message
          });
        }
      }

      logger.debug(`Checked ${checkedCount} confirmed records against blockchain`);
      return { checkedCount, inconsistencies };

    } catch (error) {
      logger.error('Failed to check confirmed records on blockchain:', error);
      throw error;
    }
  }

  /**
   * Check that recent blockchain records exist in database
   */
  async checkBlockchainRecordsInDatabase() {
    let checkedCount = 0;
    const inconsistencies = [];

    try {
      // Get recent PDFs from blockchain state
      const blockchainPDFs = await metagraphService.l0Client.get('/data-application/state/latest');
      
      if (!blockchainPDFs.data || !blockchainPDFs.data.registeredPDFs) {
        logger.warn('No blockchain PDF data available for consistency check');
        return { checkedCount: 0, inconsistencies: [] };
      }

      const recentPDFs = Object.values(blockchainPDFs.data.registeredPDFs)
        .filter(pdf => {
          // Check PDFs from last 24 hours
          const pdfDate = new Date(pdf.captureTimestamp);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return pdfDate > oneDayAgo;
        })
        .slice(0, 50); // Limit to 50 most recent

      for (const pdfRecord of recentPDFs) {
        checkedCount++;
        
        const dbRecord = await databaseService.findEvidenceRecordByHash(pdfRecord.hash);
        
        if (!dbRecord) {
          inconsistencies.push({
            type: 'MISSING_IN_DATABASE',
            hash: pdfRecord.hash,
            submitterAddress: pdfRecord.submitterAddress,
            message: 'Record found on blockchain but missing from database'
          });

          // Auto-heal: Sync record from blockchain
          await this.autoSyncFromBlockchain(pdfRecord);
        } else if (dbRecord.status !== 'confirmed') {
          inconsistencies.push({
            type: 'STATUS_MISMATCH',
            evidenceId: dbRecord.id,
            hash: pdfRecord.hash,
            dbStatus: dbRecord.status,
            message: 'Record exists on blockchain but not marked as confirmed in database'
          });

          // Auto-heal: Update status to confirmed
          await this.autoHealRecord(dbRecord.id, 'sync_status_from_blockchain');
        }
      }

      logger.debug(`Checked ${checkedCount} blockchain records against database`);
      return { checkedCount, inconsistencies };

    } catch (error) {
      logger.error('Failed to check blockchain records in database:', error);
      throw error;
    }
  }

  /**
   * Check transaction integrity
   */
  async checkTransactionIntegrity() {
    let checkedCount = 0;
    const inconsistencies = [];

    try {
      // Check for evidence records with transactions that have mismatched data
      const records = await databaseService.query(`
        SELECT 
          er.id, er.hash, er.metagraph_tx_hash, er.status,
          bt.tx_hash, bt.raw_transaction
        FROM evidence_records er
        LEFT JOIN blockchain_transactions bt ON er.id = bt.evidence_record_id
        WHERE er.status = 'confirmed' 
          AND er.metagraph_tx_hash IS NOT NULL
          AND er.created_at >= NOW() - INTERVAL '1 hour'
        LIMIT 25
      `);

      for (const record of records.rows) {
        checkedCount++;

        // Check if evidence record has corresponding blockchain transaction
        if (!record.tx_hash) {
          inconsistencies.push({
            type: 'MISSING_TRANSACTION_RECORD',
            evidenceId: record.id,
            hash: record.hash,
            message: 'Evidence record confirmed but no blockchain transaction record found'
          });
        }

        // Check if transaction hash matches
        if (record.tx_hash && record.tx_hash !== record.metagraph_tx_hash) {
          inconsistencies.push({
            type: 'TRANSACTION_HASH_MISMATCH',
            evidenceId: record.id,
            evidenceRecordTxHash: record.metagraph_tx_hash,
            transactionRecordTxHash: record.tx_hash,
            message: 'Transaction hash mismatch between evidence record and transaction record'
          });
        }
      }

      logger.debug(`Checked ${checkedCount} transaction integrity records`);
      return { checkedCount, inconsistencies };

    } catch (error) {
      logger.error('Failed to check transaction integrity:', error);
      throw error;
    }
  }

  /**
   * Check for hash duplicates
   */
  async checkHashDuplicates() {
    let checkedCount = 0;
    const inconsistencies = [];

    try {
      // Find duplicate hashes in database
      const duplicates = await databaseService.query(`
        SELECT hash, COUNT(*) as count, array_agg(id) as evidence_ids
        FROM evidence_records
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY hash
        HAVING COUNT(*) > 1
      `);

      for (const duplicate of duplicates.rows) {
        checkedCount++;
        inconsistencies.push({
          type: 'DUPLICATE_HASH',
          hash: duplicate.hash,
          count: duplicate.count,
          evidenceIds: duplicate.evidence_ids,
          message: `Hash ${duplicate.hash} has ${duplicate.count} duplicate records`
        });
      }

      logger.debug(`Checked for hash duplicates, found ${inconsistencies.length} issues`);
      return { checkedCount, inconsistencies };

    } catch (error) {
      logger.error('Failed to check hash duplicates:', error);
      throw error;
    }
  }

  /**
   * Auto-heal record by updating status with reason
   */
  async autoHealRecord(evidenceId, reason) {
    try {
      let newStatus = 'failed';
      let errorMessage = `Auto-healed: ${reason}`;

      if (reason === 'sync_status_from_blockchain') {
        newStatus = 'confirmed';
        errorMessage = null;
      }

      await databaseService.updateEvidenceRecordStatus(evidenceId, newStatus, errorMessage);

      await AuditMiddleware.logSystemEvent('RECORD_AUTO_HEALED', {
        evidenceId,
        reason,
        newStatus
      });

      logger.info(`Auto-healed record ${evidenceId}: ${reason} -> ${newStatus}`);
    } catch (error) {
      logger.error(`Failed to auto-heal record ${evidenceId}:`, error);
    }
  }

  /**
   * Auto-sync record from blockchain to database
   */
  async autoSyncFromBlockchain(pdfRecord) {
    try {
      await databaseService.syncPDFFromBlockchain(pdfRecord, {
        transactionHash: pdfRecord.registrationId,
        blockNumber: 0,
        timestamp: new Date(pdfRecord.captureTimestamp).toISOString()
      });

      await AuditMiddleware.logSystemEvent('RECORD_AUTO_SYNCED', {
        hash: pdfRecord.hash,
        submitterAddress: pdfRecord.submitterAddress,
        source: 'blockchain'
      });

      logger.info(`Auto-synced record from blockchain: ${pdfRecord.hash.substring(0, 16)}...`);
    } catch (error) {
      logger.error('Failed to auto-sync record from blockchain:', error);
    }
  }

  /**
   * Get consistency status
   */
  async getConsistencyStatus() {
    return {
      isRunning: this.isRunning,
      lastFullCheck: this.lastFullCheck,
      checkIntervalMs: this.checkIntervalMs,
      nextCheckIn: this.lastFullCheck 
        ? Math.max(0, this.checkIntervalMs - (Date.now() - new Date(this.lastFullCheck).getTime()))
        : 0
    };
  }

  /**
   * Run manual consistency check
   */
  async runManualCheck() {
    logger.info('Running manual consistency check...');
    return await this.runConsistencyChecks();
  }
}

// Create singleton instance
const consistencyService = new ConsistencyService();

module.exports = consistencyService;