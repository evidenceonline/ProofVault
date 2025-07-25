#!/usr/bin/env node

/**
 * ProofVault E2E Test CLI
 * 
 * Command line interface for running ProofVault end-to-end tests
 * with various options and configurations.
 */

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');

const ProofVaultTestOrchestrator = require('./e2e/index');
const TestDataGenerator = require('./e2e/utils/testDataGenerator');
const TestEnvironment = require('./e2e/utils/testEnvironment');

const program = new Command();

program
  .name('proofvault-e2e')
  .description('ProofVault End-to-End Test Suite')
  .version('1.0.0');

// Main test command
program
  .command('test')
  .description('Run end-to-end tests')
  .option('-c, --config <path>', 'Configuration file path', './config/e2e.json')
  .option('-s, --suites <suites>', 'Test suites to run (comma-separated)', 'all')
  .option('-b, --browsers <browsers>', 'Browsers to test (comma-separated)', 'chrome')
  .option('-p, --parallel', 'Run tests in parallel')
  .option('-h, --headless', 'Run browsers in headless mode')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '300000')
  .option('-r, --retries <count>', 'Number of retries for failed tests', '3')
  .option('--ci', 'Run in CI mode with optimized settings')
  .option('--bail', 'Stop on first test failure')
  .option('--verbose', 'Verbose output')
  .option('--dry-run', 'Show what would be tested without running')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      // Override config with CLI options
      if (options.timeout) config.timeout = parseInt(options.timeout);
      if (options.retries) config.retries = parseInt(options.retries);
      if (options.parallel) config.parallel = true;
      if (options.headless) {
        config.browsers.chrome.headless = true;
        config.browsers.firefox.headless = true;
      }
      if (options.ci) {
        config.ci.enabled = true;
        config.testing.parallel = true;
        config.browsers.chrome.headless = true;
        config.reporting.includeScreenshots = false;
      }
      
      // Filter test suites
      if (options.suites !== 'all') {
        config.testSuites = options.suites.split(',').map(s => s.trim());
      }
      
      // Filter browsers
      if (options.browsers !== 'chrome') {
        config.browsers = filterBrowsers(config.browsers, options.browsers.split(','));
      }
      
      if (options.dryRun) {
        await showDryRun(config);
        return;
      }
      
      console.log(chalk.blue('🚀 Starting ProofVault E2E Tests\n'));
      
      await ProofVaultTestOrchestrator.run(config);
      
    } catch (error) {
      console.error(chalk.red('❌ Test execution failed:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Setup command
program
  .command('setup')
  .description('Setup test environment and generate test data')
  .option('-c, --config <path>', 'Configuration file path', './config/e2e.json')
  .option('--force', 'Force setup even if already configured')
  .action(async (options) => {
    const spinner = ora('Setting up test environment...').start();
    
    try {
      const config = await loadConfig(options.config);
      const environment = new TestEnvironment(config);
      
      spinner.text = 'Verifying prerequisites...';
      await environment.verifyPrerequisites();
      
      spinner.text = 'Setting up test database...';
      await environment.setupTestDatabase();
      
      spinner.text = 'Generating test data...';
      await TestDataGenerator.generateAllTestData(path.join(__dirname, 'e2e/data'));
      
      spinner.text = 'Starting services...';
      await environment.startServices();
      
      spinner.succeed(chalk.green('✅ Test environment setup complete'));
      
      console.log(chalk.cyan('\nEnvironment Details:'));
      const envInfo = await environment.getInfo();
      console.log(`  Node.js: ${envInfo.nodeVersion}`);
      console.log(`  Platform: ${envInfo.platform} (${envInfo.arch})`);
      console.log(`  Services: ${envInfo.services.join(', ')}`);
      console.log(`  Config: ${options.config}`);
      
    } catch (error) {
      spinner.fail(chalk.red('❌ Setup failed'));
      console.error(error.message);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up test environment and data')
  .option('-c, --config <path>', 'Configuration file path', './config/e2e.json')
  .option('--keep-data', 'Keep test data files')
  .action(async (options) => {
    const spinner = ora('Cleaning up test environment...').start();
    
    try {
      const config = await loadConfig(options.config);
      const environment = new TestEnvironment(config);
      
      await environment.cleanup();
      
      if (!options.keepData) {
        spinner.text = 'Removing test data...';
        await fs.rmdir(path.join(__dirname, 'e2e/data'), { recursive: true });
        await fs.rmdir(path.join(__dirname, 'e2e/reports'), { recursive: true });
      }
      
      spinner.succeed(chalk.green('✅ Cleanup complete'));
      
    } catch (error) {
      spinner.fail(chalk.red('❌ Cleanup failed'));
      console.error(error.message);
    }
  });

// Generate test data command
program
  .command('generate-data')
  .description('Generate test data without running tests')
  .option('-o, --output <path>', 'Output directory', './e2e/data')
  .option('--types <types>', 'Data types to generate (comma-separated)', 'all')
  .action(async (options) => {
    const spinner = ora('Generating test data...').start();
    
    try {
      await TestDataGenerator.generateAllTestData(options.output);
      
      spinner.succeed(chalk.green('✅ Test data generation complete'));
      console.log(chalk.cyan(`Data saved to: ${options.output}`));
      
    } catch (error) {
      spinner.fail(chalk.red('❌ Data generation failed'));
      console.error(error.message);
    }
  });

// Health check command
program
  .command('health')
  .description('Check health of test environment and services')
  .option('-c, --config <path>', 'Configuration file path', './config/e2e.json')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const environment = new TestEnvironment(config);
      
      console.log(chalk.blue('🔍 Checking environment health...\n'));
      
      const healthChecks = await environment.monitorServices();
      
      for (const check of healthChecks) {
        const status = check.status === 'healthy' ? 
          chalk.green('✅') : chalk.red('❌');
        
        console.log(`${status} ${check.service}`);
        
        if (check.responseTime) {
          console.log(`    Response time: ${check.responseTime}ms`);
        }
        
        if (check.error) {
          console.log(`    Error: ${chalk.red(check.error)}`);
        }
        
        console.log();
      }
      
      const healthyServices = healthChecks.filter(c => c.status === 'healthy').length;
      const totalServices = healthChecks.length;
      
      if (healthyServices === totalServices) {
        console.log(chalk.green(`🎉 All ${totalServices} services are healthy`));
      } else {
        console.log(chalk.yellow(`⚠️ ${healthyServices}/${totalServices} services are healthy`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Health check failed:'), error.message);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate or view test reports')
  .option('-d, --dir <path>', 'Reports directory', './e2e/reports')
  .option('-f, --format <format>', 'Report format (html|json|junit)', 'html')
  .option('-o, --open', 'Open report in browser')
  .action(async (options) => {
    try {
      const reportsDir = options.dir;
      const reportFile = `test-report.${options.format}`;
      const reportPath = path.join(reportsDir, reportFile);
      
      // Check if report exists
      try {
        await fs.access(reportPath);
      } catch (error) {
        console.error(chalk.red(`❌ Report not found: ${reportPath}`));
        console.log(chalk.cyan('💡 Run tests first to generate reports'));
        process.exit(1);
      }
      
      console.log(chalk.green(`📊 Report available at: ${reportPath}`));
      
      if (options.open && options.format === 'html') {
        const { default: open } = await import('open');
        await open(reportPath);
        console.log(chalk.blue('🌐 Report opened in browser'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Report generation failed:'), error.message);
    }
  });

// List command
program
  .command('list')
  .description('List available test suites and tests')
  .option('-c, --config <path>', 'Configuration file path', './config/e2e.json')
  .option('-s, --suite <name>', 'Show tests for specific suite')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      console.log(chalk.blue('📋 Available Test Suites:\n'));
      
      const suites = [
        { name: 'E2E Integration', description: 'Complete workflow testing' },
        { name: 'Component Integration', description: 'Inter-component communication' },
        { name: 'API Testing', description: 'Backend API endpoints' },
        { name: 'Performance Testing', description: 'Load and performance tests' },
        { name: 'Error Handling', description: 'Error scenarios and edge cases' }
      ];
      
      for (const suite of suites) {
        console.log(chalk.cyan(`📦 ${suite.name}`));
        console.log(`   ${suite.description}`);
        console.log();
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list tests:'), error.message);
    }
  });

// Config command
program
  .command('config')
  .description('Show or validate configuration')
  .option('-c, --config <path>', 'Configuration file path', './config/e2e.json')
  .option('-v, --validate', 'Validate configuration')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      
      if (options.validate) {
        console.log(chalk.blue('🔍 Validating configuration...\n'));
        
        const validation = validateConfig(config);
        
        if (validation.valid) {
          console.log(chalk.green('✅ Configuration is valid'));
        } else {
          console.log(chalk.red('❌ Configuration validation failed:'));
          for (const error of validation.errors) {
            console.log(`  - ${error}`);
          }
          process.exit(1);
        }
      } else {
        console.log(chalk.blue('⚙️ Current Configuration:\n'));
        console.log(JSON.stringify(config, null, 2));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Configuration error:'), error.message);
    }
  });

// Helper functions
async function loadConfig(configPath) {
  try {
    const fullPath = path.resolve(configPath);
    const configData = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);
  }
}

function filterBrowsers(browsers, selectedBrowsers) {
  const filtered = {};
  for (const browser of selectedBrowsers) {
    if (browsers[browser.trim()]) {
      filtered[browser.trim()] = browsers[browser.trim()];
    }
  }
  return filtered;
}

function validateConfig(config) {
  const errors = [];
  
  // Required fields
  const required = ['urls', 'timeouts', 'database'];
  for (const field of required) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // URL validation
  if (config.urls) {
    const urlFields = ['apiBaseUrl', 'frontendUrl', 'metagraphUrl'];
    for (const field of urlFields) {
      if (config.urls[field] && !isValidUrl(config.urls[field])) {
        errors.push(`Invalid URL for ${field}: ${config.urls[field]}`);
      }
    }
  }
  
  // Timeout validation
  if (config.timeouts) {
    for (const [key, value] of Object.entries(config.timeouts)) {
      if (typeof value !== 'number' || value <= 0) {
        errors.push(`Invalid timeout for ${key}: ${value}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function showDryRun(config) {
  console.log(chalk.blue('🔍 Test Execution Plan (Dry Run)\n'));
  
  console.log(chalk.cyan('Configuration:'));
  console.log(`  API Base URL: ${config.urls.apiBaseUrl}`);
  console.log(`  Frontend URL: ${config.urls.frontendUrl}`);
  console.log(`  Metagraph URL: ${config.urls.metagraphUrl}`);
  console.log(`  Timeout: ${config.timeout || config.timeouts.default}ms`);
  console.log(`  Retries: ${config.retries || config.retries.default}`);
  console.log(`  Parallel: ${config.parallel ? 'Yes' : 'No'}`);
  console.log();
  
  console.log(chalk.cyan('Test Suites to Run:'));
  const suites = config.testSuites || ['e2e', 'component', 'api', 'performance', 'errors'];
  for (const suite of suites) {
    console.log(`  ✓ ${suite}`);
  }
  console.log();
  
  console.log(chalk.cyan('Browsers:'));
  for (const [browser, browserConfig] of Object.entries(config.browsers)) {
    if (browserConfig.enabled !== false) {
      console.log(`  ✓ ${browser} (headless: ${browserConfig.headless ? 'Yes' : 'No'})`);
    }
  }
  console.log();
  
  console.log(chalk.green('📊 Estimated execution time: 15-30 minutes'));
  console.log(chalk.blue('💡 Run without --dry-run to execute tests'));
}

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}