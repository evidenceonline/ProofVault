const express = require('express');
const { pool, testConnection } = require('../config/database');
const router = express.Router();

// Basic health check endpoint
router.get('/', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'ProofVault API',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'unknown',
        memory: 'unknown',
        disk: 'unknown'
      }
    };

    // Check database connection
    try {
      const dbConnected = await testConnection();
      healthCheck.checks.database = dbConnected ? 'healthy' : 'unhealthy';
    } catch (dbError) {
      healthCheck.checks.database = 'unhealthy';
      healthCheck.database_error = dbError.message;
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };

    healthCheck.memory = {
      usage_mb: memUsageMB,
      free_mb: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024 * 100) / 100
    };

    // Memory health check (alert if heap usage > 80%)
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    healthCheck.checks.memory = heapUsagePercent > 80 ? 'warning' : 'healthy';

    // Determine overall status
    const checks = Object.values(healthCheck.checks);
    if (checks.includes('unhealthy')) {
      healthCheck.status = 'unhealthy';
      return res.status(503).json(healthCheck);
    } else if (checks.includes('warning')) {
      healthCheck.status = 'warning';
      return res.status(200).json(healthCheck);
    }

    res.status(200).json(healthCheck);

  } catch (error) {
    console.error('Health check error:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'ProofVault API',
      error: error.message
    });
  }
});

// Detailed health check endpoint
router.get('/detailed', async (req, res) => {
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      uptime_human: formatUptime(process.uptime()),
      service: 'ProofVault API',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      pid: process.pid,
      checks: {}
    };

    // Database health check with detailed info
    try {
      const client = await pool.connect();
      const dbStart = Date.now();
      
      // Test query
      await client.query('SELECT NOW()');
      const queryTime = Date.now() - dbStart;
      
      // Get database stats
      const statsQuery = `
        SELECT 
          pg_database.datname as database_name,
          pg_size_pretty(pg_database_size(pg_database.datname)) as size
        FROM pg_database 
        WHERE datname = current_database()
      `;
      const statsResult = await client.query(statsQuery);
      
      // Get connection info
      const connectionQuery = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      const connectionResult = await client.query(connectionQuery);
      
      client.release();

      detailedHealth.checks.database = {
        status: 'healthy',
        response_time_ms: queryTime,
        connection_pool: {
          total_count: pool.totalCount,
          idle_count: pool.idleCount,
          waiting_count: pool.waitingCount
        },
        database_info: statsResult.rows[0],
        connections: connectionResult.rows[0]
      };

    } catch (dbError) {
      detailedHealth.checks.database = {
        status: 'unhealthy',
        error: dbError.message
      };
    }

    // Memory detailed check
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100
    };

    const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100 * 100) / 100;
    
    detailedHealth.checks.memory = {
      status: heapUsagePercent > 80 ? 'warning' : 'healthy',
      usage_mb: memUsageMB,
      heap_usage_percent: heapUsagePercent,
      gc_info: process.memoryUsage ? process.memoryUsage() : 'Not available'
    };

    // CPU usage (if available)
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      detailedHealth.checks.cpu = {
        user_cpu_time_us: cpuUsage.user,
        system_cpu_time_us: cpuUsage.system
      };
    }

    // Environment variables check (without sensitive data)
    detailedHealth.environment_vars = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DB_HOST: process.env.DB_HOST ? '***' : 'not set',
      DB_NAME: process.env.DB_NAME ? '***' : 'not set',
      DB_USER: process.env.DB_USER ? '***' : 'not set'
    };

    // Determine overall status
    const checkStatuses = Object.values(detailedHealth.checks).map(check => check.status);
    if (checkStatuses.includes('unhealthy')) {
      detailedHealth.status = 'unhealthy';
      return res.status(503).json(detailedHealth);
    } else if (checkStatuses.includes('warning')) {
      detailedHealth.status = 'warning';
    }

    res.status(200).json(detailedHealth);

  } catch (error) {
    console.error('Detailed health check error:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'ProofVault API',
      error: error.message
    });
  }
});

// Ready check - simple endpoint to check if server is ready to accept requests
router.get('/ready', async (req, res) => {
  try {
    // Test database connection
    const dbHealthy = await testConnection();
    
    if (dbHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        service: 'ProofVault API'
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        service: 'ProofVault API',
        reason: 'Database not available'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      service: 'ProofVault API',
      error: error.message
    });
  }
});

// Live check - simple endpoint to check if server is alive
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'ProofVault API',
    uptime: process.uptime()
  });
});

// Helper function to format uptime in human readable format
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

module.exports = router;