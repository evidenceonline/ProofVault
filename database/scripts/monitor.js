#!/usr/bin/env node

/**
 * ProofVault Database Monitoring Script
 * 
 * Provides comprehensive monitoring and performance analysis:
 * - Query performance monitoring
 * - Index usage analysis
 * - Connection pool monitoring
 * - Slow query detection
 * - Database health checks
 */

const { query, pool, healthCheck } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');

class DatabaseMonitor {
  constructor() {
    this.thresholds = {
      slowQueryMs: 1000,      // Queries slower than 1 second
      highCpuPercent: 80,     // CPU usage above 80%
      lowHitRatio: 0.95,      // Buffer hit ratio below 95%
      highConnections: 80     // Connection usage above 80%
    };
  }

  // Format bytes for display
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format duration for display
  formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  // Get database size information
  async getDatabaseSize() {
    const result = await query(`
      SELECT 
        pg_database.datname as database_name,
        pg_size_pretty(pg_database_size(pg_database.datname)) as size,
        pg_database_size(pg_database.datname) as size_bytes
      FROM pg_database
      WHERE pg_database.datname = current_database()
    `);

    return result.rows[0];
  }

  // Get table sizes
  async getTableSizes() {
    const result = await query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    return result.rows;
  }

  // Get index usage statistics
  async getIndexUsage() {
    const result = await query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        pg_relation_size(indexrelid) as index_size_bytes
      FROM pg_stat_user_indexes 
      JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    `);

    return result.rows;
  }

  // Get slow queries from pg_stat_statements (if available)
  async getSlowQueries() {
    try {
      const result = await query(`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          max_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements 
        WHERE mean_time > $1
        ORDER BY mean_time DESC 
        LIMIT 10
      `, [this.thresholds.slowQueryMs]);

      return result.rows;
    } catch (error) {
      console.warn('⚠️  pg_stat_statements not available. Install with: CREATE EXTENSION pg_stat_statements;');
      return [];
    }
  }

  // Get connection statistics
  async getConnectionStats() {
    const result = await query(`
      SELECT 
        state,
        count(*) as connection_count,
        round(100.0 * count(*) / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) as percentage
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
      GROUP BY state
      ORDER BY connection_count DESC
    `);

    const total = await query(`
      SELECT 
        count(*) as total_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
    `);

    return {
      by_state: result.rows,
      total: total.rows[0]
    };
  }

  // Get buffer hit ratio
  async getBufferHitRatio() {
    const result = await query(`
      SELECT 
        round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as buffer_hit_ratio,
        sum(blks_hit) as buffer_hits,
        sum(blks_read) as disk_reads
      FROM pg_stat_database
    `);

    return result.rows[0];
  }

  // Get replication lag (if applicable)
  async getReplicationLag() {
    try {
      const result = await query(`
        SELECT 
          client_addr,
          state,
          pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) as flush_lag_bytes,
          pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as replay_lag_bytes
        FROM pg_stat_replication
      `);

      return result.rows;
    } catch (error) {
      return []; // No replication configured
    }
  }

  // Get lock information
  async getLockInfo() {
    const result = await query(`
      SELECT 
        pg_stat_activity.pid,
        pg_stat_activity.usename,
        pg_stat_activity.query,
        pg_stat_activity.state,
        pg_locks.mode,
        pg_locks.locktype,
        pg_locks.granted,
        extract(epoch from (now() - pg_stat_activity.query_start)) as query_duration_seconds
      FROM pg_locks 
      JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid
      WHERE NOT pg_locks.granted
      ORDER BY query_duration_seconds DESC
      LIMIT 10
    `);

    return result.rows;
  }

  // Get evidence record statistics
  async getEvidenceStats() {
    const result = await query(`
      SELECT 
        status,
        count(*) as count,
        avg(extract(epoch from (updated_at - created_at))) as avg_processing_time_seconds,
        min(created_at) as oldest_record,
        max(created_at) as newest_record
      FROM evidence_records
      GROUP BY status
      ORDER BY count DESC
    `);

    const totals = await query(`
      SELECT 
        count(*) as total_records,
        avg(file_size) as avg_file_size,
        sum(file_size) as total_file_size,
        count(DISTINCT submitter_address) as unique_submitters
      FROM evidence_records
    `);

    return {
      by_status: result.rows,
      totals: totals.rows[0]
    };
  }

  // Get verification statistics
  async getVerificationStats() {
    const result = await query(`
      SELECT 
        verification_result,
        verification_method,
        count(*) as count,
        avg(verification_duration_ms) as avg_duration_ms,
        max(verification_duration_ms) as max_duration_ms
      FROM verification_attempts
      WHERE verification_timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY verification_result, verification_method
      ORDER BY count DESC
    `);

    const hourly = await query(`
      SELECT 
        date_trunc('hour', verification_timestamp) as hour,
        count(*) as verifications,
        avg(verification_duration_ms) as avg_duration_ms
      FROM verification_attempts
      WHERE verification_timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY date_trunc('hour', verification_timestamp)
      ORDER BY hour DESC
      LIMIT 24
    `);

    return {
      by_result_method: result.rows,
      hourly_stats: hourly.rows
    };
  }

  // Generate comprehensive monitoring report
  async generateReport() {
    console.log(`📊 ProofVault Database Monitoring Report`);
    console.log(`🕐 Generated: ${new Date().toISOString()}\n`);

    try {
      // Database health check
      const health = await healthCheck();
      console.log(`🏥 Database Health: ${health.status}`);
      console.log(`   PostgreSQL Version: ${health.version}`);
      console.log(`   Pool Status: Total=${health.pool.total}, Idle=${health.pool.idle}, Waiting=${health.pool.waiting}\n`);

      // Database size
      const dbSize = await this.getDatabaseSize();
      console.log(`💾 Database Size: ${dbSize.size} (${dbSize.database_name})\n`);

      // Table sizes
      const tableSizes = await this.getTableSizes();
      console.log(`📋 Table Sizes:`);
      tableSizes.forEach(table => {
        console.log(`   ${table.tablename}: ${table.size} (Table: ${table.table_size}, Indexes: ${table.index_size})`);
      });
      console.log();

      // Connection statistics
      const connStats = await this.getConnectionStats();
      console.log(`🔌 Connection Statistics:`);
      console.log(`   Total: ${connStats.total.total_connections}/${connStats.total.max_connections} (${((connStats.total.total_connections / connStats.total.max_connections) * 100).toFixed(1)}%)`);
      connStats.by_state.forEach(state => {
        console.log(`   ${state.state || 'null'}: ${state.connection_count} (${state.percentage}%)`);
      });
      console.log();

      // Buffer hit ratio
      const bufferStats = await this.getBufferHitRatio();
      console.log(`📊 Buffer Hit Ratio: ${bufferStats.buffer_hit_ratio}%`);
      console.log(`   Buffer Hits: ${bufferStats.buffer_hits}`);
      console.log(`   Disk Reads: ${bufferStats.disk_reads}`);
      
      if (bufferStats.buffer_hit_ratio < this.thresholds.lowHitRatio * 100) {
        console.log(`   ⚠️  Low hit ratio! Consider increasing shared_buffers`);
      }
      console.log();

      // Index usage
      const indexUsage = await this.getIndexUsage();
      console.log(`🔍 Index Usage (Top 10):`);
      indexUsage.slice(0, 10).forEach(idx => {
        console.log(`   ${idx.tablename}.${idx.indexname}: ${idx.idx_scan} scans, ${idx.index_size}`);
      });
      
      // Find unused indexes
      const unusedIndexes = indexUsage.filter(idx => idx.idx_scan === 0);
      if (unusedIndexes.length > 0) {
        console.log(`   ⚠️  Unused indexes found: ${unusedIndexes.length}`);
        unusedIndexes.forEach(idx => {
          console.log(`      ${idx.tablename}.${idx.indexname} (${idx.index_size})`);
        });
      }
      console.log();

      // Slow queries
      const slowQueries = await this.getSlowQueries();
      if (slowQueries.length > 0) {
        console.log(`🐌 Slow Queries (>${this.formatDuration(this.thresholds.slowQueryMs)}):`);
        slowQueries.forEach((query, index) => {
          console.log(`   ${index + 1}. Mean: ${this.formatDuration(query.mean_time)}, Max: ${this.formatDuration(query.max_time)}, Calls: ${query.calls}`);
          console.log(`      Hit%: ${query.hit_percent?.toFixed(1) || 'N/A'}%, Rows: ${query.rows}`);
          console.log(`      Query: ${query.query.substring(0, 100)}...`);
        });
        console.log();
      }

      // Locks
      const locks = await this.getLockInfo();
      if (locks.length > 0) {
        console.log(`🔒 Active Locks (Blocking):`);
        locks.forEach((lock, index) => {
          console.log(`   ${index + 1}. PID: ${lock.pid}, User: ${lock.usename}, Duration: ${this.formatDuration(lock.query_duration_seconds * 1000)}`);
          console.log(`      Mode: ${lock.mode}, Type: ${lock.locktype}, Granted: ${lock.granted}`);
          console.log(`      Query: ${lock.query?.substring(0, 100) || 'N/A'}...`);
        });
        console.log();
      }

      // Evidence statistics
      const evidenceStats = await this.getEvidenceStats();
      console.log(`📄 Evidence Records:`);
      console.log(`   Total: ${evidenceStats.totals.total_records}`);
      console.log(`   Unique Submitters: ${evidenceStats.totals.unique_submitters}`);
      console.log(`   Average File Size: ${this.formatBytes(evidenceStats.totals.avg_file_size || 0)}`);
      console.log(`   Total Storage: ${this.formatBytes(evidenceStats.totals.total_file_size || 0)}`);
      console.log(`   By Status:`);
      evidenceStats.by_status.forEach(status => {
        const avgTime = status.avg_processing_time_seconds ? this.formatDuration(status.avg_processing_time_seconds * 1000) : 'N/A';
        console.log(`      ${status.status}: ${status.count} (Avg processing: ${avgTime})`);
      });
      console.log();

      // Verification statistics
      const verificationStats = await this.getVerificationStats();
      console.log(`🔍 Verification Statistics (Last 24h):`);
      console.log(`   By Result & Method:`);
      verificationStats.by_result_method.forEach(stat => {
        console.log(`      ${stat.verification_result}/${stat.verification_method}: ${stat.count} (Avg: ${this.formatDuration(stat.avg_duration_ms)}, Max: ${this.formatDuration(stat.max_duration_ms)})`);
      });
      
      if (verificationStats.hourly_stats.length > 0) {
        console.log(`   Recent Hourly Activity:`);
        verificationStats.hourly_stats.slice(0, 5).forEach(hour => {
          console.log(`      ${new Date(hour.hour).toISOString()}: ${hour.verifications} verifications (Avg: ${this.formatDuration(hour.avg_duration_ms)})`);
        });
      }
      console.log();

      // Replication lag
      const replicationLag = await this.getReplicationLag();
      if (replicationLag.length > 0) {
        console.log(`🔄 Replication Status:`);
        replicationLag.forEach(replica => {
          console.log(`   ${replica.client_addr}: ${replica.state}`);
          console.log(`      Flush Lag: ${this.formatBytes(replica.flush_lag_bytes)}`);
          console.log(`      Replay Lag: ${this.formatBytes(replica.replay_lag_bytes)}`);
        });
        console.log();
      }

      console.log(`✅ Monitoring report completed`);

    } catch (error) {
      console.error('❌ Failed to generate monitoring report:', error.message);
      throw error;
    }
  }

  // Check for performance issues and provide recommendations
  async checkPerformanceIssues() {
    console.log(`🔧 Performance Issue Analysis\n`);

    const issues = [];
    const recommendations = [];

    try {
      // Check buffer hit ratio
      const bufferStats = await this.getBufferHitRatio();
      if (bufferStats.buffer_hit_ratio < this.thresholds.lowHitRatio * 100) {
        issues.push(`Low buffer hit ratio: ${bufferStats.buffer_hit_ratio}%`);
        recommendations.push('Increase shared_buffers setting');
      }

      // Check connection usage
      const connStats = await this.getConnectionStats();
      const connUsagePercent = (connStats.total.total_connections / connStats.total.max_connections) * 100;
      if (connUsagePercent > this.thresholds.highConnections) {
        issues.push(`High connection usage: ${connUsagePercent.toFixed(1)}%`);
        recommendations.push('Consider connection pooling or increasing max_connections');
      }

      // Check for unused indexes
      const indexUsage = await this.getIndexUsage();
      const unusedIndexes = indexUsage.filter(idx => idx.idx_scan === 0);
      if (unusedIndexes.length > 0) {
        issues.push(`${unusedIndexes.length} unused indexes found`);
        recommendations.push('Consider dropping unused indexes to improve write performance');
      }

      // Check for slow queries
      const slowQueries = await this.getSlowQueries();
      if (slowQueries.length > 0) {
        issues.push(`${slowQueries.length} slow queries detected`);
        recommendations.push('Optimize slow queries or add appropriate indexes');
      }

      // Check for blocking locks
      const locks = await this.getLockInfo();
      if (locks.length > 0) {
        issues.push(`${locks.length} blocking locks detected`);
        recommendations.push('Investigate long-running transactions and optimize queries');
      }

      if (issues.length === 0) {
        console.log(`✅ No significant performance issues detected`);
      } else {
        console.log(`⚠️  Performance Issues Found:`);
        issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
        
        console.log(`\n💡 Recommendations:`);
        recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }

    } catch (error) {
      console.error('❌ Failed to analyze performance issues:', error.message);
      throw error;
    }
  }

  // Export monitoring data to JSON
  async exportData(filename) {
    console.log(`📤 Exporting monitoring data to ${filename}...`);

    try {
      const data = {
        timestamp: new Date().toISOString(),
        health: await healthCheck(),
        database_size: await this.getDatabaseSize(),
        table_sizes: await this.getTableSizes(),
        index_usage: await this.getIndexUsage(),
        connection_stats: await this.getConnectionStats(),
        buffer_stats: await this.getBufferHitRatio(),
        evidence_stats: await this.getEvidenceStats(),
        verification_stats: await this.getVerificationStats(),
        slow_queries: await this.getSlowQueries(),
        locks: await this.getLockInfo(),
        replication: await this.getReplicationLag()
      };

      await fs.writeJson(filename, data, { spaces: 2 });
      console.log(`✅ Monitoring data exported to ${filename}`);

    } catch (error) {
      console.error('❌ Failed to export monitoring data:', error.message);
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const monitor = new DatabaseMonitor();
  const command = process.argv[2] || 'report';
  
  try {
    switch (command) {
      case 'report':
        await monitor.generateReport();
        break;
        
      case 'issues':
        await monitor.checkPerformanceIssues();
        break;
        
      case 'export':
        const filename = process.argv[3] || `proofvault-monitoring-${Date.now()}.json`;
        await monitor.exportData(filename);
        break;
        
      default:
        console.log(`
ProofVault Database Monitor

Usage: node monitor.js <command> [options]

Commands:
  report          Generate comprehensive monitoring report (default)
  issues          Analyze performance issues and recommendations
  export [file]   Export monitoring data to JSON file

Examples:
  node monitor.js
  node monitor.js report
  node monitor.js issues
  node monitor.js export monitoring-data.json
        `);
        break;
    }
  } catch (error) {
    console.error('💥 Monitoring failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseMonitor;