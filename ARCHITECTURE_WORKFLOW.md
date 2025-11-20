# ProofVault Complete Workflow - Visual Architecture Guide

> **Complete visual walkthrough of ProofVault's evidence capture, blockchain verification, and legal access process**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Phase 1: Evidence Capture](#phase-1-evidence-capture)
3. [Phase 2: Backend Processing](#phase-2-backend-processing)
4. [Phase 3: Blockchain Submission](#phase-3-blockchain-submission)
5. [Phase 4: Verification & Storage](#phase-4-verification--storage)
6. [Phase 5: Legal Team Access](#phase-5-legal-team-access)
7. [Technical Reference](#technical-reference)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROOFVAULT END-TO-END WORKFLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   📱 USER DEVICE    │    │  🖥️  PROOFVAULT     │    │  ⛓️  BLOCKCHAIN      │
│   Chrome Extension  │    │    API SERVER       │    │  Digital Evidence   │
│                     │    │    + Database       │    │  Constellation Net  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Component Architecture

- **Chrome Extension**: Captures web content as PDFs using Chrome's print API
- **Backend API (Node.js/Express)**: Receives uploads, computes SHA-256 hashes, manages database
- **PostgreSQL Database**: Stores PDF binaries, hashes, metadata, and blockchain status
- **Digital Evidence API**: Constellation Network's managed blockchain integration service
- **Constellation Network**: Decentralized blockchain providing immutable evidence records

---

## Phase 1: Evidence Capture

```
┌──────────┴──────────┐
│  PHASE 1: CAPTURE   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 🌐 User browses to  │
│ evidence website    │
│ (e.g., contract,    │
│  social media post, │
│  terms of service)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 🎯 Click ProofVault │
│ browser extension   │
│ ▸ Fill company name │
│ ▸ Add case/matter # │
│ ▸ Enter username    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 📷 Capture Evidence │
│ ▸ Chrome print API  │
│ ▸ Full page render  │
│ ▸ Metadata collect  │
│ ▸ URL + timestamp   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 📄 Generate PDF     │
│ ▸ Web page content  │
│ ▸ Legal headers     │
│ ▸ Company/matter ID │
│ ▸ Capture timestamp │
└──────────┬──────────┘
           │
           │ 📤 Upload raw PDF
           │    (NO client-side hashing)
           ▼
```

**Key Security Feature:** Extension uploads raw PDF only. Backend computes hash server-side to prevent client-side tampering.

---

## Phase 2: Backend Processing

```
┌──────────┴──────────┐    ┌─────────────────────┐
│  PHASE 2: UPLOAD    │    │  🔍 VALIDATION      │
└──────────┬──────────┘    │  ▸ File type check  │
           │               │    (PDF only)       │
           │               │  ▸ Size limits      │
           │               │    (10MB max)       │
           │               │  ▸ Required fields  │
           │               │    (company, ID)    │
           │               └─────────────────────┘
           ▼                           │
┌─────────────────────┐               │
│ 🧮 Hash Calculation │◄──────────────┘
│ SHA256(PDF_content) │
│ Backend server-side │
│ Result:             │
│ a1b2c3d4e5f6...     │
│ (64 hex chars)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 💾 Database Storage │
│ PostgreSQL          │
│ ┌─────────────────┐ │
│ │ evidence_records│ │
│ │ ├─ id (UUID)    │ │
│ │ ├─ event_id     │ │
│ │ ├─ filename     │ │
│ │ ├─ company      │ │
│ │ ├─ pdf_data     │ │ ← Binary storage (BYTEA)
│ │ ├─ document_hash│ │ ← SHA-256 of PDF
│ │ ├─ fingerprint_ │ │ ← Digital Evidence hash
│ │ │   hash        │ │
│ │ ├─ submitted_at │ │
│ │ ├─ digital_ev_  │ │ ← PENDING initially
│ │ │   status      │ │
│ │ └─ explorer_url │ │
│ └─────────────────┘ │
└──────────┬──────────┘
           │
           │ ⛓️ Submit to blockchain
           │
           ▼
```

**Endpoints Used:**
- `POST /api/upload-pdf` - Receives multipart/form-data with PDF + metadata

---

## Phase 3: Blockchain Submission

```
┌──────────┴──────────┐    ┌─────────────────────┐
│ PHASE 3: BLOCKCHAIN │    │  📋 Fingerprint     │
│     SUBMISSION      │    │  Structure          │
└──────────┬──────────┘    │  {                  │
           │               │   attestation: {    │
           │               │     content: {...}  │
           │               │     proofs: [...]   │
           │               │   },                │
           │               │   metadata: {       │
           │               │     hash: "a1b2..", │
           │               │     tags: {...}     │
           │               │   }                 │
           │               │  }                  │
           │               └─────────────────────┘
           ▼                           │
┌─────────────────────┐               │
│ 📡 HTTPS POST       │◄──────────────┘
│ Digital Evidence API│
│                     │
│ digitalevidence.    │
│ constellationnetwork│
│ .io/api/v1/         │
│ fingerprints        │
└──────────┬──────────┘
           │
           │
           │                ┌─────────────────────┐
           └───────────────►│  Constellation      │
                            │  Network Blockchain │
                            │  ┌───────────────┐  │
                            │  │ Cryptographic │  │
                            │  │ Verification  │  │
                            │  │               │  │
                            │  │ ▸ ECDSA sigs  │  │
                            │  │   (secp256k1) │  │
                            │  │ ▸ Merkle tree │  │
                            │  │   structure   │  │
                            │  │ ▸ Immutable   │  │
                            │  │   timestamp   │  │
                            │  └───────────────┘  │
                            │                     │
                            │  Status:            │
                            │  PENDING_COMMITMENT │
                            └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │ ✅ 201 Created      │
                            │ Fingerprint         │
                            │ Submitted           │
                            │ {                   │
                            │   "hash": "a1b2..." │
                            │   "status":         │
                            │   "PENDING"         │
                            │ }                   │
                            └──────────┬──────────┘
                                       │
           ┌────────────────────────────┘
           │
           ▼
```

**Key Details:**
- Digital Evidence API handles blockchain complexity
- ECDSA signatures (secp256k1) for cryptographic proof
- Merkle tree structure for verification chain
- Fail-safe: Upload succeeds even if blockchain submission fails

---

## Phase 4: Verification & Storage

```
┌──────────┴──────────┐    ┌─────────────────────┐
│ PHASE 4: BLOCKCHAIN │    │  🔄 STATUS          │
│    VERIFICATION     │    │    LIFECYCLE        │
└──────────┬──────────┘    │                     │
           │               │  NEW                │
           │               │   ↓                 │
           │               │  PENDING_COMMITMENT │
           │               │   ↓                 │
           │               │  FINALIZED_         │
           │               │  COMMITMENT         │
           │               │                     │
           │               │  (or ERROR)         │
           │               └─────────────────────┘
           ▼                           │
┌─────────────────────┐               │
│ 🔍 Query Status     │◄──────────────┘
│ GET /fingerprint/   │
│ {hash}              │
│                     │
│ Digital Evidence    │
│ Explorer provides:  │
│                     │
│ ✓ Blockchain        │
│   confirmation      │
│ ✓ Timestamp proof   │
│ ✓ Verification cert │
│ ✓ Public explorer   │
│   URL               │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ✅ Status Confirmed │
│ FINALIZED_COMMITMENT│
│                     │
│ Evidence is now     │
│ IMMUTABLY recorded  │
│ on blockchain       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 📝 Update Database  │
│ ┌─────────────────┐ │
│ │ UPDATE          │ │
│ │ evidence_records│ │
│ │ SET             │ │
│ │ digital_evidence│ │
│ │  _status =      │ │
│ │  'FINALIZED_    │ │
│ │   COMMITMENT'   │ │
│ │ fingerprint_hash│ │
│ │  = 'a1b2c3...'  │ │
│ │ explorer_url =  │ │
│ │  'https://...'  │ │
│ │ verified_at =   │ │
│ │  NOW()          │ │
│ └─────────────────┘ │
└──────────┬──────────┘
           │
           │ 📱 Return success to client
           │
           ▼
┌──────────┴──────────┐    ┌─────────────────────┐
│   PHASE 5: USER     │    │  📬 SUCCESS         │
│    RESPONSE         │    │  NOTIFICATION       │
└──────────┬──────────┘    │                     │
           │               │  "Evidence          │
           │               │   successfully      │
           │               │   captured and      │
           │               │   blockchain        │
           │               │   verified!"        │
           │               │                     │
           │               │  Event ID:          │
           │               │  uuid-12345         │
           │               │                     │
           │               │  Explorer Link:     │
           │               │  [View on Blockchain]│
           │               └─────────────────────┘
           ▼                           │
┌─────────────────────┐               │
│ 🎉 Extension Shows  │◄──────────────┘
│ Success Message     │
│                     │
│ Evidence ID:        │
│ uuid-12345          │
│                     │
│ Status: ✅ Verified │
│                     │
│ [Open in Dashboard] │
└─────────────────────┘
```

---

## Phase 5: Legal Team Access

```
══════════════════════════════════════════════════════════════════════════════

┌──────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  PHASE 6: LEGAL      │    │   🏛️ DASHBOARD      │    │  ⚖️ COURT READY    │
│   TEAM ACCESS        │    │     INTERFACE       │    │    EVIDENCE         │
└──────────┬───────────┘    └─────────────────────┘    └─────────────────────┘
           │                           │                           │
           │                           │                           │
           ▼                           ▼                           │
┌─────────────────────┐    ┌─────────────────────┐              │
│ 👩‍💼 Attorney Access  │    │ 📋 Evidence List    │              │
│ ProofVault Dashboard│    │                     │              │
│ http://localhost:   │    │ Search & Filter:    │              │
│ 4002 (dev)          │    │ • By company        │              │
│                     │    │ • By date range     │              │
└──────────┬──────────┘    │ • By status         │              │
           │               │ • By matter number  │              │
           │               │                     │              │
           │               │ 📄 Terms violation  │              │
           │               │ 🏢 Acme Corp        │              │
           │               │ 📁 CASE-2025-001    │              │
           │               │ ✅ Blockchain ✓     │              │
           │               │ 📅 2025-01-20       │              │
           │               │ 🔗 Hash: a1b2c3...  │              │
           │               │ 🌐 Explorer URL     │              │
           │               └──────────┬──────────┘              │
           │                          │                        │
           └──────────────────────────┘                        │
                                      │                        │
                                      ▼                        │
                          ┌─────────────────────┐              │
                          │ 🔍 Evidence Details │              │
                          │ ▸ Download PDF      │              │
                          │ ▸ View metadata     │              │
                          │ ▸ Blockchain proof  │              │
                          │ ▸ Verification cert │              │
                          │ ▸ Chain of custody  │              │
                          └──────────┬──────────┘              │
                                     │                        │
                                     ▼                        │
                          ┌─────────────────────┐              │
                          │ 📊 Verification     │              │
                          │ Report Generated    │              │
                          │                     │              │
                          │ ✅ Document hash    │              │
                          │    matches blockchain│              │
                          │                     │              │
                          │ ✅ Immutable        │              │
                          │    timestamp        │              │
                          │    2025-01-20       │              │
                          │    14:32:15 UTC     │              │
                          │                     │              │
                          │ ✅ Tamper-proof     │              │
                          │    guarantee        │              │
                          │    (cryptographic)  │              │
                          │                     │              │
                          │ ✅ Court admissible │──────────────┘
                          │    under Federal    │
                          │    Rules of Evidence│
                          │    Rule 901/902     │
                          │                     │
                          │ 🔗 Public Explorer: │
                          │ [View Certificate]  │
                          └─────────────────────┘
```

**Dashboard Features:**
- **View Only**: Frontend does not accept uploads (security by design)
- **Search & Filter**: Find evidence by company, date, status, matter number
- **Download**: Retrieve original PDF files
- **Verification**: Check blockchain status and get verification certificates
- **Explorer Links**: Direct links to Constellation Network's public blockchain explorer

---

## Technical Reference

### API Endpoints

**ProofVault Backend API:**
```
POST   /api/upload-pdf              Upload evidence (multipart/form-data)
GET    /api/evidence                List all evidence records
GET    /api/evidence/:eventId       Get specific evidence details
GET    /api/evidence/:eventId/status Check blockchain verification status
GET    /api/pdf/:id                 Download original PDF
GET    /api/health                  Health check endpoint
```

**Digital Evidence API (Constellation Network):**
```
POST   https://digitalevidence.constellationnetwork.io/api/v1/fingerprints
       Submit fingerprint to blockchain

GET    https://digitalevidence.constellationnetwork.io/fingerprint/{hash}
       Public blockchain explorer - verification certificate
```

### Evidence Status Lifecycle

| Status | Description | User Action |
|--------|-------------|-------------|
| `NEW` | Just uploaded to ProofVault | Wait for processing |
| `PENDING_COMMITMENT` | Submitted to blockchain, awaiting confirmation | Monitor status |
| `FINALIZED_COMMITMENT` | Verified and immutable on blockchain | Ready for legal use |
| `ERRORED_COMMITMENT` | Blockchain submission failed | Contact support |

### Security Features

1. **Server-Side Hashing**: Hash computed by backend (line api/middleware/upload.js:65-67)
2. **Binary Storage**: PDFs stored as BYTEA in PostgreSQL
3. **Duplicate Detection**: Hash comparison prevents duplicate evidence
4. **Fail-Safe Submission**: Upload succeeds even if blockchain temporarily unavailable
5. **Cryptographic Signatures**: ECDSA secp256k1 signatures for blockchain proof
6. **Tamper Evidence**: Any PDF modification creates completely different hash

### Legal Compliance

**Federal Rules of Evidence Compliance:**
- **Rule 901(b)(9)**: Authentication via distinctive blockchain characteristics ✅
- **Rule 902**: Self-authenticating records (blockchain timestamps) ✅
- **Rule 1001-1008**: Best Evidence Rule (original digital documents with hash verification) ✅

**Court Admissibility:**
- Cryptographic hash proves document integrity
- Blockchain timestamp proves capture date
- Digital signature provides non-repudiation
- Decentralized verification (no single trusted party)
- Public blockchain explorer for independent verification

### Success Indicators

```
✅ 201 Created     - Evidence uploaded to ProofVault
✅ PDF Stored      - Binary data saved in PostgreSQL
✅ Hash Computed   - SHA-256 calculated server-side
✅ Fingerprint OK  - Digital Evidence API accepted submission
✅ Status Check    - Blockchain verification confirmed
✅ Database Update - Status set to FINALIZED_COMMITMENT
✅ Explorer URL    - Public verification certificate available

🎉 Complete end-to-end integrity guarantee achieved!
```

---

## Quick Links

- **[README.md](README.md)** - Setup instructions and quick start
- **[DOCUMENTATION.md](DOCUMENTATION.md)** - Complete technical documentation
- **[API Reference](DOCUMENTATION.md#7-api-reference)** - Detailed API documentation
- **[Legal Framework](DOCUMENTATION.md#5-legal-framework--court-admissibility)** - Court admissibility details
- **[Digital Evidence Explorer](https://digitalevidence.constellationnetwork.io/)** - Public blockchain verification

---

**Generated:** 2025-01-20
**Architecture Version:** Digital Evidence API Integration (current)
**Status:** ✅ Active - Reflects Production Architecture
