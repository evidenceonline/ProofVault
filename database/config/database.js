// ProofVault Database Configuration
const { Pool } = require('pg');
require('dotenv').config();

const config = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'proofvault_dev',
    username: process.env.DB_USER || 'proofvault',
    password: process.env.DB_PASSWORD || 'proofvault_password',
    
    // Connection pool settings
    max: 20,                    // Maximum pool size
    min: 5,                     // Minimum pool size
    idle: 10000,               // How long to wait before timing out
    acquire: 60000,            // Maximum time to get connection
    evict: 1000,               // How often to check for idle connections
    
    // PostgreSQL specific options
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    
    // Query timeout
    statement_timeout: 30000,   // 30 seconds
    query_timeout: 30000,       // 30 seconds
    
    // Connection options
    application_name: 'ProofVault-Dev',
    connect_timeout: 30,
    keepalives_idle: 300,       // 5 minutes
    keepalives_interval: 30,    // 30 seconds
    keepalives_count: 3,
    
    options: {
      encrypt: false,
      enableArithAbort: true,
      search_path: 'public',
      timezone: 'UTC'
    }
  },
  
  test: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'proofvault_test',
    username: process.env.TEST_DB_USER || 'proofvault',
    password: process.env.TEST_DB_PASSWORD || 'proofvault_password',
    
    max: 5,
    min: 1,
    idle: 10000,
    acquire: 60000,
    
    ssl: false,
    statement_timeout: 10000,
    query_timeout: 10000,
    
    application_name: 'ProofVault-Test',
    connect_timeout: 15,
    keepalives_idle: 60,
    keepalives_interval: 10,
    keepalives_count: 3,
    
    options: {
      encrypt: false,
      enableArithAbort: true,
      search_path: 'public',
      timezone: 'UTC'
    }
  },
  
  production: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    
    // Production pool settings optimized for blockchain workload
    max: 100,                   // Higher pool for concurrent blockchain operations
    min: 20,                    // Keep minimum connections warm
    idle: 30000,               // 30 seconds idle timeout
    acquire: 120000,           // 2 minutes to acquire connection
    evict: 5000,               // Check for idle connections every 5 seconds
    
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    
    statement_timeout: 300000,  // 5 minutes for complex blockchain queries
    query_timeout: 300000,      // 5 minutes for long-running operations
    lock_timeout: 30000,        // 30 seconds for lock acquisition
    
    // PostgreSQL-specific production optimizations
    application_name: 'ProofVault',
    connect_timeout: 60,
    keepalives_idle: 600,       // 10 minutes
    keepalives_interval: 60,    // 1 minute
    keepalives_count: 3,
    
    // Additional production settings
    options: {
      encrypt: true,
      enableArithAbort: true,
      search_path: 'public',
      timezone: 'UTC'
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create connection pool with enhanced configuration
const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.username,
  password: dbConfig.password,
  max: dbConfig.max,
  min: dbConfig.min,
  idleTimeoutMillis: dbConfig.idle,
  connectionTimeoutMillis: dbConfig.acquire,
  ssl: dbConfig.ssl,
  statement_timeout: dbConfig.statement_timeout,
  query_timeout: dbConfig.query_timeout,
  
  // Enhanced PostgreSQL settings
  application_name: dbConfig.application_name,
  keepAlive: true,
  keepAliveInitialDelayMillis: dbConfig.keepalives_idle * 1000 || 300000,
  
  // Connection validation
  allowExitOnIdle: false
});

// Pool event handlers with enhanced logging
pool.on('connect', async (client) => {
  console.log('New client connected to PostgreSQL pool');
  
  // Set session-level optimizations for new connections
  try {
    await client.query('SET search_path TO public');
    await client.query('SET timezone TO \'UTC\'');
    
    // Enable query plan caching for production
    if (env === 'production') {
      await client.query('SET plan_cache_mode TO force_generic_plan');
    }
    
    // Set work_mem for complex queries (blockchain operations)
    if (env === 'production') {
      await client.query('SET work_mem TO \'256MB\'');
    } else {
      await client.query('SET work_mem TO \'64MB\'');
    }
    
  } catch (error) {
    console.warn('Failed to set session parameters:', error.message);
  }
});

pool.on('error', (err, client) => {
  console.error('PostgreSQL pool error:', err);
  process.exit(-1);
});

pool.on('remove', (client) => {
  console.log('Client removed from PostgreSQL pool');
});

// Enhanced query helper with performance monitoring
const query = async (text, params) => {
  const start = Date.now();
  const startTime = new Date();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in production
    if (duration > 1000) {
      console.warn('Slow query detected:', {
        duration: `${duration}ms`,
        query: text.substring(0, 200),
        rows: res.rowCount,
        params: params ? params.length : 0
      });
    }
    
    // Development logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query:', { 
        text: text.substring(0, 100), 
        duration, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', {
      error: error.message,
      query: text.substring(0, 200),
      params: params ? params.length : 0,
      duration: Date.now() - start
    });
    throw error;
  }
};

const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('Error getting database client:', error);
    throw error;
  }
};

