/**
 * Background Jobs Service
 * 
 * Handles scheduled tasks and background processing for ProofVault,
 * including transaction monitoring, file cleanup, and health checks.
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const databaseService = require('./database');
const metagraphService = require('./metagraph');
const pdfService = require('./pdf');
const { webSocketService } = require('./websocket');
const consistencyService = require('./consistency');

class BackgroundJobsService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start all background jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('Background jobs already running');
      return;
    }

    logger.info('Starting background jobs...');

    try {
      // Transaction monitoring job - every 30 seconds
      this.scheduleJob('transaction-monitor', '*/30 * * * * *', () => {
        this.monitorTransactions();
      });

      // File cleanup job - every hour
      this.scheduleJob('file-cleanup', '0 0 * * * *', () => {
        this.cleanupOldFiles();
      });

      // Health monitoring job - every 5 minutes
      this.scheduleJob('health-monitor', '0 */5 * * * *', () => {
        this.monitorHealth();
      });

      // Network status update job - every 2 minutes
      this.scheduleJob('network-status', '0 */2 * * * *', () => {
        this.updateNetworkStatus();
      });

      // Database maintenance job - daily at 2 AM
      this.scheduleJob('db-maintenance', '0 0 2 * * *', () => {
        this.performDatabaseMaintenance();
      });

      // Verification cache refresh job - every 10 minutes
      this.scheduleJob('cache-refresh', '0 */10 * * * *', () => {
        this.refreshVerificationCache();
      });

      // Data consistency check job - every 15 minutes
      this.scheduleJob('consistency-check', '0 */15 * * * *', () => {
        this.runConsistencyCheck();
      });

      // Start consistency service
      if (process.env.ENABLE_CONSISTENCY_CHECKS === 'true') {
        consistencyService.start();
      }

      this.isRunning = true;
      logger.info(`Started ${this.jobs.size} background jobs`);

    } catch (error) {
      logger.error('Failed to start background jobs:', error);
      throw error;
    }
  }

  /**
   * Stop all background jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Background jobs not running');
      return;
    }

    logger.info('Stopping background jobs...');

    for (const [name, job] of this.jobs) {
      job.destroy();
      logger.debug(`Stopped background job: ${name}`);
    }

    // Stop consistency service
    consistencyService.stop();

    this.jobs.clear();
    this.isRunning = false;
    logger.info('All background jobs stopped');
  }

  /**
   * Schedule a cron job
   */
  scheduleJob(name, pattern, task) {
    if (this.jobs.has(name)) {
      logger.warn(`Job ${name} already exists, skipping`);
      return;
    }

    const job = cron.schedule(pattern, async () => {
      const startTime = Date.now();
      logger.debug(`Running background job: ${name}`);

      try {
        await task();
        const duration = Date.now() - startTime;
        logger.debug(`Completed background job: ${name} (${duration}ms)`);
      } catch (error) {
        logger.error(`Background job failed: ${name}`, error);
      }
    }, {
      scheduled: false // Don't start immediately
    });

    this.jobs.set(name, job);
    job.start();
    logger.debug(`Scheduled background job: ${name} with pattern: ${pattern}`);
  }

  /**
   * Monitor pending transactions for confirmation updates
   */
  async monitorTransactions() {
    try {
      const { query } = require('../../database/config/database');
      
      // Get pending evidence records
      const pendingRecords = await query(`
        SELECT id, hash, metagraph_tx_hash, retry_count
        FROM evidence_records 
        WHERE status IN ('processing', 'pending') 
        AND metagraph_tx_hash IS NOT NULL
        AND retry_count < 5
        ORDER BY created_at DESC
        LIMIT 50
      `);

      if (pendingRecords.rows.length === 0) {
        return;
      }

      logger.debug(`Monitoring ${pendingRecords.rows.length} pending transactions`);

      for (const record of pendingRecords.rows) {
        try {
          const txHash = record.metagraph_tx_hash;
          const transaction = await metagraphService.getTransaction(txHash);

          if (transaction) {
            const confirmationCount = await metagraphService.getConfirmationCount(txHash);
            
            // Update evidence record if confirmed
            if (confirmationCount > 0) {
              await databaseService.updateEvidenceRecordBlockchain(record.id, {
                consensusConfirmationCount: confirmationCount,
                status: 'confirmed',
                processingCompletedAt: new Date().toISOString()
              });

              logger.info(`Transaction confirmed: ${txHash} (${confirmationCount} confirmations)`);

              // Notify WebSocket clients
              if (webSocketService) {
                webSocketService.notifyPDFProcessingUpdate(record.id, 'confirmed', {
                  txHash,
                  confirmations: confirmationCount
                });
              }
            }
          } else {
            // Transaction not found, increment retry count
            await databaseService.updateEvidenceRecordStatus(
              record.id, 
              'processing', 
              `Transaction not found: ${txHash}`
            );
          }

        } catch (error) {
          logger.warn(`Failed to check transaction ${record.metagraph_tx_hash}:`, error.message);
          
          // Update retry count
          await databaseService.updateEvidenceRecordStatus(
            record.id,
            'processing',
            `Monitoring error: ${error.message}`
          );
        }
      }

    } catch (error) {
      logger.error('Transaction monitoring job failed:', error);
    }
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles() {
    try {
      logger.debug('Starting file cleanup job');

      const cleanedCount = await pdfService.cleanupOldFiles(24); // 24 hours
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old temporary files`);
      }

    } catch (error) {
      logger.error('File cleanup job failed:', error);
    }
  }

  /**
   * Monitor system health and alert on issues
   */
  async monitorHealth() {
    try {
      // Check database health
      const { healthCheck } = require('../../database/config/database');
      const dbHealth = await healthCheck();

      if (dbHealth.status !== 'healthy') {
        logger.warn('Database health check failed:', dbHealth);
      }

      // Check metagraph health
      const metagraphHealth = await metagraphService.healthCheck();
      
      if (metagraphHealth.status !== 'healthy') {
        logger.warn('Metagraph health check failed:', metagraphHealth);
      }

      // Check storage health
      const storageStats = await pdfService.getStorageStats();
      
      if (storageStats.error) {
        logger.warn('Storage health check failed:', storageStats.error);
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (memUsedMB > 500) { // Alert if using more than 500MB
        logger.warn(`High memory usage: ${memUsedMB}MB`);
      }

    } catch (error) {
      logger.error('Health monitoring job failed:', error);
    }
  }

  /**
   * Update network status and broadcast to WebSocket clients
   */
  async updateNetworkStatus() {
    try {
      const networkInfo = await metagraphService.getNetworkInfo();
      
      // Broadcast to WebSocket clients
      if (webSocketService) {
        webSocketService.notifyNetworkStatus(networkInfo);
      }

      // Log significant network changes
      if (networkInfo.status !== 'healthy') {
        logger.warn('Network status changed:', networkInfo);
      }

    } catch (error) {
      logger.error('Network status update job failed:', error);
    }
  }

  /**
   * Perform database maintenance tasks
   */
  async performDatabaseMaintenance() {
    try {
      logger.info('Starting database maintenance');

      const { query } = require('../../database/config/database');

      // Refresh materialized view
      await query('REFRESH MATERIALIZED VIEW evidence_verification_cache');
      logger.debug('Refreshed evidence verification cache');

      // Clean up old verification attempts (older than 30 days)
      const cleanupResult = await query(`
        DELETE FROM verification_attempts 
        WHERE verification_timestamp < NOW() - INTERVAL '30 days'
      `);
      
      if (cleanupResult.rowCount > 0) {
        logger.info(`Cleaned up ${cleanupResult.rowCount} old verification attempts`);
      }

      // Update statistics
      await query('ANALYZE');
      logger.debug('Updated database statistics');

      logger.info('Database maintenance completed');

    } catch (error) {
      logger.error('Database maintenance job failed:', error);
    }
  }

  /**
   * Refresh verification cache
   */
  async refreshVerificationCache() {
    try {
      const { query } = require('../../database/config/database');
      
      // Refresh materialized view
      await query('REFRESH MATERIALIZED VIEW CONCURRENTLY evidence_verification_cache');
      
      logger.debug('Verification cache refreshed');

    } catch (error) {
      // Log but don't fail on concurrent refresh conflicts
      if (error.message.includes('concurrently')) {
        logger.debug('Concurrent cache refresh in progress, skipping');
      } else {
        logger.error('Cache refresh job failed:', error);
      }
    }
  }

  /**
   * Run data consistency check
   */
  async runConsistencyCheck() {
    try {
      logger.debug('Running scheduled consistency check');
      await consistencyService.performConsistencyCheck();
    } catch (error) {
      logger.error('Consistency check job failed:', error);
    }
  }

  /**
   * Get job status information
   */
  getJobStatus() {
    const status = {
      isRunning: this.isRunning,
      jobCount: this.jobs.size,
      jobs: {}
    };

    for (const [name, job] of this.jobs) {
      status.jobs[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }

    return status;
  }

  /**
   * Run a specific job manually
   */
  async runJob(jobName) {
    const jobMap = {
      'transaction-monitor': () => this.monitorTransactions(),
      'file-cleanup': () => this.cleanupOldFiles(),
      'health-monitor': () => this.monitorHealth(),
      'network-status': () => this.updateNetworkStatus(),
      'db-maintenance': () => this.performDatabaseMaintenance(),
      'cache-refresh': () => this.refreshVerificationCache(),
      'consistency-check': () => this.runConsistencyCheck()
    };

    const jobFunction = jobMap[jobName];
    if (!jobFunction) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    logger.info(`Manually running job: ${jobName}`);
    const startTime = Date.now();
    
    await jobFunction();
    
    const duration = Date.now() - startTime;
    logger.info(`Manually completed job: ${jobName} (${duration}ms)`);
  }
}

// Create singleton instance
const backgroundJobsService = new BackgroundJobsService();

/**
 * Start background jobs
 */
function startBackgroundJobs() {
  backgroundJobsService.start();
}

/**
 * Stop background jobs
 */
function stopBackgroundJobs() {
  backgroundJobsService.stop();
}

module.exports = {
  backgroundJobsService,
  startBackgroundJobs,
  stopBackgroundJobs
};