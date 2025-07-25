-- ProofVault Database Indexes
-- Optimized for both write-heavy blockchain operations and read-heavy verification queries

-- ============================================================================
-- PRIMARY PERFORMANCE INDEXES
-- ============================================================================

-- Evidence Records - Most Critical Indexes
-- Fast hash lookups for verification (most common query)
CREATE INDEX CONCURRENTLY idx_evidence_hash_btree ON evidence_records USING btree(hash);
-- Covering index for verification queries (includes commonly needed columns)
CREATE INDEX CONCURRENTLY idx_evidence_hash_covering ON evidence_records 
    USING btree(hash) INCLUDE (status, submitter_address, capture_timestamp, metagraph_tx_hash);

-- Submitter address lookups (user dashboards)
CREATE INDEX CONCURRENTLY idx_evidence_submitter ON evidence_records USING btree(submitter_address);
CREATE INDEX CONCURRENTLY idx_evidence_submitter_status ON evidence_records 
    USING btree(submitter_address, status) WHERE status = 'confirmed';

-- Status-based queries (admin dashboards, processing queues)
CREATE INDEX CONCURRENTLY idx_evidence_status ON evidence_records USING btree(status);
CREATE INDEX CONCURRENTLY idx_evidence_status_created ON evidence_records 
    USING btree(status, created_at) WHERE status IN ('pending', 'processing');

-- Time-based queries (chronological browsing, analytics)
CREATE INDEX CONCURRENTLY idx_evidence_capture_time ON evidence_records 
    USING btree(capture_timestamp DESC);
CREATE INDEX CONCURRENTLY idx_evidence_blockchain_time ON evidence_records 
    USING btree(blockchain_timestamp DESC) WHERE blockchain_timestamp IS NOT NULL;

-- ============================================================================
-- BLOCKCHAIN TRANSACTION INDEXES
-- ============================================================================

-- Transaction hash lookups
CREATE INDEX CONCURRENTLY idx_blockchain_tx_hash ON blockchain_transactions 
    USING btree(tx_hash);

-- Evidence record relationships
CREATE INDEX CONCURRENTLY idx_blockchain_evidence_id ON blockchain_transactions 
    USING btree(evidence_record_id);

-- Block-based queries
CREATE INDEX CONCURRENTLY idx_blockchain_block_height ON blockchain_transactions 
    USING btree(block_height) WHERE block_height IS NOT NULL;

-- Confirmation tracking
CREATE INDEX CONCURRENTLY idx_blockchain_confirmation ON blockchain_transactions 
    USING btree(is_confirmed, confirmation_count);

-- Pending transactions (for processing queues)
CREATE INDEX CONCURRENTLY idx_blockchain_pending ON blockchain_transactions 
    USING btree(submitted_at) WHERE confirmed_at IS NULL;

-- ============================================================================
-- VERIFICATION ATTEMPTS INDEXES
-- ============================================================================

-- Hash-based verification lookups
CREATE INDEX CONCURRENTLY idx_verification_hash ON verification_attempts 
    USING btree(submitted_hash);

-- Time-based analytics
CREATE INDEX CONCURRENTLY idx_verification_timestamp ON verification_attempts 
    USING btree(verification_timestamp DESC);

-- Result-based analytics
CREATE INDEX CONCURRENTLY idx_verification_result ON verification_attempts 
    USING btree(verification_result, verification_timestamp);

-- IP-based analysis (security monitoring)
CREATE INDEX CONCURRENTLY idx_verification_ip ON verification_attempts 
    USING btree(requester_ip) WHERE requester_ip IS NOT NULL;

-- Performance monitoring
CREATE INDEX CONCURRENTLY idx_verification_duration ON verification_attempts 
    USING btree(verification_duration_ms) WHERE verification_duration_ms IS NOT NULL;

-- ============================================================================
-- USER MANAGEMENT INDEXES
-- ============================================================================

-- Primary user lookups
CREATE INDEX CONCURRENTLY idx_users_address ON users USING btree(address);

-- API key lookups (for authentication)
CREATE INDEX CONCURRENTLY idx_users_api_key ON users USING btree(api_key_hash) 
    WHERE api_key_hash IS NOT NULL AND is_active = TRUE;

-- Active users
CREATE INDEX CONCURRENTLY idx_users_active ON users USING btree(is_active, created_at);

-- Login tracking
CREATE INDEX CONCURRENTLY idx_users_last_login ON users 
    USING btree(last_login_at DESC) WHERE last_login_at IS NOT NULL;

-- ============================================================================
-- AUDIT LOG INDEXES
-- ============================================================================

-- Resource-based audit queries
CREATE INDEX CONCURRENTLY idx_audit_resource ON audit_logs 
    USING btree(resource_type, resource_id);

-- Actor-based audit queries
CREATE INDEX CONCURRENTLY idx_audit_actor ON audit_logs 
    USING btree(actor_type, actor_id);

-- Time-based audit queries
CREATE INDEX CONCURRENTLY idx_audit_occurred ON audit_logs 
    USING btree(occurred_at DESC);