// Transaction helper
const withTransaction = async (callback) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Enhanced health check with database performance metrics
const healthCheck = async () => {
  try {
    const start = Date.now();
    const result = await query(`
      SELECT 
        NOW() as current_time, 
        version() as pg_version,
        current_setting('shared_buffers') as shared_buffers,
        current_setting('max_connections') as max_connections,
        current_setting('work_mem') as work_mem
    `);
    
    const responseTime = Date.now() - start;
    
    // Get additional database metrics
    const metricsResult = await query(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid()) as active_connections,
        (SELECT ROUND(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) 
         FROM pg_stat_database WHERE datname = current_database()) as buffer_hit_ratio,
        pg_size_pretty(pg_database_size(current_database())) as database_size
    `);
    
    const metrics = metricsResult.rows[0];
    
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].pg_version,
      responseTimeMs: responseTime,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        max: dbConfig.max
      },
      database: {
        size: metrics.database_size,
        activeConnections: parseInt(metrics.active_connections),
        maxConnections: parseInt(result.rows[0].max_connections),
        bufferHitRatio: parseFloat(metrics.buffer_hit_ratio),
        sharedBuffers: result.rows[0].shared_buffers,
        workMem: result.rows[0].work_mem
      },
      performance: {
        responseTime: responseTime < 100 ? 'excellent' : 
                     responseTime < 500 ? 'good' : 
                     responseTime < 1000 ? 'fair' : 'poor'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  }
};

// Batch query execution for blockchain operations
const batchQuery = async (queries) => {
  const client = await getClient();
  const results = [];
  
  try {
    await client.query('BEGIN');
    
    for (const queryObj of queries) {
      const { text, params } = queryObj;
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Execute query with retry logic for blockchain operations
const queryWithRetry = async (text, params, maxRetries = 3, backoffMs = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await query(text, params);
    } catch (error) {
      lastError = error;
      
      // Don't retry on syntax errors or constraint violations
      if (error.code === '42601' || error.code === '23505' || error.code === '23503') {
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.warn(`Query attempt ${attempt} failed, retrying in ${backoffMs}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
      }
    }
  }
  
  throw lastError;
};

// Connection pool monitoring
const getPoolStats = () => {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: dbConfig.max,
    min: dbConfig.min,
    utilization: pool.totalCount > 0 ? ((pool.totalCount - pool.idleCount) / pool.totalCount * 100).toFixed(2) + '%' : '0%'
  };
};

// Prepare database for blockchain operations
const optimizeForBlockchain = async () => {
  try {
    // Set optimal settings for blockchain workload
    const optimizations = [
      'SET statement_timeout = 300000',  // 5 minutes
      'SET lock_timeout = 30000',        // 30 seconds
      'SET idle_in_transaction_session_timeout = 600000', // 10 minutes
    ];
    
    for (const optimization of optimizations) {
      await query(optimization);
    }
    
    console.log('Database optimized for blockchain operations');
  } catch (error) {
    console.warn('Failed to apply blockchain optimizations:', error.message);
  }
};

// Graceful shutdown with enhanced cleanup
const closePool = async () => {
  console.log('Closing PostgreSQL connection pool...');
  
  try {
    // Wait for active queries to complete (with timeout)
    const shutdownTimeout = setTimeout(() => {
      console.warn('Forcing pool closure due to timeout');
      pool.end();
    }, 30000); // 30 second timeout
    
    await pool.end();
    clearTimeout(shutdownTimeout);
    console.log('PostgreSQL connection pool closed gracefully');
  } catch (error) {
    console.error('Error during pool closure:', error.message);
  }
};

// Audit context helper for tracking operations
const setAuditContext = async (context) => {
  const { actorAddress, sourceIp, userAgent, sessionId } = context;
  
  try {
    if (actorAddress) await query('SELECT set_config($1, $2, false)', ['proofvault.actor_address', actorAddress]);
    if (sourceIp) await query('SELECT set_config($1, $2, false)', ['proofvault.source_ip', sourceIp]);
    if (userAgent) await query('SELECT set_config($1, $2, false)', ['proofvault.user_agent', userAgent]);
    if (sessionId) await query('SELECT set_config($1, $2, false)', ['proofvault.session_id', sessionId]);
    await query('SELECT set_config($1, $2, false)', ['proofvault.start_time', new Date().toISOString()]);
  } catch (error) {
    console.warn('Failed to set audit context:', error.message);
  }
};

// Clear audit context
const clearAuditContext = async () => {
  try {
    const contextKeys = ['actor_address', 'source_ip', 'user_agent', 'session_id', 'start_time'];
    for (const key of contextKeys) {
      await query('SELECT set_config($1, $2, false)', [`proofvault.${key}`, '']);
    }
  } catch (error) {
    console.warn('Failed to clear audit context:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

// Initialize blockchain optimizations in production
if (env === 'production') {
  pool.on('connect', optimizeForBlockchain);
}

module.exports = {
  pool,
  query,
  queryWithRetry,
  batchQuery,
  getClient,
  withTransaction,
  healthCheck,
  getPoolStats,
  optimizeForBlockchain,
  setAuditContext,
  clearAuditContext,
  closePool,
  config: dbConfig
};