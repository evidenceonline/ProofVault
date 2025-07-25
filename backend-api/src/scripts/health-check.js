#!/usr/bin/env node

/**
 * Health Check Script
 * 
 * Standalone script to check the health of ProofVault Backend API
 * and its dependencies. Can be used for monitoring and deployment checks.
 */

const axios = require('axios');
const logger = require('../utils/logger');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TIMEOUT = parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 10000;

/**
 * Perform health check
 */
async function performHealthCheck() {
  let exitCode = 0;
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  console.log('ProofVault Backend API Health Check');
  console.log('====================================');

  try {
    // Basic health check
    console.log('\n1. Basic Health Check...');
    const basicResponse = await axios.get(`${API_BASE_URL}/health`, {
      timeout: TIMEOUT
    });
    
    results.checks.basic = {
      status: 'healthy',
      responseTime: basicResponse.headers['x-response-time'] || 'unknown',
      data: basicResponse.data
    };
    console.log('✓ Basic health check passed');

  } catch (error) {
    results.checks.basic = {
      status: 'unhealthy',
      error: error.message
    };
    console.log('✗ Basic health check failed:', error.message);
    exitCode = 1;
  }

  try {
    // Detailed health check
    console.log('\n2. Detailed Health Check...');
    const detailedResponse = await axios.get(`${API_BASE_URL}/health/detailed`, {
      timeout: TIMEOUT
    });
    
    results.checks.detailed = {
      status: detailedResponse.data.status,
      checks: detailedResponse.data.checks,
      responseTime: detailedResponse.data.responseTime
    };

    // Check individual components
    const checks = detailedResponse.data.checks;
    
    if (checks.database?.status === 'healthy') {
      console.log('✓ Database connection healthy');
    } else {
      console.log('✗ Database connection unhealthy');
      exitCode = 1;
    }

    if (checks.metagraph?.status === 'healthy') {
      console.log('✓ Metagraph connection healthy');
    } else if (checks.metagraph?.status === 'degraded') {
      console.log('⚠ Metagraph connection degraded');
    } else {
      console.log('✗ Metagraph connection unhealthy');
      exitCode = 1;
    }

    if (checks.storage?.status === 'healthy') {
      console.log('✓ Storage system healthy');
    } else {
      console.log('✗ Storage system unhealthy');
      exitCode = 1;
    }

  } catch (error) {
    results.checks.detailed = {
      status: 'unhealthy',
      error: error.message
    };
    console.log('✗ Detailed health check failed:', error.message);
    exitCode = 1;
  }

  try {
    // API endpoints check
    console.log('\n3. API Endpoints Check...');
    
    // Test network info endpoint
    const networkResponse = await axios.get(`${API_BASE_URL}/api/network/info`, {
      timeout: TIMEOUT
    });
    
    results.checks.api = {
      network: {
        status: 'healthy',
        data: networkResponse.data
      }
    };
    console.log('✓ Network info endpoint working');

  } catch (error) {
    results.checks.api = {
      network: {
        status: 'unhealthy',
        error: error.message
      }
    };
    console.log('✗ API endpoints check failed:', error.message);
    exitCode = 1;
  }

  // Summary
  console.log('\nHealth Check Summary');
  console.log('===================');
  console.log(`Status: ${exitCode === 0 ? '✓ HEALTHY' : '✗ UNHEALTHY'}`);
  console.log(`Timestamp: ${results.timestamp}`);
  
  if (process.env.OUTPUT_JSON === 'true') {
    console.log('\nDetailed Results:');
    console.log(JSON.stringify(results, null, 2));
  }

  process.exit(exitCode);
}

/**
 * Main execution
 */
if (require.main === module) {
  performHealthCheck().catch((error) => {
    console.error('Health check script failed:', error);
    process.exit(1);
  });
}

module.exports = { performHealthCheck };