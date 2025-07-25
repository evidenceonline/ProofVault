#!/usr/bin/env node

/**
 * ProofVault Database Seeding Script
 * 
 * Seeds the database with:
 * - Test users and API keys
 * - Sample evidence records
 * - System configuration
 * - Development data
 */

const { query, withTransaction } = require('../config/database');
const crypto = require('crypto');

const env = process.env.NODE_ENV || 'development';

class DatabaseSeeder {
  constructor() {
    this.isProduction = env === 'production';
  }

  // Generate a sample hash
  generateSampleHash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  // Generate API key
  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Seed system configuration
  async seedSystemConfig() {
    console.log('🔧 Seeding system configuration...');

    const configs = [
      {
        key: 'max_file_size_mb',
        value: '50',
        description: 'Maximum PDF file size in MB',
        is_public: true
      },
      {
        key: 'verification_cache_ttl_hours',
        value: '24',
        description: 'Verification result cache TTL in hours',
        is_public: false
      },
      {
        key: 'api_rate_limit_per_minute',
        value: '100',
        description: 'API calls per minute per user',
        is_public: false
      },
      {
        key: 'blockchain_confirmation_required',
        value: '3',
        description: 'Required confirmations for blockchain transactions',
        is_public: true
      },
      {
        key: 'supported_file_types',
        value: '["application/pdf", "image/png", "image/jpeg"]',
        description: 'Supported file types for evidence',
        is_public: true
      },
      {
        key: 'maintenance_mode',
        value: 'false',
        description: 'System maintenance mode flag',
        is_public: true
      }
    ];

    for (const config of configs) {
      await query(`
        INSERT INTO system_config (key, value, description, is_public)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          description = EXCLUDED.description,
          is_public = EXCLUDED.is_public,
          updated_at = NOW()
      `, [config.key, config.value, config.description, config.is_public]);
    }

    console.log(`✅ System configuration seeded`);
  }

  // Seed test users (development only)
  async seedTestUsers() {
    if (this.isProduction) {
      console.log('⏭️  Skipping test users in production');
      return;
    }

    console.log('👤 Seeding test users...');

    const users = [
      {
        address: 'DAG0000000000000000000000000000000000000000',
        display_name: 'System Administrator',
        email: 'admin@proofvault.dev',
        api_quota_daily: 10000,
        is_verified: true,
        verification_level: 99
      },
      {
        address: 'DAG1111111111111111111111111111111111111111',
        display_name: 'Test User 1',
        email: 'user1@proofvault.dev',
        api_quota_daily: 1000,
        is_verified: true,
        verification_level: 1
      },
      {
        address: 'DAG2222222222222222222222222222222222222222',
        display_name: 'Test User 2',
        email: 'user2@proofvault.dev',
        api_quota_daily: 500,
        is_verified: false,
        verification_level: 0
      }
    ];

    for (const user of users) {
      const apiKey = this.generateApiKey();
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      await query(`
        INSERT INTO users (
          address, display_name, email, api_key_hash, 
          api_quota_daily, is_verified, verification_level
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (address) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          updated_at = NOW()
      `, [
        user.address, user.display_name, user.email, apiKeyHash,
        user.api_quota_daily, user.is_verified, user.verification_level
      ]);

      console.log(`   Created user: ${user.display_name} (API Key: ${apiKey})`);
    }

    console.log(`✅ Test users seeded`);
  }

  // Seed sample evidence records (development only)
  async seedSampleEvidenceRecords() {
    if (this.isProduction) {
      console.log('⏭️  Skipping sample evidence in production');
      return;
    }

    console.log('📄 Seeding sample evidence records...');

    const sampleRecords = [
      {
        original_url: 'https://example.com/news/article-1',
        document_title: 'Breaking News: Important Announcement',
        submitter_address: 'DAG1111111111111111111111111111111111111111',
        status: 'confirmed',
        file_size: 1048576, // 1MB
        metadata: {
          browser: 'Chrome',
          version: '119.0.0.0',
          viewport: { width: 1920, height: 1080 },
          capture_method: 'extension'
        }
      },
      {
        original_url: 'https://docs.example.com/legal/terms',
        document_title: 'Terms of Service - Version 2.1',
        submitter_address: 'DAG2222222222222222222222222222222222222222',
        status: 'confirmed',
        file_size: 524288, // 512KB
        metadata: {
          browser: 'Firefox',
          version: '118.0.0',
          viewport: { width: 1366, height: 768 },
          capture_method: 'api'
        }
      },
      {
        original_url: 'https://research.example.org/paper/123',
        document_title: 'Research Paper: Blockchain Applications',
        submitter_address: 'DAG1111111111111111111111111111111111111111',
        status: 'processing',
        file_size: 2097152, // 2MB
        metadata: {
          browser: 'Safari',
          version: '17.0',
          viewport: { width: 1440, height: 900 },
          capture_method: 'extension'
        }
      }
    ];

    for (let i = 0; i < sampleRecords.length; i++) {
      const record = sampleRecords[i];
      const hash = this.generateSampleHash(`sample-record-${i}-${Date.now()}`);
      const captureTime = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)); // Stagger by days
      
      await query(`
        INSERT INTO evidence_records (
          hash, original_url, document_title, submitter_address,
          capture_timestamp, status, file_size, metadata,
          metagraph_tx_hash, blockchain_timestamp,
          consensus_confirmation_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (hash) DO NOTHING
      `, [
        hash, record.original_url, record.document_title, record.submitter_address,
        captureTime, record.status, record.file_size, JSON.stringify(record.metadata),
        record.status === 'confirmed' ? `tx_${hash.substring(0, 16)}` : null,
        record.status === 'confirmed' ? captureTime : null,
        record.status === 'confirmed' ? 3 : 0
      ]);

