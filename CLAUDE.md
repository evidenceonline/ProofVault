# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dual-purpose repository:
1. **Euclid Development Environment** - A Constellation Network metagraph development framework with Docker-based local development and Ansible-based remote deployment
2. **ProofVault** - A blockchain-powered digital notary system built on the Euclid framework

The repository combines both the development framework (Euclid) and a sample application (ProofVault) that demonstrates how to build on Constellation Network.

## Common Development Commands

### Hydra Script (Primary Development Tool)
All development operations use the `./hydra` script from the `scripts/` directory:

```bash
cd scripts/
./hydra build              # Build Docker containers
./hydra start-genesis      # Start from genesis (fresh start)
./hydra start-rollback     # Start from last snapshot (preserve history)  
./hydra stop               # Stop containers
./hydra destroy            # Destroy containers
./hydra status             # Check container status
./hydra logs <container> <layer>  # View logs
```

**Prerequisites**: Install `argc` with `cargo install argc`

### ProofVault Application Commands
The ProofVault components use standard npm commands:

```bash
# Install all dependencies
npm run install:all

# Development (runs backend and frontend concurrently)
npm run dev

# Build all components
npm run build

# Run tests
npm run test

# Lint all code
npm run lint
```

Individual components can be built/tested separately:
- `npm run dev:backend` / `npm run build:backend` / `npm run test:backend`
- `npm run dev:frontend` / `npm run build:frontend` / `npm run test:frontend`  
- `npm run build:extension` / `npm run test:extension`

### Database Operations
```bash
npm run setup:db          # Initial database setup
npm run migrate:db        # Run migrations
npm run seed:db           # Seed with test data
npm run monitor:db        # Monitor database health
npm run backup:db         # Create database backup
```

### Single Test Execution
```bash
# Backend tests
cd backend-api && npm test -- --testNamePattern="specific test"

# Frontend tests  
cd frontend && npm test -- --testNamePattern="specific test"

# Extension tests
cd chrome-extension && npm test -- --testNamePattern="specific test"

# Run specific test file
cd backend-api && npm test tests/services/pdf.test.js
```

## Architecture Overview

### Euclid Framework Structure
- **`scripts/`** - Main hydra development script and operations
- **`infra/`** - Infrastructure configuration
  - `docker/` - Container definitions and configurations
  - `ansible/` - Local and remote deployment playbooks
- **`source/`** - Metagraph source code and configuration files
  - `p12-files/` - Node identity certificates (replace defaults before production)
  - `global-l0/genesis/` and `metagraph-l0/genesis/` - Genesis configuration
- **`euclid.json`** - Primary configuration file (requires GITHUB_TOKEN)

### ProofVault Application Structure  
- **`chrome-extension/`** - Browser extension for PDF capture
- **`backend-api/`** - Node.js API server with metagraph integration
- **`frontend/`** - React verification interface
- **`database/`** - PostgreSQL schemas and setup
- **`source/project/ProofVault/`** - Custom Constellation Network L0/L1/DataL1 implementation

### Layer Architecture
The system operates on multiple blockchain layers:
- **Global L0** - Constellation Network main chain
- **Metagraph L0** - Custom application chain  
- **Currency L1** - Token/currency operations
- **Data L1** - Custom data transactions for PDF evidence

### ProofVault Metagraph Implementation
Located in `source/project/ProofVault/modules/`:

#### Shared Module (`modules/shared/`)
- **PDFTypes.scala** - Core data structures for PDF records, metadata, and registry state
- **TransactionEncoding.scala** - Serialization/deserialization for blockchain transactions
- **PDFDataTypes.scala** - Additional type definitions

#### L0 Module (`modules/l0/`)
- **Main.scala** - Currency L0 entry point
- **modules/** - Custom validators and consensus logic

#### L1 Module (`modules/l1/`)  
- **Main.scala** - Currency L1 entry point

#### Data L1 Module (`modules/data_l1/`)
- **Main.scala** - Data L1 for PDF evidence transactions

### Key Data Structures
```scala
// Core PDF record structure
case class PDFRecord(
  hash: String,              // SHA-256 hash of PDF content
  url: String,               // Storage URL
  title: String,             // Document title
  captureTimestamp: Long,    // Capture timestamp
  submitterAddress: Address, // Submitter address
  metadata: PDFMetadata,     // Additional metadata
  registrationId: String     // Unique identifier
)

// Registry state for managing PDF records
case class PDFRegistryState(
  registeredPDFs: Map[String, PDFRecord],
  totalRegistrations: Long,
  lastUpdated: Long
)
```

## Configuration

### Essential Setup
1. **Fill `euclid.json`** with your GitHub token (required for hydra operations)
2. **Replace P12 files** in `source/p12-files/` before production deployment
3. **Configure `infra/ansible/remote/hosts.ansible.yml`** for remote deployments

### Network Configuration
- Default: IntegrationNet for development
- Production: MainNet (requires registered peerIDs on seedlist)
- Configure in `euclid.json` under `deploy.network.name`

### Tessellation Dependencies
The project uses Tessellation framework version 2.8.1. Key dependencies in `Dependencies.scala`:
- `tessellation-node-shared`
- `tessellation-currency-l0`  
- `tessellation-currency-l1`
- `tessellation-currency-data-application`

**Important**: When updating Tessellation versions, ensure all required modules are published to local Maven repository during Docker build.

## Development Workflow

### Local Development
1. Start in `scripts/` directory
2. Build containers: `./hydra build`
3. Start genesis: `./hydra start-genesis`
4. Check status: `./hydra status`
5. For ProofVault app: `npm run dev` from root

### Remote Deployment
1. Configure hosts in `infra/ansible/remote/hosts.ansible.yml`
2. Deploy: `./hydra remote-deploy`
3. Start: `./hydra remote-start`
4. Monitor: `./hydra remote-status`

### Testing and Verification
- Local node URLs available at `http://localhost:9000-9420` range
- Check cluster info: `http://localhost:9000/cluster/info`
- Grafana monitoring: Enable in `euclid.json`, access at `http://localhost:3000`

### Chrome Extension Development
1. Build extension: `npm run build:extension`
2. Load in Chrome: `chrome://extensions/` → "Load unpacked" → select `chrome-extension/` directory
3. Test with: `npm run test:extension`

## Important Notes

- **Dependency**: Requires Docker (8GB+ RAM), Rust/Cargo, Ansible, jq, yq
- **Node.js**: 18+ required for ProofVault components
- **Database**: PostgreSQL 13+ for ProofVault
- **Security**: Never commit real P12 files or secrets to repository
- **Network**: GL0 node must be running before metagraph deployment
- **Monitoring**: Optional remote monitoring service available via `./hydra install-monitoring-service`

## File Structure Notes

- `package.json` defines workspace structure with separate npm packages
- `scripts/hydra` is the main orchestration tool - all operations flow through it
- Ansible playbooks handle both local Docker operations and remote deployment
- Custom metagraph code should be placed in `source/project/` after installation

## Troubleshooting

### Common Issues
1. **Tessellation dependency errors**: Ensure all required modules are published during Docker build
2. **GitHub token issues**: Set valid token in `euclid.json` 
3. **Port conflicts**: Check that ports 9000-9420 and 3000-3001 are available
4. **Docker memory**: Ensure Docker has at least 8GB RAM allocated

### Build Failures
- If metagraph build fails, check that Tessellation dependencies match between `Dependencies.scala` and `euclid.json`
- Missing `tessellation-currency-data-application` usually indicates incomplete dependency publishing