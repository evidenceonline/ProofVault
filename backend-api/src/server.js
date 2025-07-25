#!/usr/bin/env node

/**
 * ProofVault Backend API Server
 * 
 * Main entry point for the Node.js/Express server that provides
 * blockchain integration for PDF evidence registration and verification.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;

// Load environment configuration
require('dotenv').config();

// Import application modules
const logger = require('./utils/logger');
const { connectDatabase, healthCheck } = require('../database/config/database');
const { errorHandler } = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const validationMiddleware = require('./middleware/validation');
const loggingMiddleware = require('./middleware/logging');
const AuditMiddleware = require('./middleware/audit');
const { requestTracker } = require('./middleware/monitoring');

// Import route modules
const pdfRoutes = require('./routes/pdf');
const documentRoutes = require('./routes/documents');
const evidenceRoutes = require('./routes/evidence');
const networkRoutes = require('./routes/network');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const statsRoutes = require('./routes/stats');
const healthRoutes = require('./routes/health');
const enhancedHealthRoutes = require('./routes/enhancedHealth');
const extensionRoutes = require('./routes/extension');
const systemRoutes = require('./routes/system');

// Import services
const { initializeWebSocket } = require('./services/websocket');
const { startBackgroundJobs } = require('./services/backgroundJobs');
const metagraphService = require('./services/metagraph');

// Server configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express application
const app = express();

/**
 * Security and middleware configuration
 */
function configureMiddleware() {
  // Security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // Allow Chrome extension integration
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc: ["'self'", "data:", "blob:"],
      },
    },
  }));

  // CORS configuration for frontend and extension
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'chrome-extension://'
      ];
      
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is allowed or is a Chrome extension
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        // Log blocked CORS request for debugging
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-User-Address', 
      'X-Extension-Version', 
      'X-Extension-ID',
      'X-API-Key',
      'Accept',
      'Origin',
      'X-Requested-With'
    ],
    exposedHeaders: [
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
      'X-Processing-Time',
      'X-API-Version'
    ]
  };
  app.use(cors(corsOptions));

  // Request parsing
  app.use(express.json({ limit: '50mb' })); // Large limit for Base64 PDFs
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Compression for production
  if (NODE_ENV === 'production') {
    app.use(compression());
  }

  // Request logging
  if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
    app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));
  }

  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Custom middleware
  app.use(loggingMiddleware);
  
  // Request tracking and monitoring
  app.use(requestTracker);
  
  // Audit middleware for security and compliance
  if (process.env.ENABLE_AUDIT_LOGGING === 'true') {
    app.use(AuditMiddleware.createRequestAuditMiddleware());
  }
}

/**
 * Route configuration
 */
function configureRoutes() {
  // Health check (no auth required)
  app.use('/health', healthRoutes);
  app.use('/health', enhancedHealthRoutes);
  
  // API routes
  app.use('/api/pdf', pdfRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/evidence', evidenceRoutes);
  app.use('/api/network', networkRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/extension', extensionRoutes);
  app.use('/api/system', systemRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'ProofVault Backend API',
      version: '1.0.0',
      description: 'Blockchain-powered digital notary system',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        pdf: '/api/pdf',
        documents: '/api/documents',
        evidence: '/api/evidence',
        network: '/api/network',
        stats: '/api/stats',
        extension: '/api/extension',
        system: '/api/system'
      }
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);
}

/**
 * Initialize application services
 */
async function initializeServices() {
  try {
    logger.info('Initializing ProofVault Backend API services...');

    // Test database connection
    logger.info('Testing database connection...');
    const dbHealth = await healthCheck();
    if (dbHealth.status !== 'healthy') {
      throw new Error(`Database unhealthy: ${dbHealth.error}`);
    }
    logger.info('Database connection established');

    // Test metagraph connection
    logger.info('Testing metagraph connection...');
    const networkInfo = await metagraphService.getNetworkInfo();
    logger.info(`Connected to ${networkInfo.networkName} (${networkInfo.status})`);

    // Initialize WebSocket server
    if (process.env.WS_ENABLED === 'true') {
      logger.info('Initializing WebSocket server...');
      initializeWebSocket();
    }

    // Start background jobs
    if (process.env.ENABLE_BACKGROUND_JOBS === 'true') {
      logger.info('Starting background jobs...');
      startBackgroundJobs();
    }

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    try {
      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database connections
        const db = require('../database/config/database');
        if (db.closePool) {
          await db.closePool();
          logger.info('Database connections closed');
        }
        
        // Close WebSocket connections
        // TODO: Add WebSocket cleanup when implemented
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
      
      // Force close after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
      
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Configure middleware and routes
    configureMiddleware();
    configureRoutes();
    
    // Initialize services
    await initializeServices();
    
    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`ProofVault Backend API server started`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Server: http://${HOST}:${PORT}`);
      logger.info(`Health check: http://${HOST}:${PORT}/health`);
      logger.info(`API base: http://${HOST}:${PORT}/api`);
    });

    // Store server reference for graceful shutdown
    global.server = server;
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    return server;
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };