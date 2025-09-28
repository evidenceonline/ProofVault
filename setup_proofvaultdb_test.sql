-- ================================================
-- ProofVault Database Setup Script
-- Database: proofvaultdb_test
-- Created from existing schema analysis
-- ================================================

-- Create database (run as postgres superuser)
-- CREATE DATABASE proofvaultdb_test WITH OWNER proofvaultuser;

-- Create user and grant permissions (run as postgres superuser)
-- CREATE USER proofvaultuser WITH PASSWORD 'phoenixserg';
-- GRANT ALL PRIVILEGES ON DATABASE proofvaultdb_test TO proofvaultuser;

-- Connect to the database
\c proofvaultdb_test;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Main PDF Records Table
-- ================================================
CREATE TABLE IF NOT EXISTS pdf_records (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core evidence data
    company_name TEXT NOT NULL,
    username TEXT NOT NULL,
    pdf_filename TEXT NOT NULL,
    pdf_hash TEXT NOT NULL UNIQUE,
    pdf_data BYTEA NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Blockchain integration fields
    blockchain_tx_id TEXT,
    blockchain_status VARCHAR(50) DEFAULT 'pending',
    blockchain_verified_at TIMESTAMP WITH TIME ZONE,
    consensus_verified_at TIMESTAMP WITH TIME ZONE,

    -- File metadata
    file_id TEXT,
    file_size INTEGER,
    status VARCHAR(50) DEFAULT 'verified',

    -- Ordinal tracking fields (from migration)
    snapshot_ordinal BIGINT,
    blockchain_ordinal INTEGER,
    ordinal_type VARCHAR(50) DEFAULT 'timestamp-based',
    evidence_timestamp BIGINT
);

-- ================================================
-- Comments for Documentation
-- ================================================
COMMENT ON TABLE pdf_records IS 'Main table storing PDF evidence files with blockchain verification';
COMMENT ON COLUMN pdf_records.id IS 'Unique identifier for each PDF record';
COMMENT ON COLUMN pdf_records.pdf_hash IS 'SHA-256 hash of the PDF file for integrity verification';
COMMENT ON COLUMN pdf_records.pdf_data IS 'Binary data of the PDF file';
COMMENT ON COLUMN pdf_records.blockchain_tx_id IS 'Transaction ID from blockchain submission';
COMMENT ON COLUMN pdf_records.blockchain_ordinal IS 'Real blockchain consensus ordinal (sequential number like 17, 18, 19...)';
COMMENT ON COLUMN pdf_records.ordinal_type IS 'Type of ordinal: real-blockchain-ordinal, timestamp-based, or unknown';
COMMENT ON COLUMN pdf_records.evidence_timestamp IS 'Original evidence capture timestamp in milliseconds since epoch';
COMMENT ON COLUMN pdf_records.snapshot_ordinal IS 'Legacy field - contains mixed ordinals and timestamps';

-- ================================================
-- Indexes for Performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_pdf_records_company_name ON pdf_records(company_name);
CREATE INDEX IF NOT EXISTS idx_pdf_records_username ON pdf_records(username);
CREATE INDEX IF NOT EXISTS idx_pdf_records_created_at ON pdf_records(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_records_blockchain_status ON pdf_records(blockchain_status);
CREATE INDEX IF NOT EXISTS idx_pdf_records_blockchain_ordinal ON pdf_records(blockchain_ordinal);
CREATE INDEX IF NOT EXISTS idx_pdf_records_ordinal_type ON pdf_records(ordinal_type);
CREATE INDEX IF NOT EXISTS idx_pdf_records_evidence_timestamp ON pdf_records(evidence_timestamp);

-- ================================================
-- Clean Data View (from migration)
-- ================================================
CREATE OR REPLACE VIEW pdf_records_clean AS
SELECT
    id,
    company_name,
    username,
    pdf_filename,
    pdf_hash,
    created_at,
    updated_at,

    -- Clean ordinal data
    blockchain_ordinal,
    ordinal_type,
    evidence_timestamp,

    -- Convert timestamp to readable date
    TO_TIMESTAMP(evidence_timestamp / 1000) AS evidence_captured_at,

    -- Blockchain status
    blockchain_tx_id,
    blockchain_status,
    blockchain_verified_at,
    consensus_verified_at,
    file_id,
    status,

    -- File size (calculated from binary data)
    LENGTH(pdf_data) as file_size_bytes,

    -- Legacy field
    snapshot_ordinal
FROM pdf_records;

COMMENT ON VIEW pdf_records_clean IS 'Clean view of PDF records with properly formatted timestamps and calculated fields';

-- ================================================
-- Update Trigger for updated_at
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pdf_records_updated_at
    BEFORE UPDATE ON pdf_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Grant Permissions
-- ================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON pdf_records TO proofvaultuser;
GRANT SELECT ON pdf_records_clean TO proofvaultuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO proofvaultuser;

-- ================================================
-- Verification Queries
-- ================================================
-- Check table structure
\d pdf_records

-- Show indexes
\di

-- Show views
\dv

-- Count records
SELECT COUNT(*) as total_records FROM pdf_records;

-- Show sample data structure
SELECT
    'Table created successfully' as status,
    COUNT(*) as total_records,
    COUNT(blockchain_ordinal) as records_with_blockchain_ordinal,
    COUNT(CASE WHEN blockchain_status = 'pending' THEN 1 END) as pending_records,
    COUNT(CASE WHEN blockchain_status = 'verified' THEN 1 END) as verified_records
FROM pdf_records;

-- ================================================
-- Setup Complete
-- ================================================
SELECT 'ProofVault database setup completed successfully!' as message;