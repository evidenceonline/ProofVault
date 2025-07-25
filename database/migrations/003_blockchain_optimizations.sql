-- ProofVault Blockchain Optimization Migration
-- Migration: 003 - Blockchain Optimization Features
-- Created: 2025-01-25
-- Description: Enhanced blockchain integration and performance optimizations

-- ============================================================================
-- ENHANCED BLOCKCHAIN TRANSACTION TRACKING
-- ============================================================================

-- Add more detailed blockchain transaction tracking fields
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS l0_transaction_hash VARCHAR(255);
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS l1_transaction_hash VARCHAR(255);
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS network_name VARCHAR(50) DEFAULT 'integrationnet';
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS consensus_round BIGINT;
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS snapshot_hash VARCHAR(255);
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS transaction_version INTEGER DEFAULT 1;

-- Add better error tracking for blockchain operations
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS retry_attempts INTEGER DEFAULT 0;
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE blockchain_transactions ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Add constraints for new fields
ALTER TABLE blockchain_transactions ADD CONSTRAINT valid_retry_attempts CHECK (retry_attempts >= 0);
ALTER TABLE blockchain_transactions ADD CONSTRAINT valid_max_retries CHECK (max_retries >= 0);
ALTER TABLE blockchain_transactions ADD CONSTRAINT valid_consensus_round CHECK (consensus_round >= 0);

-- ============================================================================
-- BLOCKCHAIN BATCH PROCESSING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS blockchain_batches (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_hash VARCHAR(255) NOT NULL UNIQUE,
    
    -- Batch details
    batch_size INTEGER NOT NULL,
    evidence_count INTEGER NOT NULL,
    total_size_bytes BIGINT,
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    
    -- Blockchain details
    l0_batch_hash VARCHAR(255),
    l1_batch_hash VARCHAR(255),
    consensus_round BIGINT,
    confirmation_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Constraints
    CONSTRAINT valid_batch_size CHECK (batch_size > 0),
    CONSTRAINT valid_evidence_count CHECK (evidence_count > 0),
    CONSTRAINT valid_confirmation_count CHECK (confirmation_count >= 0)
);

-- Create index for batch processing
CREATE INDEX IF NOT EXISTS idx_blockchain_batches_status ON blockchain_batches(status, created_at);
CREATE INDEX IF NOT EXISTS idx_blockchain_batches_hash ON blockchain_batches(batch_hash);

-- ============================================================================
-- CONSENSUS STATE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS consensus_state (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_name VARCHAR(50) NOT NULL,
    
    -- Current state
    current_round BIGINT NOT NULL,
    current_snapshot_hash VARCHAR(255),
    current_l0_height BIGINT,
    current_l1_height BIGINT,
    
    -- Timestamps
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    
    -- Status
    is_synced BOOLEAN DEFAULT false,
    sync_lag_seconds INTEGER DEFAULT 0,
    
    -- Peer information
    active_peers INTEGER DEFAULT 0,
    total_peers INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_block_time_ms INTEGER,
    transactions_per_second NUMERIC(10,2),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_round CHECK (current_round >= 0),
    CONSTRAINT valid_heights CHECK (current_l0_height >= 0 AND current_l1_height >= 0),
    CONSTRAINT valid_peers CHECK (active_peers >= 0 AND total_peers >= 0)
);

-- Ensure only one row per network
CREATE UNIQUE INDEX IF NOT EXISTS idx_consensus_state_network ON consensus_state(network_name);

-- ============================================================================
-- ENHANCED EVIDENCE RECORD OPTIMIZATIONS
-- ============================================================================

-- Add blockchain-specific fields to evidence records
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES blockchain_batches(id);
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS registration_id VARCHAR(255);
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS l0_address VARCHAR(255);
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS l1_address VARCHAR(255);
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS consensus_round BIGINT;
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS snapshot_ordinal BIGINT;

-- Add enhanced validation fields
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS validation_score INTEGER DEFAULT 100;
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 100;

-- Add enhanced metadata
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS content_hash VARCHAR(255);
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS structure_hash VARCHAR(255);
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS page_count INTEGER;
ALTER TABLE evidence_records ADD COLUMN IF NOT EXISTS word_count INTEGER;

