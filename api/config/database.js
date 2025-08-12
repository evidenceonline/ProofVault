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
    
    // Check if the table exists first
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pdf_records'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Table doesn't exist and user doesn't have permission to create it
      console.log('Table pdf_records does not exist. Please ensure it has been created with proper permissions.');
      console.log('The table should have the following structure:');
      console.log(`
        CREATE TABLE pdf_records (
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
        );
      `);
    } else {
      console.log('Table pdf_records exists.');
      
      // Check if all required columns exist
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pdf_records';
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      const requiredColumns = ['id', 'company_name', 'username', 'pdf_filename', 'pdf_hash', 'pdf_data', 'file_size', 'status', 'created_at', 'updated_at', 'blockchain_status', 'blockchain_verified_at'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('Warning: Missing columns in pdf_records table:', missingColumns.join(', '));
        
        // Try to add blockchain-specific columns if missing
        if (missingColumns.includes('blockchain_status')) {
          try {
            await client.query('ALTER TABLE pdf_records ADD COLUMN blockchain_status VARCHAR(50) DEFAULT \'pending\';');
            console.log('✅ Added blockchain_status column');
          } catch (err) {
            console.log('❌ Could not add blockchain_status column:', err.message);
          }
        }
        
        if (missingColumns.includes('blockchain_verified_at')) {
          try {
            await client.query('ALTER TABLE pdf_records ADD COLUMN blockchain_verified_at TIMESTAMP WITH TIME ZONE;');
            console.log('✅ Added blockchain_verified_at column');
          } catch (err) {
            console.log('❌ Could not add blockchain_verified_at column:', err.message);
          }
        }
      } else {
        console.log('All required columns are present in pdf_records table.');
      }
    }
    
    console.log('Database validation completed');
    client.release();
  } catch (err) {
    console.error('Error checking database tables:', err);
    // Don't throw the error, just log it
    console.log('Continuing without table initialization...');
  }
};

module.exports = {
  pool,
  testConnection,
  initializeTables
};