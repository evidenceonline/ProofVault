# ProofVault E2E Test Suite

Comprehensive end-to-end testing framework for the ProofVault blockchain-powered digital notary system.

## Overview

This test suite provides complete coverage of the ProofVault system workflow from Chrome extension PDF capture through blockchain registration to frontend verification. It includes:

- **End-to-End Integration Testing**: Complete workflow validation
- **Component Integration Testing**: Inter-component communication testing
- **API Testing**: Comprehensive backend API validation
- **Performance Testing**: Load and scalability testing
- **Error Handling Testing**: Edge cases and failure scenarios

## Architecture

```
tests/
├── e2e/                          # Main test suite
│   ├── index.js                  # Test orchestrator
│   ├── suites/                   # Test suite implementations
│   │   ├── e2eTestSuite.js      # End-to-end workflow tests
│   │   ├── componentIntegrationSuite.js  # Component integration tests
│   │   ├── apiTestSuite.js      # API endpoint tests
│   │   ├── performanceTestSuite.js      # Performance and load tests
│   │   └── errorHandlingSuite.js        # Error scenario tests
│   ├── utils/                    # Utility modules
│   │   ├── testEnvironment.js   # Environment management
│   │   ├── testReporter.js      # Report generation
│   │   └── testDataGenerator.js # Test data creation
│   ├── data/                     # Generated test data
│   ├── reports/                  # Test execution reports
│   └── logs/                     # Test execution logs
├── config/                       # Configuration files
│   └── e2e.json                 # Main test configuration
├── scripts/                      # Setup and utility scripts
├── package.json                  # Dependencies and scripts
└── cli.js                       # Command line interface
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- Docker (for metagraph)
- PostgreSQL 13+
- Chrome/Firefox browser

### Installation

```bash
# Install dependencies
cd tests/
npm install

# Setup test environment
npm run setup
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:e2e           # End-to-end tests only
npm run test:api           # API tests only
npm run test:performance   # Performance tests only

# Run with specific browsers
npm run test:chrome        # Chrome only
npm run test:firefox       # Firefox only

# Run in CI mode
npm run test:ci            # Optimized for CI/CD
```

### Using the CLI

```bash
# Install CLI globally
npm install -g

# Run tests with options
./cli.js test --suites=e2e,api --browsers=chrome --headless

# Setup environment
./cli.js setup

# Check system health
./cli.js health

# Generate test reports
./cli.js report --format=html --open

# View available tests
./cli.js list
```

## Test Suites

### 1. End-to-End Integration Tests

Tests the complete ProofVault workflow:

- Chrome extension PDF capture
- Backend API processing
- Scala metagraph registration
- Database storage
- Frontend verification
- WebSocket real-time updates

**Key Tests:**
- Complete PDF Registration Workflow
- Real-time Updates via WebSocket
- Cross-Component Data Consistency
- Blockchain Transaction Confirmation
- Frontend Verification Interface
- Multi-Document Batch Processing

### 2. Component Integration Tests

Tests integration between system components:

- Chrome Extension ↔ Backend API
- Backend API ↔ Scala Metagraph
- Backend API ↔ PostgreSQL Database
- Backend API ↔ React Frontend
- WebSocket Communication

**Key Tests:**
- Extension to API Integration
- API to Metagraph Integration
- API to Database Integration
- API to Frontend Integration
- WebSocket Real-time Updates
- Cross-Component Authentication
- Error Propagation
- Data Flow Consistency

### 3. API Testing

Comprehensive backend API validation:

- All endpoint functionality
- Authentication and authorization
- Request/response validation
- Error handling
- Rate limiting
- Security measures

**Test Categories:**
- System endpoints (health, version, info)
- Authentication endpoints (login, register, validate)
- PDF management endpoints
- Document management endpoints
- Evidence and verification endpoints
- Network and blockchain endpoints
- Statistics and analytics endpoints
- Security and error handling

### 4. Performance Testing

Load and scalability testing:

- Concurrent PDF registrations
- Database performance under load
- API response time benchmarking
- WebSocket connection scaling
- Memory usage monitoring
- Blockchain transaction throughput

**Performance Metrics:**
- Response time (p95, p99)
- Throughput (requests/second)
- Error rates
- Memory usage
- CPU utilization
- Connection handling

### 5. Error Handling Testing

Edge cases and failure scenarios:

- Invalid PDF submissions
- Network failure recovery
- Database connection errors
- Blockchain communication failures
- Frontend error states
- Resource exhaustion scenarios

**Error Scenarios:**
- Malformed requests
- Authentication failures
- File system errors
- Timeout handling
- Concurrent error scenarios
- WebSocket error recovery

## Configuration

### Main Configuration (`config/e2e.json`)

```json
{
  "urls": {
    "apiBaseUrl": "http://localhost:3001",
    "frontendUrl": "http://localhost:3000",
    "metagraphUrl": "http://localhost:9000"
  },
  "timeouts": {
    "default": 300000,
    "api": 30000,
    "blockchain": 120000
  },
  "browsers": {
    "chrome": { "enabled": true, "headless": false },
    "firefox": { "enabled": false, "headless": false }
  },
  "testing": {
    "parallel": false,
    "maxWorkers": 4,
    "screenshotOnFailure": true
  }
}
```

### Environment Variables

```bash
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proofvault_test
DB_USER=postgres
DB_PASSWORD=password

