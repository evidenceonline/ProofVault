# ProofVault API

A robust REST API for the ProofVault Chrome extension, designed to handle PDF evidence storage and retrieval with PostgreSQL backend integration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Security](#security)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Testing](#testing)

## Overview

ProofVault API is an Express.js backend service that provides secure PDF storage and management capabilities. It integrates with PostgreSQL for data persistence and includes comprehensive security measures, error handling, and monitoring features.

### Architecture

- **Framework**: Express.js with Node.js
- **Database**: PostgreSQL with connection pooling
- **File Storage**: Binary data stored in database with SHA-256 hash verification
- **Security**: Helmet, CORS, input validation, and file type restrictions
- **Monitoring**: Health checks, detailed logging, and performance metrics

## Features

- PDF file upload with validation (10MB limit, PDF-only)
- Duplicate file detection using SHA-256 hashing
- RESTful CRUD operations for PDF records
- Pagination and filtering for PDF listings
- Comprehensive error handling and logging
- Health monitoring endpoints
- CORS configured for Chrome extensions
- Graceful shutdown handling
- Database connection pooling and optimization

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository and navigate to the API directory:
```bash
cd proofvault/api
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Create PostgreSQL database:
```sql
CREATE DATABASE proofvault;
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Authentication
JWT_SECRET=your_jwt_secret
# Comma-separated list in the format role:api_key
API_KEYS=admin:super-secret-key,viewer:readonly-key
DEFAULT_API_KEY_ROLE=service

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proofvault
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### Database Schema

The application automatically creates the required tables on startup:

```sql
CREATE TABLE pdf_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  pdf_filename VARCHAR(255) NOT NULL,
  pdf_hash VARCHAR(64) NOT NULL UNIQUE,
  pdf_data BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Base URL
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

### Authentication

All PDF routes require one of the supported authentication methods:

- **JWT Bearer tokens** – include an `Authorization: Bearer <token>` header. Tokens are validated with `JWT_SECRET` and should provide either a `role` claim (string) or `roles` array.
- **API keys** – include an `X-API-Key: <key>` header. Configure keys in the `API_KEYS` environment variable using the `role:key` format. Keys without a role use `DEFAULT_API_KEY_ROLE`.

Unauthenticated requests receive `401 Unauthorized`. Delete actions additionally require the `admin` or `manager` role and return `403 Forbidden` if the caller lacks the proper permissions.

### Rate Limiting

- **Global**: 300 requests per 15 minutes per IP across the API.
- **Uploads**: 30 upload requests per 15 minutes per IP (`POST /api/pdf/upload`).
- **Deletes**: 10 delete requests per hour per IP (`DELETE /api/pdf/:id`).

When a rate limit is exceeded, the API responds with `429 Too Many Requests` and includes standard rate limit headers.

### Health Endpoints

#### GET /api/health
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "service": "ProofVault API",
  "version": "1.0.0",
  "environment": "development",
  "checks": {
    "database": "healthy",
    "memory": "healthy"
  }
}
```

#### GET /api/health/detailed
Detailed health information with system metrics.

#### GET /api/health/ready
Readiness probe for Kubernetes/Docker deployments.

#### GET /api/health/live
Liveness probe for monitoring systems.

### PDF Endpoints

#### POST /api/pdf/upload
Upload a PDF file with metadata.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `pdf` (file, required): PDF file (max 10MB)
- `company_name` (string, required): Company name
- `username` (string, required): Username

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/pdf/upload \
  -F "pdf=@document.pdf" \
  -F "company_name=Acme Corp" \
  -F "username=john.doe"
```

**Response (201 Created):**
```json
{
  "status": "success",
  "message": "PDF uploaded successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "company_name": "Acme Corp",
    "username": "john.doe",
    "pdf_filename": "document.pdf",
    "pdf_hash": "a7b8c9d0e1f2...",
    "created_at": "2024-01-15T10:30:00.000Z",
    "file_size": 2048576
  }
}
```

#### GET /api/pdf/list
Retrieve a paginated list of PDF records.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `company_name` (string, optional): Filter by company name (partial match)
- `username` (string, optional): Filter by username (partial match)
- `sort_by` (string, optional): Sort field (created_at, company_name, username, pdf_filename)
- `sort_order` (string, optional): Sort direction (ASC, DESC, default: DESC)

**Example Request:**
```bash
curl "http://localhost:3000/api/pdf/list?page=1&limit=10&company_name=Acme&sort_by=created_at&sort_order=DESC"
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "records": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "company_name": "Acme Corp",
        "username": "john.doe",
        "pdf_filename": "document.pdf",
        "pdf_hash": "a7b8c9d0e1f2...",
        "file_size": 2048576,
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 10,
      "total_count": 25,
      "total_pages": 3,
      "has_next_page": true,
      "has_prev_page": false
    },
    "filters": {
      "company_name": "Acme",
      "username": null
    },
    "sorting": {
      "sort_by": "created_at",
      "sort_order": "DESC"
    }
  }
}
```

#### GET /api/pdf/:id
Retrieve PDF metadata or download the file.

**Path Parameters:**
- `id` (UUID, required): PDF record ID

**Query Parameters:**
- `download` (boolean, optional): If true, downloads the PDF file (default: false)

**Example Request (Metadata):**
```bash
curl http://localhost:3000/api/pdf/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "company_name": "Acme Corp",
    "username": "john.doe",
    "pdf_filename": "document.pdf",
    "pdf_hash": "a7b8c9d0e1f2...",
    "file_size": 2048576,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "download_url": "/api/pdf/550e8400-e29b-41d4-a716-446655440000?download=true"
  }
}
```

**Example Request (Download):**
```bash
curl -O -J http://localhost:3000/api/pdf/550e8400-e29b-41d4-a716-446655440000?download=true
```

#### DELETE /api/pdf/:id
Delete a PDF record.

> **Required role:** `admin` or `manager`

**Path Parameters:**
- `id` (UUID, required): PDF record ID

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/api/pdf/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "PDF deleted successfully",
  "data": {
    "deleted_record": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "pdf_filename": "document.pdf",
      "company_name": "Acme Corp",
      "username": "john.doe"
    }
  }
}
```

