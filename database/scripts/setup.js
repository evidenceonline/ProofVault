#!/usr/bin/env node

/**
 * ProofVault Database Setup Script
 * 
 * Sets up the PostgreSQL database for ProofVault including:
 * - Database creation
 * - User creation and permissions
 * - Schema initialization
 * - Index creation
 * - Initial data seeding
 */

const { Pool } = require('pg');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

// Configuration for different environments
const configs = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Connect to postgres db first
    user: process.env.DB_ADMIN_USER || 'postgres',
    password: process.env.DB_ADMIN_PASSWORD || 'postgres',
    
    targetDatabase: process.env.DB_NAME || 'proofvault_dev',
    targetUser: process.env.DB_USER || 'proofvault',
    targetPassword: process.env.DB_PASSWORD || 'proofvault_password'
  },
  
  test: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_ADMIN_USER || 'postgres',
    password: process.env.DB_ADMIN_PASSWORD || 'postgres',
    
    targetDatabase: process.env.TEST_DB_NAME || 'proofvault_test',
    targetUser: process.env.TEST_DB_USER || 'proofvault',
    targetPassword: process.env.TEST_DB_PASSWORD || 'proofvault_password'
  },
  
  production: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_ADMIN_USER,
    password: process.env.DB_ADMIN_PASSWORD,
    
    targetDatabase: process.env.DB_NAME,
    targetUser: process.env.DB_USER,
    targetPassword: process.env.DB_PASSWORD,
    
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
};

const config = configs[env];

if (!config) {
  console.error(`Unknown environment: ${env}`);
  process.exit(1);
}

class DatabaseSetup {
  constructor() {
    this.adminPool = null;
    this.userPool = null;
  }

