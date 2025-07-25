# ProofVault API Reference

## Backend API Endpoints

### PDF Registration
```
POST /api/pdf/register
```
Submit PDF for metagraph registration

### PDF Verification  
```
GET /api/pdf/verify/{hash}
```
Verify PDF hash against metagraph

### User History
```
GET /api/pdf/history/{address}
```
Get user's submission history

### PDF Validation
```
POST /api/pdf/validate
```
Upload PDF to check integrity

## Authentication
- Digital signature based authentication
- Constellation Network address system

## Response Formats
All responses return JSON with standard HTTP status codes.

*Complete API documentation coming soon...*