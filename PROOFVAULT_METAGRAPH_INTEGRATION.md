# ProofVault Metagraph Integration Guide

## Overview

This document provides comprehensive information about integrating ProofVault with the Constellation Network metagraph for blockchain verification of PDF hashes. The integration enables immutable, tamper-proof storage of legal evidence on the blockchain.

## Architecture

### Components
- **ProofVault API** (Node.js/Express) - Evidence storage and management
- **Constellation Metagraph** (Scala/Tessellation) - Blockchain verification layer
- **TextUpdate Service** - Key-value storage for ID → hash mapping
- **PostgreSQL Database** - PDF evidence storage with blockchain metadata

### Data Flow
1. ProofVault generates PDF with legal evidence
2. PDF hash calculated and stored in PostgreSQL
3. Hash submitted to metagraph for blockchain verification
4. Metagraph stores hash immutably on distributed ledger
5. Verification status updated in ProofVault database
6. Users can verify evidence integrity via blockchain lookup

## Current Status

### What's Working
- ✅ Metagraph is running with 3 validator nodes (Docker containers)
- ✅ TextUpdate service is deployed and compiled in data-l1.jar
- ✅ InMemoryRepo storage mechanism is functional
- ✅ ProofVault PDF generation and database storage
- ✅ ProofVault blockchain integration code structure

### What's Not Working
- ❌ HTTP POST endpoint for hash submission (missing in Main.scala)
- ❌ Routes not properly registered with HTTP server
- ❌ GET endpoint returns 404 (routes registration issue)
- ❌ dag4.js SDK submission also failing due to same root cause

## Technical Details

### Metagraph Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   global-l0     │    │  metagraph-l0   │    │   currency-l1   │
│   (Port 9000)   │    │   (Port 9200)   │    │   (Port 9300)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │    data-l1      │
                       │   (Port 9400)   │
                       │  TextUpdate     │
                       │   Service       │
                       └─────────────────┘
```

### Data Structures

#### TextUpdate Model (Scala)
```scala
final case class TextUpdate(id: String, hash: String) extends DataUpdate
```

#### ProofVault Submission Format
```javascript
{
  value: {
    id: recordId,
    hash: pdfHash,
    filename: filename,
    company: companyName,
    timestamp: Date.now()
  },
  proofs: []
}
```

### Database Schema
```sql
-- Blockchain-related columns in pdf_records table
ALTER TABLE pdf_records ADD COLUMN blockchain_hash VARCHAR(64);
ALTER TABLE pdf_records ADD COLUMN blockchain_status VARCHAR(20);
ALTER TABLE pdf_records ADD COLUMN blockchain_tx_id VARCHAR(255);
ALTER TABLE pdf_records ADD COLUMN blockchain_verified_at TIMESTAMP;
```

## Required Changes

### Metagraph Developer Tasks

#### 1. Add POST Endpoint in Main.scala
**File:** `modules/data_l1/src/main/scala/io/proofvault/data_l1/Main.scala`

**Current Code:**
```scala
case GET -> Root / "text" / id =>
  repoR.use(_.get(id)).flatMap {
    case Some(tu) => Ok(tu.asJson)
    case None     => NotFound()
  }
```

**Required Addition:**
```scala
case POST -> Root / "text" =>
  req.as[TextUpdate].flatMap { textUpdate =>
    repoR.use(_.put(textUpdate)) *> Ok(textUpdate.asJson)
  }
```

#### 2. Register Routes with HTTP Server
The TextUpdate routes need to be properly registered with the HTTP4s server. Currently, the service is compiled but routes are not exposed.

**Investigation needed:**
- Check HTTP server initialization in Main.scala
- Ensure routes are added to the server's route definitions
- Verify CORS and content-type handling

#### 3. Alternative: dag4.js SDK Support
If HTTP endpoints are not desired, ensure dag4.js SDK can submit TextUpdate transactions:
```javascript
const dag4 = require('@stardust-collective/dag4');
// Submit transaction via SDK
```

### ProofVault Changes (Already Implemented)

#### Current Implementation
**File:** `api/controllers/pdfController.js:491-534`

```javascript
const submitToBlockchain = async (recordId, pdfHash, filename, companyName) => {
  try {
    // Submit to metagraph using current format
    const response = await fetch('http://localhost:9400/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: {
          id: recordId,
          hash: pdfHash,
          filename: filename,
          company: companyName,
          timestamp: Date.now()
        },
        proofs: []
      })
    });

    if (response.ok) {
      // Update database with blockchain confirmation
      const client = await pool.connect();
      try {
        await client.query(
          'UPDATE pdf_records SET blockchain_tx_id = $1, blockchain_verified_at = NOW() WHERE id = $2',
          [recordId, recordId]
        );
      } finally {
        client.release();
      }
      return true;
    } else {
      throw new Error(`Blockchain submission failed: ${response.status}`);
    }
  } catch (error) {
    throw error;
  }
};
```

#### When Metagraph is Fixed
Change the endpoint URL from `/data` to `/text` to match TextUpdate service:
```javascript
const response = await fetch('http://localhost:9400/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: recordId,
    hash: pdfHash
  })
});
```

## Testing Commands

### Check Metagraph Status
```bash
# Check running containers
docker ps | grep proofvault

