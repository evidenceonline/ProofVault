-- Clear premature blockchain verification timestamps for submitted records
-- This migration ensures that records marked as "submitted" do not retain
-- a blockchain_verified_at value until a finalized commitment is received.

BEGIN;

UPDATE pdf_records
SET blockchain_verified_at = NULL
WHERE blockchain_status = 'submitted'
  AND blockchain_verified_at IS NOT NULL;

COMMIT;
