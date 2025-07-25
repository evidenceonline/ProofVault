# ProofVault Backend API

Node.js/Express backend API for the ProofVault blockchain-powered digital notary system. This service handles PDF evidence registration, verification, and database operations while integrating with the Constellation Network metagraph.

## Features

- **PDF Processing**: Upload, validate, and hash PDF documents
- **Blockchain Integration**: Register evidence on Constellation Network metagraph
- **Verification**: Verify document hashes against blockchain records  
- **Database Operations**: PostgreSQL integration for evidence tracking
- **Real-time Updates**: WebSocket support for live status updates
- **Background Jobs**: Automated transaction monitoring and cleanup
- **API Documentation**: RESTful endpoints with comprehensive validation

## Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 13+
- Running Constellation Network metagraph (via Euclid framework)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Configure environment variables (see Configuration section)
nano .env

# Run database migrations (from parent database directory)
cd ../database && npm run migrate

# Start development server
npm run dev
```

The API will start on `http://localhost:3001` by default.

## Configuration

Copy `.env.example` to `.env` and configure the following variables:

### Essential Configuration

```bash
# Server
NODE_ENV=development
PORT=3001

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proofvault_dev
DB_USER=proofvault
DB_PASSWORD=proofvault_password

# Metagraph (Constellation Network)
METAGRAPH_BASE_URL=http://localhost:9000
METAGRAPH_L0_URL=http://localhost:9000
DATA_L1_URL=http://localhost:9400

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

See `.env.example` for all available configuration options.

## API Endpoints

### PDF Operations

- `POST /api/pdf/register` - Register PDF evidence on blockchain
- `GET /api/pdf/verify/:hash` - Verify PDF hash against blockchain
- `POST /api/pdf/validate` - Upload PDF for hash validation
- `GET /api/pdf/history/:address` - Get submission history for address

### Document Management

- `GET /api/documents/browse` - Browse documents with filters
- `GET /api/documents/search/:hash` - Search documents by hash
- `GET /api/documents/export` - Export documents (JSON/CSV)
- `GET /api/documents/stats` - Get document statistics

### Network & System

- `GET /api/network/info` - Get blockchain network information
- `GET /api/evidence/:id` - Get specific evidence record
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with dependencies

## Development

### Available Scripts

```bash
npm run dev          # Start development server with auto-reload
npm run start        # Start production server
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues
```

### Project Structure

```
src/
├── server.js              # Main server entry point
├── routes/                # API route handlers
│   ├── pdf.js            # PDF operations
│   ├── documents.js      # Document management
│   ├── health.js         # Health checks
│   └── ...
├── services/             # Business logic services
│   ├── metagraph.js      # Blockchain integration
│   ├── database.js       # Database operations
│   ├── pdf.js           # PDF processing
│   └── ...
├── middleware/           # Express middleware
│   ├── auth.js          # Authentication
│   ├── validation.js    # Request validation
│   └── errorHandler.js  # Error handling
├── utils/               # Utility functions
│   └── logger.js        # Logging configuration
└── scripts/            # Utility scripts
    └── health-check.js  # Standalone health check
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/services/pdf.test.js

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Database Integration

The API integrates with the PostgreSQL database configured in the `../database/` directory:

```bash
# Run migrations
cd ../database && npm run migrate

# Seed test data
cd ../database && npm run seed

# Check database status
npm run monitor:db
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database credentials
3. Set strong JWT secrets
4. Configure proper CORS origins
5. Enable HTTPS proxy settings

### Process Management

```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start src/server.js --name proofvault-api

# Or using Docker
docker build -t proofvault-backend .
docker run -p 3001:3001 proofvault-backend
```

### Health Monitoring

```bash
# Standalone health check
node src/scripts/health-check.js

# Health check with JSON output
OUTPUT_JSON=true node src/scripts/health-check.js

# Health endpoints for load balancers
curl http://localhost:3001/health/liveness   # Kubernetes liveness
curl http://localhost:3001/health/readiness  # Kubernetes readiness
```

## Architecture

### Services Architecture

- **Metagraph Service**: Handles blockchain interactions with Constellation Network
- **Database Service**: PostgreSQL operations with connection pooling
- **PDF Service**: File processing, validation, and storage
- **WebSocket Service**: Real-time updates to clients
- **Background Jobs**: Automated tasks and monitoring

### Security Features

- Request rate limiting
- Input validation and sanitization
- CORS configuration for browser/extension integration
- JWT-based authentication (optional)
- SQL injection prevention
- File upload security

### Error Handling

- Comprehensive error logging
- Standardized error responses
- Graceful degradation for external service failures
- Request tracking with unique IDs

## Integration

### Chrome Extension

The API is designed to work with the ProofVault Chrome extension:

```javascript
// Extension integration example
const response = await fetch('http://localhost:3001/api/pdf/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Extension-Version': chrome.runtime.getManifest().version
  },
  body: JSON.stringify({
    hash: pdfHash,
    metadata: captureMetadata,
    signature: digitalSignature,
    pdfData: base64PdfData
  })
});
```

### Frontend Integration

Works with the React frontend via the configured API client:

```javascript
import { apiClient } from '@/services/apiClient';

// Register PDF
const result = await apiClient.registerPDF({
  hash,
  metadata,
  signature,
  pdfData
});

// Verify hash
const verification = await apiClient.verifyPDF(hash);
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify database credentials in `.env`
   - Ensure database exists and migrations are run

2. **Metagraph Connection Failed**
   - Verify Constellation Network nodes are running
   - Check metagraph URLs in `.env`
   - Run health check: `curl http://localhost:9000/cluster/info`

3. **File Upload Issues**
   - Check file size limits in `.env`
   - Verify upload directory permissions
   - Monitor disk space usage

### Debug Mode

Enable detailed logging:

```bash
DEBUG=proofvault:* npm run dev
LOG_LEVEL=debug npm run dev
```

### Performance Monitoring

Monitor API performance:

```bash
# Enable metrics collection
ENABLE_METRICS=true npm start

# Check system stats
curl http://localhost:3001/api/stats/system

# Monitor background jobs
curl http://localhost:3001/health/detailed
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass: `npm test`
5. Check linting: `npm run lint`

## License

MIT License - see LICENSE file for details.