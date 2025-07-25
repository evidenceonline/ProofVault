# ProofVault Deployment Guide

## Prerequisites
- Docker and Docker Compose
- PostgreSQL 13+
- Node.js 18+
- Constellation Network access

## Local Development
1. Clone repository
2. Install dependencies: `npm run install:all`
3. Set up database: `npm run setup:db`
4. Start services: `npm run dev`

## Production Deployment

### Database Setup
```bash
# PostgreSQL configuration
createdb proofvault_prod
psql proofvault_prod < database/schema.sql
```

### Metagraph Deployment
```bash
cd metagraph
# Configure for production network
sbt assembly
# Deploy using existing Euclid infrastructure
```

### Backend API
```bash
cd backend-api
npm run build
npm start
```

### Frontend
```bash
cd frontend  
npm run build
# Deploy to web server or CDN
```

## Environment Variables
- `DATABASE_URL`
- `METAGRAPH_ENDPOINT`
- `JWT_SECRET`
- `NODE_ENV`

*Complete deployment instructions coming soon...*