-- ProofVault Initial Database Schema
-- PostgreSQL 13+ optimized for blockchain-powered digital notary system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create enum types for better type safety and performance
CREATE TYPE evidence_status AS ENUM (
    'pending',           -- Submitted but not yet processed
    'processing',        -- Being processed by metagraph
    'confirmed',         -- Confirmed on blockchain
    'failed',           -- Processing failed
    'rejected'          -- Rejected by validation
);

CREATE TYPE verification_result AS ENUM (
    'valid',            -- Document hash matches blockchain record
    'invalid',          -- Document has been tampered with
    'not_found',        -- Hash not found in blockchain
    'expired'           -- Record exists but outside validity period
);

CREATE TYPE transaction_type AS ENUM (
    'register_pdf',     -- PDF registration transaction
    'verify_document',  -- Document verification transaction
    'update_metadata'   -- Metadata update transaction
);

-- ============================================================================
-- CORE EVIDENCE RECORDS TABLE
-- ============================================================================
CREATE TABLE evidence_records (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash (64 hex chars)
    
    -- Document metadata
    original_url TEXT NOT NULL,
    document_title TEXT,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    file_size BIGINT,
    
    -- Capture information
    capture_timestamp TIMESTAMPTZ NOT NULL,
    capture_user_agent TEXT,
    capture_viewport_size JSONB,  -- {width: 1920, height: 1080}
    
    -- Submitter information
    submitter_address VARCHAR(255) NOT NULL,
    submitter_signature TEXT,  -- Digital signature of the hash
    
    -- Blockchain integration
    metagraph_tx_hash VARCHAR(255),
    metagraph_block_height BIGINT,
    blockchain_timestamp TIMESTAMPTZ,
    consensus_confirmation_count INTEGER DEFAULT 0,
    
    -- Processing status
    status evidence_status DEFAULT 'pending',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- File storage
    local_file_path TEXT,
    ipfs_hash VARCHAR(255),
    storage_backend VARCHAR(50) DEFAULT 'local',  -- 'local', 'ipfs', 's3'
    
    -- Additional metadata (flexible JSONB for extensibility)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_hash_format CHECK (hash ~ '^[a-fA-F0-9]{64}$'),
    CONSTRAINT valid_file_size CHECK (file_size > 0),
    CONSTRAINT valid_confirmation_count CHECK (consensus_confirmation_count >= 0),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0)
);

-- ============================================================================
-- BLOCKCHAIN TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE blockchain_transactions (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash VARCHAR(255) NOT NULL,
    evidence_record_id UUID REFERENCES evidence_records(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type transaction_type NOT NULL,
    block_height BIGINT,
    block_hash VARCHAR(255),
    transaction_index INTEGER,
    
    -- Gas and fees
    gas_used BIGINT,
    gas_price BIGINT,
    transaction_fee BIGINT,
    
    -- Timing
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    
    -- Status tracking
    confirmation_count INTEGER DEFAULT 0,
    is_confirmed BOOLEAN DEFAULT FALSE,
    is_finalized BOOLEAN DEFAULT FALSE,
    
    -- Raw transaction data
    raw_transaction JSONB,
    receipt_data JSONB,
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Constraints
    CONSTRAINT valid_block_height CHECK (block_height > 0),
    CONSTRAINT valid_confirmation_count CHECK (confirmation_count >= 0),
    CONSTRAINT unique_tx_hash_per_evidence UNIQUE(tx_hash, evidence_record_id)
);

-- ============================================================================
-- DOCUMENT VERIFICATION HISTORY
-- ============================================================================
CREATE TABLE verification_attempts (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Document being verified
    submitted_hash VARCHAR(64) NOT NULL,
    matched_evidence_id UUID REFERENCES evidence_records(id),
    
    -- Verification details
    verification_result verification_result NOT NULL,
    verification_timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Requester information
    requester_ip INET,
    requester_user_agent TEXT,
    requester_address VARCHAR(255),  -- If authenticated
    
    -- Verification context
    verification_method VARCHAR(50) DEFAULT 'api',  -- 'api', 'web', 'extension'
    additional_data JSONB DEFAULT '{}',
    
    -- Performance metrics
    verification_duration_ms INTEGER,
    
    -- Constraints
    CONSTRAINT valid_hash_format CHECK (submitted_hash ~ '^[a-fA-F0-9]{64}$'),
    CONSTRAINT valid_duration CHECK (verification_duration_ms >= 0)
);

-- ============================================================================
-- USER MANAGEMENT (Simple implementation)
-- ============================================================================
CREATE TABLE users (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) NOT NULL UNIQUE,  -- Constellation Network address
    
    -- User profile
    display_name VARCHAR(255),
    email VARCHAR(255),
    
    -- API access
    api_key_hash VARCHAR(255),
    api_quota_daily INTEGER DEFAULT 1000,
    api_usage_count INTEGER DEFAULT 0,
    api_usage_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_level INTEGER DEFAULT 0,
    
    -- Security
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_quota CHECK (api_quota_daily >= 0),
    CONSTRAINT valid_usage CHECK (api_usage_count >= 0),
    CONSTRAINT valid_verification_level CHECK (verification_level >= 0)
);