# API configuration
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
METAGRAPH_URL=http://localhost:9000

# Test configuration
TEST_TIMEOUT=300000
TEST_RETRIES=3
HEADLESS_MODE=false
```

## Test Data

The test suite automatically generates:

- **PDF Files**: Valid, invalid, corrupted, oversized PDFs
- **Test Documents**: Legal contracts, financial statements, academic papers
- **User Accounts**: Test users with different roles and permissions
- **Blockchain Data**: Test transactions, blocks, and network state
- **Metadata Examples**: Various document metadata formats

## Reporting

### Report Formats

- **HTML**: Human-readable reports with charts and graphs
- **JSON**: Machine-readable data for analysis
- **JUnit XML**: CI/CD integration format
- **Coverage**: Code coverage reports

### Report Contents

- Test execution summary
- Individual test results
- Performance metrics
- Error details and stack traces
- Screenshots on failure
- System resource usage
- Configuration details

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd tests && npm ci
      
      - name: Setup test environment
        run: cd tests && npm run setup
      
      - name: Run E2E tests
        run: cd tests && npm run test:ci
      
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: tests/e2e/reports/
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('Setup') {
            steps {
                sh 'cd tests && npm ci'
                sh 'cd tests && npm run setup'
            }
        }
        stage('Test') {
            steps {
                sh 'cd tests && npm run test:ci'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'tests/e2e/reports',
                        reportFiles: 'test-report.html',
                        reportName: 'E2E Test Report'
                    ])
                }
            }
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check service health
   ./cli.js health
   
   # Restart services
   npm run cleanup && npm run setup
   ```

2. **Database connection errors**
   ```bash
   # Check database status
   pg_isready -h localhost -p 5432
   
   # Reset test database
   npm run setup -- --force
   ```

3. **Browser automation issues**
   ```bash
   # Install browser dependencies
   sudo apt-get install -y chromium-browser firefox
   
   # Run in headless mode
   npm test -- --headless
   ```

4. **Network connectivity issues**
   ```bash
   # Check service endpoints
   curl http://localhost:3001/api/health
   curl http://localhost:3000
   curl http://localhost:9000/cluster/info
   ```

### Debug Mode

```bash
# Run with debug logging
DEBUG=* npm test

# Generate detailed reports
npm test -- --verbose

# Keep test data for inspection
npm run cleanup -- --keep-data
```

## Performance Benchmarks

### Expected Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p95) | < 2000ms | 95th percentile |
| API Response Time (p99) | < 5000ms | 99th percentile |
| Throughput | > 100 req/s | Sustained load |
| Error Rate | < 1% | Under normal load |
| Memory Usage | < 512MB | Backend process |
| WebSocket Connections | > 1000 | Concurrent connections |

### Load Testing Scenarios

1. **Baseline Load**: 10 concurrent users
2. **Normal Load**: 50 concurrent users
3. **Peak Load**: 100 concurrent users
4. **Stress Test**: 500+ concurrent users

## Security Testing

### Security Test Categories

- Input validation and sanitization
- SQL injection protection
- XSS prevention
- CSRF protection
- Authentication bypass attempts
- Authorization testing
- Rate limiting validation
- File upload security

## Contributing

### Adding New Tests

1. Create test file in appropriate suite directory
2. Follow existing test patterns and naming conventions
3. Include proper error handling and cleanup
4. Add test documentation
5. Update configuration if needed

### Test Guidelines

- Tests should be independent and idempotent
- Use descriptive test names and comments
- Include both positive and negative test cases
- Handle async operations properly
- Clean up test data after execution
- Follow the AAA pattern (Arrange, Act, Assert)

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: https://github.com/evidenceonline/ProofVault/issues
- Documentation: https://proofvault.com/docs
- Email: support@proofvault.com