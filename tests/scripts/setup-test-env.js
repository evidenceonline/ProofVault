#!/usr/bin/env node

/**
 * Test Environment Setup Script
 * 
 * Automated setup of the ProofVault E2E test environment.
 * Prepares all necessary services, databases, and test data.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class TestEnvironmentSetup {
  constructor() {
    this.services = new Map();
    this.setupComplete = false;
  }

  async run() {
    console.log('🚀 Setting up ProofVault E2E Test Environment\n');
    
    try {
      await this.checkPrerequisites();
      await this.setupDatabase();
      await this.installDependencies();
      await this.generateTestData();
      await this.startServices();
      await this.verifyServices();
      await this.finalizeSetup();
      
      console.log('\n✅ Test environment setup complete!');
      console.log('\nYou can now run tests with:');
      console.log('  npm test');
      console.log('  ./cli.js test');
      console.log('  ./cli.js health  # Check service health');
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    const requirements = [
      { command: 'node --version', name: 'Node.js', minVersion: 'v18' },
      { command: 'npm --version', name: 'npm', minVersion: '8' },
      { command: 'docker --version', name: 'Docker' },
      { command: 'psql --version', name: 'PostgreSQL' }
    ];

    for (const req of requirements) {
      try {
        const output = execSync(req.command, { encoding: 'utf8' });
        console.log(`  ✅ ${req.name}: ${output.trim()}`);
        
        if (req.minVersion) {
          const version = output.match(/v?(\d+)/)?.[1];
          const minVersion = req.minVersion.match(/v?(\d+)/)?.[1];
          if (version && minVersion && parseInt(version) < parseInt(minVersion)) {
            throw new Error(`${req.name} version ${version} is below minimum ${minVersion}`);
          }
        }
      } catch (error) {
        throw new Error(`${req.name} is not available: ${error.message}`);
      }
    }
  }

  async setupDatabase() {
    console.log('\n🗄️ Setting up test database...');
    
    try {
      // Create test database
      console.log('  Creating test database...');
      execSync('createdb proofvault_test 2>/dev/null || true', { stdio: 'pipe' });
      
      // Run migrations
      console.log('  Running database migrations...');
      const dbDir = path.join(__dirname, '../../database');
      execSync('npm run migrate', { cwd: dbDir, stdio: 'pipe' });
      
      // Seed test data
      console.log('  Seeding test data...');
      execSync('npm run seed', { cwd: dbDir, stdio: 'pipe' });
      
      console.log('  ✅ Database setup complete');
    } catch (error) {
      throw new Error(`Database setup failed: ${error.message}`);
    }
  }

  async installDependencies() {
    console.log('\n📦 Installing dependencies...');
    
    const components = [
      { name: 'Backend API', dir: '../../backend-api' },
      { name: 'Frontend', dir: '../../frontend' },
      { name: 'Chrome Extension', dir: '../../chrome-extension' },
      { name: 'Database', dir: '../../database' },
      { name: 'Test Suite', dir: '..' }
    ];

    for (const component of components) {
      try {
        console.log(`  Installing ${component.name} dependencies...`);
        const componentDir = path.join(__dirname, component.dir);
        execSync('npm install', { cwd: componentDir, stdio: 'pipe' });
        console.log(`  ✅ ${component.name} dependencies installed`);
      } catch (error) {
        console.warn(`  ⚠️ ${component.name} dependency installation failed: ${error.message}`);
      }
    }
  }

  async generateTestData() {
    console.log('\n📊 Generating test data...');
    
    try {
      const TestDataGenerator = require('../e2e/utils/testDataGenerator');
      const dataDir = path.join(__dirname, '../e2e/data');
      
      await TestDataGenerator.generateAllTestData(dataDir);
      
      console.log('  ✅ Test data generation complete');
    } catch (error) {
      throw new Error(`Test data generation failed: ${error.message}`);
    }
  }

  async startServices() {
    console.log('\n🚀 Starting services...');
    
    // Start services in the correct order
    await this.startService('Backend API', '../../backend-api', 'npm run dev', 3001);
    await this.startService('Frontend', '../../frontend', 'npm run dev', 3000);
    await this.startMetagraph();
  }

  async startService(name, dir, command, port) {
    console.log(`  Starting ${name}...`);
    
    try {
      // Check if service is already running
      try {
        await axios.get(`http://localhost:${port}`, { timeout: 2000 });
        console.log(`  ✅ ${name} already running on port ${port}`);
        return;
      } catch (error) {
        // Service not running, start it
      }
      
      const serviceDir = path.join(__dirname, dir);
      const [cmd, ...args] = command.split(' ');
      
      const process = spawn(cmd, args, {
        cwd: serviceDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });
      
      this.services.set(name, process);
      
      // Wait for service to start
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        try {
          await axios.get(`http://localhost:${port}`, { timeout: 2000 });
          console.log(`  ✅ ${name} started on port ${port}`);
          return;
        } catch (error) {
          attempts++;
          await this.sleep(2000);
        }
      }
      
      throw new Error(`${name} failed to start after ${maxAttempts} attempts`);
      
    } catch (error) {
      throw new Error(`Failed to start ${name}: ${error.message}`);
    }
  }

  async startMetagraph() {
    console.log('  Starting metagraph...');
    
    try {
      // Check if metagraph is already running
      try {
        await axios.get('http://localhost:9000/cluster/info', { timeout: 5000 });
        console.log('  ✅ Metagraph already running');
        return;
      } catch (error) {
        // Metagraph not running, start it
      }
      
      const hydraScript = path.join(__dirname, '../../scripts/hydra');
      
      // Build if needed
      execSync(`${hydraScript} build`, { stdio: 'pipe' });
      
      // Start from genesis
      const process = spawn(hydraScript, ['start-genesis'], {
        cwd: path.join(__dirname, '../../scripts'),
        stdio: 'pipe'
      });
      
      this.services.set('Metagraph', process);
      
      // Wait for metagraph to start (takes longer)
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        try {
          await axios.get('http://localhost:9000/cluster/info', { timeout: 5000 });
          console.log('  ✅ Metagraph started');
          return;
        } catch (error) {
          attempts++;
          await this.sleep(5000);
        }
      }
      
      console.log('  ⚠️ Metagraph startup timeout - some tests may fail');
      
    } catch (error) {
      console.warn(`  ⚠️ Metagraph startup failed: ${error.message}`);
    }
  }

  async verifyServices() {
    console.log('\n🔍 Verifying services...');
    
    const services = [
      { name: 'Backend API', url: 'http://localhost:3001/api/health' },
      { name: 'Frontend', url: 'http://localhost:3000' },
      { name: 'Metagraph', url: 'http://localhost:9000/cluster/info' }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(service.url, { timeout: 10000 });
        console.log(`  ✅ ${service.name} is responsive (${response.status})`);
      } catch (error) {
        console.warn(`  ⚠️ ${service.name} verification failed: ${error.message}`);
      }
    }
  }

  async finalizeSetup() {
    console.log('\n🎯 Finalizing setup...');
    
    // Create test reports directory
    const reportsDir = path.join(__dirname, '../e2e/reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Create logs directory
    const logsDir = path.join(__dirname, '../e2e/logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    // Save service information
    const serviceInfo = {
      setupTime: new Date().toISOString(),
      services: Array.from(this.services.keys()),
      serviceDetails: {
        backendAPI: 'http://localhost:3001',
        frontend: 'http://localhost:3000',
        metagraph: 'http://localhost:9000',
        database: 'postgresql://localhost:5432/proofvault_test'
      }
    };
    
    await fs.writeFile(
      path.join(__dirname, '../e2e/service-info.json'),
      JSON.stringify(serviceInfo, null, 2)
    );
    
    this.setupComplete = true;
    console.log('  ✅ Setup finalized');
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    for (const [name, process] of this.services) {
      try {
        if (process.pid) {
          process.kill('SIGTERM');
          console.log(`  ✅ Stopped ${name}`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to stop ${name}: ${error.message}`);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Interrupt received, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Termination received, cleaning up...');
  process.exit(0);
});

// Run setup if called directly
if (require.main === module) {
  const setup = new TestEnvironmentSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = TestEnvironmentSetup;