/**
 * System Routes
 * 
 * Administrative endpoints for system monitoring, health checks,
 * and maintenance operations.
 */

const express = require('express');
const { param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const logger = require('../utils/logger');
const metagraphService = require('../services/metagraph');
const databaseService = require('../services/database');
const consistencyService = require('../services/consistency');
const { backgroundJobsService } = require('../services/backgroundJobs');
const { webSocketService } = require('../services/websocket');
const AuditMiddleware = require('../middleware/audit');

const router = express.Router();

// System endpoint rate limiting
const systemRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: {
    error: 'System endpoint rate limit exceeded',
    code: 'SYSTEM_RATE_LIMITED'
  }
});

/**
 * GET /api/system/health
 * Comprehensive system health check
 */
router.get('/health', systemRateLimit, async (req, res) => {
  try {
    const startTime = Date.now();

    // Gather health information from all services
    const [
      metagraphHealth,
      dbHealth,
      consistencyStatus,
      backgroundJobsStatus,
      wsStats
    ] = await Promise.allSettled([
      metagraphService.healthCheck(),
      databaseService.query('SELECT 1 as test').then(() => ({ status: 'healthy' })).catch(err => ({ status: 'unhealthy', error: err.message })),
      consistencyService.getConsistencyStatus(),
      Promise.resolve(backgroundJobsService.getJobStatus()),
      Promise.resolve(webSocketService.getStats())
    ]);

    const health = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      version: '1.0.0',
      node: {
        id: process.env.NODE_ID || 'unknown',
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        },
        cpu: process.cpuUsage()
      },
      services: {
        metagraph: metagraphHealth.status === 'fulfilled' ? metagraphHealth.value : { status: 'error', error: metagraphHealth.reason?.message },
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'error', error: dbHealth.reason?.message },
        consistency: consistencyStatus.status === 'fulfilled' ? consistencyStatus.value : { status: 'error', error: consistencyStatus.reason?.message },
        backgroundJobs: backgroundJobsStatus.status === 'fulfilled' ? backgroundJobsStatus.value : { status: 'error', error: backgroundJobsStatus.reason?.message },
        websocket: wsStats.status === 'fulfilled' ? wsStats.value : { status: 'error', error: wsStats.reason?.message }
      }
    };

    // Determine overall health
    const serviceStatuses = Object.values(health.services);
    const unhealthyServices = serviceStatuses.filter(s => s.status === 'error' || s.status === 'unhealthy');
    
    if (unhealthyServices.length > 0) {
      if (unhealthyServices.length >= serviceStatuses.length / 2) {
        health.overall = 'unhealthy';
      } else {
        health.overall = 'degraded';
      }
    }

    const statusCode = health.overall === 'healthy' ? 200 : 
                      health.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('System health check failed:', error);
    res.status(500).json({
      overall: 'error',
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/system/consistency
 * Get data consistency status
 */
router.get('/consistency', systemRateLimit, async (req, res) => {
  try {
    const status = await consistencyService.getConsistencyStatus();
    res.json({
      success: true,
      consistency: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get consistency status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get consistency status',
      message: error.message
    });
  }
});

/**
 * POST /api/system/consistency/check
 * Run manual consistency check
 */
router.post('/consistency/check', systemRateLimit, async (req, res) => {
  try {
    logger.info('Manual consistency check requested');

    // Log audit trail
    await AuditMiddleware.logSystemEvent('MANUAL_CONSISTENCY_CHECK_REQUESTED', {
      requesterIp: req.ip,
      userAgent: req.get('User-Agent')
    });

    const checkResult = await consistencyService.runManualCheck();

    res.json({
      success: true,
      checkResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Manual consistency check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Consistency check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/system/stats
 * Get system statistics
 */
router.get('/stats', systemRateLimit, async (req, res) => {
  try {
    const stats = await databaseService.getEvidenceStatistics();
    const networkInfo = await metagraphService.getNetworkInfo();
    const wsStats = webSocketService.getStats();

    res.json({
      success: true,
      stats: {
        evidence: stats,
        network: networkInfo,
        websocket: wsStats,
        system: {
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          version: '1.0.0',
          nodeId: process.env.NODE_ID || 'unknown'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system stats',
      message: error.message
    });
  }
});

/**
 * POST /api/system/jobs/:jobName/run
 * Run specific background job manually
 */
router.post('/jobs/:jobName/run',
  systemRateLimit,
  [
    param('jobName')
      .isIn(['transaction-monitor', 'file-cleanup', 'health-monitor', 'network-status', 'db-maintenance', 'cache-refresh', 'consistency-check'])
      .withMessage('Invalid job name')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { jobName } = req.params;

      logger.info(`Manual job execution requested: ${jobName}`);

      // Log audit trail
      await AuditMiddleware.logSystemEvent('MANUAL_JOB_EXECUTION_REQUESTED', {
        jobName,
        requesterIp: req.ip,
        userAgent: req.get('User-Agent')
      });

      const startTime = Date.now();
      await backgroundJobsService.runJob(jobName);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        message: `Job ${jobName} completed successfully`,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`Manual job execution failed: ${req.params.jobName}`, error);
      res.status(500).json({
        success: false,
        error: 'Job execution failed',
        jobName: req.params.jobName,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/system/jobs
 * Get background jobs status
 */
router.get('/jobs', systemRateLimit, async (req, res) => {
  try {
    const jobStatus = backgroundJobsService.getJobStatus();
    const consistencyStatus = await consistencyService.getConsistencyStatus();

    res.json({
      success: true,
      jobs: {
        ...jobStatus,
        consistency: consistencyStatus
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status',
      message: error.message
    });
  }
});

/**
 * GET /api/system/metrics
 * Get detailed system metrics
 */
router.get('/metrics', systemRateLimit, async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoop: {
        delay: process.hrtime.bigint ? Number(process.hrtime.bigint()) : 0
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      }
    };

    // Add service-specific metrics if available
    try {
      const networkInfo = await metagraphService.getNetworkInfo();
      metrics.network = {
        status: networkInfo.status,
        blockHeight: networkInfo.blockHeight,
        peerCount: networkInfo.peerCount
      };
    } catch (error) {
      metrics.network = { status: 'unavailable', error: error.message };
    }

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics',
      message: error.message
    });
  }
});

module.exports = router;