  async connect() {
    console.log(`🔌 Connecting to PostgreSQL as admin user...`);
    
    this.adminPool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl || false
    });

    // Test connection
    try {
      const result = await this.adminPool.query('SELECT version()');
      console.log(`✅ Connected to PostgreSQL: ${result.rows[0].version}`);
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error.message);
      throw error;
    }
  }

  async createDatabase() {
    console.log(`📊 Creating database: ${config.targetDatabase}`);
    
    try {
      // Check if database exists
      const checkDb = await this.adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [config.targetDatabase]
      );

      if (checkDb.rows.length > 0) {
        console.log(`⚠️  Database ${config.targetDatabase} already exists`);
        return;
      }

      // Create database
      await this.adminPool.query(`CREATE DATABASE "${config.targetDatabase}"`);
      console.log(`✅ Database ${config.targetDatabase} created successfully`);
      
    } catch (error) {
      console.error('❌ Failed to create database:', error.message);
      throw error;
    }
  }

  async createUser() {
    console.log(`👤 Creating user: ${config.targetUser}`);
    
    try {
      // Check if user exists
      const checkUser = await this.adminPool.query(
        'SELECT 1 FROM pg_user WHERE usename = $1',
        [config.targetUser]
      );

      if (checkUser.rows.length === 0) {
        // Create user
        await this.adminPool.query(
          `CREATE USER "${config.targetUser}" WITH PASSWORD '${config.targetPassword}'`
        );
        console.log(`✅ User ${config.targetUser} created successfully`);
      } else {
        console.log(`⚠️  User ${config.targetUser} already exists`);
      }

      // Grant permissions
      await this.adminPool.query(
        `GRANT ALL PRIVILEGES ON DATABASE "${config.targetDatabase}" TO "${config.targetUser}"`
      );
      
      console.log(`✅ Permissions granted to ${config.targetUser}`);
      
    } catch (error) {
      console.error('❌ Failed to create user:', error.message);
      throw error;
    }
  }

  async connectToTargetDatabase() {
    console.log(`🔌 Connecting to target database: ${config.targetDatabase}`);
    
    this.userPool = new Pool({
      host: config.host,
      port: config.port,
      database: config.targetDatabase,
      user: config.targetUser,
      password: config.targetPassword,
      ssl: config.ssl || false
    });

    // Test connection
    try {
      await this.userPool.query('SELECT 1');
      console.log(`✅ Connected to ${config.targetDatabase}`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.targetDatabase}:`, error.message);
      throw error;
    }
  }

  async runMigration(filename) {
    const migrationPath = path.join(__dirname, '..', 'migrations', filename);
    
    if (!await fs.pathExists(migrationPath)) {
      console.error(`❌ Migration file not found: ${filename}`);
      return false;
    }

    console.log(`📄 Running migration: ${filename}`);
    
    try {
      const sql = await fs.readFile(migrationPath, 'utf8');
      await this.userPool.query(sql);
      console.log(`✅ Migration completed: ${filename}`);
      return true;
    } catch (error) {
      console.error(`❌ Migration failed: ${filename}`, error.message);
      throw error;
    }
  }

  async runAllMigrations() {
    console.log(`🚀 Running database migrations...`);
    
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_indexes.sql',
      '003_blockchain_optimizations.sql',
      '004_audit_triggers.sql'
    ];

    for (const file of migrationFiles) {
      await this.runMigration(file);
    }

    console.log(`✅ All migrations completed successfully`);
  }

  async seedData() {
    console.log(`🌱 Seeding initial data...`);
    
    try {
      // Create a default admin user
      const adminAddress = 'DAG0000000000000000000000000000000000000000';
      
      await this.userPool.query(`
        INSERT INTO users (address, display_name, is_verified, verification_level)
        VALUES ($1, 'System Administrator', true, 99)
        ON CONFLICT (address) DO NOTHING
      `, [adminAddress]);

      // Insert some test configuration if in development
      if (env === 'development') {
        await this.userPool.query(`
          INSERT INTO system_config (key, value, description, is_public) VALUES 
          ('maintenance_mode', 'false', 'System maintenance mode flag', true),
          ('welcome_message', '"Welcome to ProofVault"', 'Welcome message for users', true)
          ON CONFLICT (key) DO NOTHING
        `);
      }

      console.log(`✅ Initial data seeded successfully`);
      
    } catch (error) {
      console.error('❌ Failed to seed data:', error.message);
      throw error;
    }
  }

  async createMigrationTable() {
    console.log(`📋 Creating migration tracking table...`);
    
    try {
      await this.userPool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT NOW(),
          description TEXT,
          checksum VARCHAR(64)
        )
      `);

      // Record our initial migrations
      await this.userPool.query(`
        INSERT INTO schema_migrations (version, description) VALUES 
        ('001', 'Initial schema creation'),
        ('002', 'Performance indexes'),
        ('003', 'Blockchain optimizations'),
        ('004', 'Audit triggers')
        ON CONFLICT (version) DO NOTHING
      `);

      console.log(`✅ Migration tracking table created`);
      
    } catch (error) {
      console.error('❌ Failed to create migration table:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.adminPool) {
      await this.adminPool.end();
    }
    if (this.userPool) {
      await this.userPool.end();
    }
  }

  async setup() {
    try {
      console.log(`🏗️  Starting ProofVault database setup for environment: ${env}`);
      console.log(`📍 Target: ${config.host}:${config.port}/${config.targetDatabase}`);
      
      await this.connect();
      await this.createDatabase();
      await this.createUser();
      await this.connectToTargetDatabase();
      await this.runAllMigrations();
      await this.createMigrationTable();
      await this.seedData();
      
      console.log(`🎉 Database setup completed successfully!`);
      console.log(`📊 Database: ${config.targetDatabase}`);
      console.log(`👤 User: ${config.targetUser}`);
      console.log(`🔗 Connection string: postgresql://${config.targetUser}:***@${config.host}:${config.port}/${config.targetDatabase}`);
      
    } catch (error) {
      console.error('💥 Database setup failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Command line interface
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.setup();
}

module.exports = DatabaseSetup;