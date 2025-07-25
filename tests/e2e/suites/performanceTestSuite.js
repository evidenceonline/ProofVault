/**
 * Performance Test Suite
 * 
 * Comprehensive performance and load testing for ProofVault:
 * - Concurrent PDF registration testing
 * - Database performance under load
 * - Blockchain transaction processing scalability
 * - WebSocket connection handling
 * - Memory and CPU usage monitoring
 * - Response time benchmarking
 */

const axios = require('axios');
const WebSocket = require('ws');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const { performance } = require('perf_hooks');

class PerformanceTestSuite {
  constructor(config) {
    this.config = config;
    this.metrics = {
      responseTime: [],
      throughput: [],
      errorRate: [],
      memoryUsage: [],
      cpuUsage: [],
      concurrentConnections: []
    };
    this.startTime = 0;
    this.endTime = 0;
  }

  async setup() {
    console.log('🔧 Setting up performance test environment...');
    
    // Warm up the system
    await this.warmupSystem();
    
    // Baseline measurements
    await this.takeBaselineMeasurements();
    
    console.log('✅ Performance test environment ready');
  }

  async teardown() {
    // Generate performance report
    await this.generatePerformanceReport();
  }

  async warmupSystem() {
    console.log('🔥 Warming up system...');
    
    // Make a few API calls to warm up the system
    const warmupRequests = Array.from({ length: 10 }, () =>
      axios.get(`${this.config.apiBaseUrl}/api/health`).catch(() => {})
    );
    
    await Promise.all(warmupRequests);
    
    // Wait for system to stabilize
    await this.sleep(5000);
  }

  async takeBaselineMeasurements() {
    console.log('📏 Taking baseline measurements...');
    
    this.baseline = {
      memory: process.memoryUsage(),
      cpu: await this.getCPUUsage(),
      responseTime: await this.measureBaselineResponseTime(),
      timestamp: Date.now()
    };
    
    console.log('📊 Baseline:', this.baseline);
  }

  async measureBaselineResponseTime() {
    const start = performance.now();
    await axios.get(`${this.config.apiBaseUrl}/api/health`);
    const end = performance.now();
    return end - start;
  }

