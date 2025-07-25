#!/usr/bin/env node

/**
 * ProofVault Database Status Script
 * 
 * Provides comprehensive database status information:
 * - Connection health
 * - Migration status
 * - Data statistics
 * - Performance metrics
 * - System configuration
 */

const { healthCheck, query } = require('../config/database');
const MigrationManager = require('./migrate');

class DatabaseStatus {
  constructor() {
    this.migrationManager = new MigrationManager();
  }

  // Format numbers for display
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Format bytes for display
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get basic database info
  async getDatabaseInfo() {
    const result = await query(`
      SELECT 
        current_database() as database_name,
        current_user as current_user,
        version() as postgresql_version,
        current_setting('server_version') as server_version,
        current_setting('max_connections') as max_connections,
        current_setting('shared_buffers') as shared_buffers,
        pg_size_pretty(pg_database_size(current_database())) as database_size
    `);

    return result.rows[0];
  }

  // Get table statistics
  async getTableStats() {
    const result = await query(`
      SELECT 
        t.tablename,
        c.reltuples::bigint as estimated_rows,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_relation_size(c.oid)) as table_size,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as index_size
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);

    return result.rows;
  }

  // Get evidence record statistics
  async getEvidenceStats() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_records,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_records,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_records,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_records,
        COUNT(DISTINCT submitter_address) as unique_submitters,
        AVG(file_size)::bigint as avg_file_size,
        SUM(file_size)::bigint as total_file_size,
        MIN(created_at) as oldest_record,
        MAX(created_at) as newest_record
      FROM evidence_records
    `);

    return result.rows[0];
  }

  // Get verification statistics
  async getVerificationStats() {
    const result = await query(`
      SELECT 
        COUNT(*) as total_verifications,
        COUNT(*) FILTER (WHERE verification_result = 'valid') as valid_verifications,
        COUNT(*) FILTER (WHERE verification_result = 'invalid') as invalid_verifications,
        COUNT(*) FILTER (WHERE verification_result = 'not_found') as not_found_verifications,
        AVG(verification_duration_ms) as avg_duration_ms,
        MIN(verification_timestamp) as oldest_verification,
        MAX(verification_timestamp) as newest_verification
      FROM verification_attempts
      WHERE verification_timestamp > NOW() - INTERVAL '7 days'
    `);

    const recent = await query(`
      SELECT COUNT(*) as recent_verifications
      FROM verification_attempts 
      WHERE verification_timestamp > NOW() - INTERVAL '24 hours'
    `);

    return {
      ...result.rows[0],
      recent_24h: recent.rows[0].recent_verifications
    };
  }

  // Get system configuration
  async getSystemConfig() {
    const result = await query(`
      SELECT key, value, description, is_public
      FROM system_config
      WHERE is_public = true
      ORDER BY key
    `);

    return result.rows;
  }

