-- Add blockchain verification columns to pdf_records table
ALTER TABLE pdf_records 
ADD COLUMN IF NOT EXISTS blockchain_tx_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP;

-- Create index for blockchain_tx_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pdf_records_blockchain_tx_id 
ON pdf_records(blockchain_tx_id) 
WHERE blockchain_tx_id IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN pdf_records.blockchain_tx_id IS 'Transaction ID from blockchain metagraph submission';
COMMENT ON COLUMN pdf_records.blockchain_verified_at IS 'Timestamp when hash was verified on blockchain';