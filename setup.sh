#!/bin/bash

# ProofVault Automated Setup Script
# This script sets up the entire ProofVault development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Welcome message
clear
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║      ProofVault Setup Script                          ║
║      Blockchain-Powered Digital Evidence              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

print_info "This script will set up your ProofVault development environment"
echo ""

# Step 1: Check Prerequisites
print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js is installed: $NODE_VERSION"

    # Check if version is 18+
    NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. You have: $NODE_VERSION"
        exit 1
    fi
else
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm is installed: v$NPM_VERSION"
else
    print_error "npm is not installed."
    exit 1
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    print_success "PostgreSQL client is installed: $PSQL_VERSION"
else
    print_error "PostgreSQL is not installed. Please install PostgreSQL 13+ first."
    exit 1
fi

# Check if PostgreSQL is running
if pg_isready &> /dev/null; then
    print_success "PostgreSQL server is running"
else
    print_error "PostgreSQL server is not running. Please start it first."
    exit 1
fi

# Check port availability
print_info "Checking if required ports are available..."

if lsof -i :4000 &> /dev/null; then
    print_warning "Port 4000 is already in use. Please free it before continuing."
    lsof -i :4000
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Port 4000 is available"
fi

if lsof -i :4002 &> /dev/null; then
    print_warning "Port 4002 is already in use. Please free it before continuing."
    lsof -i :4002
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Port 4002 is available"
fi

# Step 2: Gather Configuration
print_header "Step 2: Configuration Setup"

# Database configuration
print_info "Database Configuration"
echo ""
read -p "Enter PostgreSQL database name [proofvaultdb_test]: " DB_NAME
DB_NAME=${DB_NAME:-proofvaultdb_test}

read -p "Enter PostgreSQL username [proofvaultuser]: " DB_USER
DB_USER=${DB_USER:-proofvaultuser}

read -sp "Enter PostgreSQL password (or leave empty to generate): " DB_PASSWORD
echo ""
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="ProofVault_$(date +%s | sha256sum | head -c 16)"
    print_info "Generated password: $DB_PASSWORD"
fi

# Digital Evidence API configuration
echo ""
print_info "Digital Evidence API Configuration (Constellation Network)"
print_warning "Leave empty if you don't have credentials yet - app will work for local storage"
echo ""

read -p "Enter Digital Evidence API Key (pk_live_...): " DE_API_KEY
read -p "Enter Organization ID: " DE_ORGANIZATION_ID
read -p "Enter Tenant ID: " DE_TENANT_ID

# Step 3: Install Dependencies
print_header "Step 3: Installing Dependencies"

print_info "Installing API dependencies..."
cd api
npm install --silent
print_success "API dependencies installed"

print_info "Installing Frontend dependencies..."
cd ../frontend
npm install --silent
print_success "Frontend dependencies installed"

cd ..

# Step 4: Database Setup
print_header "Step 4: Setting Up Database"

# Check if user exists, create if not
print_info "Setting up database user..."
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1
if [ $? -eq 0 ]; then
    print_warning "User $DB_USER already exists"
else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    print_success "Created database user: $DB_USER"
fi

# Check if database exists, create if not
print_info "Setting up database..."
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"
if [ $? -eq 0 ]; then
    print_warning "Database $DB_NAME already exists"
    read -p "Drop and recreate database? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo -u postgres psql -c "DROP DATABASE $DB_NAME;" 2>/dev/null || true
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME WITH OWNER $DB_USER;"
        print_success "Recreated database: $DB_NAME"
    fi
else
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME WITH OWNER $DB_USER;"
    print_success "Created database: $DB_NAME"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# Run setup script
print_info "Running database setup script..."
cp setup_proofvaultdb_test.sql /tmp/setup_proofvaultdb_test.sql
chmod 644 /tmp/setup_proofvaultdb_test.sql
sudo -u postgres psql -d "$DB_NAME" -f /tmp/setup_proofvaultdb_test.sql > /dev/null 2>&1
print_success "Database schema created"

# Verify connection
print_info "Verifying database connection..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM pdf_records;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Database connection verified"
else
    print_error "Could not connect to database. Please check credentials."
    exit 1
fi

# Step 5: Create Environment Files
print_header "Step 5: Creating Environment Files"

# API .env
print_info "Creating API environment file..."
cat > api/.env << EOL
# ProofVault API Environment Variables
# Auto-generated by setup script on $(date)

# Server Configuration
NODE_ENV=development
PORT=4000
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Security
JWT_SECRET=dev_jwt_secret_change_in_production_$(date +%s)
JWT_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf

# Logging Configuration
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:4002,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Digital Evidence API Configuration (Constellation Network)
EOL

if [ -n "$DE_API_KEY" ]; then
    cat >> api/.env << EOL
DE_API_KEY=$DE_API_KEY
DE_ORGANIZATION_ID=$DE_ORGANIZATION_ID
DE_TENANT_ID=$DE_TENANT_ID
EOL
    print_success "Digital Evidence API credentials configured"
else
    cat >> api/.env << EOL
# Add your credentials here when you have them:
# DE_API_KEY=your_api_key
# DE_ORGANIZATION_ID=your_org_id
# DE_TENANT_ID=your_tenant_id
EOL
    print_warning "Digital Evidence API not configured - app will work for local storage only"
fi

print_success "API environment file created"

# Frontend .env.local (verify it's correct)
if [ -f "frontend/.env.local" ]; then
    print_success "Frontend environment file exists"
else
    print_info "Creating Frontend environment file..."
    cat > frontend/.env.local << EOL
# ProofVault API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_NAME=ProofVault
NEXT_PUBLIC_APP_DESCRIPTION=Legal Evidence Management System
EOL
    print_success "Frontend environment file created"
fi

# Step 6: Verify Setup
print_header "Step 6: Verifying Setup"

# Check all files exist
FILES=(
    "api/.env"
    "frontend/.env.local"
    "api/package.json"
    "frontend/package.json"
    "chrome-extension/manifest.json"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file is missing!"
        exit 1
    fi
done

# Final Success Message
print_header "Setup Complete!"

echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   ✓ ProofVault is ready to use!                      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

print_info "Your Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  API Port: 4000"
echo "  Frontend Port: 4002"
echo ""

print_info "To start your application:"
echo ""
echo "  Option 1 - Start both services at once:"
echo "    ${GREEN}npm run dev${NC}"
echo ""
echo "  Option 2 - Start services separately:"
echo "    Terminal 1: ${GREEN}cd api && npm start${NC}"
echo "    Terminal 2: ${GREEN}cd frontend && npm run dev${NC}"
echo ""

print_info "Access your application:"
echo "  Frontend: ${BLUE}http://localhost:4002${NC}"
echo "  API:      ${BLUE}http://localhost:4000${NC}"
echo "  Health:   ${BLUE}http://localhost:4000/api/health${NC}"
echo ""

print_info "Chrome Extension:"
echo "  1. Open Chrome: ${BLUE}chrome://extensions/${NC}"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $(pwd)/chrome-extension/"
echo ""

print_success "Happy coding! 🚀"
