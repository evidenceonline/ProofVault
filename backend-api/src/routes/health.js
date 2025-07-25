/**
 * Health Check Routes
 * 
 * Provides health check endpoints for monitoring the ProofVault Backend API
 * and its dependencies (database, metagraph, storage).
 */

const express = require('express');
const logger = require('../utils/logger');
const { healthCheck: dbHealthCheck } = require('../../database/config/database');
const metagraphService = require('../services/metagraph');
const pdfService = require('../services/pdf');

const router = express.Router();

/**
 * GET /health
 * Basic health check - returns 200 if server is running
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ProofVault Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/detailed
 * Detailed health check including all dependencies
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    service: 'ProofVault Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  try {
    // Database health check
    try {
      const dbHealth = await dbHealthCheck();
      health.checks.database = {
        status: dbHealth.status,
        responseTime: dbHealth.responseTime || 0,
        details: dbHealth
      };
    } catch (error) {
      health.checks.database = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Metagraph health check
    try {
      const metagraphHealth = await metagraphService.healthCheck();
      health.checks.metagraph = {
        status: metagraphHealth.status,
        layers: metagraphHealth.layers,
        details: metagraphHealth
      };
      
      if (metagraphHealth.status !== 'healthy') {
        health.status = 'degraded';
      }
    } catch (error) {
      health.checks.metagraph = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Storage health check
    try {
      const storageStats = await pdfService.getStorageStats();
      health.checks.storage = {
        status: storageStats.error ? 'unhealthy' : 'healthy',
        details: storageStats
      };
      
      if (storageStats.error) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.checks.storage = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    health.checks.memory = {
      status: 'healthy',
      details: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      }
    };

    // Environment check
    health.checks.environment = {
      status: 'healthy',
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    health.responseTime = Date.now() - startTime;

    // Determine HTTP status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'ProofVault Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
});

/**
 * GET /health/database
 * Database-specific health check
 */
router.get('/database', async (req, res) => {
  try {
    const health = await dbHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/metagraph
 * Metagraph-specific health check
 */
router.get('/metagraph', async (req, res) => {
  try {
    const health = await metagraphService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/storage
 * Storage-specific health check
 */
router.get('/storage', async (req, res) => {
  try {
    const stats = await pdfService.getStorageStats();
    const health = {
      status: stats.error ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      storage: stats
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/readiness
 * Kubernetes readiness probe
 */
router.get('/readiness', async (req, res) => {
  try {
    // Check critical dependencies
    const dbHealth = await dbHealthCheck();
    const metagraphHealth = await metagraphService.healthCheck();

    const isReady = dbHealth.status === 'healthy' && 
                   (metagraphHealth.status === 'healthy' || metagraphHealth.status === 'degraded');

    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealth.status,
          metagraph: metagraphHealth.status
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/liveness
 * Kubernetes liveness probe
 */
router.get('/liveness', (req, res) => {
  // Simple liveness check - if the server can respond, it's alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;