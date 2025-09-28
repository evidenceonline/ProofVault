#!/bin/bash

# Test script for ProofVault blockchain integration

echo "ProofVault Blockchain Integration Test Script"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1${NC}"
        exit 1
    fi
}

# Step 1: Apply database migration
echo -e "\n${YELLOW}Step 1: Applying database migration...${NC}"
cd /home/nodeadmin/proofvault/api
psql -d $DATABASE_URL -f migrations/add_blockchain_columns.sql
check_status "Database migration applied"

# Step 2: Build the metagraph
echo -e "\n${YELLOW}Step 2: Building metagraph...${NC}"
cd /home/nodeadmin/todo/euclid-development-environment
./scripts/hydra build
check_status "Metagraph built successfully"

# Step 3: Start the metagraph
echo -e "\n${YELLOW}Step 3: Starting metagraph cluster...${NC}"
./scripts/hydra start
check_status "Metagraph started"

echo -e "\n${GREEN}Metagraph is running!${NC}"
echo "Global L0: http://localhost:9000"
echo "Metagraph L1 Data: http://localhost:9400"
echo ""
echo "Next steps:"
echo "1. In a new terminal, start ProofVault API: cd /home/nodeadmin/proofvault/api && npm run dev"
echo "2. Test PDF upload through Chrome extension or API"
echo "3. Check blockchain submission in API logs"
echo "4. Test verification endpoint"
echo ""
echo "To stop the metagraph: ./scripts/hydra stop"