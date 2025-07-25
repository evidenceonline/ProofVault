#!/usr/bin/env node

/**
 * ProofVault Database Backup Script
 * 
 * Handles database backups with:
 * - Full database dumps
 * - Compressed backups
 * - Retention management
 * - Backup verification
 * - Restore capabilities
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

class BackupManager {
  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || `proofvault_${env}`,
      username: process.env.DB_USER || 'proofvault',
      password: process.env.DB_PASSWORD || 'proofvault_password',
      
      backupPath: process.env.BACKUP_STORAGE_PATH || path.join(__dirname, '..', 'backups'),
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
      
      // pg_dump options
      pgDumpPath: process.env.PG_DUMP_PATH || 'pg_dump',
      pgRestorePath: process.env.PG_RESTORE_PATH || 'pg_restore'
    };
    
    // Ensure backup directory exists
    fs.ensureDirSync(this.config.backupPath);
  }

  // Generate backup filename
  generateBackupFilename(type = 'full') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `proofvault_${this.config.database}_${type}_${timestamp}.sql.gz`;
  }

  // Calculate file hash for verification
  async calculateFileHash(filepath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filepath);
      
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  // Execute pg_dump with compression
  async createBackup(options = {}) {
    const {
      type = 'full',
      compress = true,
      schemaOnly = false,
      dataOnly = false,
      tables = null
    } = options;

    const filename = this.generateBackupFilename(type);
    const filepath = path.join(this.config.backupPath, filename);
    
    console.log(`📦 Creating ${type} backup: ${filename}`);
    console.log(`📍 Location: ${filepath}`);

    const args = [
      '--host', this.config.host,
      '--port', this.config.port.toString(),
      '--username', this.config.username,
      '--no-password',
      '--verbose',
      '--format', 'custom',
      '--no-owner',
      '--no-privileges'
    ];

    // Add conditional options
    if (schemaOnly) args.push('--schema-only');
    if (dataOnly) args.push('--data-only');
    
    // Add specific tables if provided
    if (tables && Array.isArray(tables)) {
      tables.forEach(table => {
        args.push('--table', table);
      });
    }

    // Add database name
    args.push(this.config.database);

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        PGPASSWORD: this.config.password
      };

      console.log(`🚀 Running pg_dump with args:`, args.join(' '));
      
      const pgDump = spawn(this.config.pgDumpPath, args, { env });
      const writeStream = fs.createWriteStream(filepath);
      
      let stderr = '';
      let stdout = '';

      pgDump.stdout.pipe(writeStream);
      
      pgDump.stderr.on('data', (data) => {
        stderr += data.toString();
        // pg_dump writes progress to stderr, so we don't treat it as error
        if (data.toString().includes('ERROR')) {
          console.error('❌ pg_dump error:', data.toString());
        }
      });

      pgDump.on('close', async (code) => {
        writeStream.end();
        
        if (code !== 0) {
          console.error('❌ pg_dump failed with code:', code);
          console.error('Stderr:', stderr);
          reject(new Error(`pg_dump failed with code ${code}`));
          return;
        }

        try {
          const stats = await fs.stat(filepath);
          const hash = await this.calculateFileHash(filepath);
          
          // Create metadata file
          const metadataPath = filepath + '.meta.json';
          const metadata = {
            filename,
            filepath,
            type,
            database: this.config.database,
            host: this.config.host,
            created_at: new Date().toISOString(),
            size_bytes: stats.size,
            size_human: this.formatBytes(stats.size),
            sha256: hash,
            pg_dump_version: stderr.match(/pg_dump \(PostgreSQL\) ([\d.]+)/)?.[1] || 'unknown',
            options: {
              schemaOnly,
              dataOnly,
              tables: tables || 'all'
            }
          };
          
          await fs.writeJson(metadataPath, metadata, { spaces: 2 });
          
          console.log(`✅ Backup completed successfully`);
          console.log(`📊 Size: ${metadata.size_human}`);
          console.log(`🔒 SHA256: ${hash}`);
          console.log(`📝 Metadata: ${metadataPath}`);
          
          resolve({
            filepath,
            metadata,
            success: true
          });
          
        } catch (error) {
          reject(error);
        }
      });

      pgDump.on('error', (error) => {
        console.error('❌ pg_dump process error:', error);
        reject(error);
      });
    });
  }

  // Restore from backup
  async restoreBackup(backupPath, options = {}) {
    const {
      targetDatabase = this.config.database,
      dropExisting = false,
      dataOnly = false,
      schemaOnly = false
    } = options;

    console.log(`🔄 Restoring backup: ${backupPath}`);
    console.log(`🎯 Target database: ${targetDatabase}`);

    // Verify backup file exists
    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Check if metadata exists and verify
    const metadataPath = backupPath + '.meta.json';
    if (await fs.pathExists(metadataPath)) {
      console.log(`🔍 Verifying backup integrity...`);
      const metadata = await fs.readJson(metadataPath);
      const currentHash = await this.calculateFileHash(backupPath);
      
      if (currentHash !== metadata.sha256) {
        throw new Error(`Backup file integrity check failed! Expected: ${metadata.sha256}, Got: ${currentHash}`);
      }
      console.log(`✅ Backup integrity verified`);
    }

    const args = [
      '--host', this.config.host,
      '--port', this.config.port.toString(),
      '--username', this.config.username,
      '--no-password',
      '--verbose'
    ];

    // Add conditional options
    if (dataOnly) args.push('--data-only');
    if (schemaOnly) args.push('--schema-only');
    if (dropExisting) args.push('--clean');

    // Add database and backup file
    args.push('--dbname', targetDatabase, backupPath);

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        PGPASSWORD: this.config.password
      };

      console.log(`🚀 Running pg_restore...`);
      
      const pgRestore = spawn(this.config.pgRestorePath, args, { env });
      
      let stderr = '';

      pgRestore.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(data.toString());
      });

      pgRestore.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ pg_restore failed with code:', code);
          console.error('Stderr:', stderr);
          reject(new Error(`pg_restore failed with code ${code}`));
          return;
        }

        console.log(`✅ Restore completed successfully`);
        resolve({
          success: true,
          targetDatabase
        });
      });

      pgRestore.on('error', (error) => {
        console.error('❌ pg_restore process error:', error);
        reject(error);
      });
    });
  }

  // List available backups
  async listBackups() {
    const files = await fs.readdir(this.config.backupPath);
    const backups = [];

    for (const file of files) {
      if (file.endsWith('.sql.gz') || file.endsWith('.sql')) {
        const filepath = path.join(this.config.backupPath, file);
        const metadataPath = filepath + '.meta.json';
        
        let metadata = null;
        if (await fs.pathExists(metadataPath)) {
          metadata = await fs.readJson(metadataPath);
        }

        const stats = await fs.stat(filepath);
        
        backups.push({
          filename: file,
          filepath,
          size: stats.size,
          created: stats.ctime,
          modified: stats.mtime,
          metadata
        });
      }
    }

    return backups.sort((a, b) => b.created - a.created);
  }

  // Clean old backups based on retention policy
  async cleanOldBackups() {
    console.log(`🧹 Cleaning backups older than ${this.config.retentionDays} days...`);

    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let deletedCount = 0;
    let freedSpace = 0;

    for (const backup of backups) {
      if (backup.created < cutoffDate) {
        console.log(`🗑️  Deleting old backup: ${backup.filename}`);
        
        // Delete backup file
        await fs.remove(backup.filepath);
        
        // Delete metadata file if exists
        const metadataPath = backup.filepath + '.meta.json';
        if (await fs.pathExists(metadataPath)) {
          await fs.remove(metadataPath);
        }
        
        deletedCount++;
        freedSpace += backup.size;
      }
    }

    console.log(`✅ Cleanup completed: ${deletedCount} backups deleted, ${this.formatBytes(freedSpace)} freed`);
    return { deletedCount, freedSpace };
  }

  // Verify backup integrity
  async verifyBackup(backupPath) {
    console.log(`🔍 Verifying backup: ${backupPath}`);

    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const metadataPath = backupPath + '.meta.json';
    if (!await fs.pathExists(metadataPath)) {
      console.warn(`⚠️  No metadata file found for backup`);
      return { verified: false, reason: 'No metadata file' };
    }

    const metadata = await fs.readJson(metadataPath);
    const currentHash = await this.calculateFileHash(backupPath);

    if (currentHash !== metadata.sha256) {
      return {
        verified: false,
        reason: 'Hash mismatch',
        expected: metadata.sha256,
        actual: currentHash
      };
    }

    console.log(`✅ Backup integrity verified`);
    return { verified: true, metadata };
  }

  // Format bytes for display
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Create schema-only backup
  async createSchemaBackup() {
    return this.createBackup({
      type: 'schema',
      schemaOnly: true
    });
  }

  // Create data-only backup
  async createDataBackup() {
    return this.createBackup({
      type: 'data',
      dataOnly: true
    });
  }

  // Create backup of specific tables
  async createTableBackup(tables) {
    return this.createBackup({
      type: 'tables',
      tables
    });
  }
}

// Command line interface
async function main() {
  const manager = new BackupManager();
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'create':
      case 'backup':
        const result = await manager.createBackup();
        console.log(`🎉 Backup created: ${result.filepath}`);
        break;
        
      case 'schema':
        const schemaResult = await manager.createSchemaBackup();
        console.log(`🎉 Schema backup created: ${schemaResult.filepath}`);
        break;
        
      case 'data':
        const dataResult = await manager.createDataBackup();
        console.log(`🎉 Data backup created: ${dataResult.filepath}`);
        break;
        
      case 'restore':
        const backupPath = process.argv[3];
        if (!backupPath) {
          console.error('❌ Please specify backup file path');
          process.exit(1);
        }
        await manager.restoreBackup(backupPath);
        break;
        
      case 'list':
        const backups = await manager.listBackups();
        console.log(`📋 Available backups (${backups.length}):`);
        backups.forEach(backup => {
          const date = backup.created.toISOString();
          const size = manager.formatBytes(backup.size);
          console.log(`   ${backup.filename} - ${date} (${size})`);
        });
        break;
        
      case 'verify':
        const verifyPath = process.argv[3];
        if (!verifyPath) {
          console.error('❌ Please specify backup file path');
          process.exit(1);
        }
        const verification = await manager.verifyBackup(verifyPath);
        if (verification.verified) {
          console.log(`✅ Backup verified successfully`);
        } else {
          console.error(`❌ Backup verification failed: ${verification.reason}`);
          process.exit(1);
        }
        break;
        
      case 'clean':
        await manager.cleanOldBackups();
        break;
        
      default:
        console.log(`
ProofVault Database Backup Manager

Usage: node backup.js <command> [options]

Commands:
  backup, create     Create full database backup
  schema            Create schema-only backup
  data              Create data-only backup
  restore <file>    Restore from backup file
  list              List available backups
  verify <file>     Verify backup integrity
  clean             Remove old backups per retention policy

Environment Variables:
  BACKUP_STORAGE_PATH    Backup directory (default: ./backups)
  BACKUP_RETENTION_DAYS  Days to keep backups (default: 30)
  PG_DUMP_PATH          Path to pg_dump binary
  PG_RESTORE_PATH       Path to pg_restore binary

Examples:
  node backup.js backup
  node backup.js restore ./backups/proofvault_backup.sql.gz
  node backup.js verify ./backups/proofvault_backup.sql.gz
  node backup.js clean
        `);
        break;
    }
  } catch (error) {
    console.error('💥 Backup operation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BackupManager;