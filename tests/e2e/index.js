/**
 * ProofVault End-to-End Test Suite
 * 
 * Comprehensive testing orchestrator for the complete ProofVault workflow:
 * Chrome Extension PDF Capture → Backend API → Scala Metagraph → Database Storage → Frontend Verification
 * 
 * Test Coverage:
 * - Complete workflow integration
 * - Component integration testing
 * - API endpoint validation
 * - Performance and load testing
 * - Error handling and edge cases
 * - Cross-browser compatibility
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const WebSocket = require('ws');

const E2ETestSuite = require('./suites/e2eTestSuite');
const ComponentIntegrationSuite = require('./suites/componentIntegrationSuite');
const ApiTestSuite = require('./suites/apiTestSuite');
const PerformanceTestSuite = require('./suites/performanceTestSuite');
const ErrorHandlingSuite = require('./suites/errorHandlingSuite');
const TestReporter = require('./utils/testReporter');
const TestEnvironment = require('./utils/testEnvironment');

class ProofVaultTestOrchestrator {
  constructor(config = {}) {
    this.config = {
      timeout: 300000, // 5 minutes default timeout
      retries: 3,
      parallel: false,
      browsers: ['chrome', 'firefox'],
      apiBaseUrl: 'http://localhost:3001',
      frontendUrl: 'http://localhost:3000',
      metagraphUrl: 'http://localhost:9000',
      wsUrl: 'ws://localhost:3001',
      testDataDir: path.join(__dirname, 'data'),
      reportsDir: path.join(__dirname, 'reports'),
      screenshotsDir: path.join(__dirname, 'screenshots'),
      ...config
    };

    this.reporter = new TestReporter(this.config.reportsDir);
    this.environment = new TestEnvironment(this.config);
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      suites: {}
    };
  }

  /**
   * Initialize test environment and dependencies
   */
  async initialize() {
    console.log('🚀 Initializing ProofVault E2E Test Suite...');
    
    try {
      // Create test directories
      await this.createTestDirectories();
      
      // Initialize test environment
      await this.environment.setup();
      
      // Verify system prerequisites
      await this.verifyPrerequisites();
      
      // Generate test data
      await this.generateTestData();
      
      console.log('✅ Test environment initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error.message);
      throw error;
    }
  }

  /**
   * Create necessary test directories
   */
  async createTestDirectories() {
    const dirs = [
      this.config.testDataDir,
      this.config.reportsDir,
      this.config.screenshotsDir,
      path.join(this.config.reportsDir, 'coverage'),
      path.join(this.config.reportsDir, 'performance'),
      path.join(this.config.reportsDir, 'screenshots')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Verify system prerequisites are met
   */
  async verifyPrerequisites() {
    const checks = [
      this.checkService('Backend API', this.config.apiBaseUrl + '/health'),
      this.checkService('Frontend', this.config.frontendUrl),
      this.checkService('Metagraph', this.config.metagraphUrl + '/cluster/info'),
      this.checkDatabase(),
      this.checkWebSocket()
    ];

    const results = await Promise.allSettled(checks);
    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      const errorMessages = failures.map(({ result, index }) => 
        `Check ${index + 1}: ${result.reason.message}`
      ).join('\n');
      
      throw new Error(`Prerequisites not met:\n${errorMessages}`);
    }

    console.log('✅ All prerequisites verified');
  }

  /**
   * Check if a service is running and accessible
   */
  async checkService(name, url) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      if (response.status === 200) {
        console.log(`✅ ${name} is accessible`);
        return true;
      }
      throw new Error(`${name} returned status ${response.status}`);
    } catch (error) {
      throw new Error(`${name} is not accessible: ${error.message}`);
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const { testDatabaseConnection } = require('../../database/config/database');
      await testDatabaseConnection();
      console.log('✅ Database connection verified');
      return true;
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }
  }

  /**
   * Check WebSocket connectivity
   */
  async checkWebSocket() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.wsUrl);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        console.log('✅ WebSocket connection verified');
        resolve(true);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket check failed: ${error.message}`));
      });
    });
  }

  /**
   * Generate test data including PDFs and test documents
   */
  async generateTestData() {
    const testDataGenerator = require('./utils/testDataGenerator');
    await testDataGenerator.generateAllTestData(this.config.testDataDir);
    console.log('✅ Test data generated');
  }

  /**
   * Run all test suites
   */
  async runAllTests() {
    console.log('🧪 Starting comprehensive test execution...');
    
    const suites = [
      { name: 'E2E Integration', suite: E2ETestSuite, priority: 1 },
      { name: 'Component Integration', suite: ComponentIntegrationSuite, priority: 2 },
      { name: 'API Testing', suite: ApiTestSuite, priority: 2 },
      { name: 'Performance Testing', suite: PerformanceTestSuite, priority: 3 },
      { name: 'Error Handling', suite: ErrorHandlingSuite, priority: 3 }
    ];

    // Sort by priority and run tests
    suites.sort((a, b) => a.priority - b.priority);
    
    for (const { name, suite: SuiteClass } of suites) {
      console.log(`\n📋 Running ${name} Test Suite...`);
      
      try {
        const suiteInstance = new SuiteClass(this.config);
        const suiteResults = await this.runTestSuite(name, suiteInstance);
        
        this.results.suites[name] = suiteResults;
        this.results.total += suiteResults.total;
        this.results.passed += suiteResults.passed;
        this.results.failed += suiteResults.failed;
        this.results.skipped += suiteResults.skipped;
        
        if (suiteResults.errors.length > 0) {
          this.results.errors.push(...suiteResults.errors);
        }
        
        console.log(`✅ ${name} Suite: ${suiteResults.passed}/${suiteResults.total} passed`);
      } catch (error) {
        console.error(`❌ ${name} Suite failed:`, error.message);
        this.results.errors.push({
          suite: name,
          error: error.message,
          stack: error.stack
        });
      }
    }

    return this.results;
  }

  /**
   * Run a specific test suite with error handling and retries
   */
  async runTestSuite(suiteName, suiteInstance) {
    const suiteResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      tests: []
    };

    try {
      await suiteInstance.setup();
      const tests = await suiteInstance.getTests();
      suiteResults.total = tests.length;

      for (const test of tests) {
        const testResult = await this.runTestWithRetries(test, suiteInstance);
        suiteResults.tests.push(testResult);
        
        if (testResult.status === 'passed') {
          suiteResults.passed++;
        } else if (testResult.status === 'failed') {
          suiteResults.failed++;
          suiteResults.errors.push(testResult.error);
        } else {
          suiteResults.skipped++;
        }
      }

      await suiteInstance.teardown();
    } catch (error) {
      suiteResults.errors.push({
        suite: suiteName,
        error: error.message,
        stack: error.stack
      });
    }

    return suiteResults;
  }

  /**
   * Run individual test with retry logic
   */
  async runTestWithRetries(test, suiteInstance) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        console.log(`  🔄 Running: ${test.name} (attempt ${attempt}/${this.config.retries})`);
        
        const startTime = Date.now();
        await suiteInstance.runTest(test);
        const duration = Date.now() - startTime;
        
        console.log(`  ✅ ${test.name} passed (${duration}ms)`);
        return {
          name: test.name,
          status: 'passed',
          duration,
          attempt
        };
      } catch (error) {
        lastError = error;
        console.log(`  ❌ ${test.name} failed (attempt ${attempt}): ${error.message}`);
        
        if (attempt < this.config.retries) {
          await this.sleep(1000 * attempt); // Progressive backoff
        }
      }
    }

    return {
      name: test.name,
      status: 'failed',
      error: {
        message: lastError.message,
        stack: lastError.stack
      },
      attempts: this.config.retries
    };
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport() {
    console.log('\n📊 Generating test reports...');
    
    const reportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      environment: await this.environment.getInfo(),
      summary: {
        success: this.results.failed === 0,
        successRate: this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0,
        totalDuration: Date.now() - this.startTime
      }
    };

    // Generate different report formats
    await this.reporter.generateJSONReport(reportData);
    await this.reporter.generateHTMLReport(reportData);
    await this.reporter.generateJUnitReport(reportData);
    
    // Generate coverage report if available
    if (this.results.coverage) {
      await this.reporter.generateCoverageReport(this.results.coverage);
    }

    console.log(`📄 Reports generated in: ${this.config.reportsDir}`);
    return reportData;
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      await this.environment.cleanup();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('⚠️ Cleanup warnings:', error.message);
    }
  }

  /**
   * Main test execution entry point
   */
  static async run(config = {}) {
    const orchestrator = new ProofVaultTestOrchestrator(config);
    orchestrator.startTime = Date.now();
    
    try {
      await orchestrator.initialize();
      const results = await orchestrator.runAllTests();
      const report = await orchestrator.generateReport();
      
      console.log('\n🎯 Test Execution Summary:');
      console.log(`Total Tests: ${results.total}`);
      console.log(`Passed: ${results.passed} ✅`);
      console.log(`Failed: ${results.failed} ❌`);
      console.log(`Skipped: ${results.skipped} ⏭️`);
      console.log(`Success Rate: ${report.summary.successRate}%`);
      console.log(`Total Duration: ${report.summary.totalDuration}ms`);
      
      if (results.failed > 0) {
        console.log('\n❌ Test failures detected:');
        results.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.suite || 'Unknown'}: ${error.message || error.error}`);
        });
        process.exit(1);
      } else {
        console.log('\n🎉 All tests passed successfully!');
        process.exit(0);
      }
    } catch (error) {
      console.error('\n💥 Test execution failed:', error.message);
      process.exit(1);
    } finally {
      await orchestrator.cleanup();
    }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProofVaultTestOrchestrator;

// If called directly, run the tests
if (require.main === module) {
  const config = process.env.E2E_CONFIG ? JSON.parse(process.env.E2E_CONFIG) : {};
  ProofVaultTestOrchestrator.run(config);
}