-- ============================================================================
-- AUDIT TRAIL FOR COMPLIANCE
-- ============================================================================
CREATE TABLE audit_logs (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What happened
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,  -- 'evidence_record', 'user', 'transaction'
    resource_id UUID,
    
    -- Who did it
    actor_type VARCHAR(50) DEFAULT 'user',  -- 'user', 'system', 'api'
    actor_id UUID,
    actor_address VARCHAR(255),
    
    -- When and where
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    source_ip INET,
    user_agent TEXT,
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    context_data JSONB DEFAULT '{}',
    
    -- Compliance
    retention_until DATE,
    is_sensitive BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- SYSTEM CONFIGURATION AND METADATA
-- ============================================================================
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO system_config (key, value, description, is_public) VALUES 
('schema_version', '"1.0.0"', 'Current database schema version', TRUE),
('blockchain_network', '"integrationnet"', 'Target blockchain network', TRUE),
('max_file_size_mb', '10', 'Maximum PDF file size in MB', TRUE),
('verification_cache_ttl_hours', '24', 'Verification result cache TTL', FALSE),
('api_rate_limit_per_minute', '60', 'API calls per minute per user', FALSE);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION TABLES
-- ============================================================================

-- Materialized view for fast verification lookups
CREATE MATERIALIZED VIEW evidence_verification_cache AS
SELECT 
    hash,
    id as evidence_id,
    submitter_address,
    capture_timestamp,
    blockchain_timestamp,
    status,
    metagraph_tx_hash,
    CASE 
        WHEN status = 'confirmed' THEN 'valid'::verification_result
        WHEN status = 'failed' OR status = 'rejected' THEN 'invalid'::verification_result
        ELSE 'not_found'::verification_result
    END as cached_verification_result,
    created_at,
    updated_at
FROM evidence_records 
WHERE status IN ('confirmed', 'failed', 'rejected');

-- Unique index on the materialized view
CREATE UNIQUE INDEX idx_evidence_cache_hash ON evidence_verification_cache(hash);

-- Partitioned table for high-volume verification attempts (by month)
CREATE TABLE verification_attempts_partitioned (
    LIKE verification_attempts INCLUDING ALL
) PARTITION BY RANGE (verification_timestamp);

-- Create initial partitions (current period and next few months)
CREATE TABLE verification_attempts_2025_01 PARTITION OF verification_attempts_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE verification_attempts_2025_02 PARTITION OF verification_attempts_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE verification_attempts_2025_03 PARTITION OF verification_attempts_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE verification_attempts_2025_04 PARTITION OF verification_attempts_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

-- Add comment documentation
COMMENT ON TABLE evidence_records IS 'Core table storing PDF evidence records with blockchain integration';
COMMENT ON TABLE blockchain_transactions IS 'Tracks all blockchain transactions related to evidence records';
COMMENT ON TABLE verification_attempts IS 'Logs all document verification attempts for analytics and audit';
COMMENT ON TABLE users IS 'User accounts with API access management';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance and security';
COMMENT ON MATERIALIZED VIEW evidence_verification_cache IS 'Fast lookup cache for document verification queries';