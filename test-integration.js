const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3003/api';
const METAGRAPH_URL = 'http://localhost:9400';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ ${msg}${colors.reset}`)
};

// Create a test PDF content
const createTestPDF = () => {
  // Simple PDF structure (minimal valid PDF)
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
  
  return Buffer.from(pdfContent);
};

// Test 1: Upload PDF and verify blockchain submission
async function testPDFUpload() {
  log.info('Test 1: Uploading PDF to ProofVault...');
  
  const pdfBuffer = createTestPDF();
  const form = new FormData();
  
  form.append('pdf', pdfBuffer, {
    filename: 'test-evidence.pdf',
    contentType: 'application/pdf'
  });
  form.append('company_name', 'Test Company');
  form.append('username', 'test-user');

  try {
    const response = await axios.post(`${API_BASE_URL}/pdf/upload`, form, {
      headers: form.getHeaders()
    });

    if (response.status === 200 || response.status === 201) {
      log.success(`PDF uploaded successfully! ID: ${response.data.data.id}`);
      log.info(`PDF Hash: ${response.data.data.pdf_hash}`);
      return response.data.data;
    } else {
      log.error(`Upload failed: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    log.error(`Upload error: ${errorMsg}`);
    return null;
  }
}

// Test 2: Verify hash on blockchain
async function testBlockchainVerification(pdfId) {
  log.info('\nTest 2: Verifying hash on blockchain...');
  
  // Wait a bit for blockchain submission
  log.info('Waiting 3 seconds for blockchain submission...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const response = await fetch(`${API_BASE_URL}/pdf/${pdfId}/verify`);
    const result = await response.json();
    
    if (response.ok) {
      if (result.data.blockchain_verified) {
        log.success('Hash verified on blockchain!');
        log.info(`Blockchain TX ID: ${result.data.blockchain_tx_id}`);
        log.info(`Verified at: ${result.data.blockchain_verified_at}`);
      } else {
        log.error('Hash not yet verified on blockchain');
        log.info('This might be normal if the metagraph is not running');
      }
      return result.data;
    } else {
      log.error(`Verification failed: ${result.message}`);
      return null;
    }
  } catch (error) {
    log.error(`Verification error: ${error.message}`);
    return null;
  }
}

// Test 3: Query metagraph directly
async function testMetagraphQuery(pdfHash) {
  log.info('\nTest 3: Querying metagraph directly...');
  
  try {
    const response = await fetch(`${METAGRAPH_URL}/hash/verify/${pdfHash}`);
    
    if (response.ok) {
      const result = await response.json();
      if (result.found !== false) {
        log.success('Hash found in metagraph!');
        console.log('Metagraph record:', JSON.stringify(result, null, 2));
      } else {
        log.error('Hash not found in metagraph');
      }
      return result;
    } else {
      log.error(`Metagraph query failed: ${response.statusText}`);
      return null;
    }
  } catch (error) {
    log.error(`Metagraph not accessible. Is it running?`);
    log.info('Start metagraph with: cd /home/nodeadmin/todo/euclid-development-environment && ./scripts/hydra start');
    return null;
  }
}

// Test 4: Check metagraph endpoints
async function testMetagraphEndpoints() {
  log.info('\nTest 4: Testing metagraph endpoints...');
  
  const endpoints = [
    '/active-hashes/all',
    '/company-counts',
    '/hash/company/Test%20Company'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${METAGRAPH_URL}${endpoint}`);
      if (response.ok) {
        log.success(`Endpoint ${endpoint} is accessible`);
      } else {
        log.error(`Endpoint ${endpoint} returned ${response.status}`);
      }
    } catch (error) {
      log.error(`Endpoint ${endpoint} not accessible`);
    }
  }
}

// Main test runner
async function runTests() {
  console.log('\n=== ProofVault Blockchain Integration Tests ===\n');
  
  // Check if API is running
  try {
    await fetch(`${API_BASE_URL}/health`);
  } catch (error) {
    log.error('ProofVault API is not running!');
    log.info('Start it with: cd /home/nodeadmin/proofvault/api && npm run dev');
    process.exit(1);
  }
  
  // Run tests
  const uploadResult = await testPDFUpload();
  
  if (uploadResult) {
    const verifyResult = await testBlockchainVerification(uploadResult.id);
    
    if (uploadResult.pdf_hash) {
      await testMetagraphQuery(uploadResult.pdf_hash);
    }
  }
  
  await testMetagraphEndpoints();
  
  console.log('\n=== Test Summary ===');
  log.info('Check API logs for blockchain submission details');
  log.info('If metagraph is not running, start it with:');
  log.info('cd /home/nodeadmin/todo/euclid-development-environment && ./scripts/hydra start');
}

// Run the tests
runTests().catch(console.error);