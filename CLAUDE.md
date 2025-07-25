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
- **`metagraph/`** - Custom Constellation Network L0/L1 implementation

### Layer Architecture
The system operates on multiple blockchain layers:
- **Global L0** - Constellation Network main chain
- **Metagraph L0** - Custom application chain  
- **Currency L1** - Token/currency operations
- **Data L1** - Custom data transactions

## Configuration

### Essential Setup
1. **Fill `euclid.json`** with your GitHub token (required for hydra operations)
2. **Replace P12 files** in `source/p12-files/` before production deployment
3. **Configure `infra/ansible/remote/hosts.ansible.yml`** for remote deployments

### Network Configuration
- Default: IntegrationNet for development
- Production: MainNet (requires registered peerIDs on seedlist)
- Configure in `euclid.json` under `deploy.network.name`

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