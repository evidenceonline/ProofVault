# ProofVault Blockchain Integration Testing Guide

## Prerequisites

1. PostgreSQL database running with ProofVault schema
2. Node.js installed
3. Two terminal windows available

## Testing Steps

### Terminal 1: Start the Metagraph

```bash
# 1. Apply database migration (if not already done)
cd /home/nodeadmin/proofvault/api
psql -d $DATABASE_URL -f migrations/add_blockchain_columns.sql

# 2. Build and start the metagraph
cd /home/nodeadmin/todo/euclid-development-environment
./scripts/hydra build
./scripts/hydra start
```

Wait for the metagraph to fully start. You should see:
- Global L0 running on http://localhost:9000
- Metagraph L1 Data running on http://localhost:9400

### Terminal 2: Start ProofVault API and Run Tests

```bash
# 1. Start the ProofVault API
cd /home/nodeadmin/proofvault/api
npm run dev
```

Wait for: "Server running on port 3001"

### Terminal 3: Run Integration Tests

```bash
# Run the automated test suite
cd /home/nodeadmin/proofvault
node test-integration.js
```

## Manual Testing with Chrome Extension

1. Load the Chrome extension from `/home/nodeadmin/proofvault/chrome-extension`
2. Navigate to any webpage
3. Click the ProofVault extension icon
4. Fill in company name and capture evidence
5. Check the API logs for blockchain submission
6. Use the verification endpoint to check blockchain status

## Testing Endpoints

### 1. Upload PDF (with automatic blockchain submission)
```bash
curl -X POST http://localhost:3001/api/pdf/upload \
  -F "file=@test.pdf" \
  -F "company_name=Test Company" \
  -F "username=test-user"
```

### 2. Verify PDF on blockchain
```bash
# Replace {pdf-id} with the ID from upload response
curl http://localhost:3001/api/pdf/{pdf-id}/verify
```

### 3. Query metagraph directly
```bash
# Get all active hashes
curl http://localhost:9400/active-hashes/all

# Verify specific hash
curl http://localhost:9400/hash/verify/{pdf-hash}

# Get hashes by company
curl http://localhost:9400/hash/company/Test%20Company
```

## Expected Results

✅ **Successful Integration:**
- PDF uploads return a hash
- API logs show "Hash submitted to blockchain"
- Verification endpoint shows `blockchain_verified: true`
- Metagraph queries return the hash record

⚠️ **Common Issues:**
- "Blockchain submission failed" - Check if metagraph is running
- "Hash not found" - Wait a few seconds for blockchain confirmation
- Connection refused - Ensure both API and metagraph are running

## Monitoring

1. **API Logs**: Watch for blockchain submission messages
2. **Database**: Check `blockchain_tx_id` column in `pdf_records`
3. **Metagraph Logs**: Monitor for incoming transactions

## Stopping Services

```bash
# Stop metagraph
cd /home/nodeadmin/todo/euclid-development-environment
./scripts/hydra stop

# Stop API
Ctrl+C in the API terminal
```

## Troubleshooting

1. **Port conflicts**: Ensure ports 3001, 9000, and 9400 are free
2. **Database connection**: Verify DATABASE_URL is set correctly
3. **Build errors**: Check Scala/Java versions for metagraph

## Next Steps

After successful local testing:
1. Deploy metagraph to IntegrationNet
2. Update API to use IntegrationNet URLs
3. Test with production-like data