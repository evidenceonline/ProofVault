# ProofVault Metagraph Implementation

This is the custom Constellation Network metagraph implementation for ProofVault - a blockchain-powered PDF evidence registry system.

## Overview

The ProofVault metagraph extends the Constellation Network's Tessellation framework to provide:
- **Custom PDF registration transactions**: Register PDF documents with SHA-256 hash validation
- **Hash uniqueness validation**: Prevents duplicate PDF registrations
- **State management**: Maintains a registry of all registered PDFs
- **Query capabilities**: Retrieve PDFs by hash or submitter address

## Architecture

### Modules

1. **shared** - Common data types and structures
   - `PDFTypes.scala` - Core data models (PDFRecord, PDFMetadata, PDFRegistryState)
   - `PDFDataTypes.scala` - Data application types for state management

2. **l0** - Layer 0 consensus and state management
   - Extends `CurrencyL0App` for metagraph consensus
   - Handles state persistence across snapshots

3. **l1** - Layer 1 transaction validation
   - Custom transaction validator for PDF registrations
   - Hash format and uniqueness validation
   - In-memory state tracking of registered hashes

4. **data_l1** - Data application layer (optional)
   - REST API endpoints for querying PDF registry
   - Advanced state management capabilities

## Custom Transaction Validation

The L1 layer implements custom validation logic that:

1. **Identifies PDF registration transactions**:
   - Zero-amount transfers to addresses starting with "DAG8"
   - PDF hash encoded in transaction data

2. **Validates PDF hash**:
   - Must be valid 64-character SHA-256 hex string
   - Must not already exist in the registry

3. **Updates state**:
   - Registers valid PDF hashes with timestamp
   - Maintains thread-safe in-memory registry

## Data Structures

### PDFRecord
```scala
case class PDFRecord(
  hash: String,              // SHA-256 hash of PDF content
  url: String,               // Storage URL or IPFS hash
  title: String,             // Document title
  captureTimestamp: Long,    // When the PDF was captured
  submitterAddress: Address, // Who submitted the PDF
  metadata: PDFMetadata,     // Additional metadata
  registrationId: String     // Unique identifier
)
```

### PDFRegistryState
```scala
case class PDFRegistryState(
  registeredPDFs: Map[String, PDFRecord],
  totalRegistrations: Long,
  lastUpdated: Long
)
```

## Building and Running

### Prerequisites
- Scala 2.13.10
- SBT 1.x
- Docker (for local development)
- Tessellation 2.8.1

### Build Commands
```bash
# Build all modules
sbt compile

# Build L0 JAR
sbt currencyL0/assembly

# Build L1 JAR
sbt currencyL1/assembly

# Build Data L1 JAR (optional)
sbt dataL1/assembly
```

### Running with Hydra
```bash
cd scripts/
./hydra build
./hydra start-genesis
```

## API Endpoints (Data L1)

When running the data application layer:

- `GET /pdf/{hash}` - Retrieve PDF by hash
- `GET /pdfs` - List all registered PDFs
- `GET /pdfs/by-submitter/{address}` - Get PDFs by submitter
- `GET /stats` - Registry statistics

## Integration with ProofVault

This metagraph integrates with the ProofVault application:
- **Chrome Extension**: Captures PDFs and submits registration transactions
- **Backend API**: Interfaces with the metagraph for registration/verification
- **Frontend**: Queries the metagraph for PDF verification

## Security Considerations

- PDF hashes are validated for SHA-256 format
- Duplicate registrations are prevented at consensus level
- State is maintained across all nodes for consistency
- Digital signatures can be added for additional authenticity

## Future Enhancements

1. **Persistent State Storage**: Move from in-memory to persistent storage
2. **IPFS Integration**: Store PDF content on IPFS with hash references
3. **Advanced Querying**: Add more query capabilities and indexing
4. **Batch Registration**: Support multiple PDF registrations in one transaction
5. **Access Control**: Add permission levels for different operations

## Development Notes

- The current implementation uses transaction patterns to identify PDF registrations
- In production, use proper transaction data encoding for PDF metadata
- State synchronization across nodes is handled by the Tessellation framework
- Consider implementing state snapshots for large registries

## Testing

```bash
# Run tests
sbt test

# Test PDF registration transaction
# Create a 0-amount transaction to a DAG8* address with PDF hash in data
```

## Contributing

Follow the Constellation Network development guidelines and ensure all changes maintain compatibility with Tessellation 2.8.1.