#### GET /api/pdf/stats
Retrieve PDF storage statistics.

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "overview": {
      "total_pdfs": 150,
      "unique_companies": 25,
      "unique_users": 45,
      "total_storage_bytes": 157286400,
      "total_storage_mb": 150.0,
      "avg_file_size_bytes": 1048576,
      "avg_file_size_mb": 1.0,
      "oldest_record": "2024-01-01T00:00:00.000Z",
      "newest_record": "2024-01-15T10:30:00.000Z"
    },
    "top_companies": [
      {"company_name": "Acme Corp", "pdf_count": 25},
      {"company_name": "Tech Inc", "pdf_count": 20}
    ],
    "top_users": [
      {"username": "john.doe", "pdf_count": 15},
      {"username": "jane.smith", "pdf_count": 12}
    ],
    "monthly_stats": [
      {"month": "2024-01-01T00:00:00.000Z", "pdf_count": 45},
      {"month": "2023-12-01T00:00:00.000Z", "pdf_count": 38}
    ]
  }
}
```

## Error Handling

The API uses standardized error responses with appropriate HTTP status codes.

### Error Response Format

```json
{
  "status": "error",
  "message": "Error description",
  "errorId": "abc123def456",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid input data or malformed request
- `401 Unauthorized`: Authentication required (future implementation)
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource (e.g., same PDF hash)
- `413 Payload Too Large`: File size exceeds 10MB limit
- `422 Unprocessable Entity`: Invalid file type (non-PDF)
- `500 Internal Server Error`: Server-side error

### Example Error Responses

**File too large:**
```json
{
  "status": "error",
  "message": "File size exceeds the maximum limit of 10MB",
  "errorId": "req_abc123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Invalid file type:**
```json
{
  "status": "error",
  "message": "Invalid file type. Only PDF files are allowed.",
  "errorId": "req_def456",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Security

### Security Features

- **Helmet**: Security headers (CSP, HSTS, etc.)
- **CORS**: Configured for Chrome extensions and specific domains
- **Input Validation**: Strict validation for all inputs
- **File Type Validation**: Multiple layers of PDF validation
- **SQL Injection Protection**: Parameterized queries
- **File Size Limits**: 10MB maximum file size
- **Hash Verification**: SHA-256 file integrity checking

### CORS Configuration

The API is configured to accept requests from:
- Chrome extensions (`chrome-extension://`)
- Localhost (development)
- Configured production domains
- Mobile applications (no origin)

### File Upload Security

- File type validation (extension and MIME type)
- File signature validation (PDF magic bytes)
- Size limits (10MB maximum)
- Filename sanitization
- Hash-based duplicate detection

## Development

### Running the Server

**Development mode with auto-reload:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### Development Tools

The API includes several development-friendly features:

- Detailed error responses in development mode
- Request ID tracking for debugging
- Comprehensive logging with Morgan
- Database connection testing on startup
- Graceful shutdown handling

### Project Structure

```
api/
├── config/
│   └── database.js          # PostgreSQL configuration
├── controllers/
│   └── pdfController.js     # PDF CRUD operations
├── middleware/
│   ├── errorHandler.js      # Error handling middleware
│   └── upload.js            # File upload middleware
├── routes/
│   ├── health.js            # Health check routes
│   └── pdf.js               # PDF API routes
├── package.json             # Dependencies and scripts
├── server.js                # Main application entry point
├── .env.example             # Environment variables template
└── README.md                # This documentation
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database credentials
3. Set up reverse proxy (nginx recommended)
4. Configure SSL/TLS certificates
5. Set up monitoring and logging

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

Use the health endpoints for monitoring:
- `/api/health/live` - Liveness probe
- `/api/health/ready` - Readiness probe
- `/api/health/detailed` - Comprehensive health info

### Performance Considerations

- Database connection pooling (max 20 connections)
- Request size limits (15MB including overhead)
- Memory usage monitoring
- Graceful shutdown handling
- Request ID tracking for debugging

## Testing

### Manual Testing

Test the API endpoints using curl or Postman:

```bash
# Health check
curl http://localhost:3000/api/health

# Upload PDF
curl -X POST http://localhost:3000/api/pdf/upload \
  -F "pdf=@test.pdf" \
  -F "company_name=Test Corp" \
  -F "username=testuser"

# List PDFs
curl http://localhost:3000/api/pdf/list
```

### Integration Testing

The API is designed to work with:
- ProofVault Chrome Extension
- PostgreSQL database
- File upload clients
- Monitoring systems

### Testing Database

Use the test utilities in the `/test` directory to verify database connectivity and operations.

## Support

For issues and questions:
1. Check the health endpoints for system status
2. Review application logs for detailed error information
3. Verify database connectivity and permissions
4. Ensure environment variables are properly configured

## License

MIT License - see LICENSE file for details.