-- Add constraints for scores
ALTER TABLE evidence_records ADD CONSTRAINT valid_validation_score CHECK (validation_score >= 0 AND validation_score <= 100);
ALTER TABLE evidence_records ADD CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 100);
ALTER TABLE evidence_records ADD CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100);

-- ============================================================================
-- VERIFICATION ENHANCEMENTS
-- ============================================================================

-- Add more detailed verification tracking
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS consensus_verified BOOLEAN DEFAULT false;
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS blockchain_confidence INTEGER DEFAULT 0;
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS l0_verified BOOLEAN DEFAULT false;
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS l1_verified BOOLEAN DEFAULT false;
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS verification_score INTEGER DEFAULT 0;

-- Add network performance tracking
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS network_latency_ms INTEGER;
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS blockchain_query_time_ms INTEGER;
ALTER TABLE verification_attempts ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT false;

-- Add constraints
ALTER TABLE verification_attempts ADD CONSTRAINT valid_confidence CHECK (blockchain_confidence >= 0 AND blockchain_confidence <= 100);
ALTER TABLE verification_attempts ADD CONSTRAINT valid_verification_score CHECK (verification_score >= 0 AND verification_score <= 100);

-- ============================================================================
-- NETWORK PERFORMANCE MONITORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS network_metrics (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Network details
    network_name VARCHAR(50) NOT NULL,
    node_type VARCHAR(50), -- 'l0', 'l1', 'validator'
    node_id VARCHAR(255),
    
    -- Performance metrics
    response_time_ms INTEGER,
    throughput_tps NUMERIC(10,2),
    error_rate NUMERIC(5,2),
    success_rate NUMERIC(5,2),
    
    -- Resource metrics
    cpu_usage NUMERIC(5,2),
    memory_usage NUMERIC(5,2),
    disk_usage NUMERIC(5,2),
    network_usage NUMERIC(10,2),
    
    -- Blockchain metrics
    block_height BIGINT,
    transaction_count INTEGER,
    pending_transactions INTEGER,
    confirmation_time_ms INTEGER,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_response_time CHECK (response_time_ms >= 0),
    CONSTRAINT valid_rates CHECK (error_rate >= 0 AND success_rate >= 0),
    CONSTRAINT valid_usage CHECK (cpu_usage >= 0 AND memory_usage >= 0 AND disk_usage >= 0)
);

