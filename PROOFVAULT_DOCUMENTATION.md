# ProofVault Digital Evidence System

## Overview

ProofVault is a comprehensive digital evidence capture, verification, and blockchain attestation system designed for legal and compliance use cases. The system provides tamper-proof evidence collection with cryptographic integrity guarantees through integration with Constellation Network's Digital Evidence API.

## What ProofVault Solves

- **Legal Evidence Integrity**: Provides cryptographic proof that digital evidence hasn't been tampered with
- **Blockchain Attestation**: Creates immutable records on Constellation Network's blockchain
- **Automated Evidence Capture**: Chrome extension for seamless web page and document capture
- **Chain of Custody**: Complete audit trail from capture to blockchain verification
- **Legal Compliance**: Generates verification certificates suitable for legal proceedings

## System Architecture

### Components

1. **Chrome Extension** (Evidence Capture)
   - Captures web pages and generates PDFs
   - Computes SHA-256 hashes for integrity verification
   - Uploads evidence to API backend

2. **API Backend** (Node.js/Express)
   - Receives evidence uploads from Chrome extension
   - Stores evidence metadata in PostgreSQL database
   - Integrates with Constellation Digital Evidence API
   - Provides status tracking and verification endpoints

3. **Frontend Dashboard** (Next.js/React)
   - Web interface for viewing captured evidence
   - Real-time verification status display
   - Links to blockchain explorer for evidence verification

4. **Database** (PostgreSQL)
   - Stores evidence metadata, hashes, and status
   - Tracks blockchain submission results
   - Maintains audit trail

5. **Blockchain Integration** (Constellation Digital Evidence API)
   - Submits cryptographic fingerprints to blockchain
   - Provides tamper-proof evidence verification
   - Generates legal verification certificates

## Evidence Capture and Verification Flow

### 1. Evidence Capture (Chrome Extension)
```
User visits webpage → Chrome Extension activated → Page converted to PDF →
SHA-256 hash computed → Evidence uploaded to API
```

### 2. Backend Processing (API)
```
Evidence received → Stored in database → Digital Evidence fingerprint created →
ECDSA signature generated → Submitted to Constellation blockchain
```

### 3. Blockchain Verification
```
Fingerprint submitted → Blockchain processing → Status: PENDING_COMMITMENT →
Final confirmation → Status: FINALIZED_COMMITMENT
```

### 4. Verification Display (Frontend)
```
Evidence listed in dashboard → Real-time status checking →
Blockchain explorer links → Verification certificates
```

## Technical Implementation

### Cryptographic Standards

- **Document Hashing**: SHA-256 for content integrity
- **Fingerprint Hashing**: SHA-256 of canonicalized JSON (RFC 8785)
- **Digital Signatures**: ECDSA secp256k1 with DER encoding
- **Hash Chain**: SHA-256 → UTF-8 → SHA-512 → Truncate to 32 bytes → Sign

### API Endpoints

#### Evidence Upload
```
POST /api/upload-pdf
Content-Type: multipart/form-data
```

#### Status Check
```
GET /api/evidence/:eventId/status
Response: { status, explorerUrl, isFinalized }
```

#### Evidence List
```
GET /api/evidence
Response: Array of evidence records with metadata
```

### Database Schema

```sql
-- Evidence records table
evidence_records (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE,
  filename VARCHAR(255),
  document_hash VARCHAR(64),
  fingerprint_hash VARCHAR(64),
  company VARCHAR(255),
  submitted_at TIMESTAMP,
  digital_evidence_status VARCHAR(50),
  explorer_url TEXT
)
```

### Digital Evidence Integration

The system integrates with Constellation Network's Digital Evidence API using the following structure:

```javascript
{
  attestation: {
    content: {
      orgId: "organization_id",
      tenantId: "tenant_id",
      eventId: "unique_event_id",
      signerId: "public_key_hex",
      documentId: "filename",
      documentRef: "document_sha256_hash",
      timestamp: "ISO_8601_timestamp",
      version: 1
    },
    proofs: [{
      id: "public_key_hex",
      signature: "der_encoded_signature",
      algorithm: "SECP256K1_RFC8785_V1"
    }]
  },
  metadata: {
    hash: "fingerprint_content_hash",
    organizationName: "ProofVault",
    tags: { company, filename, etc }
  }
}
```

