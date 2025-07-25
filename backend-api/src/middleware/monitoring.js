/**
 * Comprehensive Monitoring Middleware
 * 
 * Advanced monitoring, metrics collection, health checks, and alerting
 * system for ProofVault Backend API.
 */

const os = require('os');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { getErrorMetrics } = require('./errorHandler');

/**
 * System metrics collector
 */
class SystemMetrics {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byMethod: new Map(),
        byRoute: new Map(),
        byStatusCode: new Map()
      },
      performance: {
        responseTimes: [],
        averageResponseTime: 0,
        slowRequests: 0,
        requestsPerSecond: 0,
        concurrentRequests: 0
      },
      system: {
        memoryUsage: {},
        cpuUsage: [],
        uptime: 0,
        loadAverage: []
      },
      database: {
        connectionPool: {},
        queryMetrics: {},
        healthStatus: 'unknown'
      },
      blockchain: {
        networkHealth: {},
        transactionMetrics: {},
        circuitBreakerStatus: {}
      }
    };
    
    this.activeRequests = new Map();
    this.requestTimestamps = [];
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.1, // 10%
      memoryUsage: 0.9, // 90%
      cpuUsage: 0.8, // 80%
      concurrentRequests: 100
    };
    
    this.startSystemMonitoring();
  }

  /**
   * Request tracking middleware
   */
  trackRequest(req, res, next) {
    const startTime = Date.now();
    const requestId = req.id || crypto.randomUUID();
    
    // Track active request
    this.activeRequests.set(requestId, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      startTime
    });
    
    this.metrics.performance.concurrentRequests = this.activeRequests.size;
    
    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = (...args) => {
      const duration = Date.now() - startTime;
      
      // Remove from active requests
      this.activeRequests.delete(requestId);
      this.metrics.performance.concurrentRequests = this.activeRequests.size;
      
      // Update metrics
      this.updateRequestMetrics(req, res, duration);
      
      // Check for alerts
      this.checkAlertConditions(req, res, duration);
      
      // Call original end
      originalEnd.apply(res, args);
    };
    
    req.id = requestId;
    next();
  }

  /**
   * Update request metrics
   */
  updateRequestMetrics(req, res, duration) {
    // Update request counts
    this.metrics.requests.total++;
    
    if (res.statusCode < 400) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    // Update by method
    const methodCount = this.metrics.requests.byMethod.get(req.method) || 0;
    this.metrics.requests.byMethod.set(req.method, methodCount + 1);
    
    // Update by route (extract route pattern)
    const route = this.extractRoutePattern(req.url);
    const routeCount = this.metrics.requests.byRoute.get(route) || 0;
    this.metrics.requests.byRoute.set(route, routeCount + 1);
    
    // Update by status code
    const statusCount = this.metrics.requests.byStatusCode.get(res.statusCode) || 0;
    this.metrics.requests.byStatusCode.set(res.statusCode, statusCount + 1);
    
    // Update performance metrics
    this.updatePerformanceMetrics(duration);
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(duration) {
    // Track response times (keep last 1000)
    this.metrics.performance.responseTimes.push(duration);
    if (this.metrics.performance.responseTimes.length > 1000) {
      this.metrics.performance.responseTimes.shift();
    }
    
    // Calculate average response time
    this.metrics.performance.averageResponseTime = 
      this.metrics.performance.responseTimes.reduce((a, b) => a + b, 0) / 
      this.metrics.performance.responseTimes.length;
    
    // Count slow requests
    if (duration > this.alertThresholds.responseTime) {
      this.metrics.performance.slowRequests++;
    }
    
    // Calculate requests per second
    const now = Date.now();
    this.requestTimestamps.push(now);
    
    // Keep only requests from last minute
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );
    
    this.metrics.performance.requestsPerSecond = this.requestTimestamps.length / 60;
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    // Update system metrics every 5 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 5000);
    
    // Update database metrics every 10 seconds
    setInterval(async () => {
      await this.updateDatabaseMetrics();
    }, 10000);
    
    // Update blockchain metrics every 15 seconds
    setInterval(async () => {
      await this.updateBlockchainMetrics();
    }, 15000);
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    // Memory usage
    this.metrics.system.memoryUsage = process.memoryUsage();
    
    // CPU usage (simplified)
    const cpus = os.cpus();
    this.metrics.system.cpuUsage = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return ((total - idle) / total) * 100;
    });
    
    // System uptime
    this.metrics.system.uptime = process.uptime();
    
    // Load average
    this.metrics.system.loadAverage = os.loadavg();
  }

  /**
   * Update database metrics
   */
  async updateDatabaseMetrics() {
    try {
      const enhancedDatabase = require('../services/enhancedDatabase');
      const healthMetrics = await enhancedDatabase.getHealthMetrics();
      
      this.metrics.database = {
        connectionPool: healthMetrics.pool || {},
        queryMetrics: healthMetrics.performance || {},
        healthStatus: healthMetrics.status || 'unknown',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to update database metrics:', error);
      this.metrics.database.healthStatus = 'error';
    }
  }

  /**
   * Update blockchain metrics
   */
  async updateBlockchainMetrics() {
    try {
      const enhancedMetagraph = require('../services/enhancedMetagraph');
      const healthCheck = await enhancedMetagraph.healthCheck();
      
      this.metrics.blockchain = {
        networkHealth: healthCheck.services || {},
        transactionMetrics: healthCheck.metrics || {},
        circuitBreakerStatus: healthCheck.circuitBreakers || {},
        healthStatus: healthCheck.status || 'unknown',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to update blockchain metrics:', error);
      this.metrics.blockchain.healthStatus = 'error';
    }
  }

  /**
   * Check alert conditions
   */
  checkAlertConditions(req, res, duration) {
    const alerts = [];
    
    // High response time
    if (duration > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'HIGH_RESPONSE_TIME',
        severity: 'warning',
        message: `Slow request detected: ${duration}ms`,
        details: { url: req.url, method: req.method, duration }
      });
    }
    
    // High error rate
    const errorRate = this.metrics.requests.failed / this.metrics.requests.total;
    if (errorRate > this.alertThresholds.errorRate) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        severity: 'critical',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        details: { errorRate, totalRequests: this.metrics.requests.total }
      });
    }
    
    // High memory usage
    const memoryUsage = this.metrics.system.memoryUsage.heapUsed / 
                       this.metrics.system.memoryUsage.heapTotal;
    if (memoryUsage > this.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'warning',
        message: `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
        details: { memoryUsage: this.metrics.system.memoryUsage }
      });
    }
    
    // High concurrent requests
    if (this.metrics.performance.concurrentRequests > this.alertThresholds.concurrentRequests) {
      alerts.push({
        type: 'HIGH_CONCURRENT_REQUESTS',
        severity: 'warning',
        message: `High concurrent requests: ${this.metrics.performance.concurrentRequests}`,
        details: { concurrentRequests: this.metrics.performance.concurrentRequests }
      });
    }
    
    // Send alerts if any
    if (alerts.length > 0) {
      this.sendAlerts(alerts);
    }
  }

  /**
   * Send alerts
   */
  sendAlerts(alerts) {
    for (const alert of alerts) {
      logger.warn('SYSTEM ALERT', alert);
      
      // TODO: Implement external alerting (Slack, PagerDuty, etc.)
      // this.sendToExternalSystem(alert);
    }
  }

  /**
   * Extract route pattern from URL
   */
  extractRoutePattern(url) {
    // Remove query parameters
    const path = url.split('?')[0];
    
    // Replace IDs with pattern
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/[a-fA-F0-9]{64}/g, '/:hash')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      errors: getErrorMetrics(),
      timestamp: new Date().toISOString(),
      // Convert Maps to Objects for JSON serialization
      requests: {
        ...this.metrics.requests,
        byMethod: Object.fromEntries(this.metrics.requests.byMethod),
        byRoute: Object.fromEntries(this.metrics.requests.byRoute),
        byStatusCode: Object.fromEntries(this.metrics.requests.byStatusCode)
      }
    };
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    const errorRate = this.metrics.requests.total > 0 ? 
      this.metrics.requests.failed / this.metrics.requests.total : 0;
    
    const memoryUsage = this.metrics.system.memoryUsage.heapUsed / 
                       this.metrics.system.memoryUsage.heapTotal;
    
    const avgCpuUsage = this.metrics.system.cpuUsage.length > 0 ?
      this.metrics.system.cpuUsage.reduce((a, b) => a + b, 0) / 
      this.metrics.system.cpuUsage.length : 0;

    // Calculate overall health score
    let healthScore = 1.0;
    
    if (errorRate > 0.05) healthScore -= 0.3;
    if (this.metrics.performance.averageResponseTime > 2000) healthScore -= 0.2;
    if (memoryUsage > 0.8) healthScore -= 0.2;
    if (avgCpuUsage > 70) healthScore -= 0.2;
    if (this.metrics.database.healthStatus !== 'healthy') healthScore -= 0.3;
    if (this.metrics.blockchain.healthStatus !== 'healthy') healthScore -= 0.2;
    
    healthScore = Math.max(0, healthScore);
    
    let status;
    if (healthScore > 0.8) status = 'healthy';
    else if (healthScore > 0.5) status = 'degraded';
    else status = 'unhealthy';

    return {
      status,
      healthScore,
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: this.metrics.requests.total,
        successRate: this.metrics.requests.total > 0 ? 
          (this.metrics.requests.successful / this.metrics.requests.total) * 100 : 100,
        averageResponseTime: this.metrics.performance.averageResponseTime,
        concurrentRequests: this.metrics.performance.concurrentRequests,
        memoryUsage: (memoryUsage * 100).toFixed(1) + '%',
        cpuUsage: avgCpuUsage.toFixed(1) + '%',
        uptime: this.metrics.system.uptime,
        databaseStatus: this.metrics.database.healthStatus,
        blockchainStatus: this.metrics.blockchain.healthStatus
      },
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    const alerts = [];
    
    const errorRate = this.metrics.requests.total > 0 ? 
      this.metrics.requests.failed / this.metrics.requests.total : 0;
    
    if (errorRate > this.alertThresholds.errorRate) {
      alerts.push('HIGH_ERROR_RATE');
    }
    
    if (this.metrics.performance.averageResponseTime > this.alertThresholds.responseTime) {
      alerts.push('HIGH_RESPONSE_TIME');
    }
    
    const memoryUsage = this.metrics.system.memoryUsage.heapUsed / 
                       this.metrics.system.memoryUsage.heapTotal;
    if (memoryUsage > this.alertThresholds.memoryUsage) {
      alerts.push('HIGH_MEMORY_USAGE');
    }
    
    if (this.metrics.performance.concurrentRequests > this.alertThresholds.concurrentRequests) {
      alerts.push('HIGH_CONCURRENT_REQUESTS');
    }
    
    return alerts;
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics.requests = {
      total: 0,
      successful: 0,
      failed: 0,
      byMethod: new Map(),
      byRoute: new Map(),
      byStatusCode: new Map()
    };
    this.metrics.performance.responseTimes = [];
    this.metrics.performance.slowRequests = 0;
    this.activeRequests.clear();
    this.requestTimestamps = [];
  }
}

// Create singleton instance
const systemMetrics = new SystemMetrics();

/**
 * Request tracking middleware function
 */
function requestTracker(req, res, next) {
  systemMetrics.trackRequest(req, res, next);
}

/**
 * Health check endpoint handler
 */
async function healthCheckHandler(req, res) {
  try {
    const healthSummary = systemMetrics.getHealthSummary();
    
    const statusCode = healthSummary.status === 'healthy' ? 200 :
                      healthSummary.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: healthSummary
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Metrics endpoint handler
 */
function metricsHandler(req, res) {
  try {
    const metrics = systemMetrics.getMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * System info endpoint handler
 */
function systemInfoHandler(req, res) {
  try {
    const systemInfo = {
      nodejs: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      },
      os: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus().length
      },
      application: {
        name: process.env.APP_NAME || 'ProofVault',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      }
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    logger.error('Failed to get system info:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system information',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  requestTracker,
  healthCheckHandler,
  metricsHandler,
  systemInfoHandler,
  systemMetrics
};