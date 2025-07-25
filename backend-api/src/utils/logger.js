/**
 * Logger Utility
 * 
 * Configures Winston logger for ProofVault Backend API
 * with appropriate transports and formatting.
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Log configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || './logs';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14d';
const PRETTY_LOGS = process.env.PRETTY_LOGS === 'true' || process.env.NODE_ENV === 'development';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Pretty format for development
const prettyFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, service, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    
    if (service) {
      log = `${timestamp} [${service}] ${level}: ${message}`;
    }
    
    if (Object.keys(meta).length) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create transports array
const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    level: LOG_LEVEL,
    format: PRETTY_LOGS ? prettyFormat : logFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

// File transports for production
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Combined logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOG_FILE_PATH, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: LOG_LEVEL,
      format: logFormat,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOG_FILE_PATH, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // HTTP access logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOG_FILE_PATH, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      format: logFormat,
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: {
    service: 'proofvault-backend'
  },
  transports,
  exitOnError: false
});

// Create child loggers for different modules
const createChildLogger = (module) => {
  return logger.child({ module });
};

// Add custom log levels
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  verbose: 'white',
  debug: 'green',
  silly: 'gray'
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Module-specific loggers
const loggers = {
  server: createChildLogger('server'),
  database: createChildLogger('database'),
  metagraph: createChildLogger('metagraph'),
  pdf: createChildLogger('pdf'),
  auth: createChildLogger('auth'),
  api: createChildLogger('api'),
  websocket: createChildLogger('websocket'),
  background: createChildLogger('background')
};

// Log startup information
logger.info('Logger initialized', {
  level: LOG_LEVEL,
  environment: process.env.NODE_ENV,
  prettyLogs: PRETTY_LOGS,
  fileLogging: process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true'
});

module.exports = logger;
module.exports.loggers = loggers;
module.exports.createChildLogger = createChildLogger;