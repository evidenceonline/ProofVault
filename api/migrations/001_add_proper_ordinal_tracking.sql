-- ================================================
-- ProofVault Database Migration: Proper Ordinal Tracking
-- File: 001_add_proper_ordinal_tracking.sql
-- Description: Separate real blockchain ordinals from timestamps
-- ================================================

-- Step 1: Add new columns for proper ordinal/timestamp separation
ALTER TABLE pdf_records 
ADD COLUMN IF NOT EXISTS blockchain_ordinal INTEGER,
ADD COLUMN IF NOT EXISTS ordinal_type VARCHAR(50) DEFAULT 'timestamp-based',
ADD COLUMN IF NOT EXISTS evidence_timestamp BIGINT;

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_records_blockchain_ordinal ON pdf_records(blockchain_ordinal);
CREATE INDEX IF NOT EXISTS idx_pdf_records_ordinal_type ON pdf_records(ordinal_type);

-- Step 3: Update existing records to properly categorize ordinal data
UPDATE pdf_records 
SET 
    ordinal_type = CASE 
        WHEN snapshot_ordinal IS NULL THEN 'none'
        WHEN snapshot_ordinal < 1000 AND snapshot_ordinal > 0 THEN 'real-blockchain-ordinal'
        WHEN snapshot_ordinal > 1000000000000 THEN 'timestamp-based'
        ELSE 'unknown'
    END,
    blockchain_ordinal = CASE 
        WHEN snapshot_ordinal < 1000 AND snapshot_ordinal > 0 THEN snapshot_ordinal::INTEGER
        ELSE NULL
    END,
    evidence_timestamp = CASE 
        WHEN snapshot_ordinal > 1000000000000 THEN snapshot_ordinal
        ELSE EXTRACT(epoch FROM created_at AT TIME ZONE 'UTC') * 1000
    END;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN pdf_records.blockchain_ordinal IS 'Real blockchain consensus ordinal (sequential number like 17, 18, 19...)';
COMMENT ON COLUMN pdf_records.ordinal_type IS 'Type of ordinal: real-blockchain-ordinal, timestamp-based, or unknown';
COMMENT ON COLUMN pdf_records.evidence_timestamp IS 'Original evidence capture timestamp in milliseconds since epoch';
COMMENT ON COLUMN pdf_records.snapshot_ordinal IS 'Legacy field - contains mixed ordinals and timestamps';

-- Step 5: Create a view for clean data access
CREATE OR REPLACE VIEW pdf_records_clean AS
SELECT 
    id,
    company_name,
    username,
    pdf_filename,
    pdf_hash,
    created_at,
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
    -- File size (calculated)
    LENGTH(pdf_data) as file_size_bytes
FROM pdf_records;

-- Step 6: Display migration results
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_records,
    COUNT(blockchain_ordinal) as real_ordinal_records,
    COUNT(CASE WHEN ordinal_type = 'timestamp-based' THEN 1 END) as timestamp_records,
    COUNT(CASE WHEN ordinal_type = 'real-blockchain-ordinal' THEN 1 END) as blockchain_ordinal_records
FROM pdf_records;

-- Step 7: Show sample of migrated data
SELECT 
    company_name,
    blockchain_ordinal,
    ordinal_type,
    evidence_timestamp,
    TO_TIMESTAMP(evidence_timestamp / 1000) AS evidence_captured_at,
    created_at
FROM pdf_records 
ORDER BY created_at DESC 
LIMIT 5;
