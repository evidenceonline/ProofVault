const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'proofvault',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0]);
    
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection error:', err);
    return false;
  }
};

// Create tables if they don't exist
const initializeTables = async () => {
  try {
    const client = await pool.connect();
    
    // Create pdf_records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pdf_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        pdf_filename VARCHAR(255) NOT NULL,
        pdf_hash VARCHAR(64) NOT NULL UNIQUE,
        pdf_data BYTEA NOT NULL,
        file_size INTEGER,
        status VARCHAR(50) DEFAULT 'verified',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add new columns if they don't exist (for existing databases)
    await client.query(`
      ALTER TABLE pdf_records 
      ADD COLUMN IF NOT EXISTS file_size INTEGER,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'verified'
    `);
    
    // Create indexes for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_created_at ON pdf_records(created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_company_name ON pdf_records(company_name)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_username ON pdf_records(username)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_filename ON pdf_records(pdf_filename)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_status ON pdf_records(status)
    `);
    
    // Composite index for common search patterns
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_search ON pdf_records(company_name, username, created_at DESC)
    `);
    
    // Full-text search index for global search
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pdf_records_fulltext ON pdf_records 
      USING gin(to_tsvector('english', company_name || ' ' || username || ' ' || pdf_filename))
    `);
    
    console.log('Database tables initialized successfully');
    client.release();
  } catch (err) {
    console.error('Error initializing database tables:', err);
    throw err;
  }
};

module.exports = {
  pool,
  testConnection,
  initializeTables
};