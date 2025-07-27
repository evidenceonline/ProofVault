/**
 * ProofVault Enhanced Logging and Debugging System
 * Comprehensive logging for legal evidence capture workflow
 */

class Logger {
  constructor() {
    this.config = {
      level: 'WARN', // Only WARN and ERROR - no INFO or DEBUG to reduce quota usage
      maxLogs: 100, // Reduced from 1000 to 100
      maxLogSize: 50 * 1024, // Reduced from 500KB to 50KB
      enableConsole: false, // Disable console overrides to prevent storage bloat
      enableStorage: true,
      enablePerformance: false, // Disable performance logging to reduce quota usage
      enableNetworkLogging: false // Disable network logging to reduce quota usage
    };
    
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.logs = [];
    this.performanceMetrics = {
      pageLoad: null,
      screenshotCapture: [],
      pdfGeneration: [],
      apiRequests: []
    };
    
    this.networkRequests = [];
    this.errorCounts = new Map();
    
    this.initialize();
  }

  /**
   * Initialize logger
   */
  initialize() {
    try {
      // Set up console overrides
      this.setupConsoleOverrides();
      
      // Set up error handling
      this.setupGlobalErrorHandling();
      
      // Set up performance monitoring
      this.setupPerformanceMonitoring();
      
      // Set up network monitoring
      this.setupNetworkMonitoring();
      
      // Load existing logs
      this.loadStoredLogs();
      
      // Start periodic cleanup
      this.startPeriodicCleanup();
      
      this.info('Logger initialized', {
        sessionId: this.sessionId,
        level: this.config.level,
        startTime: new Date(this.startTime).toISOString()
      });
      
    } catch (error) {
      console.error('Logger initialization failed:', error);
    }
  }

  /**
   * Setup console overrides for better logging
   */
  setupConsoleOverrides() {
    if (!this.config.enableConsole) return;
    
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    // Override console methods
    console.log = (...args) => {
      this.originalConsole.log(...args);
      this.logMessage('INFO', 'console.log', args);
    };
    
    console.info = (...args) => {
      this.originalConsole.info(...args);
      this.logMessage('INFO', 'console.info', args);
    };
    
    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      this.logMessage('WARN', 'console.warn', args);
    };
    
    console.error = (...args) => {
      this.originalConsole.error(...args);
      this.logMessage('ERROR', 'console.error', args);
    };
    