## Deployment Architecture

### Development Environment
- **API Server**: http://localhost:4000
- **Frontend Dashboard**: http://localhost:4002
- **Database**: PostgreSQL on localhost:5432

### Production Requirements
- Node.js 18+
- PostgreSQL 12+
- SSL certificates for HTTPS
- Environment variables for API keys

### Environment Configuration

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/proofvault

# Digital Evidence API
DE_API_KEY=your_constellation_api_key
DE_ORGANIZATION_ID=your_org_id
DE_TENANT_ID=your_tenant_id

# Server Configuration
PORT=4000
FRONTEND_URL=http://localhost:4002
```

## Usage Instructions

### Chrome Extension Setup
1. Load unpacked extension in Chrome Developer Mode
2. Navigate to any webpage
3. Click ProofVault extension icon
4. Review captured content and submit

### Dashboard Access
1. Open http://localhost:4002
2. View all captured evidence
3. Click "View" for detailed verification status
4. Access blockchain explorer links

### API Integration
```javascript
// Upload evidence
const formData = new FormData();
formData.append('pdf', pdfBlob);
formData.append('metadata', JSON.stringify({
  company: 'Company Name',
  eventId: 'unique_id',
  filename: 'document.pdf'
}));

fetch('/api/upload-pdf', {
  method: 'POST',
  body: formData
});
```

## Security Features

### Data Integrity
- SHA-256 hashing prevents content tampering
- Cryptographic signatures ensure authenticity
- Blockchain immutability provides permanent records

### Access Control
- API key authentication for Digital Evidence API
- Environment variable protection for sensitive data
- HTTPS encryption for data transmission

### Audit Trail
- Complete timestamp tracking
- Event ID correlation across systems
- Blockchain transaction records

## Verification and Legal Use

### Verification Process
1. Document hash verifies content hasn't changed
2. Fingerprint hash verifies blockchain record authenticity
3. Digital signature proves authorized submission
4. Timestamp establishes when evidence was captured

### Legal Certificates
- Blockchain explorer provides verification certificates
- Immutable proof suitable for legal proceedings
- Chain of custody documentation
- Cryptographic integrity guarantees

## Monitoring and Status

### Evidence Status Lifecycle
- **NEW**: Just uploaded, not yet processed
- **QUEUED**: Waiting for blockchain submission
- **PROCESSING**: Being submitted to blockchain
- **PENDING_COMMITMENT**: Awaiting blockchain confirmation
- **FINALIZED_COMMITMENT**: Verified and immutable on blockchain
- **ERRORED_COMMITMENT**: Submission failed

### Real-time Monitoring
- Frontend dashboard shows live status updates
- API provides programmatic status checking
- Blockchain explorer links for independent verification

## Troubleshooting

### Common Issues

1. **Hash Mismatch Errors**
   - Ensure fingerprint content hash is used in metadata.hash
   - Verify JSON canonicalization (RFC 8785)

2. **Organization Name Display**
   - Include organizationName field in metadata
   - Add organization tags for explorer display

3. **Status Check Failures**
   - Verify API credentials are configured
   - Check network connectivity to Digital Evidence API
   - Ensure correct response parsing (result.data.status)

### Debug Information
- All API calls include detailed console logging
- Database queries logged in development mode
- Blockchain submission payloads logged for debugging

## System Benefits

### For Legal Teams
- Tamper-proof evidence collection
- Blockchain verification certificates
- Automated chain of custody
- Compliance with digital evidence standards

### For Developers
- RESTful API for integration
- Real-time status updates
- Comprehensive error handling
- Detailed logging and monitoring

### For Organizations
- Scalable evidence management
- Reduced manual processes
- Enhanced legal defensibility
- Integration with existing workflows

---

**ProofVault** - Securing digital evidence with blockchain integrity since 2024.