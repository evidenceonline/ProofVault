# ProofVault Database

PostgreSQL database schema and management tools for ProofVault - a blockchain-powered digital notary system.

## Overview

This database is optimized for both write-heavy blockchain operations and read-heavy verification queries. It stores PDF evidence records with cryptographic hashes, blockchain transaction references, and comprehensive audit trails.

## Quick Start

1. **Install Dependencies**
   ```bash
   cd database
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup Database**
   ```bash
   npm run setup
   ```

4. **Seed with Test Data** (development only)
   ```bash
   npm run seed
   ```

## Database Schema

### Core Tables

#### `evidence_records`
Stores PDF evidence records with metadata and blockchain references.
- **Primary Key**: `id` (UUID)
- **Unique Index**: `hash` (SHA-256 of PDF content)
- **Status**: `pending` → `processing` → `confirmed`
- **Blockchain Integration**: `metagraph_tx_hash`, `blockchain_timestamp`

#### `blockchain_transactions`
Tracks all blockchain transactions related to evidence records.
- Links to `evidence_records` via foreign key
- Stores transaction details, gas costs, confirmation counts
- Supports multiple transaction types

#### `verification_attempts`
Logs all document verification requests for analytics.
- Records verification results (`valid`, `invalid`, `not_found`)
- Tracks performance metrics and user patterns
- Partitioned by month for high-volume queries

#### `users`
Simple user management with API key authentication.
- Constellation Network address-based identity
- API quotas and rate limiting
- Verification levels for premium features

#### `audit_logs`
Comprehensive audit trail for compliance.
- Records all system actions with before/after values
- Supports retention policies for sensitive data
- Actor tracking (user, system, API)
- Enhanced with session tracking, compliance flags, and change magnitude classification

#### `blockchain_batches`
Manages batched blockchain operations for efficiency.
- Groups evidence records for batch processing
- Tracks batch status and confirmation counts
- Optimizes blockchain transaction costs

#### `consensus_state`
Tracks blockchain network consensus state.
- Current round and snapshot information
- Network synchronization status
- Peer connection monitoring

#### `network_metrics`
Performance monitoring for blockchain network.
- Response times and throughput metrics
- Resource utilization tracking
- Block height and transaction monitoring

### Performance Features

- **Materialized View**: `evidence_verification_cache` for fast hash lookups
- **Partitioning**: `verification_attempts` partitioned by month
- **Comprehensive Indexing**: B-tree, GIN, and partial indexes
- **Full-Text Search**: Document titles and URLs with PostgreSQL's tsvector

## Scripts & Tools

### Database Management

```bash
# Setup database from scratch
npm run setup

# Run migrations
node scripts/migrate.js migrate

# Check migration status
node scripts/migrate.js status

# Create new migration
node scripts/migrate.js create "add new feature table"
```

### Data Management

```bash
# Seed test data
npm run seed

# Clear test data (development only)
node scripts/seed.js clear
```

### Monitoring & Performance

```bash
# Generate monitoring report
node scripts/monitor.js report

# Check for performance issues
node scripts/monitor.js issues

# Export monitoring data
node scripts/monitor.js export monitoring-data.json
```

### Backup & Recovery

```bash
# Create full backup
node scripts/backup.js backup

# Create schema-only backup
node scripts/backup.js schema

# List available backups
node scripts/backup.js list

# Restore from backup
node scripts/backup.js restore /path/to/backup.sql.gz

# Verify backup integrity
node scripts/backup.js verify /path/to/backup.sql.gz

# Clean old backups
node scripts/backup.js clean
```

## Configuration

### Environment Variables

```bash
# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proofvault_dev
DB_USER=proofvault
DB_PASSWORD=your_password

# Admin Connection (for setup)
DB_ADMIN_USER=postgres
DB_ADMIN_PASSWORD=postgres_password

# SSL Configuration
DB_SSL=false  # Set to true for production