    console.debug = (...args) => {
      this.originalConsole.debug(...args);
      this.logMessage('DEBUG', 'console.debug', args);
    };
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.error('Uncaught Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        type: 'javascript_error'
      });
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise,
        type: 'promise_rejection'
      });
    });
    
    // Handle Chrome runtime errors
    if (chrome && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'log-message') {
          this.logMessage(message.level, message.source, message.data);
        }
      });
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    if (!this.config.enablePerformance) return;
    
    // Monitor page load performance
    window.addEventListener('load', () => {
      if (performance.timing) {
        const timing = performance.timing;
        this.performanceMetrics.pageLoad = {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          pageLoad: timing.loadEventEnd - timing.navigationStart,
          dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
          tcpConnect: timing.connectEnd - timing.connectStart,
          timestamp: Date.now()
        };
        
        this.info('Page Performance', this.performanceMetrics.pageLoad);
      }
    });
    
    // Monitor resource loading
    if (performance.getEntriesByType) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'navigation' || entry.entryType === 'resource') {
            this.debug('Resource Performance', {
              name: entry.name,
              duration: entry.duration,
              size: entry.transferSize,
              type: entry.entryType
            });
          }
        });
      });
      
      try {
        observer.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (error) {
        this.warn('Performance Observer not available', error);
      }
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    if (!this.config.enableNetworkLogging) return;
    
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = args[0];
      const options = args[1] || {};
      
      const requestId = this.generateRequestId();
      
      this.debug('Network Request Started', {
        requestId,
        url,
        method: options.method || 'GET',
        headers: this.sanitizeHeaders(options.headers),
        timestamp: startTime
      });
      
      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();
        
        const networkLog = {
          requestId,
          url,
          method: options.method || 'GET',
          status: response.status,
          statusText: response.statusText,
          duration: endTime - startTime,
          size: response.headers.get('content-length'),
          contentType: response.headers.get('content-type'),
          timestamp: startTime,
          success: response.ok
        };
        
        this.networkRequests.push(networkLog);
        
        if (response.ok) {
          this.debug('Network Request Completed', networkLog);
        } else {
          this.warn('Network Request Failed', networkLog);
        }
        
        return response;
        
      } catch (error) {
        const endTime = Date.now();
        
        const errorLog = {
          requestId,
          url,
          method: options.method || 'GET',
          error: error.message,
          duration: endTime - startTime,
          timestamp: startTime,
          success: false
        };
        
        this.networkRequests.push(errorLog);
        this.error('Network Request Error', errorLog);
        
        throw error;
      }
    };
  }

  /**
   * Log a message with specified level
   */
  logMessage(level, source, data, context = {}) {
    if (this.levels[level] < this.levels[this.config.level]) {
      return; // Skip if below configured level
    }
    
    const timestamp = Date.now();
    const logEntry = {
      id: this.generateLogId(),
      sessionId: this.sessionId,
      timestamp,
      level,
      source,
      data: this.sanitizeLogData(data),
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        extensionVersion: chrome?.runtime?.getManifest()?.version,
        ...context
      },
      stackTrace: level === 'ERROR' ? this.getStackTrace() : null
    };
    
    // Add to logs array
    this.logs.push(logEntry);
    
    // Maintain size limit
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }
    
    // Store in chrome storage
    if (this.config.enableStorage) {
      this.saveLogsToStorage();
    }
    
    // Track error counts
    if (level === 'ERROR') {
      const errorKey = source || 'unknown';
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }
    
    return logEntry;
  }

  /**
   * Logging methods
   */
  debug(source, data, context) {
    return this.logMessage('DEBUG', source, data, context);
  }

  info(source, data, context) {
    return this.logMessage('INFO', source, data, context);
  }

  warn(source, data, context) {
    return this.logMessage('WARN', source, data, context);
  }

  error(source, data, context) {
    return this.logMessage('ERROR', source, data, context);
  }

  /**
   * Performance logging methods
   */
  startTimer(name) {
    const timer = {
      name,
      startTime: performance.now(),
      id: this.generateTimerId()
    };
    
    this.debug('Timer Started', { name, id: timer.id });
    return timer;
  }

  endTimer(timer, data = {}) {
    if (!timer || !timer.startTime) return null;
    
    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    
    const result = {
      name: timer.name,
      id: timer.id,
      duration,
      startTime: timer.startTime,
      endTime,
      ...data
    };
    
    this.info('Timer Completed', result);
    
    // Store in appropriate performance category
    if (timer.name.includes('screenshot')) {
      this.performanceMetrics.screenshotCapture.push(result);
    } else if (timer.name.includes('pdf')) {
      this.performanceMetrics.pdfGeneration.push(result);
    } else if (timer.name.includes('api')) {
      this.performanceMetrics.apiRequests.push(result);
    }
    
    return result;
  }

  /**
   * Log evidence capture workflow
   */
  logEvidenceCapture(step, data = {}, success = true) {
    const level = success ? 'INFO' : 'ERROR';
    const source = `Evidence Capture - ${step}`;
    
    return this.logMessage(level, source, {
      step,
      success,
      timestamp: Date.now(),
      ...data
    });
  }

  /**
   * Get current logs
   */
  getLogs(filter = {}) {
    let filteredLogs = [...this.logs];
    
    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }
    
    if (filter.source) {
      filteredLogs = filteredLogs.filter(log => 
        log.source.toLowerCase().includes(filter.source.toLowerCase())
      );
    }
    
    if (filter.since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since);
    }
    
    if (filter.limit) {
      filteredLogs = filteredLogs.slice(-filter.limit);
    }
    
    return filteredLogs;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    return {
      pageLoad: this.performanceMetrics.pageLoad,
      screenshotCapture: {
        count: this.performanceMetrics.screenshotCapture.length,
        averageDuration: this.calculateAverageDuration(this.performanceMetrics.screenshotCapture),
        lastCapture: this.performanceMetrics.screenshotCapture.slice(-1)[0]
      },
      pdfGeneration: {
        count: this.performanceMetrics.pdfGeneration.length,
        averageDuration: this.calculateAverageDuration(this.performanceMetrics.pdfGeneration),
        lastGeneration: this.performanceMetrics.pdfGeneration.slice(-1)[0]
      },
      apiRequests: {
        count: this.performanceMetrics.apiRequests.length,
        averageDuration: this.calculateAverageDuration(this.performanceMetrics.apiRequests),
        successRate: this.calculateSuccessRate(this.networkRequests)
      }
    };
  }

  /**
   * Export logs for debugging
   */
  exportLogs(format = 'json') {
    const exportData = {
      sessionId: this.sessionId,
      exportTime: new Date().toISOString(),
      extensionVersion: chrome?.runtime?.getManifest()?.version,
      logs: this.logs,
      performanceMetrics: this.performanceMetrics,
      networkRequests: this.networkRequests.slice(-50), // Last 50 requests
      errorCounts: Object.fromEntries(this.errorCounts)
    };
    
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.logsToCSV(this.logs);
    }
    
    return exportData;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
    this.networkRequests = [];
    this.errorCounts.clear();
    this.performanceMetrics = {
      pageLoad: null,
      screenshotCapture: [],
      pdfGeneration: [],
      apiRequests: []
    };
    
    if (this.config.enableStorage) {
      chrome.storage.local.remove(['proofvault_logs']);
    }
    
    this.info('Logs Cleared', { sessionId: this.sessionId });
  }

  /**
   * Helper methods
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateLogId() {
    return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  generateTimerId() {
    return 'timer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  getStackTrace() {
    try {
      throw new Error();
    } catch (error) {
      return error.stack?.split('\n').slice(3, 8) || []; // Get relevant stack frames
    }
  }

  sanitizeLogData(data) {
    if (!data) return data;
    
    // Convert to string if needed
    let sanitized = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data;
    
    // Remove sensitive information
    if (typeof sanitized === 'object') {
      this.removeSensitiveKeys(sanitized);
    }
    
    return sanitized;
  }

  removeSensitiveKeys(obj) {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
    
    for (const key in obj) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.removeSensitiveKeys(obj[key]);
      }
    }
  }

  sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('auth') || lowerKey.includes('token') || lowerKey.includes('key')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  calculateAverageDuration(metrics) {
    if (!metrics.length) return 0;
    const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return Math.round(total / metrics.length * 100) / 100;
  }

  calculateSuccessRate(requests) {
    if (!requests.length) return 100;
    const successful = requests.filter(req => req.success).length;
    return Math.round((successful / requests.length) * 100);
  }

  logsToCSV(logs) {
    const headers = ['Timestamp', 'Level', 'Source', 'Message', 'URL'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.level,
      log.source,
      typeof log.data === 'string' ? log.data : JSON.stringify(log.data),
      log.context.url
    ]);
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  async saveLogsToStorage() {
    try {
      // Only store ERROR level logs to minimize storage usage
      const errorLogs = this.logs.filter(log => log.level === 'ERROR').slice(-20); // Only last 20 errors
      
      // Only save if we have errors or it's been more than 5 minutes since last save
      if (errorLogs.length > 0) {
        await chrome.storage.local.set({
          proofvault_logs: {
            sessionId: this.sessionId,
            logs: errorLogs,
            lastUpdate: Date.now()
          }
        });
      }
    } catch (error) {
      // Don't log storage errors to avoid recursive loops
      console.error('Failed to save logs to storage:', error);
    }
  }

  async loadStoredLogs() {
    try {
      const stored = await chrome.storage.local.get(['proofvault_logs']);
      if (stored.proofvault_logs && stored.proofvault_logs.logs) {
        // Only load logs from recent sessions (last 24 hours)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentLogs = stored.proofvault_logs.logs.filter(log => 
          log.timestamp > oneDayAgo
        );
        
        this.logs = [...recentLogs, ...this.logs];
        this.info('Stored logs loaded', { count: recentLogs.length });
      }
    } catch (error) {
      this.originalConsole?.error('Failed to load stored logs:', error);
    }
  }

  startPeriodicCleanup() {
    // Clean up old logs every 2 minutes (more aggressive)
    setInterval(() => {
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000); // Keep only last 10 minutes
      const initialCount = this.logs.length;
      
      // Keep only recent error and warn logs
      this.logs = this.logs.filter(log => 
        log.timestamp > tenMinutesAgo && (log.level === 'ERROR' || log.level === 'WARN')
      );
      this.networkRequests = this.networkRequests.filter(req => req.timestamp > tenMinutesAgo);
      
      // Clear performance metrics older than 10 minutes
      this.performanceMetrics.screenshotCapture = this.performanceMetrics.screenshotCapture
        .filter(metric => Date.now() - metric.startTime < 10 * 60 * 1000);
      this.performanceMetrics.pdfGeneration = this.performanceMetrics.pdfGeneration
        .filter(metric => Date.now() - metric.startTime < 10 * 60 * 1000);
      this.performanceMetrics.apiRequests = this.performanceMetrics.apiRequests
        .filter(metric => Date.now() - metric.startTime < 10 * 60 * 1000);
      
      // If we have too many logs, clear storage
      if (this.logs.length > this.config.maxLogs) {
        this.logs = this.logs.slice(-this.config.maxLogs);
        chrome.storage.local.remove(['proofvault_logs']).catch(() => {});
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }
}

// Initialize global logger
const logger = new Logger();

// Export for use in other modules
window.Logger = Logger;
window.logger = logger;