#!/usr/bin/env node

/**
 * ProofVault Database Migration Script
 * 
 * Handles database schema migrations with:
 * - Migration tracking
 * - Rollback capabilities
 * - Checksum verification
 * - Dependency management
 */

const { query, withTransaction, getClient } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  // Calculate checksum for migration file
  calculateChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Get all migration files
  async getMigrationFiles() {
    const files = await fs.readdir(this.migrationsDir);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file => {
        const match = file.match(/^(\d{3})_(.+)\.sql$/);
        return {
          filename: file,
          version: match ? match[1] : file,
          description: match ? match[2].replace(/_/g, ' ') : file,
          path: path.join(this.migrationsDir, file)
        };
      });
  }

  // Get applied migrations from database
  async getAppliedMigrations() {
    try {
      const result = await query(`
        SELECT version, applied_at, description, checksum 
        FROM schema_migrations 
        ORDER BY version
      `);
      return result.rows;
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  // Create migration tracking table if it doesn't exist
  async ensureMigrationTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        description TEXT,
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      )
    `);
  }

  // Apply a single migration
  async applyMigration(migration) {
    console.log(`📄 Applying migration: ${migration.version} - ${migration.description}`);
    
    const content = await fs.readFile(migration.path, 'utf8');
    const checksum = this.calculateChecksum(content);
    const startTime = Date.now();

    try {
      await withTransaction(async (client) => {
        // Execute migration
        await client.query(content);

        // Record migration
        await client.query(`
          INSERT INTO schema_migrations (version, description, checksum, execution_time_ms)
          VALUES ($1, $2, $3, $4)
        `, [migration.version, migration.description, checksum, Date.now() - startTime]);
      });

      console.log(`✅ Migration ${migration.version} applied successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Migration ${migration.version} failed:`, error.message);
      throw error;
    }
  }

  // Rollback a migration
  async rollbackMigration(version) {
    console.log(`🔄 Rolling back migration: ${version}`);
    
    // Look for rollback file
    const rollbackFile = path.join(this.migrationsDir, `${version}_rollback.sql`);
    
    if (await fs.pathExists(rollbackFile)) {
      const content = await fs.readFile(rollbackFile, 'utf8');
      
      try {
        await withTransaction(async (client) => {
          await client.query(content);
          await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
        });
        
        console.log(`✅ Migration ${version} rolled back successfully`);
      } catch (error) {
        console.error(`❌ Rollback ${version} failed:`, error.message);
        throw error;
      }
    } else {
      console.warn(`⚠️  No rollback file found for migration ${version}`);
      
      // Just remove from tracking table
      await query('DELETE FROM schema_migrations WHERE version = $1', [version]);
      console.log(`📝 Migration ${version} removed from tracking table`);
    }
  }

  // Verify migration checksums
  async verifyChecksums() {
    console.log(`🔍 Verifying migration checksums...`);
    
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    
    let allValid = true;
    
    for (const applied of appliedMigrations) {
      const file = migrationFiles.find(f => f.version === applied.version);
      
      if (!file) {
        console.warn(`⚠️  Applied migration ${applied.version} has no corresponding file`);
        continue;
      }
      
      if (!applied.checksum) {
        console.warn(`⚠️  Migration ${applied.version} has no checksum recorded`);
        continue;
      }
      
      const content = await fs.readFile(file.path, 'utf8');
      const currentChecksum = this.calculateChecksum(content);
      
      if (currentChecksum !== applied.checksum) {
        console.error(`❌ Checksum mismatch for migration ${applied.version}`);
        console.error(`   Expected: ${applied.checksum}`);
        console.error(`   Current:  ${currentChecksum}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log(`✅ All migration checksums verified`);
    } else {
      console.error(`❌ Some migration checksums are invalid`);
    }
    
    return allValid;
  }

  // Run pending migrations
  async migrate() {
    console.log(`🚀 Starting database migration...`);
    
    await this.ensureMigrationTable();
    
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    const pendingMigrations = migrationFiles.filter(f => !appliedVersions.has(f.version));
    
    if (pendingMigrations.length === 0) {
      console.log(`✅ No pending migrations`);
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach(m => {
      console.log(`   - ${m.version}: ${m.description}`);
    });
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }
    
    console.log(`🎉 All migrations completed successfully!`);
  }

  // Show migration status
  async status() {
    console.log(`📊 Migration Status\n`);
    
    await this.ensureMigrationTable();
    
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    console.log(`Available Migrations:`);
    migrationFiles.forEach(migration => {
      const status = appliedVersions.has(migration.version) ? '✅ Applied' : '⏳ Pending';
      const applied = appliedMigrations.find(m => m.version === migration.version);
      const appliedAt = applied ? ` (${applied.applied_at.toISOString()})` : '';
      
      console.log(`   ${migration.version}: ${migration.description} - ${status}${appliedAt}`);
    });
    
    console.log(`\nSummary:`);
    console.log(`   Total migrations: ${migrationFiles.length}`);
    console.log(`   Applied: ${appliedMigrations.length}`);
    console.log(`   Pending: ${migrationFiles.length - appliedMigrations.length}`);
  }

  // Create a new migration file
  async create(name) {
    const migrationFiles = await this.getMigrationFiles();
    const lastVersion = migrationFiles.length > 0 
      ? Math.max(...migrationFiles.map(f => parseInt(f.version))) 
      : 0;
    
    const newVersion = String(lastVersion + 1).padStart(3, '0');
    const filename = `${newVersion}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filepath = path.join(this.migrationsDir, filename);
    
    const template = `-- Migration: ${name}
-- Version: ${newVersion}
-- Created: ${new Date().toISOString()}
-- Description: ${name}

-- Add your migration SQL here


-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE INDEX idx_example_name ON example(name);
`;

    await fs.writeFile(filepath, template);
    console.log(`✅ Created migration file: ${filename}`);
    
    // Also create rollback template
    const rollbackFilename = `${newVersion}_rollback.sql`;
    const rollbackFilepath = path.join(this.migrationsDir, rollbackFilename);
    
    const rollbackTemplate = `-- Rollback for migration: ${name}
-- Version: ${newVersion}
-- Created: ${new Date().toISOString()}

-- Add rollback SQL here
-- This should undo everything done in ${filename}

-- Example:
-- DROP INDEX IF EXISTS idx_example_name;
-- DROP TABLE IF EXISTS example;
`;

    await fs.writeFile(rollbackFilepath, rollbackTemplate);
    console.log(`✅ Created rollback file: ${rollbackFilename}`);
  }
}

// Command line interface
async function main() {
  const manager = new MigrationManager();
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await manager.migrate();
        break;
        
      case 'rollback':
      case 'down':
        const version = process.argv[3];
        if (!version) {
          console.error('❌ Please specify a migration version to rollback');
          process.exit(1);
        }
        await manager.rollbackMigration(version);
        break;
        
      case 'status':
        await manager.status();
        break;
        
      case 'verify':
        const valid = await manager.verifyChecksums();
        process.exit(valid ? 0 : 1);
        break;
        
      case 'create':
        const name = process.argv.slice(3).join(' ');
        if (!name) {
          console.error('❌ Please specify a migration name');
          process.exit(1);
        }
        await manager.create(name);
        break;
        
      default:
        console.log(`
ProofVault Migration Manager

Usage: node migrate.js <command> [options]

Commands:
  migrate, up           Run pending migrations
  rollback, down <ver>  Rollback specific migration
  status               Show migration status
  verify               Verify migration checksums
  create <name>        Create new migration file

Examples:
  node migrate.js migrate
  node migrate.js status
  node migrate.js rollback 001
  node migrate.js create "add user preferences table"
        `);
        break;
    }
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MigrationManager;