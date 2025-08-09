# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProofVault is a comprehensive legal evidence management system built as a multi-package monorepo. The system captures web evidence via Chrome extension, stores it with blockchain verification, and provides professional dashboards for legal teams.

## Architecture

This is a **multi-service monorepo** with four distinct applications:

- **`chrome-extension/`** - Manifest V3 Chrome extension for professional evidence capture
- **`api/`** - Express.js REST API with PostgreSQL and blockchain integration  
- **`frontend/`** - Next.js dashboard for evidence management and review
- **`business-site/`** - Next.js marketing website with live blockchain demos

## Development Commands

### Global Setup
```bash
# Install dependencies for all packages
npm install  # Root level has minimal deps (canvas, pdfkit, axios, form-data)
cd api && npm install
cd frontend && npm install  
cd business-site && npm install
```

### API Development (Port 3003)
```bash
cd api
npm start          # Production server
npm run dev        # Development with nodemon
npm test          # Jest test suite
```

### Frontend Development (Port 3002)
```bash
cd frontend  
npm run dev       # Next.js dev server
npm run build     # Production build
npm start         # Production server
npm run lint      # ESLint
```

### Business Site Development (Port 3005)
```bash
cd business-site
npm run dev       # Next.js dev with Turbopack
npm run build     # Production build  
npm start         # Production server
npm run lint      # ESLint
npm run type-check # TypeScript validation
```

### Chrome Extension Development
```bash
cd chrome-extension
# Load extension in Chrome developer mode
# No build process - uses vanilla JS with ES6 modules
```

### Process Management (Production)
```bash
pm2 start ecosystem.config.js  # Start all services
pm2 logs                       # View logs
pm2 status                     # Check service status
```

## Database Architecture

### PostgreSQL Schema
- **`pdf_records`** - Core evidence storage with BYTEA PDF data
- **Blockchain columns** - `blockchain_hash`, `blockchain_status`, `verification_data`
- **Connection pooling** - Max 20 connections with health monitoring
- **Migrations** - Located in `api/migrations/`

### Database Operations
```bash
# Connect to database
PGPASSWORD=phoenixserg psql -h localhost -U proofvaultuser -d proofvaultdb

# Run migrations
cd api && node -e "require('./config/database').query('-- migration SQL')"

# Check recent records
PGPASSWORD=phoenixserg psql -h localhost -U proofvaultuser -d proofvaultdb -c "SELECT id, company_name, LENGTH(pdf_data) as pdf_size_bytes FROM pdf_records ORDER BY created_at DESC LIMIT 3;"
```

## API Architecture

### Express.js Structure
- **`routes/`** - RESTful endpoints (`pdf.js`, `health.js`)
- **`controllers/`** - Business logic (`pdfController.js`)
- **`middleware/`** - Error handling, file upload, CORS
- **`config/`** - Database connection and configuration

### Key API Endpoints
- `POST /api/pdf/upload` - Evidence upload with blockchain verification
- `GET /api/pdf/:id` - Retrieve evidence by ID
- `GET /api/health` - Service health check

### Error Handling Pattern
- Request ID tracking for debugging
- Comprehensive validation with specific error messages
- Blockchain verification error recovery

## Blockchain Integration

### HGTP/Constellation Network
- **Metagraph URL** - `https://be-testnet.constellationnetwork.io/data-application`
- **Hash Submission** - Automatic after PDF generation
- **Verification** - Real-time status polling with exponential backoff
- **Error Recovery** - Graceful degradation if blockchain unavailable

### Blockchain Workflow
1. PDF generated → hash calculated
2. Hash submitted to metagraph
3. Transaction ID stored in database
4. Verification status polled and updated
5. UI shows real-time verification status

## Chrome Extension Architecture

### Manifest V3 Features
- **Service Worker** - `background.js` handles extension lifecycle
- **Content Scripts** - `content-capture.js` for page interaction
- **Popup Interface** - Professional UI with company/matter fields
- **Screenshot Capture** - High-quality evidence capture
- **PDF Generation** - Client-side with legal metadata

### Security Implementation
- Content Security Policy compliance
- XSS prevention and input sanitization
- Secure API communication with error boundaries
- Professional validation patterns

## Frontend Architecture

### Next.js Applications
Both `frontend/` and `business-site/` use:
- **TypeScript** - Strict type checking enabled
- **Tailwind CSS** - Utility-first styling
- **Path aliases** - `@/` for clean imports
- **ESLint** - Next.js recommended rules

### State Management Patterns
- React Query for server state caching
- React hooks for local state
- Error boundaries for graceful error handling
- Professional loading states and user feedback

## Legal Compliance Features

### Federal Rules of Evidence
- **Rule 901** - Authentication requirements met via blockchain
- **Court-admissible** - Professional PDF generation with metadata
- **Chain of custody** - Immutable blockchain verification
- **Timestamp accuracy** - Precise capture time recording

### Professional Standards  
- **WCAG 2.1 AA** - Accessibility compliance
- **Security headers** - CSP, HSTS, XSS protection
- **Data validation** - Comprehensive input sanitization
- **Error logging** - Professional debugging capabilities

## Development Patterns

### TypeScript Configuration
- **Strict mode enabled** - All packages use strict TypeScript
- **Path mapping** - Clean import aliases in Next.js apps
- **Type definitions** - Comprehensive interfaces for blockchain, PDF, and API data

### Error Handling
- **Request tracking** - Unique IDs for debugging
- **Graceful degradation** - System works even if blockchain unavailable
- **User-friendly messages** - Professional error presentation
- **Comprehensive logging** - Detailed error information for debugging

### Testing Strategy
- **API tests** - Jest for business logic and database operations
- **Integration tests** - Full workflow testing including blockchain
- **Manual testing** - Chrome extension requires browser-based testing

## Key Configuration Files

- **`ecosystem.config.js`** - PM2 process management
- **`api/config/database.js`** - PostgreSQL connection with pooling
- **`tsconfig.json`** - TypeScript configuration (frontend/business-site)
- **`chrome-extension/manifest.json`** - Extension permissions and CSP