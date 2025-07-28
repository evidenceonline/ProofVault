# ProofVault Blockchain Middleware Architecture Flow

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        CE[Chrome Extension]
        FE[Frontend Dashboard]
    end
    
    subgraph "Backend Services"
        API[Backend API<br/>:3001]
        BM[Blockchain Middleware<br/>:3002]
        DB[(PostgreSQL<br/>Database)]
    end
    
    subgraph "Blockchain Layer"
        HGTP[HGTP/Constellation<br/>Network]
    end
    
    %% Upload Flow
    CE -->|1. Upload PDF| API
    API -->|2. Store PDF & Hash| DB
    API -->|3. Submit Hash| BM
    BM -->|4. Write to Blockchain| HGTP
    HGTP -->|5. Return TX ID| BM
    BM -->|6. Return TX ID| API
    API -->|7. Update Record| DB
    API -->|8. Return Success| CE
    
    %% Verification Flow
    FE -->|A. Request Verification| API
    API -->|B. Get TX ID| DB
    API -->|C. Verify on Blockchain| BM
    BM -->|D. Query HGTP| HGTP
    HGTP -->|E. Return Data| BM
    BM -->|F. Return Status| API
    API -->|G. Return Result| FE
```

## Detailed Flow Sequences

### 1. PDF Upload with Blockchain Recording

```mermaid
sequenceDiagram
    participant CE as Chrome Extension
    participant API as Backend API
    participant DB as PostgreSQL
    participant BM as Blockchain Middleware
    participant BC as HGTP Network
    
    CE->>API: POST /api/pdf/upload<br/>(PDF file, metadata)
    API->>API: Generate SHA-256 hash
    API->>DB: Store PDF record<br/>(without blockchain_tx_id)
    DB-->>API: Return record ID
    
    API->>BM: POST /submit-hash<br/>{hash, recordId, metadata}
    BM->>BC: Submit to HGTP
    BC-->>BM: Transaction ID
    BM-->>API: {txId, status: "submitted"}
    
    API->>DB: Update record<br/>(set blockchain_tx_id)
    API-->>CE: Success response<br/>{recordId, txId}
```

### 2. Blockchain Verification Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as Backend API
    participant DB as PostgreSQL
    participant BM as Blockchain Middleware
    participant BC as HGTP Network
    
    FE->>API: GET /api/pdf/:id/verify
    API->>DB: Get record with TX ID
    DB-->>API: Record data
    
    API->>BM: GET /retrieve/:txId
    BM->>BC: Query transaction
    BC-->>BM: Blockchain data
    BM-->>API: {hash, timestamp, status}
    
    API->>API: Compare hashes
    API-->>FE: Verification result
```

## Component Details

### Backend API (Port 3001)
```
Existing Endpoints:
├── POST /api/pdf/upload
├── GET /api/pdf/list
├── GET /api/pdf/:id
└── DELETE /api/pdf/:id

New Endpoints:
├── GET /api/pdf/:id/blockchain    # Get blockchain status
└── POST /api/pdf/:id/verify       # Trigger verification
```

### Blockchain Middleware (Port 3002)
```
New Service Endpoints:
├── POST /submit-hash              # Submit hash to blockchain
│   Request: { hash, recordId, metadata }
│   Response: { txId, status }
│
├── GET /retrieve/:txId            # Get data from blockchain
│   Response: { hash, timestamp, blockHeight, status }
│
├── GET /verify/:hash              # Check if hash exists
│   Response: { exists, txId, timestamp }
│
└── GET /health                    # Service health check
```

### Database Schema Updates
```sql
-- Add blockchain columns to pdf_records table
ALTER TABLE pdf_records ADD COLUMN blockchain_tx_id VARCHAR(255);
ALTER TABLE pdf_records ADD COLUMN blockchain_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE pdf_records ADD COLUMN blockchain_timestamp TIMESTAMP;
ALTER TABLE pdf_records ADD COLUMN blockchain_metadata JSONB;
```

## Data Flow Examples

### Success Case
```
1. User captures screenshot in Chrome Extension
2. Extension generates PDF with metadata
3. PDF uploaded to Backend API
4. Backend stores PDF, generates hash
5. Backend calls Middleware to submit hash
6. Middleware writes to HGTP blockchain
7. Transaction ID returned and stored
8. User can verify later via Frontend
```

### Async Processing (Alternative)
```
1. Backend stores PDF with status='pending_blockchain'
2. Background job picks up pending records
3. Submits to blockchain via middleware
4. Updates status to 'blockchain_confirmed'
5. Webhook notifies frontend of completion
```

## Benefits of This Architecture

1. **Separation of Concerns**
   - Backend focuses on PDF management
   - Middleware handles all blockchain complexity

2. **Scalability**
   - Can scale blockchain operations independently
   - Queue system prevents overload

3. **Reliability**
   - Retry logic for failed blockchain submissions
   - No data loss if blockchain is temporarily unavailable

4. **Flexibility**
   - Easy to add support for multiple blockchains
   - Can switch blockchain providers without touching main backend

5. **Security**
   - Blockchain credentials isolated in middleware
   - API key authentication between services