  async getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length,
      usage: 100 - (100 * totalIdle / totalTick)
    };
  }

  async getTests() {
    return [
      {
        name: 'Concurrent PDF Registrations',
        description: 'Test system performance with concurrent PDF registrations',
        concurrency: [1, 10, 50, 100]
      },
      {
        name: 'Database Performance Under Load',
        description: 'Test database operations under high concurrent load',
        concurrency: [10, 50, 100, 200]
      },
      {
        name: 'API Response Time Benchmarking',
        description: 'Measure API response times under various loads',
        endpoints: ['health', 'documents', 'evidence', 'network']
      },
      {
        name: 'WebSocket Connection Scaling',
        description: 'Test WebSocket server with many concurrent connections',
        connections: [10, 50, 100, 500, 1000]
      },
      {
        name: 'Memory Usage Under Load',
        description: 'Monitor memory usage during high-load operations',
        duration: 300000 // 5 minutes
      },
      {
        name: 'Blockchain Transaction Throughput',
        description: 'Test maximum blockchain transaction processing rate',
        duration: 180000 // 3 minutes
      },
      {
        name: 'System Recovery After Load',
        description: 'Test system recovery and stability after high load',
        recoveryTime: 120000 // 2 minutes
      }
    ];
  }

  async runTest(test) {
    console.log(`🚀 Running performance test: ${test.name}`);
    this.startTime = Date.now();
    
    switch (test.name) {
      case 'Concurrent PDF Registrations':
        return await this.testConcurrentPDFRegistrations(test);
      case 'Database Performance Under Load':
        return await this.testDatabasePerformance(test);
      case 'API Response Time Benchmarking':
        return await this.testAPIResponseTimes(test);
      case 'WebSocket Connection Scaling':
        return await this.testWebSocketScaling(test);
      case 'Memory Usage Under Load':
        return await this.testMemoryUsage(test);
      case 'Blockchain Transaction Throughput':
        return await this.testBlockchainThroughput(test);
      case 'System Recovery After Load':
        return await this.testSystemRecovery(test);
      default:
        throw new Error(`Unknown performance test: ${test.name}`);
    }
  }

  /**
   * Test concurrent PDF registrations
   */
  async testConcurrentPDFRegistrations(test) {
    const results = {};
    
    for (const concurrency of test.concurrency) {
      console.log(`📈 Testing with ${concurrency} concurrent registrations...`);
      
      const startTime = performance.now();
      const workers = [];
      const results_batch = [];
      
      // Create worker promises for concurrent execution
      for (let i = 0; i < concurrency; i++) {
        workers.push(this.createPDFRegistrationWorker(i));
      }
      
      const workerResults = await Promise.allSettled(workers);
      const endTime = performance.now();
      
      const successful = workerResults.filter(r => r.status === 'fulfilled').length;
      const failed = workerResults.filter(r => r.status === 'rejected').length;
      const totalTime = endTime - startTime;
      const throughput = (successful / totalTime) * 1000; // requests per second
      
      results[`${concurrency}_concurrent`] = {
        concurrency,
        successful,
        failed,
        totalTime,
        throughput,
        successRate: (successful / concurrency) * 100,
        averageResponseTime: this.calculateAverageResponseTime(workerResults)
      };
      
      console.log(`✅ ${concurrency} concurrent: ${successful}/${concurrency} successful (${throughput.toFixed(2)} req/s)`);
      
      // Cool down between test runs
      await this.sleep(10000);
    }
    
    return results;
  }

  async createPDFRegistrationWorker(workerId) {
    const testData = this.generateTestData(workerId);
    const start = performance.now();
    
    try {
      const response = await axios.post(
        `${this.config.apiBaseUrl}/api/pdf/register`,
        {
          hash: testData.hash,
          metadata: testData.metadata,
          signature: testData.signature
        },
        { timeout: 30000 }
      );
      
      const end = performance.now();
      return {
        workerId,
        success: true,
        responseTime: end - start,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      const end = performance.now();
      return {
        workerId,
        success: false,
        responseTime: end - start,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Test database performance under load
   */
  async testDatabasePerformance(test) {
    const results = {};
    
    for (const concurrency of test.concurrency) {
      console.log(`🗄️ Testing database with ${concurrency} concurrent operations...`);
      
      const operations = [
        'CREATE', 'READ', 'UPDATE', 'SEARCH'
      ];
      
      const operationResults = {};
      
      for (const operation of operations) {
        const startTime = performance.now();
        const workers = [];
        
        for (let i = 0; i < concurrency; i++) {
          workers.push(this.createDatabaseOperationWorker(operation, i));
        }
        
        const workerResults = await Promise.allSettled(workers);
        const endTime = performance.now();
        
        const successful = workerResults.filter(r => r.status === 'fulfilled').length;
        const totalTime = endTime - startTime;
        
        operationResults[operation] = {
          successful,
          failed: concurrency - successful,
          totalTime,
          throughput: (successful / totalTime) * 1000,
          averageResponseTime: this.calculateAverageResponseTime(workerResults)
        };
      }
      
      results[`${concurrency}_concurrent`] = operationResults;
      
      // Cool down
      await this.sleep(5000);
    }
    
    return results;
  }

  async createDatabaseOperationWorker(operation, workerId) {
    const testData = this.generateTestData(workerId);
    const start = performance.now();
    
    try {
      let response;
      
      switch (operation) {
        case 'CREATE':
          response = await axios.post(`${this.config.apiBaseUrl}/api/documents`, {
            hash: testData.hash,
            originalUrl: testData.metadata.originalUrl,
            documentTitle: testData.metadata.title
          });
          break;
        case 'READ':
          response = await axios.get(`${this.config.apiBaseUrl}/api/documents/search?limit=10`);
          break;
        case 'UPDATE':
          // First create, then update
          const createResp = await axios.post(`${this.config.apiBaseUrl}/api/documents`, {
            hash: testData.hash,
            originalUrl: testData.metadata.originalUrl,
            documentTitle: testData.metadata.title
          });
          response = await axios.patch(`${this.config.apiBaseUrl}/api/documents/${createResp.data.id}`, {
            status: 'updated'
          });
          break;
        case 'SEARCH':
          response = await axios.get(`${this.config.apiBaseUrl}/api/documents/search?q=${testData.hash.substring(0, 8)}`);
          break;
      }
      
      const end = performance.now();
      return {
        operation,
        workerId,
        success: true,
        responseTime: end - start,
        status: response.status
      };
    } catch (error) {
      const end = performance.now();
      return {
        operation,
        workerId,
        success: false,
        responseTime: end - start,
        error: error.message
      };
    }
  }

  /**
   * Test API response times
   */
  async testAPIResponseTimes(test) {
    const results = {};
    
    for (const endpoint of test.endpoints) {
      console.log(`⚡ Benchmarking ${endpoint} endpoint...`);
      
      const measurements = [];
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        try {
          await this.makeEndpointRequest(endpoint);
          const end = performance.now();
          measurements.push(end - start);
        } catch (error) {
          // Record failed requests as maximum time
          measurements.push(30000);
        }
        
        // Small delay between requests
        await this.sleep(50);
      }
      
      results[endpoint] = {
        iterations,
        min: Math.min(...measurements),
        max: Math.max(...measurements),
        average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
        median: this.calculateMedian(measurements),
        p95: this.calculatePercentile(measurements, 95),
        p99: this.calculatePercentile(measurements, 99)
      };
      
      console.log(`📊 ${endpoint}: avg ${results[endpoint].average.toFixed(2)}ms, p95 ${results[endpoint].p95.toFixed(2)}ms`);
    }
    
    return results;
  }

  async makeEndpointRequest(endpoint) {
    const endpoints = {
      health: '/api/health',
      documents: '/api/documents/search?limit=10',
      evidence: '/api/stats/system',
      network: '/api/network/status'
    };
    
    const url = endpoints[endpoint];
    if (!url) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    
    return await axios.get(`${this.config.apiBaseUrl}${url}`);
  }

  /**
   * Test WebSocket connection scaling
   */
  async testWebSocketScaling(test) {
    const results = {};
    
    for (const connectionCount of test.connections) {
      console.log(`🔌 Testing with ${connectionCount} WebSocket connections...`);
      
      const connections = [];
      const startTime = performance.now();
      
      try {
        // Create connections
        for (let i = 0; i < connectionCount; i++) {
          const ws = new WebSocket(this.config.wsUrl);
          connections.push(ws);
          
          // Small delay to avoid overwhelming the server
          if (i % 10 === 0) {
            await this.sleep(100);
          }
        }
        
        // Wait for all connections to establish
        await Promise.all(connections.map(ws => this.waitForWebSocketConnection(ws)));
        
        const connectionTime = performance.now() - startTime;
        
        // Test message broadcasting
        const messageTest = await this.testWebSocketMessageBroadcast(connections);
        
        // Test connection stability
        await this.sleep(10000); // Keep connections open for 10 seconds
        
        const activeConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN).length;
        
        results[`${connectionCount}_connections`] = {
          requested: connectionCount,
          established: activeConnections,
          connectionTime,
          establishmentRate: (activeConnections / connectionCount) * 100,
          messageDelivery: messageTest,
          memoryUsage: process.memoryUsage()
        };
        
        console.log(`✅ ${connectionCount} connections: ${activeConnections} established (${connectionTime.toFixed(2)}ms)`);
        
      } finally {
        // Clean up connections
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
      }
      
      // Cool down
      await this.sleep(5000);
    }
    
    return results;
  }

  async waitForWebSocketConnection(ws) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async testWebSocketMessageBroadcast(connections) {
    const messagesReceived = {};
    const testMessage = { type: 'performance_test', data: 'test', timestamp: Date.now() };
    
    // Setup message listeners
    connections.forEach((ws, index) => {
      messagesReceived[index] = [];
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'performance_test') {
            messagesReceived[index].push(message);
          }
        } catch (error) {
          // Ignore parsing errors
        }
      });
    });
    
    // Send broadcast message via API
    const start = performance.now();
    await axios.post(`${this.config.apiBaseUrl}/api/system/broadcast`, testMessage);
    
    // Wait for message delivery
    await this.sleep(2000);
    const end = performance.now();
    
    const deliveredCount = Object.values(messagesReceived).filter(msgs => msgs.length > 0).length;
    
    return {
      sent: 1,
      delivered: deliveredCount,
      deliveryRate: (deliveredCount / connections.length) * 100,
      deliveryTime: end - start
    };
  }

  /**
   * Test memory usage under load
   */
  async testMemoryUsage(test) {
    console.log('🧠 Testing memory usage under load...');
    
    const memorySnapshots = [];
    const startMemory = process.memoryUsage();
    
    // Start memory monitoring
    const monitoringInterval = setInterval(() => {
      const memory = process.memoryUsage();
      memorySnapshots.push({
        timestamp: Date.now(),
        ...memory
      });
    }, 1000);
    
    try {
      // Generate continuous load
      const loadPromises = [];
      const loadDuration = test.duration;
      const startTime = Date.now();
      
      while (Date.now() - startTime < loadDuration) {
        // Create batches of concurrent requests
        const batchSize = 20;
        const batch = [];
        
        for (let i = 0; i < batchSize; i++) {
          batch.push(this.createLoadRequest());
        }
        
        loadPromises.push(Promise.allSettled(batch));
        
        // Wait a bit before next batch
        await this.sleep(1000);
      }
      
      // Wait for all requests to complete
      await Promise.all(loadPromises);
      
    } finally {
      clearInterval(monitoringInterval);
    }
    
    const endMemory = process.memoryUsage();
    
    return {
      startMemory,
      endMemory,
      snapshots: memorySnapshots,
      peakMemory: memorySnapshots.reduce((max, snapshot) => 
        Math.max(max, snapshot.heapUsed), 0
      ),
      memoryIncrease: endMemory.heapUsed - startMemory.heapUsed,
      averageMemory: memorySnapshots.reduce((sum, snapshot) => 
        sum + snapshot.heapUsed, 0) / memorySnapshots.length
    };
  }

  async createLoadRequest() {
    const testData = this.generateTestData();
    
    try {
      const response = await axios.post(
        `${this.config.apiBaseUrl}/api/documents`,
        {
          hash: testData.hash,
          originalUrl: testData.metadata.originalUrl,
          documentTitle: testData.metadata.title
        }
      );
      return { success: true, status: response.status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test blockchain transaction throughput
   */
  async testBlockchainThroughput(test) {
    console.log('⛓️ Testing blockchain transaction throughput...');
    
    const startTime = Date.now();
    const transactions = [];
    const batchSize = 10;
    const maxDuration = test.duration;
    
    while (Date.now() - startTime < maxDuration) {
      const batch = [];
      
      for (let i = 0; i < batchSize; i++) {
        const testData = this.generateTestData();
        batch.push(
          axios.post(`${this.config.apiBaseUrl}/api/pdf/register`, {
            hash: testData.hash,
            metadata: testData.metadata,
            signature: testData.signature
          }).catch(error => ({ error: error.message }))
        );
      }
      
      const batchResults = await Promise.all(batch);
      transactions.push(...batchResults);
      
      // Small delay between batches
      await this.sleep(2000);
    }
    
    const totalTime = Date.now() - startTime;
    const successful = transactions.filter(tx => !tx.error).length;
    const failed = transactions.length - successful;
    
    return {
      totalTransactions: transactions.length,
      successful,
      failed,
      totalTime,
      throughput: (successful / totalTime) * 1000, // tx per second
      successRate: (successful / transactions.length) * 100,
      errors: transactions.filter(tx => tx.error).map(tx => tx.error)
    };
  }

  /**
   * Test system recovery after load
   */
  async testSystemRecovery(test) {
    console.log('🔄 Testing system recovery after load...');
    
    // First, generate heavy load
    console.log('⚡ Generating heavy load...');
    const loadPromises = [];
    
    for (let i = 0; i < 100; i++) {
      loadPromises.push(this.createLoadRequest());
    }
    
    await Promise.allSettled(loadPromises);
    
    // Wait for recovery period
    console.log('⏳ Waiting for system recovery...');
    const recoveryStart = Date.now();
    const recoveryMetrics = [];
    
    while (Date.now() - recoveryStart < test.recoveryTime) {
      const start = performance.now();
      
      try {
        await axios.get(`${this.config.apiBaseUrl}/api/health`);
        const responseTime = performance.now() - start;
        
        recoveryMetrics.push({
          timestamp: Date.now(),
          responseTime,
          memory: process.memoryUsage(),
          success: true
        });
      } catch (error) {
        recoveryMetrics.push({
          timestamp: Date.now(),
          responseTime: 30000, // Max timeout
          error: error.message,
          success: false
        });
      }
      
      await this.sleep(5000); // Check every 5 seconds
    }
    
    const avgResponseTime = recoveryMetrics
      .filter(m => m.success)
      .reduce((sum, m) => sum + m.responseTime, 0) / recoveryMetrics.length;
    
    const recoveryComplete = avgResponseTime < (this.baseline.responseTime * 1.2); // Within 20% of baseline
    
    return {
      recoveryTime: test.recoveryTime,
      baselineResponseTime: this.baseline.responseTime,
      averageRecoveryResponseTime: avgResponseTime,
      recoveryComplete,
      metrics: recoveryMetrics,
      successRate: (recoveryMetrics.filter(m => m.success).length / recoveryMetrics.length) * 100
    };
  }

  // Helper methods
  generateTestData(id = Date.now()) {
    const crypto = require('crypto');
    const hash = crypto.randomBytes(32).toString('hex');
    
    return {
      hash,
      metadata: {
        originalUrl: `https://test-${id}.example.com/document`,
        title: `Test Document ${id}`,
        timestamp: new Date().toISOString(),
        userAgent: 'Performance Test Agent',
        viewport: { width: 1920, height: 1080 }
      },
      signature: `test-signature-${id}`
    };
  }

  calculateAverageResponseTime(results) {
    const times = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.responseTime)
      .filter(t => t !== undefined);
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 !== 0 
      ? sorted[mid] 
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  async generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testDuration: this.endTime - this.startTime,
      baseline: this.baseline,
      metrics: this.metrics,
      summary: {
        averageResponseTime: this.metrics.responseTime.length > 0 
          ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
          : 0,
        peakMemoryUsage: Math.max(...this.metrics.memoryUsage.map(m => m.heapUsed)),
        totalErrors: this.metrics.errorRate.reduce((a, b) => a + b, 0)
      }
    };
    
    console.log('📊 Performance Test Summary:');
    console.log(`Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`Peak Memory Usage: ${(report.summary.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Total Errors: ${report.summary.totalErrors}`);
    
    return report;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PerformanceTestSuite;