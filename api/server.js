const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import middleware
const { 
  errorHandler, 
  notFoundHandler, 
  handleUnhandledRejection, 
  handleUncaughtException 
} = require('./middleware/errorHandler');

// Import routes
const pdfRoutes = require('./routes/pdf');
const healthRoutes = require('./routes/health');

// Import database
const { testConnection, initializeTables } = require('./config/database');

// Handle uncaught exceptions and unhandled rejections
handleUncaughtException();
handleUnhandledRejection();

// Create Express app
const app = express();

// Trust proxy (important for getting real IP addresses behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration for Chrome extensions and web clients
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extension origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow specific domains (add your production domains here)
    const allowedOrigins = [
      'https://proofvault.com',
      'https://app.proofvault.com',
      // Add more production domains as needed
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '15mb' })); // Slightly higher than file limit for overhead
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Logging middleware
const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' 
  : 'dev';

app.use(morgan(morganFormat, {
  // Skip logging for health check endpoints to reduce noise
  skip: function (req, res) {
    return req.url.startsWith('/api/health');
  }
}));

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Basic request info logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Request ID: ${req.id}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ProofVault API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      pdf_upload: 'POST /api/pdf/upload',
      pdf_list: 'GET /api/pdf/list?search=query&company_name=filter&username=filter&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&page=1&limit=10&sort_by=created_at&sort_order=DESC',
      pdf_get: 'GET /api/pdf/:id',
      pdf_download: 'GET /api/pdf/:id?download=true',
      pdf_delete: 'DELETE /api/pdf/:id',
      pdf_stats: 'GET /api/pdf/stats'
    },
    documentation: 'See README.md for detailed API documentation'
  });
});

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/pdf', pdfRoutes);

// Handle 404 errors
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Server configuration
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Graceful shutdown handler
let server;

const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      console.log('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Force closing server after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    console.log('Starting ProofVault API server...');
    
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }
    
    // Initialize database tables
    console.log('Initializing database tables...');
    await initializeTables();
    
    // Start the server
    server = app.listen(PORT, HOST, () => {
      console.log('=========================================');
      console.log(`🚀 ProofVault API Server is running!`);
      console.log(`📍 Host: ${HOST}`);
      console.log(`🔌 Port: ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health Check: http://${HOST}:${PORT}/api/health`);
      console.log(`📋 API Documentation: http://${HOST}:${PORT}/`);
      console.log('=========================================');
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      
      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
      
      switch (error.code) {
        case 'EACCES':
          console.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;