  // Get active connections
  async getActiveConnections() {
    const result = await query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
      GROUP BY state
      ORDER BY count DESC
    `);

    const total = await query(`
      SELECT COUNT(*) as total
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
    `);

    return {
      by_state: result.rows,
      total: total.rows[0].total
    };
  }

  // Check if materialized views need refresh
  async checkMaterializedViews() {
    try {
      // Check if evidence_verification_cache exists and when it was last refreshed
      const result = await query(`
        SELECT 
          schemaname,
          matviewname,
          hasindexes,
          ispopulated
        FROM pg_matviews 
        WHERE schemaname = 'public'
      `);

      return result.rows;
    } catch (error) {
      return [];
    }
  }

  // Generate comprehensive status report
  async generateStatus() {
    console.log(`📊 ProofVault Database Status Report`);
    console.log(`🕐 Generated: ${new Date().toISOString()}\n`);

    try {
      // Health check
      console.log(`🏥 Connection Health:`);
      const health = await healthCheck();
      console.log(`   Status: ${health.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
      if (health.pool) {
        console.log(`   Pool: ${health.pool.total} total, ${health.pool.idle} idle, ${health.pool.waiting} waiting`);
      }
      console.log();

      // Database info
      console.log(`💾 Database Information:`);
      const dbInfo = await this.getDatabaseInfo();
      console.log(`   Database: ${dbInfo.database_name}`);
      console.log(`   User: ${dbInfo.current_user}`);
      console.log(`   PostgreSQL: ${dbInfo.server_version}`);
      console.log(`   Size: ${dbInfo.database_size}`);
      console.log(`   Max Connections: ${dbInfo.max_connections}`);
      console.log(`   Shared Buffers: ${dbInfo.shared_buffers}`);
      console.log();

      // Migration status
      console.log(`🚀 Migration Status:`);
      try {
        const migrations = await this.migrationManager.getMigrationFiles();
        const applied = await this.migrationManager.getAppliedMigrations();
        const pendingCount = migrations.length - applied.length;
        
        console.log(`   Total Migrations: ${migrations.length}`);
        console.log(`   Applied: ${applied.length}`);
        console.log(`   Pending: ${pendingCount}`);
        
        if (pendingCount > 0) {
          console.log(`   ⚠️  Run 'npm run migrate:db' to apply pending migrations`);
        } else {
          console.log(`   ✅ All migrations up to date`);
        }
      } catch (error) {
        console.log(`   ❌ Could not check migration status: ${error.message}`);
      }
      console.log();

      // Table statistics
      console.log(`📋 Table Statistics:`);
      const tableStats = await this.getTableStats();
      tableStats.forEach(table => {
        const rows = this.formatNumber(table.estimated_rows);
        console.log(`   ${table.tablename}: ${rows} rows, ${table.total_size} (${table.table_size} + ${table.index_size} indexes)`);
      });
      console.log();

      // Evidence records
      console.log(`📄 Evidence Records:`);
      const evidenceStats = await this.getEvidenceStats();
      console.log(`   Total: ${this.formatNumber(evidenceStats.total_records)}`);
      console.log(`   Confirmed: ${this.formatNumber(evidenceStats.confirmed_records)}`);
      console.log(`   Pending: ${this.formatNumber(evidenceStats.pending_records)}`);
      console.log(`   Processing: ${this.formatNumber(evidenceStats.processing_records)}`);
      console.log(`   Failed: ${this.formatNumber(evidenceStats.failed_records)}`);
      console.log(`   Unique Submitters: ${this.formatNumber(evidenceStats.unique_submitters)}`);
      if (evidenceStats.avg_file_size) {
        console.log(`   Avg File Size: ${this.formatBytes(evidenceStats.avg_file_size)}`);
        console.log(`   Total Storage: ${this.formatBytes(evidenceStats.total_file_size)}`);
      }
      if (evidenceStats.oldest_record) {
        console.log(`   Date Range: ${new Date(evidenceStats.oldest_record).toISOString().split('T')[0]} to ${new Date(evidenceStats.newest_record).toISOString().split('T')[0]}`);
      }
      console.log();

      // Verification statistics
      console.log(`🔍 Verification Statistics (Last 7 days):`);
      const verificationStats = await this.getVerificationStats();
      console.log(`   Total: ${this.formatNumber(verificationStats.total_verifications)}`);
      console.log(`   Last 24h: ${this.formatNumber(verificationStats.recent_24h)}`);
      console.log(`   Valid: ${this.formatNumber(verificationStats.valid_verifications)}`);
      console.log(`   Invalid: ${this.formatNumber(verificationStats.invalid_verifications)}`);
      console.log(`   Not Found: ${this.formatNumber(verificationStats.not_found_verifications)}`);
      if (verificationStats.avg_duration_ms) {
        console.log(`   Avg Duration: ${Math.round(verificationStats.avg_duration_ms)}ms`);
      }
      console.log();

      // Active connections
      console.log(`🔌 Active Connections:`);
      const connections = await this.getActiveConnections();
      console.log(`   Total: ${connections.total}`);
      connections.by_state.forEach(conn => {
        console.log(`   ${conn.state || 'null'}: ${conn.count}`);
      });
      console.log();

      // Materialized views
      console.log(`📊 Materialized Views:`);
      const matviews = await this.checkMaterializedViews();
      if (matviews.length > 0) {
        matviews.forEach(mv => {
          const populated = mv.ispopulated ? '✅ Populated' : '❌ Not Populated';
          const indexes = mv.hasindexes ? '(indexed)' : '(no indexes)';
          console.log(`   ${mv.matviewname}: ${populated} ${indexes}`);
        });
      } else {
        console.log(`   No materialized views found`);
      }
      console.log();

      // System configuration
      console.log(`⚙️  System Configuration:`);
      const config = await this.getSystemConfig();
      config.forEach(cfg => {
        console.log(`   ${cfg.key}: ${cfg.value}`);
      });
      console.log();

      console.log(`✅ Status report completed`);

    } catch (error) {
      console.error('❌ Failed to generate status report:', error.message);
      throw error;
    }
  }

  // Quick health check
  async quickCheck() {
    try {
      const health = await healthCheck();
      console.log(`Database Health: ${health.status}`);
      
      if (health.status === 'healthy') {
        const evidenceCount = await query('SELECT COUNT(*) as count FROM evidence_records');
        console.log(`Evidence Records: ${evidenceCount.rows[0].count}`);
        
        const recentVerifications = await query(`
          SELECT COUNT(*) as count 
          FROM verification_attempts 
          WHERE verification_timestamp > NOW() - INTERVAL '24 hours'
        `);
        console.log(`Verifications (24h): ${recentVerifications.rows[0].count}`);
        
        console.log('✅ Database is operational');
      } else {
        console.log('❌ Database health check failed');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Quick check failed:', error.message);
      process.exit(1);
    }
  }
}

// Command line interface
async function main() {
  const status = new DatabaseStatus();
  const command = process.argv[2] || 'full';
  
  try {
    switch (command) {
      case 'full':
      case 'status':
        await status.generateStatus();
        break;
        
      case 'quick':
      case 'health':
        await status.quickCheck();
        break;
        
      default:
        console.log(`
ProofVault Database Status

Usage: node status.js [command]

Commands:
  full, status    Generate comprehensive status report (default)
  quick, health   Quick health check

Examples:
  node status.js
  node status.js full
  node status.js quick
        `);
        break;
    }
  } catch (error) {
    console.error('💥 Status check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseStatus;