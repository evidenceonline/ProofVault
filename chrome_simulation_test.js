const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

/**
 * Chrome Extension Simulation Test
 *
 * This script simulates exactly what the Chrome extension does when capturing evidence:
 * 1. Generates the same metadata format
 * 2. Creates a test PDF (mimicking the extension's merged PDF)
 * 3. Calls the API with identical parameters
 * 4. Tests the Digital Evidence integration
 */

// Configuration
const API_BASE_URL = 'http://localhost:4001/api';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ ${msg}${colors.reset}`),
  debug: (msg) => console.log(`${colors.blue}🔍 ${msg}${colors.reset}`)
};

/**
 * Generate Chrome extension-style metadata
 */
function generateExtensionMetadata() {
  const id = `PV_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const timestamp = new Date().toISOString();

  return {
    id,
    organization: 'Test Company Chrome Ext',
    user: 'Test User Chrome Ext',
    timestamp,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    url: 'https://example.com/test-page'
  };
}

/**
 * Create a simple PDF that mimics what the Chrome extension would generate
 * This simulates the merged PDF (cover + webpage content)
 */
function createTestChromePDF(uniqueId) {
  // Simple PDF structure that mimics Chrome extension output (with unique content)
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 720 Td
(ProofVault Cover Page) Tj
ET
endstream
endobj
6 0 obj
<< /Length ${54 + uniqueId.length} >>
stream
BT
/F1 12 Tf
72 720 Td
(Chrome Test: ${uniqueId}) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000189 00000 n
0000000263 00000 n
0000000358 00000 n
trailer
<< /Size 7 /Root 1 0 R >>
startxref
459
%%EOF`;

  return Buffer.from(pdfContent);
}

/**
 * Simulate the Chrome extension API call exactly
 */
async function simulateExtensionUpload(metadata, pdfBuffer) {
  log.info('Simulating Chrome extension upload...');

  // Create FormData exactly like the Chrome extension does (api.js lines 19-37)
  const form = new FormData();

  // TEXT FIELDS FIRST (as the extension does)
  form.append('company_name', metadata.organization); // Maps organization -> company_name
  form.append('username', metadata.user);             // Maps user -> username
  form.append('id', metadata.id);
  form.append('timestamp', metadata.timestamp);
  form.append('url', metadata.url);
  // file_id is optional in extension

  log.debug('Form fields being sent:');
  log.debug(`  company_name: ${metadata.organization}`);
  log.debug(`  username: ${metadata.user}`);
  log.debug(`  id: ${metadata.id}`);
  log.debug(`  timestamp: ${metadata.timestamp}`);
  log.debug(`  url: ${metadata.url}`);

  // FILE FIELD LAST (must be exactly 'pdf')
  form.append('pdf', pdfBuffer, `ProofVault_${metadata.id}.pdf`);

  try {
    // Upload with timeout (like the extension does - 30 seconds)
    const response = await axios.post(`${API_BASE_URL}/pdf/upload`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });

    if (response.status === 200 || response.status === 201) {
      log.success(`Upload successful! Status: ${response.status}`);

      const data = response.data?.data;
      if (data) {
        log.info(`Generated ID: ${data.id}`);
        log.info(`PDF Hash: ${data.pdf_hash}`);
        log.info(`Blockchain Status: ${data.blockchain_status}`);

        // Check for Digital Evidence fingerprint
        if (data.blockchain_tx_id) {
          log.success(`🔒 Digital Evidence Fingerprint: ${data.blockchain_tx_id}`);
        } else {
          log.error('❌ No Digital Evidence fingerprint generated');
        }

        if (data.blockchain_error) {
          log.error(`Blockchain Error: ${data.blockchain_error}`);
        }
      }

      return response.data;
    } else {
      log.error(`Upload failed: ${response.data?.message || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log.error('Connection refused - is the API server running on localhost:4000?');
      log.info('Start with: cd /home/nodeadmin/proofvault-digital-evidence/api && npm start');
    } else if (error.response) {
      const errorMsg = error.response.data?.message || error.response.statusText;
      log.error(`Upload failed (${error.response.status}): ${errorMsg}`);

      // Log response details for debugging
      if (error.response.data) {
        console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      log.error(`Upload error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Test API health first
 */
async function testApiHealth() {
  log.info('Testing API health...');

  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    if (response.status === 200) {
      log.success('API is healthy');
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log.error('API is not running on localhost:4000');
      log.info('Start with: cd /home/nodeadmin/proofvault-digital-evidence/api && npm start');
    } else {
      log.error(`API health check failed: ${error.message}`);
    }
    return false;
  }
}

/**
 * Main test runner
 */
async function runChromeSimulationTest() {
  console.log('\n=== Chrome Extension Simulation Test ===\n');

  // Test API health first
  const isHealthy = await testApiHealth();
  if (!isHealthy) {
    process.exit(1);
  }

  // Generate metadata like the Chrome extension
  const metadata = generateExtensionMetadata();
  log.info('Generated metadata:');
  console.log(JSON.stringify(metadata, null, 2));

  // Create test PDF with unique content
  const pdfBuffer = createTestChromePDF(metadata.id);
  log.info(`Created test PDF (${pdfBuffer.length} bytes)`);

  // Save test PDF for reference
  const testPdfPath = path.join(__dirname, 'chrome_simulation_test.pdf');
  fs.writeFileSync(testPdfPath, pdfBuffer);
  log.info(`Test PDF saved to: ${testPdfPath}`);

  // Simulate the upload
  const result = await simulateExtensionUpload(metadata, pdfBuffer);

  console.log('\n=== Test Results ===');
  if (result && result.success) {
    log.success('✅ Chrome extension simulation successful!');

    if (result.data?.blockchain_tx_id) {
      log.success('✅ Digital Evidence fingerprint generated successfully');
      log.info(`Fingerprint: ${result.data.blockchain_tx_id}`);
    } else {
      log.error('❌ Digital Evidence fingerprint missing - this is the issue!');
      log.info('Check API logs for Digital Evidence API errors');
    }
  } else {
    log.error('❌ Chrome extension simulation failed');
  }

  console.log('\n=== Next Steps ===');
  log.info('1. If this works but real extension doesn\'t:');
  log.info('   - Extension is calling wrong server (proofvault.net vs localhost)');
  log.info('   - Production server needs Digital Evidence integration');
  log.info('2. If this also fails:');
  log.info('   - Check API logs for Digital Evidence errors');
  log.info('   - Verify Digital Evidence API credentials');
}

// Run the test
runChromeSimulationTest().catch(console.error);