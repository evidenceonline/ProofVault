# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProofVault is a legal evidence management system with three main components:
- **Chrome Extension**: Captures screenshots and generates PDF evidence reports
- **Backend API**: Express.js REST API with PostgreSQL for secure PDF storage
- **Frontend Dashboard**: Next.js web application for evidence management

## Common Development Commands

### Backend API (in `/api` directory)
```bash
npm run dev    # Start development server with nodemon (watches for changes)
npm start      # Start production server
npm test       # Run Jest tests
```

### Frontend Dashboard (in `/frontend` directory)
```bash
npm run dev    # Start Next.js development server
npm run build  # Create production build
npm start      # Start production server
npm run lint   # Run ESLint checks
```

### Chrome Extension
No build process required - load unpacked extension from `/chrome-extension` directory in Chrome's developer mode.

## Architecture Overview

### Backend API Architecture
- **Entry Point**: `api/server.js`
- **Database**: PostgreSQL with connection pooling via `pg` library
- **File Storage**: PDFs stored as BYTEA in `pdf_records` table
- **Security**: Helmet for headers, CORS configured, file validation middleware
- **Error Handling**: Centralized error middleware with proper status codes
- **Routes**: All PDF operations under `/api/pdf/*` endpoints

### Chrome Extension Architecture
- **Manifest V3**: Modern service worker-based architecture
- **Background Script**: `background.js` handles all API communication
- **Content Scripts**: Injected for screenshot capture
- **PDF Generation**: Uses jsPDF library with custom formatting
- **Security**: CSP configured, validates all inputs before API calls

### Frontend Architecture
- **Framework**: Next.js 14 with App Router
- **State Management**: React Query for server state
- **Styling**: Tailwind CSS with responsive design
- **API Integration**: Configured for `http://proofvault.net:3001`
- **TypeScript**: Strict type checking enabled

## Database Schema

The main table `pdf_records` includes:
- `id` (UUID primary key)
- `filename` (varchar 255)
- `company_name` (varchar 255)
- `pdf_data` (bytea - actual PDF content)
- `upload_date` (timestamp)
- `file_size` (integer)
- `mime_type` (varchar 100)
- `sha256_hash` (varchar 64)

## Key Integration Points

1. **Chrome Extension → API**: 
   - Uses multipart/form-data for PDF uploads
   - API endpoint: `POST /api/pdf/upload`
   - Returns PDF ID for "View Online" functionality

2. **Frontend → API**:
   - All API calls go through `/api/pdf/*` endpoints
   - Supports filtering by company name and date range
   - Binary PDF download via `/api/pdf/download/:id`

3. **Security Considerations**:
   - File size limit: 10MB
   - Only PDF files accepted
   - SHA-256 hash verification
   - CORS configured for specific origins

## Testing Approach

- API tests use Jest with PostgreSQL test database
- Test utilities available in `/test` directory
- Frontend uses Next.js built-in testing capabilities
- Chrome extension can be tested via developer tools

## Development Tips

1. **Database Connection**: Ensure PostgreSQL is running and `.env` file has correct `DATABASE_URL`
2. **Chrome Extension Development**: Use "Reload" button in chrome://extensions after changes
3. **API Development**: Nodemon auto-restarts on file changes in dev mode
4. **Frontend Development**: Next.js fast refresh enabled for instant updates
5. **Cross-Origin Issues**: API CORS is configured for localhost:3000 (frontend) and chrome-extension:// origins