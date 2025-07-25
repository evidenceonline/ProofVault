/**
 * Enhanced Health Check Routes
 * 
 * Comprehensive health check endpoints with detailed system diagnostics,
 * dependency health, and monitoring capabilities.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { 
  healthCheckHandler, 
  metricsHandler, 
  systemInfoHandler 
} = require('../middleware/monitoring');

/**
 * Basic health check - quick status
 * GET /health
 */
router.get('/', healthCheckHandler);

/**
 * Detailed health check with diagnostics
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get all health metrics
    const [
      databaseHealth,
      blockchainHealth,
      systemHealth
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkBlockchainHealth(),
      checkSystemHealth()
    ]);
    
    const diagnosticTime = Date.now() - startTime;
    
    // Aggregate results
    const healthResults = {
      overall: {
        status: 'healthy',
        score: 1.0,
        timestamp: new Date().toISOString(),
        diagnosticTime: `${diagnosticTime}ms`
      },
      dependencies: {
        database: databaseHealth.status === 'fulfilled' ? 
          databaseHealth.value : { status: 'error', error: databaseHealth.reason?.message },
        blockchain: blockchainHealth.status === 'fulfilled' ? 
          blockchainHealth.value : { status: 'error', error: blockchainHealth.reason?.message },
        system: systemHealth.status === 'fulfilled' ? 
          systemHealth.value : { status: 'error', error: systemHealth.reason?.message }
      },
      performance: {
        diagnosticTime,
        responseTime: `${Date.now() - startTime}ms`
      }
    };
    
    // Calculate overall health score
    const scores = [];
    let hasErrors = false;
    
    Object.values(healthResults.dependencies).forEach(dep => {
      if (dep.status === 'healthy') scores.push(1.0);
      else if (dep.status === 'degraded') scores.push(0.5);
      else {
        scores.push(0.0);
        hasErrors = true;
      }
    });
    
    healthResults.overall.score = scores.length > 0 ? 
      scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Determine overall status
    if (healthResults.overall.score > 0.8) {
      healthResults.overall.status = 'healthy';
    } else if (healthResults.overall.score > 0.3) {
      healthResults.overall.status = 'degraded';
    } else {
      healthResults.overall.status = 'unhealthy';
    }
    
    const statusCode = hasErrors ? 503 : 200;
    
    res.status(statusCode).json({
      success: !hasErrors,
      data: healthResults
    });
    
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Database-specific health check
 * GET /health/database
 */
router.get('/database', async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: 'Database health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Blockchain-specific health check
 * GET /health/blockchain
 */
router.get('/blockchain', async (req, res) => {
  try {
    const health = await checkBlockchainHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    logger.error('Blockchain health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: 'Blockchain health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * System resources health check
 * GET /health/system
 */
router.get('/system', async (req, res) => {
  try {
    const health = await checkSystemHealth();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('System health check failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'System health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Performance metrics endpoint
 * GET /health/metrics
 */
router.get('/metrics', metricsHandler);

/**
 * System information endpoint
 * GET /health/info
 */
router.get('/info', systemInfoHandler);

/**
 * Readiness probe for Kubernetes
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const [dbHealth, blockchainHealth] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkBlockchainHealth()
    ]);
    
    const dbReady = dbHealth.status === 'fulfilled' && 
                   dbHealth.value.status !== 'error';
    const blockchainReady = blockchainHealth.status === 'fulfilled' && 
                           blockchainHealth.value.status !== 'error';
    
    const ready = dbReady && blockchainReady;
    
    const result = {
      ready,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbReady,
        blockchain: blockchainReady
      }
    };
    
    const statusCode = ready ? 200 : 503;
    
    res.status(statusCode).json({
      success: ready,
      data: result
    });
    
  } catch (error) {
    logger.error('Readiness probe failed:', error);
    
    res.status(503).json({
      success: false,
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe for Kubernetes
 * GET /health/live
 */
router.get('/live', (req, res) => {
  try {
    // Basic liveness check - process is running
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
      success: true,
      data: {
        alive: true,
        timestamp: new Date().toISOString(),
        uptime,
        memoryUsage: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
        }
      }
    });
  } catch (error) {
    logger.error('Liveness probe failed:', error);
    
    res.status(503).json({
      success: false,
      alive: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Dependency health check functions
 */

async function checkDatabaseHealth() {
  try {
    const enhancedDatabase = require('../services/enhancedDatabase');
    const health = await enhancedDatabase.getHealthMetrics();
    
    return {
      status: health.status || 'unknown',
      responseTime: health.responseTimeMs,
      pool: {
        total: health.pool?.total || 0,
        idle: health.pool?.idle || 0,
        waiting: health.pool?.waiting || 0,
        utilization: health.pool?.utilization || '0%'
      },
      database: {
        size: health.database?.size,
        connections: health.database?.activeConnections,
        bufferHitRatio: health.database?.bufferHitRatio
      },
      performance: health.performance || {},
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkBlockchainHealth() {
  try {
    const enhancedMetagraph = require('../services/enhancedMetagraph');
    const health = await enhancedMetagraph.healthCheck();
    
    return {
      status: health.status || 'unknown',
      services: health.services || {},
      metrics: {
        totalRequests: health.metrics?.totalRequests || 0,
        successfulRequests: health.metrics?.successfulRequests || 0,
        failedRequests: health.metrics?.failedRequests || 0,
        averageResponseTime: health.metrics?.averageResponseTime || 0
      },
      circuitBreakers: health.circuitBreakers || {},
      activeRequests: health.activeRequests || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function checkSystemHealth() {
  const os = require('os');
  
  try {
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calculate memory usage percentage
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // Determine system status
    let status = 'healthy';
    const issues = [];
    
    if (memoryPercent > 90) {
      status = 'degraded';
      issues.push('High memory usage');
    }
    
    if (loadAvg[0] > cpus.length * 2) {
      status = 'degraded';
      issues.push('High CPU load');
    }
    
    return {
      status,
      issues,
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        pid: process.pid
      },
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        usagePercent: `${memoryPercent.toFixed(1)}%`
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model || 'unknown',
        loadAverage: loadAvg.map(load => load.toFixed(2))
      },
      os: {
        type: os.type(),
        release: os.release(),
        hostname: os.hostname(),
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = router;