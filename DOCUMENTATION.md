# ProofVault Digital Evidence System - Complete Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [Technical Implementation](#3-technical-implementation)
4. [Production Deployment Guide](#4-production-deployment-guide)
5. [Legal Framework & Court Admissibility](#5-legal-framework--court-admissibility)
6. [Blockchain Integration](#6-blockchain-integration)
7. [API Reference](#7-api-reference)
8. [Usage Instructions](#8-usage-instructions)
9. [Security Features](#9-security-features)
10. [Troubleshooting](#10-troubleshooting)
11. [Implementation for Legal Professionals](#11-implementation-for-legal-professionals)

---

## 1. System Overview

### What ProofVault Solves

ProofVault is a comprehensive digital evidence capture, verification, and blockchain attestation system designed for legal and compliance use cases. The system provides tamper-proof evidence collection with cryptographic integrity guarantees through integration with Constellation Network's Digital Evidence API.

**Core Problems Addressed:**
- **Legal Evidence Integrity**: Provides cryptographic proof that digital evidence hasn't been tampered with
- **Blockchain Attestation**: Creates immutable records on Constellation Network's blockchain
- **Automated Evidence Capture**: Chrome extension for seamless web page and document capture
- **Chain of Custody**: Complete audit trail from capture to blockchain verification
- **Legal Compliance**: Generates verification certificates suitable for legal proceedings

**Use Cases:**
- **Litigation**: Website evidence, document authentication, timeline establishment
- **Compliance**: Regulatory documentation, policy records
- **Intellectual Property**: Prior art documentation, copyright evidence
- **Corporate Legal**: Contract management, HR documentation, board resolutions

### Key Benefits

**For Legal Teams:**
- Tamper-proof evidence collection
- Blockchain verification certificates
- Automated chain of custody
- Compliance with digital evidence standards

**For Developers:**
- RESTful API for integration
- Real-time status updates
- Comprehensive error handling
- Detailed logging and monitoring

**For Organizations:**
- Scalable evidence management
- Reduced manual processes
- Enhanced legal defensibility
- Integration with existing workflows

---

## 2. System Architecture

### Components Overview

```mermaid
graph TB
    subgraph "Client Layer"
        CE[Chrome Extension]
        FE[Frontend Dashboard]
    end

    subgraph "Backend Services"
        API[Backend API<br/>:4000]
        DB[(PostgreSQL<br/>Database)]
    end

    subgraph "Blockchain Layer"
        DE[Digital Evidence API<br/>Constellation Network]
    end

    %% Upload Flow
    CE -->|1. Upload PDF raw file| API
    API -->|2. Compute SHA-256 Hash| API
    API -->|3. Store PDF + Hash| DB
    API -->|4. Submit Fingerprint| DE
    DE -->|5. Return Status| API
    API -->|6. Update Record| DB
    API -->|7. Return Success| CE

    %% Verification Flow
    FE -->|A. Request Evidence| API
    API -->|B. Get Records| DB
    API -->|C. Return Data| FE
```

### Core Components

1. **Chrome Extension** (Evidence Capture)
   - Captures web pages and generates PDFs locally using Chrome's print API
   - Uploads raw PDF files to API backend (no client-side hashing)
   - Provides user interface for evidence metadata input

2. **API Backend** (Node.js/Express)
   - Receives evidence uploads from Chrome extension
   - Computes SHA-256 hash of PDF content (server-side for security)
   - Stores PDF binary data, hash, and metadata in PostgreSQL database
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

### Environment Configuration

#### Development Environment
- **API Server**: http://localhost:4000
- **Frontend Dashboard**: http://localhost:4002
- **Database**: PostgreSQL on localhost:5433 (Docker) or localhost:5432 (native install)

#### Production Environment
- **API Server**: https://proofvault.net:4000
- **Frontend Dashboard**: https://proofvault.net:4002
- **Database**: Production PostgreSQL instance

---

## 3. Technical Implementation

### Evidence Capture and Verification Flow

#### 1. Evidence Capture (Chrome Extension)
```
User visits webpage → Chrome Extension activated → Page converted to PDF →
Evidence uploaded to API (raw PDF file, no pre-hashing)
```

#### 2. Backend Processing (API)
```
Evidence received → SHA-256 hash computed (server-side) → PDF + hash stored in database →
Digital Evidence fingerprint created → ECDSA signature generated → Submitted to Constellation blockchain
```

#### 3. Blockchain Verification
```
Fingerprint submitted → Blockchain processing → Status: PENDING_COMMITMENT →
Final confirmation → Status: FINALIZED_COMMITMENT
```

#### 4. Verification Display (Frontend)
```
Evidence listed in dashboard → Real-time status checking →
Blockchain explorer links → Verification certificates
```

### Cryptographic Standards

- **Document Hashing**: SHA-256 for content integrity
- **Fingerprint Hashing**: SHA-256 of canonicalized JSON (RFC 8785)
- **Digital Signatures**: ECDSA secp256k1 with DER encoding
- **Hash Chain**: SHA-256 → UTF-8 → SHA-512 → Truncate to 32 bytes → Sign

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

### Digital Evidence Integration Structure

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

---

## 4. Production Deployment Guide

### Overview

ProofVault can be deployed to production using either Docker (recommended) or native installation. This guide covers the essential requirements and configuration for production deployment.

### Deployment Options

#### Option 1: Docker Production Deployment (Recommended)

```bash
# 1. Clone repository and checkout feature branch
git clone https://github.com/evidenceonline/ProofVault.git
cd ProofVault
git checkout feature/automated-setup-and-improvements

# 2. Configure production environment
cp .env.docker.example .env.docker
# Edit .env.docker with production credentials

# 3. Deploy with production compose file
docker compose -f docker-compose.yml up -d
```

#### Option 2: Native Production Deployment

Follow the native installation steps from the README, then configure the production environment variables as described below.

### Production Configuration Requirements

#### 1. Required Files

**API Backend Files**:
```
api/
├── controllers/pdfController.js     # Updated with Digital Evidence integration
├── utils/digital-evidence-client.js # Digital Evidence API client
├── package.json                     # Updated dependencies (uuid, secp256k1, etc.)
├── .env                            # Environment variables (see below)
└── ... (all other API files)
```

#### 2. Environment Variables

**Production `.env` file must include**:
```bash
# Existing ProofVault variables
NODE_ENV=production
PORT=4000
DB_HOST=your_production_db
DB_PORT=5432
DB_NAME=your_production_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# NEW: Digital Evidence API credentials
DE_API_KEY=your_digital_evidence_api_key
DE_ORGANIZATION_ID=your_organization_id
DE_TENANT_ID=your_tenant_id
```

**How to get Digital Evidence credentials**:
1. Register at [Constellation Digital Evidence](https://digitalevidence.constellationnetwork.io/)
2. Create organization and tenant
3. Generate API key
4. Use the same credentials currently in the development `.env` or request new production ones

#### 3. Dependencies

**New Node.js packages required** (already in package.json):
```json
{
  "uuid": "^10.0.0",
  "secp256k1": "^5.0.0",
  "js-sha256": "^0.11.0",
  "js-sha512": "^0.9.0"
}
```

Run `npm install` after deployment to install new dependencies.

#### 4. Chrome Extension Configuration

**Current Status**: Chrome extension has development/production switch

**For Production**:
- Set `DEVELOPMENT = false` in `chrome-extension/config.js`
- Extension will call your production API URL (e.g., `https://your-domain.com/api`)
- Extension will redirect to your production frontend URL

**For Development/Testing**:
- Set `DEVELOPMENT = true` in `config.js`
- Extension will call `localhost:4000`
- Extension will redirect to `localhost:4002` for web app

#### 5. Verification Steps

After production deployment:

1. **Test Health Endpoint**:
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Test Extension Upload**:
   - Install Chrome extension with `DEVELOPMENT = false`
   - Configure extension to point to your production API
   - Capture evidence on any webpage
   - Verify fingerprint is generated (check `blockchain_tx_id` in response)

3. **Verify Digital Evidence Explorer**:
   - Check that fingerprints appear at: `https://digitalevidence.constellationnetwork.io/fingerprint/{hash}`

### Testing Checklist

#### Pre-Deployment Testing
- [x] Local API generates Digital Evidence fingerprints
- [x] Chrome extension simulation test passes
- [x] API returns `blockchain_tx_id` in upload response
- [x] Digital Evidence API accepts fingerprints without errors
- [x] Extension has proper development/production configuration

#### Post-Deployment Testing
- [ ] Production API health check responds
- [ ] Chrome extension connects to production API
- [ ] Upload generates Digital Evidence fingerprint
- [ ] Fingerprint accessible in Digital Evidence explorer
- [ ] "Open in Web App" redirects to correct URL

---

## 5. Legal Framework & Court Admissibility

### Understanding Digital Fingerprints (Hashes)

#### What is a Hash?
Think of a hash like a **unique DNA signature** for digital content:

```
Document: "Contract between ABC Corp and XYZ Ltd..."
Hash:     "a1b2c3d4e5f6..." (64 characters)
```

#### Key Properties (Legal Perspective)
1. **Deterministic**: Same document = Same hash (always)
2. **Unique**: Different documents = Different hashes
3. **Tamper-Evident**: Change even 1 letter → Completely different hash
4. **One-Way**: Cannot reverse-engineer document from hash

#### Legal Analogy
- **Fingerprint** → Identifies a person uniquely
- **Hash** → Identifies a document uniquely
- **Change fingerprint** → Different person
- **Change hash** → Different document

### Understanding Blockchain (Legal Context)

#### What is Blockchain?
Think of blockchain as a **digital ledger** that:
- **Cannot be erased or modified** (immutable)
- **Is witnessed by thousands** (decentralized)
- **Creates permanent records** (timestamped)

#### Legal Analogy: Notarized Public Record
```
Traditional Notary:
- Witness signs document
- Recorded in public records
- Date and time stamped
- Cannot be altered after signing

Blockchain:
- Network "witnesses" digital signature
- Recorded on public blockchain
- Cryptographically timestamped
- Cannot be altered after confirmation
```

#### Why Blockchain for Legal Evidence?
1. **Immutability**: Records cannot be changed or deleted
2. **Transparency**: Anyone can verify the record exists
3. **Decentralization**: No single point of failure or control
4. **Timestamping**: Proves when evidence was created
5. **Cryptographic Proof**: Mathematical certainty of authenticity

### Federal Rules of Evidence Compliance

**Rule 901 - Authentication**
✅ ProofVault provides cryptographic authentication of digital evidence

**Rule 902 - Self-Authentication**
✅ Blockchain records are self-authenticating public records

**Rule 1001-1008 - Best Evidence Rule**
✅ Original digital documents with hash verification satisfy original document requirements

**Rule 403 - Prejudicial Evidence**
✅ Clear, objective technical process without prejudicial effect

### Evidence Foundation Requirements

1. **Authenticity**: Cryptographic hash proves document hasn't been altered
2. **Accuracy**: Exact digital reproduction of original webpage/document
3. **Trustworthiness**: Blockchain provides independent verification
4. **Chain of Custody**: Complete audit trail with timestamps
5. **Reliability**: Mathematical certainty through cryptographic proof

### Legal Use Cases

#### For Litigation
- **Website Evidence**: Prove what a webpage displayed on specific date
- **Document Authentication**: Verify contracts, emails, reports haven't been altered
- **Timeline Establishment**: Cryptographic proof of when evidence was created
- **Chain of Custody**: Automated audit trail from capture to court

#### For Compliance
- **Regulatory Documentation**: Tamper-proof compliance records
- **Policy Documentation**: Prove policies were in effect on specific dates
- **Communication Records**: Authenticate business communications
- **Financial Records**: Verify transaction documents and reports

#### For Intellectual Property
- **Prior Art Documentation**: Prove public disclosure dates
- **Trade Secret Protection**: Timestamped proof of invention dates
- **Copyright Evidence**: Establish creation and publication dates
- **Patent Prosecution**: Document invention timeline

### Technical Verification Process (For Court)

#### Evidence Presentation
1. **Present Original Document**: Submit captured PDF/evidence
2. **Calculate Current Hash**: Compute hash of presented document
3. **Blockchain Verification**: Show matching hash on blockchain
4. **Timestamp Verification**: Prove when evidence was captured
5. **Chain of Custody**: Display complete audit trail

#### Expert Testimony Points
- Hash comparison demonstrates document integrity
- Blockchain timestamp proves capture date
- Cryptographic signature confirms authenticity
- Network consensus validates record permanence

---

## 6. Blockchain Integration

### Current Architecture

The system integrates with Constellation Network's Digital Evidence API using a direct submission approach rather than the previous metagraph middleware architecture.

### Integration Components

#### Data Flow
1. ProofVault generates PDF with legal evidence
2. PDF hash calculated and stored in PostgreSQL
3. Hash submitted to Digital Evidence API for blockchain verification
4. Digital Evidence API stores hash immutably on distributed ledger
5. Verification status updated in ProofVault database
6. Users can verify evidence integrity via blockchain lookup

### Evidence Status Lifecycle

- **NEW**: Just uploaded, not yet processed
- **QUEUED**: Waiting for blockchain submission
- **PROCESSING**: Being submitted to blockchain
- **PENDING_COMMITMENT**: Awaiting blockchain confirmation
- **FINALIZED_COMMITMENT**: Verified and immutable on blockchain
- **ERRORED_COMMITMENT**: Submission failed

### Blockchain Verification Benefits

1. **Immutability**: Records cannot be changed or deleted
2. **Transparency**: Anyone can verify the record exists
3. **Decentralization**: No single point of failure or control
4. **Timestamping**: Proves when evidence was created
5. **Cryptographic Proof**: Mathematical certainty of authenticity

---

## 7. API Reference

### Evidence Upload
```http
POST /api/upload-pdf
Content-Type: multipart/form-data
```

**Request Body:**
```javascript
FormData:
  pdf: File (PDF blob)
  metadata: JSON string {
    company: 'Company Name',
    eventId: 'unique_id',
    filename: 'document.pdf'
  }
```

**Response:**
```json
{
  "success": true,
  "recordId": "uuid",
  "blockchain_tx_id": "fingerprint_hash",
  "status": "submitted"
}
```

### Status Check
```http
GET /api/evidence/:eventId/status
```

**Response:**
```json
{
  "status": "FINALIZED_COMMITMENT",
  "explorerUrl": "https://digitalevidence.constellationnetwork.io/fingerprint/{hash}",
  "isFinalized": true
}
```

### Evidence List
```http
GET /api/evidence
```

**Response:**
```json
[
  {
    "id": "uuid",
    "event_id": "unique_event_id",
    "filename": "document.pdf",
    "company": "Company Name",
    "submitted_at": "2024-01-01T12:00:00Z",
    "digital_evidence_status": "FINALIZED_COMMITMENT",
    "explorer_url": "https://digitalevidence.constellationnetwork.io/fingerprint/{hash}"
  }
]
```

### API Integration Example

```javascript
// Upload evidence
const formData = new FormData();
formData.append('pdf', pdfBlob);
formData.append('metadata', JSON.stringify({
  company: 'Company Name',
  eventId: 'unique_id',
  filename: 'document.pdf'
}));

const response = await fetch('/api/upload-pdf', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Blockchain TX ID:', result.blockchain_tx_id);
```

---

## 8. Usage Instructions

### Chrome Extension Setup
1. Load unpacked extension in Chrome Developer Mode
2. Navigate to any webpage
3. Click ProofVault extension icon
4. Review captured content and submit

### Dashboard Access
1. Open http://localhost:4002 (development) or https://proofvault.net:4002 (production)
2. View all captured evidence
3. Click "View" for detailed verification status
4. Access blockchain explorer links

### Real-time Monitoring
- Frontend dashboard shows live status updates
- API provides programmatic status checking
- Blockchain explorer links for independent verification

---

## 9. Security Features

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

### Data Protection
- **No Document Storage**: Only fingerprints stored on blockchain
- **Client Confidentiality**: Documents never leave your control
- **GDPR Compliant**: Pseudonymous hashes protect privacy
- **Attorney-Client Privilege**: Evidence capture doesn't breach privilege

---

## 10. Troubleshooting

### Common Issues

#### 1. Hash Mismatch Errors
- Ensure fingerprint content hash is used in metadata.hash
- Verify JSON canonicalization (RFC 8785)

#### 2. Organization Name Display
- Include organizationName field in metadata
- Add organization tags for explorer display

#### 3. Status Check Failures
- Verify API credentials are configured
- Check network connectivity to Digital Evidence API
- Ensure correct response parsing (result.data.status)

#### 4. Chrome Extension Issues
- **No fingerprint generated**: Check Digital Evidence API credentials in production `.env`
- **Extension can't connect**: Verify API server is accessible and running updated code
- **Fingerprint too long error**: Ensure latest code with filename truncation is deployed

### Debug Information
- All API calls include detailed console logging
- Database queries logged in development mode
- Blockchain submission payloads logged for debugging

### Success Indicators
✅ API logs show: `✅ Digital Evidence submission successful`
✅ API logs show: `🆔 Fingerprint Hash: {64-character-hash}`
✅ Chrome extension shows fingerprint in response
✅ Explorer URL accessible: `https://digitalevidence.constellationnetwork.io/fingerprint/{hash}`

### Diagnostic Commands

```bash
# Test API health
curl http://localhost:4000/api/health

# Test evidence upload
curl -X POST http://localhost:4000/api/upload-pdf \
  -F "pdf=@test.pdf" \
  -F "metadata={\"company\":\"TestCorp\",\"eventId\":\"test-123\",\"filename\":\"test.pdf\"}"

# Check database records
PGPASSWORD=your_password psql -h localhost -U your_user -d your_database \
  -c "SELECT event_id, filename, digital_evidence_status FROM evidence_records ORDER BY submitted_at DESC LIMIT 5;"
```

---

## 11. Implementation for Legal Professionals

### Getting Started
1. **Install Chrome Extension** - One-click evidence capture
2. **Access Dashboard** - View all captured evidence
3. **Generate Reports** - Export verification certificates
4. **Court Presentation** - Direct links to blockchain verification

### Cost-Benefit Analysis
- **Reduced Discovery Time**: Automated evidence collection
- **Increased Admissibility**: Cryptographic authentication
- **Lower Risk**: Tamper-proof evidence handling
- **Client Confidence**: Demonstrable evidence integrity

### Training Requirements
- **15-minute orientation** for basic usage
- **1-hour session** for advanced features
- **Expert witness preparation** available for complex cases

### Questions and Concerns

#### "Is this technology legally accepted?"
**Answer**: Yes. Blockchain evidence has been accepted in federal courts since 2018. Hash verification is standard in digital forensics and widely accepted.

#### "What if the blockchain company disappears?"
**Answer**: The blockchain is decentralized - no single company controls it. Records remain permanently accessible even if ProofVault ceased operations.

#### "How do I explain this to a judge/jury?"
**Answer**: Simple analogy: "Like a tamper-evident seal, but mathematically impossible to fake." We provide expert witness support.

#### "What about admissibility challenges?"
**Answer**: Built to exceed Federal Rules of Evidence requirements. Includes comprehensive foundation documentation and expert testimony support.

### Competitive Advantages

#### vs. Traditional Methods
| Method | Tampering Risk | Court Acceptance | Time to Implement | Cost |
|--------|---------------|------------------|-------------------|------|
| Screenshots | High | Questionable | Immediate | Free |
| Notarization | Medium | Good | Days/Weeks | High |
| **ProofVault** | **None** | **Excellent** | **Minutes** | **Low** |

#### vs. Other Digital Solutions
- **Superior Cryptography**: Military-grade hash algorithms
- **True Immutability**: Blockchain vs. centralized databases
- **Legal Focus**: Built specifically for court admissibility
- **User Friendly**: No technical knowledge required

---

## Legal Compliance Notes

This system is designed to meet Federal Rules of Evidence requirements:
- **Rule 901(b)(9)** - Authentication via distinctive blockchain characteristics
- **Immutable Evidence** - Blockchain provides tamper-proof storage
- **Chain of Custody** - Complete audit trail from capture to court
- **Timestamp Accuracy** - Precise time recording for legal proceedings

The blockchain verification ensures that any tampering with evidence after initial capture will be immediately detectable, providing the legal certainty required for court admissibility.

---

**ProofVault Digital Evidence System** - Securing digital evidence with blockchain integrity.

*"In the digital age, proving authenticity is just as important as proving truth."*