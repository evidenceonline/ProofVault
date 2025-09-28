# ProofVault Digital Evidence - Production Deployment Guide

## Summary

The Chrome extension Digital Evidence fingerprint issue has been **RESOLVED**. The local Digital Evidence integration is working perfectly and generates proper tamper-proof fingerprints. However, the production server at `proofvault.net:4000` needs to be updated to include the Digital Evidence integration.

## Issue Analysis

### Root Cause
The Chrome extension was configured to call `proofvault.net:4000` in production, but that server was running the **original ProofVault API** without Digital Evidence integration. The Digital Evidence integration code exists in this repository (`proofvault-digital-evidence`) but was not deployed to production.

### Solution Status
✅ **Local Integration Working**: Digital Evidence fingerprints are generated successfully on `localhost:4001`
✅ **Chrome Extension Fixed**: Configuration switches between development and production
✅ **API Response Fixed**: `blockchain_tx_id` field now included in upload response
✅ **Tag Length Fixed**: Filename truncated to meet 32-character Digital Evidence API limit

## Production Deployment Requirements

### 1. Deploy Updated API Code

**Target**: `proofvault.net:4000`

**Required Files**:
```
api/
├── controllers/pdfController.js     # Updated with Digital Evidence integration
├── utils/digital-evidence-client.js # Digital Evidence API client
├── package.json                     # Updated dependencies (uuid, secp256k1, etc.)
├── .env                            # Environment variables (see below)
└── ... (all other API files)
```

### 2. Environment Variables

**Production `.env` file must include**:
```bash
# Existing ProofVault variables
NODE_ENV=production
PORT=4000
DB_HOST=your_production_db
DB_PORT=5432
DB_NAME=your_production_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# NEW: Digital Evidence API credentials
DE_API_KEY=your_digital_evidence_api_key
DE_ORGANIZATION_ID=your_organization_id
DE_TENANT_ID=your_tenant_id
```

**How to get Digital Evidence credentials**:
1. Register at [Constellation Digital Evidence](https://digitalevidence.constellationnetwork.io/)
2. Create organization and tenant
3. Generate API key
4. Use the same credentials currently in the development `.env` or request new production ones

### 3. Database Updates

The Digital Evidence integration uses the existing `pdf_records` table with the `blockchain_tx_id` column to store fingerprint hashes. No database migrations are required.

### 4. Chrome Extension Configuration

**Current Status**: Chrome extension has development/production switch

**For Production Users**:
- Set `DEVELOPMENT = false` in `config.js` (already set)
- Extension will call `proofvault.net:4000`
- Extension will redirect to `proofvault.net:4002` for web app

**For Development/Testing**:
- Set `DEVELOPMENT = true` in `config.js`
- Extension will call `localhost:4001`
- Extension will redirect to `localhost:4002` for web app

### 5. Dependencies

**New Node.js packages required** (already in package.json):
```json
{
  "uuid": "^10.0.0",
  "secp256k1": "^5.0.0",
  "js-sha256": "^0.11.0",
  "js-sha512": "^0.9.0"
}
```

Run `npm install` after deployment to install new dependencies.

### 6. Verification Steps

After production deployment:

1. **Test Health Endpoint**:
   ```bash
   curl http://proofvault.net:4000/api/health
   ```

2. **Test Extension Upload**:
   - Install Chrome extension with `DEVELOPMENT = false`
   - Capture evidence on any webpage
   - Verify fingerprint is generated (check `blockchain_tx_id` in response)

3. **Verify Digital Evidence Explorer**:
   - Check that fingerprints appear at: `https://digitalevidence.constellationnetwork.io/fingerprint/{hash}`

## Testing Checklist

### Pre-Deployment Testing
- [x] Local API generates Digital Evidence fingerprints
- [x] Chrome extension simulation test passes
- [x] API returns `blockchain_tx_id` in upload response
- [x] Digital Evidence API accepts fingerprints without errors
- [x] Extension has proper development/production configuration

### Post-Deployment Testing
- [ ] Production API health check responds
- [ ] Chrome extension connects to production API
- [ ] Upload generates Digital Evidence fingerprint
- [ ] Fingerprint accessible in Digital Evidence explorer
- [ ] "Open in Web App" redirects to correct URL

## File Changes Summary

### Modified Files
1. `api/controllers/pdfController.js` - Added Digital Evidence integration, fixed response
2. `api/utils/digital-evidence-client.js` - Created Digital Evidence API client
3. `chrome-extension/config.js` - Added development/production configuration
4. `chrome-extension/popup.js` - Updated to use configurable web app URL
5. `chrome-extension/manifest.json` - Updated CSP to allow both domains
6. `api/package.json` - Added Digital Evidence dependencies

### New Files
1. `chrome_simulation_test.js` - Chrome extension simulation test
2. `PRODUCTION_DEPLOYMENT_GUIDE.md` - This deployment guide

## Support

### Troubleshooting
- **No fingerprint generated**: Check Digital Evidence API credentials in production `.env`
- **Extension can't connect**: Verify `proofvault.net:4000` is accessible and running updated code
- **Fingerprint too long error**: Ensure latest code with filename truncation is deployed

### Success Indicators
✅ API logs show: `✅ Digital Evidence submission successful`
✅ API logs show: `🆔 Fingerprint Hash: {64-character-hash}`
✅ Chrome extension shows fingerprint in response
✅ Explorer URL accessible: `https://digitalevidence.constellationnetwork.io/fingerprint/{hash}`

## Next Steps

1. **Deploy updated API code** to `proofvault.net:4000`
2. **Configure Digital Evidence credentials** in production `.env`
3. **Test Chrome extension** with production configuration
4. **Verify fingerprint generation** end-to-end

The Digital Evidence integration is complete and working perfectly in development. Production deployment will enable tamper-proof legal evidence certificates for all users.