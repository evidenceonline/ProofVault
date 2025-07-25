#!/usr/bin/env node

/**
 * Test Environment Cleanup Script
 * 
 * Cleans up the ProofVault E2E test environment.
 * Stops services, cleans databases, and removes test data.
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class TestEnvironmentCleanup {
  constructor(options = {}) {
    this.options = {
      keepData: false,
      keepLogs: false,
      keepReports: false,
      ...options
    };
  }

  async run() {
    console.log('🧹 Cleaning up ProofVault E2E Test Environment\n');
    
    try {
      await this.stopServices();
      await this.cleanDatabase();
      await this.cleanTestData();
      await this.cleanLogs();
      await this.cleanReports();
      await this.cleanupDirectories();
      
      console.log('\n✅ Test environment cleanup complete!');
      
    } catch (error) {
      console.error('\n❌ Cleanup failed:', error.message);
      process.exit(1);
    }
  }

  async stopServices() {
    console.log('🛑 Stopping services...');
    
    // Stop individual services
    await this.stopService('Backend API', 3001);
    await this.stopService('Frontend', 3000);
    await this.stopMetagraph();
    
    // Kill any remaining Node.js processes on test ports
    await this.killProcessesOnPorts([3000, 3001, 9000, 9001, 9002, 9003]);
  }

  async stopService(name, port) {
    try {
      console.log(`  Stopping ${name} on port ${port}...`);
      
      // Find and kill processes on the port
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
        if (pid) {
          execSync(`kill -TERM ${pid}`, { stdio: 'pipe' });
          console.log(`  ✅ Stopped ${name} (PID: ${pid})`);
        } else {
          console.log(`  ℹ️ ${name} not running`);
        }
      } catch (error) {
        console.log(`  ℹ️ ${name} not running or already stopped`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Failed to stop ${name}: ${error.message}`);
    }
  }

  async stopMetagraph() {
    console.log('  Stopping metagraph...');
    
    try {
      const hydraScript = path.join(__dirname, '../../scripts/hydra');
      execSync(`${hydraScript} stop`, { 
        cwd: path.join(__dirname, '../../scripts'),
        stdio: 'pipe' 
      });
      console.log('  ✅ Metagraph stopped');
    } catch (error) {
      console.warn(`  ⚠️ Metagraph stop failed: ${error.message}`);
    }

    // Also try to destroy containers
    try {
      execSync(`${hydraScript} destroy`, {
        cwd: path.join(__dirname, '../../scripts'),
        stdio: 'pipe'
      });
      console.log('  ✅ Metagraph containers destroyed');
    } catch (error) {
      console.warn(`  ⚠️ Container cleanup failed: ${error.message}`);
    }
  }

  async killProcessesOnPorts(ports) {
    for (const port of ports) {
      try {
        const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
        if (pids) {
          for (const pid of pids.split('\n')) {
            if (pid.trim()) {
              execSync(`kill -9 ${pid.trim()}`, { stdio: 'pipe' });
            }
          }
        }
      } catch (error) {
        // Port not in use, which is fine
      }
    }
  }

  async cleanDatabase() {
    console.log('\n🗄️ Cleaning database...');
    
    try {
      // Drop test database
      console.log('  Dropping test database...');
      execSync('dropdb proofvault_test --if-exists', { stdio: 'pipe' });
      console.log('  ✅ Test database dropped');
      
      // Also clean any test tables in main database if they exist
      try {
        const dbDir = path.join(__dirname, '../../database');
        execSync('npm run cleanup-test-data', { 
          cwd: dbDir, 
          stdio: 'pipe' 
        });
        console.log('  ✅ Test data cleaned from main database');
      } catch (error) {
        // Cleanup script might not exist, which is fine
        console.log('  ℹ️ No additional database cleanup needed');
      }
      
    } catch (error) {
      console.warn(`  ⚠️ Database cleanup failed: ${error.message}`);
    }
  }

  async cleanTestData() {
    if (this.options.keepData) {
      console.log('\n📊 Keeping test data (--keep-data flag)');
      return;
    }

    console.log('\n📊 Cleaning test data...');
    
    try {
      const dataDir = path.join(__dirname, '../e2e/data');
      
      if (await this.directoryExists(dataDir)) {
        await fs.rmdir(dataDir, { recursive: true });
        console.log('  ✅ Test data directory removed');
      } else {
        console.log('  ℹ️ Test data directory not found');
      }
      
      // Clean uploaded files
      const uploadsDir = path.join(__dirname, '../../backend-api/uploads');
      if (await this.directoryExists(uploadsDir)) {
        const files = await fs.readdir(uploadsDir);
        for (const file of files) {
          if (file.startsWith('test-') || file.includes('test')) {
            await fs.unlink(path.join(uploadsDir, file));
          }
        }
        console.log('  ✅ Test upload files cleaned');
      }
      
    } catch (error) {
      console.warn(`  ⚠️ Test data cleanup failed: ${error.message}`);
    }
  }

  async cleanLogs() {
    if (this.options.keepLogs) {
      console.log('\n📋 Keeping log files (--keep-logs flag)');
      return;
    }

    console.log('\n📋 Cleaning logs...');
    
    try {
      const logsDir = path.join(__dirname, '../e2e/logs');
      
      if (await this.directoryExists(logsDir)) {
        const files = await fs.readdir(logsDir);
        for (const file of files) {
          await fs.unlink(path.join(logsDir, file));
        }
        console.log('  ✅ Test logs cleaned');
      }
      
      // Clean backend logs
      const backendLogsDir = path.join(__dirname, '../../backend-api/logs');
      if (await this.directoryExists(backendLogsDir)) {
        const files = await fs.readdir(backendLogsDir);
        for (const file of files) {
          if (file.includes('test') || file.includes('e2e')) {
            await fs.unlink(path.join(backendLogsDir, file));
          }
        }
        console.log('  ✅ Backend test logs cleaned');
      }
      
    } catch (error) {
      console.warn(`  ⚠️ Log cleanup failed: ${error.message}`);
    }
  }

  async cleanReports() {
    if (this.options.keepReports) {
      console.log('\n📊 Keeping test reports (--keep-reports flag)');
      return;
    }

    console.log('\n📊 Cleaning reports...');
    
    try {
      const reportsDir = path.join(__dirname, '../e2e/reports');
      
      if (await this.directoryExists(reportsDir)) {
        await fs.rmdir(reportsDir, { recursive: true });
        console.log('  ✅ Test reports cleaned');
      } else {
        console.log('  ℹ️ Reports directory not found');
      }
      
    } catch (error) {
      console.warn(`  ⚠️ Reports cleanup failed: ${error.message}`);
    }
  }

  async cleanupDirectories() {
    console.log('\n📁 Cleaning up directories...');
    
    try {
      // Remove service info file
      const serviceInfoPath = path.join(__dirname, '../e2e/service-info.json');
      try {
        await fs.unlink(serviceInfoPath);
        console.log('  ✅ Service info file removed');
      } catch (error) {
        // File might not exist
      }
      
      // Clean any temporary files
      const tempDirs = [
        path.join(__dirname, '../e2e/screenshots'),
        path.join(__dirname, '../e2e/videos'),
        path.join(__dirname, '../temp')
      ];
      
      for (const dir of tempDirs) {
        if (await this.directoryExists(dir)) {
          await fs.rmdir(dir, { recursive: true });
          console.log(`  ✅ Cleaned ${path.basename(dir)} directory`);
        }
      }
      
      // Clean node_modules/.cache if it exists
      const cacheDir = path.join(__dirname, '../node_modules/.cache');
      if (await this.directoryExists(cacheDir)) {
        await fs.rmdir(cacheDir, { recursive: true });
        console.log('  ✅ Node modules cache cleaned');
      }
      
    } catch (error) {
      console.warn(`  ⚠️ Directory cleanup failed: ${error.message}`);
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const options = {
  keepData: args.includes('--keep-data'),
  keepLogs: args.includes('--keep-logs'),
  keepReports: args.includes('--keep-reports')
};

// Run cleanup if called directly
if (require.main === module) {
  const cleanup = new TestEnvironmentCleanup(options);
  cleanup.run().catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
}

module.exports = TestEnvironmentCleanup;