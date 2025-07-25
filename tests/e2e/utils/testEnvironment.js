/**
 * Test Environment Manager
 * 
 * Manages the test environment setup, configuration, and cleanup
 * for ProofVault E2E tests.
 */

const { spawn, execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class TestEnvironment {
  constructor(config) {
    this.config = config;
    this.services = new Map();
    this.cleanup = [];
    this.isSetup = false;
  }

  /**
   * Setup the complete test environment
   */
  async setup() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Verify prerequisites
      await this.verifyPrerequisites();
      
      // Setup test database
      await this.setupTestDatabase();
      
      // Start required services
      await this.startServices();
      
      // Wait for services to be ready
      await this.waitForServices();
      
      // Setup test data
      await this.setupTestData();
      
      this.isSetup = true;
      console.log('✅ Test environment ready');
    } catch (error) {
      console.error('❌ Test environment setup failed:', error.message);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Verify system prerequisites
   */
  async verifyPrerequisites() {
    console.log('🔍 Verifying prerequisites...');
    
    const requirements = [
      { command: 'node --version', name: 'Node.js' },
      { command: 'npm --version', name: 'npm' },
      { command: 'docker --version', name: 'Docker' },
      { command: 'psql --version', name: 'PostgreSQL client' }
    ];

    for (const req of requirements) {
      try {
        execSync(req.command, { stdio: 'pipe' });
        console.log(`  ✅ ${req.name} is available`);
      } catch (error) {
        throw new Error(`${req.name} is not available or not in PATH`);
      }
    }
  }

  /**
   * Setup test database
   */
  async setupTestDatabase() {
    console.log('🗄️ Setting up test database...');
    
    try {
      // Create test database if it doesn't exist
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'postgres', // Connect to default database first
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password'
      };

      // Try to create test database
      const createDbCommand = `PGPASSWORD=${dbConfig.password} createdb -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} proofvault_test 2>/dev/null || true`;
      execSync(createDbCommand, { stdio: 'pipe' });
      
      // Run migrations
      const migrationCommand = `cd ${path.join(__dirname, '../../../database')} && npm run migrate`;
      execSync(migrationCommand, { stdio: 'pipe' });
      
      console.log('  ✅ Test database ready');
    } catch (error) {
      console.warn('  ⚠️ Database setup failed, continuing with existing database');
    }
  }

  /**
   * Start required services
   */
  async startServices() {
    console.log('🚀 Starting services...');
    
    // Start backend API if not running
    if (!(await this.isServiceRunning(this.config.apiBaseUrl + '/health'))) {
      await this.startBackendAPI();
    }
    
    // Start frontend if not running
    if (!(await this.isServiceRunning(this.config.frontendUrl))) {
      await this.startFrontend();
    }
    
    // Start metagraph if not running
    if (!(await this.isServiceRunning(this.config.metagraphUrl + '/cluster/info'))) {
      await this.startMetagraph();
    }
  }

  /**
   * Check if a service is running
   */
  async isServiceRunning(url) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start backend API service
   */
  async startBackendAPI() {
    console.log('  📡 Starting backend API...');
    
    const apiProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../../../backend-api'),
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3001'
      }
    });

    this.services.set('backend-api', apiProcess);
    
    // Add to cleanup
    this.cleanup.push(() => {
      if (apiProcess.pid) {
        process.kill(apiProcess.pid, 'SIGTERM');
      }
    });

    // Wait a moment for startup
    await this.sleep(5000);
  }

  /**
   * Start frontend service
   */
  async startFrontend() {
    console.log('  🖥️ Starting frontend...');
    
    const frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../../../frontend'),
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    this.services.set('frontend', frontendProcess);
    
    // Add to cleanup
    this.cleanup.push(() => {
      if (frontendProcess.pid) {
        process.kill(frontendProcess.pid, 'SIGTERM');
      }
    });

    // Wait a moment for startup
    await this.sleep(5000);
  }

  /**
   * Start metagraph service
   */
  async startMetagraph() {
    console.log('  ⛓️ Starting metagraph...');
    
    try {
      // Use hydra script to start metagraph
      const hydraProcess = spawn('./hydra', ['start-genesis'], {
        cwd: path.join(__dirname, '../../../scripts'),
        stdio: 'pipe'
      });

      this.services.set('metagraph', hydraProcess);
      
      // Add to cleanup
      this.cleanup.push(() => {
        execSync('./hydra stop', {
          cwd: path.join(__dirname, '../../../scripts'),
          stdio: 'pipe'
        });
      });

      // Wait for metagraph to start
      await this.sleep(30000); // Metagraph takes longer to start
    } catch (error) {
      console.warn('  ⚠️ Metagraph startup failed, tests may be limited');
    }
  }

  /**
   * Wait for all services to be ready
   */
  async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');
    
    const services = [
      { name: 'Backend API', url: this.config.apiBaseUrl + '/health' },
      { name: 'Frontend', url: this.config.frontendUrl }
    ];

    // Add metagraph if configured
    if (this.config.metagraphUrl) {
      services.push({ name: 'Metagraph', url: this.config.metagraphUrl + '/cluster/info' });
    }

    for (const service of services) {
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        try {
          const response = await axios.get(service.url, { timeout: 5000 });
          if (response.status === 200) {
            console.log(`  ✅ ${service.name} is ready`);
            break;
          }
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`${service.name} failed to start after ${maxAttempts} attempts`);
          }
          await this.sleep(2000);
        }
      }
    }
  }

  /**
   * Setup test data
   */
  async setupTestData() {
    console.log('📊 Setting up test data...');
    
    try {
      // Create test user
      await axios.post(`${this.config.apiBaseUrl}/api/auth/register`, {
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpassword'
      });
      
      console.log('  ✅ Test data ready');
    } catch (error) {
      // User might already exist
      console.log('  ℹ️ Test data already exists or creation failed');
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Run all cleanup functions
    for (const cleanupFn of this.cleanup) {
      try {
        await cleanupFn();
      } catch (error) {
        console.warn('⚠️ Cleanup warning:', error.message);
      }
    }
    
    // Stop all services
    for (const [name, process] of this.services) {
      try {
        if (process.pid) {
          process.kill('SIGTERM');
          console.log(`  ✅ Stopped ${name}`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to stop ${name}:`, error.message);
      }
    }
    
    // Clean up test database
    await this.cleanupTestDatabase();
    
    console.log('✅ Cleanup complete');
  }

  /**
   * Cleanup test database
   */
  async cleanupTestDatabase() {
    try {
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password'
      };

      // Drop test database
      const dropDbCommand = `PGPASSWORD=${dbConfig.password} dropdb -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} proofvault_test --if-exists 2>/dev/null || true`;
      execSync(dropDbCommand, { stdio: 'pipe' });
      
      console.log('  ✅ Test database cleaned up');
    } catch (error) {
      console.warn('  ⚠️ Database cleanup warning:', error.message);
    }
  }

  /**
   * Get environment information
   */
  async getInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      config: this.config,
      services: Array.from(this.services.keys()),
      isSetup: this.isSetup,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset test environment to clean state
   */
  async reset() {
    console.log('🔄 Resetting test environment...');
    
    // Clear test data
    try {
      await axios.delete(`${this.config.apiBaseUrl}/api/test/cleanup`);
    } catch (error) {
      // Endpoint might not exist
    }
    
    // Reset database to clean state
    try {
      const migrationCommand = `cd ${path.join(__dirname, '../../../database')} && npm run migrate:reset`;
      execSync(migrationCommand, { stdio: 'pipe' });
    } catch (error) {
      console.warn('⚠️ Database reset warning:', error.message);
    }
    
    console.log('✅ Environment reset complete');
  }

  /**
   * Take environment snapshot for debugging
   */
  async takeSnapshot() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      environment: await this.getInfo(),
      services: {},
      logs: {}
    };

    // Get service status
    for (const [name, process] of this.services) {
      snapshot.services[name] = {
        pid: process.pid,
        killed: process.killed,
        exitCode: process.exitCode
      };
    }

    // Get recent logs (if available)
    try {
      const logsDir = path.join(__dirname, '../../../backend-api/logs');
      const logFiles = await fs.readdir(logsDir);
      
      for (const logFile of logFiles.slice(-3)) { // Last 3 log files
        const logPath = path.join(logsDir, logFile);
        const logContent = await fs.readFile(logPath, 'utf8');
        snapshot.logs[logFile] = logContent.split('\n').slice(-100).join('\n'); // Last 100 lines
      }
    } catch (error) {
      snapshot.logs.error = 'Could not read log files';
    }

    return snapshot;
  }

  /**
   * Monitor services health
   */
  async monitorServices() {
    const healthChecks = [];
    
    const services = [
      { name: 'Backend API', url: this.config.apiBaseUrl + '/health' },
      { name: 'Frontend', url: this.config.frontendUrl },
      { name: 'Metagraph', url: this.config.metagraphUrl + '/cluster/info' }
    ];

    for (const service of services) {
      try {
        const start = Date.now();
        const response = await axios.get(service.url, { timeout: 5000 });
        const responseTime = Date.now() - start;
        
        healthChecks.push({
          service: service.name,
          status: 'healthy',
          responseTime,
          statusCode: response.status
        });
      } catch (error) {
        healthChecks.push({
          service: service.name,
          status: 'unhealthy',
          error: error.message,
          statusCode: error.response?.status
        });
      }
    }

    return healthChecks;
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TestEnvironment;