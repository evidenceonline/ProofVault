#\!/bin/bash

echo "🔧 Quick Fix: Adding ordinal columns with sudo"
echo "=============================================="

echo ""
echo "Running migration as postgres user..."

sudo -u postgres psql -d proofvaultdb << 'EOSQL'
-- Add new columns
ALTER TABLE pdf_records 
ADD COLUMN IF NOT EXISTS blockchain_ordinal INTEGER,
ADD COLUMN IF NOT EXISTS ordinal_type VARCHAR(50) DEFAULT 'timestamp-based',
ADD COLUMN IF NOT EXISTS evidence_timestamp BIGINT;

-- Update existing data
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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON pdf_records TO proofvaultuser;

-- Show results
SELECT 
    'Migration completed\!' as status,
    COUNT(*) as total_records,
    COUNT(blockchain_ordinal) as real_ordinal_records,
    COUNT(CASE WHEN ordinal_type = 'real-blockchain-ordinal' THEN 1 END) as blockchain_records
FROM pdf_records;

-- Show sample data
SELECT 
    company_name,
    blockchain_ordinal,
    ordinal_type,
    evidence_timestamp
FROM pdf_records 
ORDER BY created_at DESC 
LIMIT 3;
EOSQL

echo ""
echo "✅ Migration complete\! Your database now has proper ordinal tracking."