# Backup Configuration
BACKUP_STORAGE_PATH=/var/backups/proofvault
BACKUP_RETENTION_DAYS=30
```

### Connection Pool Settings

The database configuration includes optimized connection pooling:

- **Development**: 5-20 connections
- **Test**: 1-5 connections
- **Production**: 20-100 connections (optimized for blockchain workload)
- **Automatic failover** and health checking
- **Query timeout**: 30 seconds (5 minutes in production for complex operations)
- **Enhanced monitoring** with pool utilization tracking

## Database Design Principles

### 1. **Blockchain Integration**
- Evidence records link to blockchain transactions
- Support for multiple confirmation levels
- Transaction status tracking with retry logic

### 2. **Performance Optimization**
- Strategic indexing for common query patterns
- Materialized views for expensive aggregations
- Partitioning for high-volume tables
- Connection pooling and query optimization

### 3. **Data Integrity**
- Foreign key constraints ensure referential integrity
- Check constraints validate data formats
- Audit trails maintain change history
- Backup verification with checksums

### 4. **Scalability**
- Horizontal partitioning support
- Read replica compatibility
- Index-only scans for verification queries
- Efficient bulk insert patterns

## Common Query Patterns

### Verify Document Hash
```sql
SELECT 
    er.hash,
    er.submitter_address,
    er.capture_timestamp,
    er.status,
    bt.tx_hash,
    bt.block_height
FROM evidence_records er
LEFT JOIN blockchain_transactions bt ON er.id = bt.evidence_record_id
WHERE er.hash = $1 AND er.status = 'confirmed';
```

### User Dashboard
```sql
SELECT 
    hash,
    document_title,
    original_url,
    capture_timestamp,
    status,
    file_size
FROM evidence_records 
WHERE submitter_address = $1 
ORDER BY capture_timestamp DESC 
LIMIT 50;
```

### Analytics Query
```sql
SELECT 
    DATE(capture_timestamp) as date,
    COUNT(*) as submissions,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
    AVG(file_size) as avg_file_size
FROM evidence_records 
WHERE capture_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(capture_timestamp)
ORDER BY date DESC;
```

## Security Considerations

1. **API Keys**: Hashed using SHA-256 before storage
2. **Rate Limiting**: Per-user quotas tracked in database
3. **Audit Logging**: All sensitive operations logged
4. **Data Retention**: Configurable retention policies
5. **Connection Security**: SSL support for production
6. **Row-Level Security**: Can be enabled for multi-tenant scenarios

## Monitoring & Alerts

The monitoring system tracks:

- **Query Performance**: Slow query detection and analysis
- **Index Usage**: Unused index identification
- **Connection Health**: Pool utilization and blocking locks
- **Storage Growth**: Table and index size monitoring
- **Cache Hit Ratios**: Buffer pool efficiency
- **Replication Lag**: If using read replicas

### Recommended Alerts

- Buffer hit ratio < 95%
- Connection pool > 80% utilized
- Queries slower than 1 second
- Disk space > 80% full
- Replication lag > 1MB

## Troubleshooting

### Common Issues

1. **Slow Verification Queries**
   - Check if `evidence_verification_cache` is up to date
   - Ensure hash indexes are being used (check `EXPLAIN ANALYZE`)

2. **High Write Latency**
   - Monitor index maintenance overhead
   - Consider removing unused indexes

3. **Connection Pool Exhaustion**
   - Increase pool size or implement connection limits
   - Check for long-running transactions

4. **Storage Growth**
   - Archive old verification attempts
   - Implement partition pruning for time-series data

### Performance Tuning

1. **PostgreSQL Settings** (production)
   ```sql
   -- Increase shared buffers (25% of RAM)
   shared_buffers = 4GB
   
   -- Optimize for write-heavy workload
   wal_buffers = 16MB
   checkpoint_completion_target = 0.9
   
   -- Query optimization
   random_page_cost = 1.1  # For SSD storage
   effective_cache_size = 12GB
   ```

2. **Index Maintenance**
   ```sql
   -- Rebuild fragmented indexes
   REINDEX INDEX CONCURRENTLY idx_evidence_hash_btree;
   
   -- Update statistics
   ANALYZE evidence_records;
   ```

## Contributing

When adding new tables or modifying the schema:

1. Create migration files using `node scripts/migrate.js create "description"`
2. Include appropriate indexes for query patterns
3. Add monitoring queries to `scripts/monitor.js`
4. Update this documentation
5. Test with realistic data volumes

## License

MIT License - see LICENSE file for details.