-- Partition by month for performance
CREATE INDEX IF NOT EXISTS idx_network_metrics_timestamp ON network_metrics(metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_network_metrics_network ON network_metrics(network_name, metric_timestamp);

-- ============================================================================
-- ENHANCED AUDIT LOGGING
-- ============================================================================

-- Add blockchain-specific audit events
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS network_name VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS consensus_round BIGINT;

-- Add performance tracking to audit logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS transaction_size_bytes INTEGER;

-- ============================================================================
-- OPTIMIZED INDEXES FOR BLOCKCHAIN OPERATIONS
-- ============================================================================

-- Blockchain transaction optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_tx_batch ON blockchain_transactions(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_tx_network ON blockchain_transactions(network_name, submitted_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_tx_consensus ON blockchain_transactions(consensus_round) WHERE consensus_round IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_tx_retry ON blockchain_transactions(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Evidence record blockchain indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_batch ON evidence_records(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_registration ON evidence_records(registration_id) WHERE registration_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_consensus ON evidence_records(consensus_round) WHERE consensus_round IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_scores ON evidence_records(validation_score, risk_score, quality_score);

-- Verification blockchain indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_consensus ON verification_attempts(consensus_verified, l0_verified, l1_verified);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_performance ON verification_attempts(network_latency_ms, blockchain_query_time_ms) WHERE network_latency_ms IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_cache ON verification_attempts(cache_hit, verification_timestamp);

-- ============================================================================
-- BLOCKCHAIN INTEGRATION FUNCTIONS
-- ============================================================================

-- Function to calculate evidence batch hash
CREATE OR REPLACE FUNCTION calculate_batch_hash(evidence_ids UUID[])
RETURNS VARCHAR(255)
LANGUAGE plpgsql
AS $$
DECLARE
    hash_input TEXT := '';
    evidence_id UUID;
    evidence_hash VARCHAR(64);
BEGIN
    -- Sort evidence IDs for consistent hashing
    FOREACH evidence_id IN ARRAY array_agg(unnest ORDER BY unnest) FROM unnest(evidence_ids)
    LOOP
        SELECT hash INTO evidence_hash FROM evidence_records WHERE id = evidence_id;
        hash_input := hash_input || evidence_hash;
    END LOOP;
    
    -- Return SHA-256 of concatenated hashes
    RETURN encode(digest(hash_input, 'sha256'), 'hex');
END;
$$;

-- Function to update consensus state
CREATE OR REPLACE FUNCTION update_consensus_state(
    p_network_name VARCHAR(50),
    p_current_round BIGINT,
    p_snapshot_hash VARCHAR(255) DEFAULT NULL,
    p_l0_height BIGINT DEFAULT NULL,
    p_l1_height BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO consensus_state (
        network_name, current_round, current_snapshot_hash, 
        current_l0_height, current_l1_height, last_updated
    )
    VALUES (
        p_network_name, p_current_round, p_snapshot_hash,
        p_l0_height, p_l1_height, NOW()
    )
    ON CONFLICT (network_name) 
    DO UPDATE SET
        current_round = EXCLUDED.current_round,
        current_snapshot_hash = COALESCE(EXCLUDED.current_snapshot_hash, consensus_state.current_snapshot_hash),
        current_l0_height = COALESCE(EXCLUDED.current_l0_height, consensus_state.current_l0_height),
        current_l1_height = COALESCE(EXCLUDED.current_l1_height, consensus_state.current_l1_height),
        last_updated = NOW(),
        last_sync_at = NOW(),
        is_synced = true;
END;
$$;

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Enhanced verification cache with blockchain data
DROP MATERIALIZED VIEW IF EXISTS evidence_verification_cache;
CREATE MATERIALIZED VIEW evidence_verification_cache AS
SELECT 
    er.hash,
    er.id as evidence_id,
    er.submitter_address,
    er.capture_timestamp,
    er.blockchain_timestamp,
    er.status,
    er.metagraph_tx_hash,
    er.consensus_round,
    er.validation_score,
    er.risk_score,
    er.quality_score,
    bt.network_name,
    bt.confirmation_count as tx_confirmations,
    CASE 
        WHEN er.status = 'confirmed' AND er.validation_score >= 80 THEN 'valid'::verification_result
        WHEN er.status = 'failed' OR er.status = 'rejected' OR er.risk_score > 50 THEN 'invalid'::verification_result
        ELSE 'not_found'::verification_result
    END as cached_verification_result,
    er.created_at,
    er.updated_at
FROM evidence_records er
LEFT JOIN blockchain_transactions bt ON er.metagraph_tx_hash = bt.tx_hash
WHERE er.status IN ('confirmed', 'failed', 'rejected');

-- Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_cache_hash_v2 ON evidence_verification_cache(hash);
CREATE INDEX IF NOT EXISTS idx_evidence_cache_network ON evidence_verification_cache(network_name, cached_verification_result);

-- Blockchain performance summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS blockchain_performance_summary AS
SELECT 
    network_name,
    DATE_TRUNC('hour', metric_timestamp) as hour,
    AVG(response_time_ms) as avg_response_time,
    AVG(throughput_tps) as avg_throughput,
    AVG(error_rate) as avg_error_rate,
    AVG(success_rate) as avg_success_rate,
    COUNT(*) as metric_count
FROM network_metrics
WHERE metric_timestamp > NOW() - INTERVAL '7 days'
GROUP BY network_name, DATE_TRUNC('hour', metric_timestamp)
ORDER BY network_name, hour DESC;

CREATE INDEX IF NOT EXISTS idx_blockchain_perf_summary ON blockchain_performance_summary(network_name, hour);

-- ============================================================================
-- TRIGGER FUNCTIONS FOR ENHANCED AUDIT LOGGING
-- ============================================================================

-- Enhanced audit trigger for evidence records
CREATE OR REPLACE FUNCTION audit_evidence_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            action, resource_type, resource_id, actor_type,
            new_values, context_data, blockchain_tx_hash, network_name
        ) VALUES (
            'evidence_created', 'evidence_record', NEW.id, 'system',
            to_jsonb(NEW), 
            jsonb_build_object(
                'trigger', 'evidence_insert',
                'file_size', NEW.file_size,
                'submitter', NEW.submitter_address
            ),
            NEW.metagraph_tx_hash,
            COALESCE((SELECT network_name FROM blockchain_transactions WHERE tx_hash = NEW.metagraph_tx_hash), 'unknown')
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            action, resource_type, resource_id, actor_type,
            old_values, new_values, context_data, blockchain_tx_hash, network_name
        ) VALUES (
            'evidence_updated', 'evidence_record', NEW.id, 'system',
            to_jsonb(OLD), to_jsonb(NEW),
            jsonb_build_object(
                'trigger', 'evidence_update',
                'status_changed', OLD.status != NEW.status,
                'blockchain_updated', OLD.metagraph_tx_hash != NEW.metagraph_tx_hash
            ),
            COALESCE(NEW.metagraph_tx_hash, OLD.metagraph_tx_hash),
            COALESCE((SELECT network_name FROM blockchain_transactions WHERE tx_hash = COALESCE(NEW.metagraph_tx_hash, OLD.metagraph_tx_hash)), 'unknown')
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;

-- Create/recreate the trigger
DROP TRIGGER IF EXISTS evidence_audit_trigger ON evidence_records;
CREATE TRIGGER evidence_audit_trigger
    AFTER INSERT OR UPDATE ON evidence_records
    FOR EACH ROW EXECUTE FUNCTION audit_evidence_changes();

-- ============================================================================
-- PERFORMANCE OPTIMIZATION SETTINGS
-- ============================================================================

-- Update vacuum and analyze settings for blockchain tables
ALTER TABLE blockchain_transactions SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE blockchain_batches SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE network_metrics SET (autovacuum_analyze_scale_factor = 0.1);

-- ============================================================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================================================

-- Insert default consensus state for integration network
INSERT INTO consensus_state (network_name, current_round, is_synced)
VALUES ('integrationnet', 0, false)
ON CONFLICT (network_name) DO NOTHING;

-- Insert default consensus state for mainnet
INSERT INTO consensus_state (network_name, current_round, is_synced)
VALUES ('mainnet', 0, false)
ON CONFLICT (network_name) DO NOTHING;

-- Update system configuration with blockchain settings
INSERT INTO system_config (key, value, description, is_public) VALUES 
('blockchain_batch_size', '100', 'Number of evidence records per blockchain batch', false),
('blockchain_confirmation_timeout_minutes', '30', 'Timeout for blockchain confirmations', false),
('blockchain_retry_backoff_seconds', '60', 'Retry backoff time for failed blockchain operations', false),
('network_sync_interval_seconds', '30', 'Interval for network state synchronization', false),
('consensus_required_confirmations', '3', 'Required confirmations for consensus', true),
('verification_cache_refresh_hours', '1', 'How often to refresh verification cache', false)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE blockchain_batches IS 'Tracks batches of evidence records processed together on blockchain';
COMMENT ON TABLE consensus_state IS 'Current state of blockchain consensus across different networks';
COMMENT ON TABLE network_metrics IS 'Performance and health metrics for blockchain network nodes';
COMMENT ON FUNCTION calculate_batch_hash(UUID[]) IS 'Calculates deterministic hash for a batch of evidence records';
COMMENT ON FUNCTION update_consensus_state(VARCHAR, BIGINT, VARCHAR, BIGINT, BIGINT) IS 'Updates consensus state for a given network';
COMMENT ON MATERIALIZED VIEW blockchain_performance_summary IS 'Hourly summary of blockchain network performance metrics';

-- Refresh materialized views
REFRESH MATERIALIZED VIEW evidence_verification_cache;
REFRESH MATERIALIZED VIEW blockchain_performance_summary;

-- Update table statistics
ANALYZE blockchain_transactions;
ANALYZE evidence_records;
ANALYZE verification_attempts;