      // Add blockchain transaction record for confirmed evidence
      if (record.status === 'confirmed') {
        const evidenceResult = await query('SELECT id FROM evidence_records WHERE hash = $1', [hash]);
        if (evidenceResult.rows.length > 0) {
          const evidenceId = evidenceResult.rows[0].id;
          
          await query(`
            INSERT INTO blockchain_transactions (
              tx_hash, evidence_record_id, transaction_type,
              block_height, confirmation_count, is_confirmed, is_finalized,
              submitted_at, confirmed_at, finalized_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            `tx_${hash.substring(0, 16)}`, evidenceId, 'register_pdf',
            100000 + i, 3, true, true,
            captureTime, captureTime, captureTime
          ]);
        }
      }
    }

    console.log(`✅ Sample evidence records seeded`);
  }

  // Seed verification attempts (development only)
  async seedSampleVerificationAttempts() {
    if (this.isProduction) {
      console.log('⏭️  Skipping sample verifications in production');
      return;
    }

    console.log('🔍 Seeding sample verification attempts...');

    // Get existing evidence hashes
    const evidenceResult = await query('SELECT hash FROM evidence_records LIMIT 3');
    const evidenceHashes = evidenceResult.rows.map(row => row.hash);

    const verificationAttempts = [
      {
        result: 'valid',
        method: 'web',
        requester_ip: '192.168.1.100'
      },
      {
        result: 'valid',
        method: 'api',
        requester_ip: '10.0.0.50'
      },
      {
        result: 'not_found',
        method: 'extension',
        requester_ip: '172.16.0.25'
      }
    ];

    for (let i = 0; i < Math.min(evidenceHashes.length, verificationAttempts.length); i++) {
      const hash = evidenceHashes[i];
      const attempt = verificationAttempts[i];
      const verificationTime = new Date(Date.now() - (i * 60 * 60 * 1000)); // Stagger by hours

      await query(`
        INSERT INTO verification_attempts (
          submitted_hash, verification_result, verification_timestamp,
          requester_ip, verification_method, verification_duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        hash, attempt.result, verificationTime,
        attempt.requester_ip, attempt.method, 50 + Math.floor(Math.random() * 200)
      ]);
    }

    // Add some invalid hash attempts
    for (let i = 0; i < 5; i++) {
      const fakeHash = this.generateSampleHash(`fake-${i}-${Date.now()}`);
      const verificationTime = new Date(Date.now() - (i * 30 * 60 * 1000)); // Stagger by 30 minutes

      await query(`
        INSERT INTO verification_attempts (
          submitted_hash, verification_result, verification_timestamp,
          requester_ip, verification_method, verification_duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        fakeHash, 'not_found', verificationTime,
        '203.0.113.' + (10 + i), 'api', 25 + Math.floor(Math.random() * 100)
      ]);
    }

    console.log(`✅ Sample verification attempts seeded`);
  }

  // Refresh materialized views
  async refreshMaterializedViews() {
    console.log('🔄 Refreshing materialized views...');

    try {
      await query('REFRESH MATERIALIZED VIEW evidence_verification_cache');
      console.log(`✅ Materialized views refreshed`);
    } catch (error) {
      console.warn(`⚠️  Could not refresh materialized views: ${error.message}`);
    }
  }

  // Update table statistics
  async updateStatistics() {
    console.log('📊 Updating table statistics...');

    const tables = [
      'evidence_records',
      'blockchain_transactions', 
      'verification_attempts',
      'users',
      'audit_logs'
    ];

    for (const table of tables) {
      await query(`ANALYZE ${table}`);
    }

    console.log(`✅ Table statistics updated`);
  }

  // Run all seeding operations
  async seed() {
    console.log(`🌱 Starting database seeding for environment: ${env}`);
    
    try {
      await this.seedSystemConfig();
      await this.seedTestUsers();
      await this.seedSampleEvidenceRecords();
      await this.seedSampleVerificationAttempts();
      await this.refreshMaterializedViews();
      await this.updateStatistics();
      
      console.log(`🎉 Database seeding completed successfully!`);
      
      if (!this.isProduction) {
        console.log(`\n📝 Development Notes:`);
        console.log(`   - Check the API keys logged above for testing`);
        console.log(`   - Sample evidence records are available for verification`);
        console.log(`   - Test users have different permission levels`);
      }
      
    } catch (error) {
      console.error('💥 Database seeding failed:', error.message);
      throw error;
    }
  }

  // Clear all seeded data (development only)
  async clear() {
    if (this.isProduction) {
      console.error('❌ Cannot clear data in production environment');
      process.exit(1);
    }

    console.log('🧹 Clearing seeded data...');

    await withTransaction(async (client) => {
      await client.query('DELETE FROM verification_attempts');
      await client.query('DELETE FROM blockchain_transactions');
      await client.query('DELETE FROM evidence_records');
      await client.query('DELETE FROM users WHERE address LIKE \'DAG%\'');
      await client.query('DELETE FROM system_config WHERE key NOT IN (\'schema_version\', \'blockchain_network\')');
    });

    console.log(`✅ Seeded data cleared`);
  }
}

// Command line interface
async function main() {
  const seeder = new DatabaseSeeder();
  const command = process.argv[2] || 'seed';
  
  try {
    switch (command) {
      case 'seed':
        await seeder.seed();
        break;
        
      case 'clear':
        await seeder.clear();
        break;
        
      default:
        console.log(`
ProofVault Database Seeder

Usage: node seed.js [command]

Commands:
  seed    Seed database with initial data (default)
  clear   Clear all seeded data (development only)

Examples:
  node seed.js
  node seed.js seed
  node seed.js clear
        `);
        break;
    }
  } catch (error) {
    console.error('💥 Seeding failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseSeeder;