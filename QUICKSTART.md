# ProofVault Quick Start Guide

Get ProofVault running in **under 5 minutes**!

## Prerequisites

Before you start, make sure you have:

- **Node.js 18+** ([Download](https://nodejs.org/))
- **PostgreSQL 13+** ([Download](https://www.postgresql.org/download/))
- **Chrome Browser** (for extension)

### Verify Installation

```bash
node --version   # Should show v18 or higher
psql --version   # Should show 13 or higher
```

---

## Option 1: Docker Setup (Fastest - ZERO Prerequisites! 🐳)

**The absolute fastest way** - No Node.js, no PostgreSQL install needed!

### Prerequisites
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))

### Setup Steps

```bash
# 1. Clone the repository
git clone https://github.com/evidenceonline/ProofVault.git
cd ProofVault
git checkout digital-evidence

# 2. Start everything with Docker
docker-compose -f docker-compose.dev.yml up
```

**That's literally it!** 🎉

Your application is now running:
- **Frontend Dashboard**: http://localhost:4002
- **API Server**: http://localhost:4000

### What Happens Automatically

- ✅ PostgreSQL database created and initialized
- ✅ Database schema loaded
- ✅ API dependencies installed
- ✅ Frontend dependencies installed
- ✅ Both services started with hot reload

### Stop the Application

```bash
# Press Ctrl+C in the terminal
# Or run:
docker-compose -f docker-compose.dev.yml down
```

### Clean Up (Optional)

```bash
# Remove all containers and volumes
docker-compose -f docker-compose.dev.yml down -v
```

---

## Option 2: Automated Setup (Recommended for Native Install)

The easiest way to get started:

### 1. Clone the Repository

```bash
git clone https://github.com/evidenceonline/ProofVault.git
cd ProofVault
git checkout digital-evidence
```

### 2. Run the Setup Script

```bash
chmod +x setup.sh
./setup.sh
```

The script will:
- ✅ Check all prerequisites
- ✅ Install dependencies
- ✅ Set up PostgreSQL database
- ✅ Create configuration files
- ✅ Verify everything is ready

### 3. Start the Application

```bash
npm run dev
```

That's it! Your application is running:
- **Frontend**: http://localhost:4002
- **API**: http://localhost:4000

---

## Option 3: Manual Setup

If you prefer to set things up manually:

### 1. Clone and Install

```bash
git clone https://github.com/evidenceonline/ProofVault.git
cd ProofVault
git checkout digital-evidence

# Install all dependencies
npm run install:all
```

### 2. Set Up Database

```bash
# Create database user and database
sudo -u postgres psql << EOF
CREATE USER proofvaultuser WITH PASSWORD 'your_password_here';
CREATE DATABASE proofvaultdb_test WITH OWNER proofvaultuser;
GRANT ALL PRIVILEGES ON DATABASE proofvaultdb_test TO proofvaultuser;
\q
EOF

# Run setup script
sudo -u postgres psql -d proofvaultdb_test -f setup_proofvaultdb_test.sql
```

### 3. Configure API

```bash
# Create API environment file
cp api/.env.example api/.env

# Edit api/.env and set:
# - DB_PASSWORD=your_password_here
# - DE_API_KEY=your_constellation_api_key (optional)
# - DE_ORGANIZATION_ID=your_org_id (optional)
# - DE_TENANT_ID=your_tenant_id (optional)
```

### 4. Start Services

```bash
# Terminal 1: Start API
cd api && npm start

# Terminal 2: Start Frontend
cd frontend && npm run dev
```

---

## Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from your ProofVault directory

---

## Verify Everything is Working

### Test the API

```bash
curl http://localhost:4000/api/health
```

You should see a JSON response with `"status":"healthy"` or `"status":"warning"`.

### Test the Frontend

Open your browser and go to:
```
http://localhost:4002
```

You should see the ProofVault dashboard.

### Test the Chrome Extension

1. Click the ProofVault icon in your Chrome toolbar
2. Navigate to any webpage
3. Click "Capture Evidence" in the extension popup

---

## Configuration

### Database Credentials

Default credentials (if using setup script):
- **Host**: localhost
- **Port**: 5432
- **Database**: proofvaultdb_test
- **User**: proofvaultuser
- **Password**: Set during setup

### Digital Evidence API (Constellation Network)

To enable blockchain features, add your credentials to `api/.env`:

```bash
DE_API_KEY=pk_live_your_api_key
DE_ORGANIZATION_ID=your_organization_id
DE_TENANT_ID=your_tenant_id
```

Get your credentials at: https://digitalevidence.constellationnetwork.io/

**Note:** The app works for local PDF storage even without these credentials.

---

## Troubleshooting

### Port Already in Use

If ports 4000 or 4002 are already in use:

```bash
# Find what's using the port
lsof -i :4000
lsof -i :4002

# Kill the process (replace PID with actual process ID)
kill -9 PID
```

### Database Connection Failed

1. Verify PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Check credentials in `api/.env`:
   ```bash
   cat api/.env | grep DB_
   ```

3. Test connection manually:
   ```bash
   psql -h localhost -U proofvaultuser -d proofvaultdb_test
   ```

### Node Version Error

If you see errors about Node.js version:

```bash
# Check your version
node --version

# Install Node 18+ using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Dependencies Won't Install

Try clearing the cache and reinstalling:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules api/node_modules frontend/node_modules

# Reinstall
npm run install:all
```

---

## Next Steps

### 1. Explore the Dashboard

Navigate to http://localhost:4002 to:
- View all captured evidence
- See blockchain verification status
- Download PDFs

### 2. Capture Your First Evidence

1. Install the Chrome extension (see above)
2. Navigate to any webpage
3. Click the ProofVault icon
4. Fill in Company Name and Username
5. Click "Capture Evidence"

### 3. Verify on Blockchain

If you configured Digital Evidence API credentials:
1. Go to https://digitalevidence.constellationnetwork.io/
2. Search for your evidence hash
3. View the blockchain verification certificate

---

## Development Workflow

### Running Tests

```bash
cd api && npm test
```

### Building for Production

```bash
npm run build
```

### Viewing Logs

API logs are shown in the terminal where you ran `npm start`.

---

## Getting Help

- **Documentation**: See [DOCUMENTATION.md](DOCUMENTATION.md) for complete technical details
- **Issues**: Report bugs at https://github.com/evidenceonline/ProofVault/issues
- **API Reference**: http://localhost:4000/ when API is running

---

## Project Structure

```
ProofVault/
├── api/                # Node.js backend API
├── frontend/           # Next.js dashboard
├── chrome-extension/   # Chrome browser extension
├── setup.sh           # Automated setup script
├── docker-compose.yml # Docker configuration
└── README.md          # Full documentation
```

---

**You're all set!** 🚀

Happy building with ProofVault!