-- Action-based queries
CREATE INDEX CONCURRENTLY idx_audit_action ON audit_logs 
    USING btree(action, occurred_at DESC);

-- Compliance queries (sensitive data)
CREATE INDEX CONCURRENTLY idx_audit_sensitive ON audit_logs 
    USING btree(is_sensitive, retention_until) WHERE is_sensitive = TRUE;

-- ============================================================================
-- FULL-TEXT SEARCH INDEXES (GIN)
-- ============================================================================

-- Document title and URL search
CREATE INDEX CONCURRENTLY idx_evidence_title_gin ON evidence_records 
    USING gin(to_tsvector('english', COALESCE(document_title, '')));

CREATE INDEX CONCURRENTLY idx_evidence_url_gin ON evidence_records 
    USING gin(to_tsvector('english', original_url));

-- Combined full-text search
CREATE INDEX CONCURRENTLY idx_evidence_fulltext_gin ON evidence_records 
    USING gin(to_tsvector('english', 
        COALESCE(document_title, '') || ' ' || 
        COALESCE(original_url, '')
    ));

-- ============================================================================
-- JSONB INDEXES FOR METADATA
-- ============================================================================

-- Evidence metadata search
CREATE INDEX CONCURRENTLY idx_evidence_metadata_gin ON evidence_records 
    USING gin(metadata);

-- Specific metadata key searches (add as needed)
CREATE INDEX CONCURRENTLY idx_evidence_browser_gin ON evidence_records 
    USING gin((metadata->'browser')) WHERE metadata ? 'browser';

-- Blockchain transaction metadata
CREATE INDEX CONCURRENTLY idx_blockchain_raw_data_gin ON blockchain_transactions 
    USING gin(raw_transaction);

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Only confirmed evidence records (most verification queries)
CREATE INDEX CONCURRENTLY idx_evidence_confirmed_hash ON evidence_records 
    USING btree(hash) WHERE status = 'confirmed';

-- Recent evidence records (dashboard queries)
CREATE INDEX CONCURRENTLY idx_evidence_recent ON evidence_records 
    USING btree(created_at DESC) 
    WHERE created_at > (NOW() - INTERVAL '30 days');

-- Failed transactions needing retry
CREATE INDEX CONCURRENTLY idx_blockchain_failed ON blockchain_transactions 
    USING btree(submitted_at) 
    WHERE is_confirmed = FALSE AND error_code IS NOT NULL;

-- High-value evidence (large files or premium users)
CREATE INDEX CONCURRENTLY idx_evidence_large_files ON evidence_records 
    USING btree(file_size DESC, created_at DESC) 
    WHERE file_size > 1048576; -- > 1MB

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- User activity analysis
CREATE INDEX CONCURRENTLY idx_evidence_user_activity ON evidence_records 
    USING btree(submitter_address, status, capture_timestamp DESC);

-- Blockchain processing pipeline
CREATE INDEX CONCURRENTLY idx_blockchain_processing ON blockchain_transactions 
    USING btree(transaction_type, is_confirmed, submitted_at);

-- Verification analytics
CREATE INDEX CONCURRENTLY idx_verification_analytics ON verification_attempts 
    USING btree(verification_result, verification_timestamp DESC, verification_method);

-- Cross-table join optimization (evidence + blockchain)
CREATE INDEX CONCURRENTLY idx_evidence_blockchain_join ON evidence_records 
    USING btree(id) INCLUDE (hash, status, metagraph_tx_hash);

-- ============================================================================
-- UNIQUE CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure unique API keys
CREATE UNIQUE INDEX CONCURRENTLY idx_users_api_key_unique ON users 
    (api_key_hash) WHERE api_key_hash IS NOT NULL;

-- Ensure unique evidence hashes
-- (Already created as UNIQUE constraint in main table, but adding comment)
-- CREATE UNIQUE INDEX idx_evidence_hash_unique ON evidence_records (hash);

-- Ensure unique transaction hashes per evidence
-- (Already created as constraint in main table)

-- ============================================================================
-- STATISTICS AND MAINTENANCE
-- ============================================================================

-- Update table statistics for query planner
ANALYZE evidence_records;
ANALYZE blockchain_transactions;
ANALYZE verification_attempts;
ANALYZE users;
ANALYZE audit_logs;

-- Set up automatic statistics collection
ALTER TABLE evidence_records SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE verification_attempts SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE blockchain_transactions SET (autovacuum_analyze_scale_factor = 0.05);

-- Comments for documentation
COMMENT ON INDEX idx_evidence_hash_btree IS 'Primary index for document verification queries';
COMMENT ON INDEX idx_evidence_hash_covering IS 'Covering index to avoid table lookups for common verification data';
COMMENT ON INDEX idx_evidence_submitter IS 'User dashboard queries by submitter address';
COMMENT ON INDEX idx_evidence_fulltext_gin IS 'Full-text search across document titles and URLs';
COMMENT ON INDEX idx_verification_hash IS 'Fast lookups for verification attempt history';
COMMENT ON INDEX idx_blockchain_tx_hash IS 'Blockchain transaction hash lookups';