# Check process status
ps aux | grep java

# Check port availability
ss -tulnp | grep -E ':(9000|9200|9300|9400)'
```

### Test Database Connection
```bash
PGPASSWORD=phoenixserg psql -h localhost -U proofvaultuser -d proofvaultdb -c "SELECT id, company_name, LENGTH(pdf_data) as pdf_size_bytes FROM pdf_records ORDER BY created_at DESC LIMIT 3;"
```

### Test API Endpoints
```bash
# Test ProofVault PDF upload
curl -X POST http://localhost:3003/api/pdf/upload \
  -F "file=@test.pdf" \
  -F "company_name=TestCorp" \
  -F "username=testuser"

# Test metagraph health (once fixed)
curl http://localhost:9400/text/test-id

# Test blockchain verification
curl http://localhost:3003/api/pdf/verify/{pdf-id}
```

## Troubleshooting

### Common Issues

#### 1. "404 Not Found" on /text endpoint
**Cause:** Routes not registered with HTTP server
**Solution:** Ensure TextUpdate routes are added to server configuration

#### 2. "Missing required field" errors
**Cause:** Incorrect request format or missing signature
**Solution:** Use correct TextUpdate format with proper JSON structure

#### 3. Connection refused on port 9400
**Cause:** Service not running or port mapping issue
**Solution:** Verify Docker container status and port bindings

#### 4. Database connection errors
**Cause:** PostgreSQL service down or credentials incorrect
**Solution:** Check database service and connection string

### Diagnostic Commands
```bash
# Check service logs
pm2 logs

# Check database connectivity
PGPASSWORD=phoenixserg psql -h localhost -U proofvaultuser -d proofvaultdb -c "SELECT version();"

# Check metagraph jar contents
jar tf ~/euclid-development-environment2/source/project/proofvault-0.3/modules/data_l1/target/scala-2.13/proofvault-data_l1-*.jar | grep TextUpdate

# Monitor network traffic
netstat -tulnp | grep java
```

## Implementation Roadmap

### Phase 1: Core Integration (Current)
- [x] ProofVault PDF generation and storage
- [x] Metagraph deployment and service compilation
- [ ] HTTP POST endpoint implementation
- [ ] Route registration fixes
- [ ] Basic hash submission/retrieval

### Phase 2: Production Readiness
- [ ] Error handling and retry logic
- [ ] Transaction confirmation polling
- [ ] Blockchain status monitoring
- [ ] Performance optimization

### Phase 3: Advanced Features
- [ ] Batch hash submission
- [ ] Real-time blockchain status updates
- [ ] Court-admissible verification certificates
- [ ] Integration with legal workflow systems

## File Locations

### ProofVault
- **API Controller:** `/home/nodeadmin/proofvault/api/controllers/pdfController.js`
- **Database Config:** `/home/nodeadmin/proofvault/api/config/database.js`
- **Routes:** `/home/nodeadmin/proofvault/api/routes/pdf.js`

### Metagraph
- **Source Root:** `/home/nodeadmin/euclid-development-environment2/source/project/proofvault-0.3/`
- **Main Class:** `modules/data_l1/src/main/scala/io/proofvault/data_l1/Main.scala`
- **Data Model:** `modules/shared_data/src/main/scala/io/proofvault/shared_data/model/TextUpdate.scala`
- **Repository:** `modules/data_l1/src/main/scala/io/proofvault/data_l1/Repo.scala`
- **Build File:** `build.sbt`

## Contact and Support

For questions or issues with this integration:
1. Check this documentation first
2. Review ProofVault logs: `pm2 logs`
3. Check database connectivity
4. Verify metagraph service status
5. Test with provided diagnostic commands

## Legal Compliance Notes

This integration is designed to meet Federal Rules of Evidence requirements:
- **Rule 901(b)(9)** - Authentication via distinctive blockchain characteristics
- **Immutable Evidence** - Blockchain provides tamper-proof storage
- **Chain of Custody** - Complete audit trail from capture to court
- **Timestamp Accuracy** - Precise time recording for legal proceedings

The blockchain verification ensures that any tampering with evidence after initial capture will be immediately detectable, providing the legal certainty required for court admissibility.