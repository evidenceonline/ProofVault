#\!/bin/bash

# ProofVault Database Migration Runner (as postgres user)
# Usage: sudo -u postgres ./run_migration_as_postgres.sh

echo "🚀 ProofVault Database Migration: Proper Ordinal Tracking (as postgres)"
echo "======================================================================"

# Database connection details
DB_HOST="localhost"
DB_USER="postgres"
DB_NAME="proofvaultdb"

echo ""
echo "1️⃣ Creating backup of current database..."
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
if [ $? -eq 0 ]; then
    echo "   ✅ Backup created successfully"
else
    echo "   ❌ Backup failed - ABORTING migration"
    exit 1
fi

echo ""
echo "2️⃣ Running migration script..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f 001_add_proper_ordinal_tracking.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "3️⃣ Granting permissions to proofvaultuser..."
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
    GRANT SELECT, INSERT, UPDATE, DELETE ON pdf_records TO proofvaultuser;
    GRANT SELECT ON pdf_records_clean TO proofvaultuser;
    "
    
    echo ""
    echo "🎉 Migration completed successfully\!"
    echo ""
    echo "📊 You can now use these new columns:"
    echo "   - blockchain_ordinal: Real blockchain ordinals (17, 18, 19...)"
    echo "   - ordinal_type: 'real-blockchain-ordinal' or 'timestamp-based'" 
    echo "   - evidence_timestamp: Original capture timestamps"
    echo ""
    echo "📋 Use the new view for clean data access:"
    echo "   SELECT * FROM pdf_records_clean;"
else
    echo ""
    echo "❌ Migration failed\!"
    echo "💾 Your data is safe - restore from backup if needed"
fi
