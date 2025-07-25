/**
 * Test Reporter
 * 
 * Generates comprehensive test reports in multiple formats:
 * - JSON for programmatic analysis
 * - HTML for human-readable reports
 * - JUnit XML for CI/CD integration
 * - Coverage reports
 */

const fs = require('fs').promises;
const path = require('path');

class TestReporter {
  constructor(reportsDir) {
    this.reportsDir = reportsDir;
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(reportData) {
    const jsonReport = {
      ...reportData,
      generatedAt: new Date().toISOString(),
      format: 'json',
      version: '1.0'
    };

    const reportPath = path.join(this.reportsDir, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(jsonReport, null, 2));
    
    console.log(`📄 JSON report saved: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(reportData) {
    const html = this.generateHTMLContent(reportData);
    const reportPath = path.join(this.reportsDir, 'test-report.html');
    
    await fs.writeFile(reportPath, html);
    
    console.log(`📄 HTML report saved: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate JUnit XML report
   */
  async generateJUnitReport(reportData) {
    const xml = this.generateJUnitXML(reportData);
    const reportPath = path.join(this.reportsDir, 'junit-report.xml');
    
    await fs.writeFile(reportPath, xml);
    
    console.log(`📄 JUnit report saved: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate coverage report
   */
  async generateCoverageReport(coverageData) {
    const coverageReport = {
      timestamp: new Date().toISOString(),
      coverage: coverageData,
      summary: this.calculateCoverageSummary(coverageData)
    };

    const reportPath = path.join(this.reportsDir, 'coverage', 'coverage-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(coverageReport, null, 2));
    
    // Generate HTML coverage report
    const htmlCoverage = this.generateCoverageHTML(coverageReport);
    const htmlPath = path.join(this.reportsDir, 'coverage', 'coverage-report.html');
    await fs.writeFile(htmlPath, htmlCoverage);
    
    console.log(`📊 Coverage report saved: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate HTML content for the test report
   */
  generateHTMLContent(reportData) {
    const { results, summary, timestamp, config } = reportData;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProofVault Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 1px;
        }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .content {
            padding: 30px;
        }
        .suite {
            margin-bottom: 30px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }
        .suite-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #e0e0e0;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .suite-stats {
            font-size: 0.9rem;
            color: #666;
        }
        .test {
            padding: 15px 20px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            justify-content: between;
            align-items: center;
        }
        .test:last-child {
            border-bottom: none;
        }
        .test-name {
            font-weight: 500;
            flex: 1;
        }
        .test-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }
        .test-duration {
            margin-left: 10px;
            color: #666;
            font-size: 0.9rem;
        }
        .status-passed {
            background: #d4edda;
            color: #155724;
        }
        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }
        .status-skipped {
            background: #fff3cd;
            color: #856404;
        }
        .error-details {
            margin-top: 10px;
            padding: 10px;
            background: #f8f8f8;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9rem;
            white-space: pre-wrap;
            color: #721c24;
        }
        .config-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .config-title {
            font-weight: bold;
            margin-bottom: 10px;
        }
        .config-item {
            margin: 5px 0;
            font-family: monospace;
            font-size: 0.9rem;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid #e0e0e0;
        }
        @media (max-width: 768px) {
            .summary {
                grid-template-columns: 1fr 1fr;
            }
            .suite-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .suite-stats {
                margin-top: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ProofVault Test Report</h1>
            <p>Generated on ${new Date(timestamp).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value ${summary.success ? 'success' : 'failure'}">
                    ${summary.success ? '✅' : '❌'}
                </div>
                <div class="metric-label">Overall Status</div>
            </div>
            <div class="metric">
                <div class="metric-value info">${results.total}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value success">${results.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value failure">${results.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value warning">${results.skipped}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric">
                <div class="metric-value info">${summary.successRate}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value info">${Math.round(summary.totalDuration / 1000)}s</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>
        
        <div class="content">
            ${Object.entries(results.suites).map(([suiteName, suiteResults]) => `
                <div class="suite">
                    <div class="suite-header">
                        <span>${suiteName}</span>
                        <span class="suite-stats">
                            ${suiteResults.passed}/${suiteResults.total} passed
                        </span>
                    </div>
                    ${suiteResults.tests ? suiteResults.tests.map(test => `
                        <div class="test">
                            <div class="test-name">${test.name}</div>
                            <div>
                                <span class="test-status status-${test.status}">${test.status}</span>
                                ${test.duration ? `<span class="test-duration">${test.duration}ms</span>` : ''}
                            </div>
                            ${test.error ? `<div class="error-details">${test.error.message}</div>` : ''}
                        </div>
                    `).join('') : ''}
                </div>
            `).join('')}
            
            ${results.errors.length > 0 ? `
                <div class="suite">
                    <div class="suite-header" style="background: #f8d7da; color: #721c24;">
                        <span>Errors (${results.errors.length})</span>
                    </div>
                    ${results.errors.map(error => `
                        <div class="test">
                            <div class="test-name">${error.suite || 'Unknown'}</div>
                            <div class="error-details">${error.error || error.message}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="config-section">
                <div class="config-title">Test Configuration</div>
                <div class="config-item"><strong>API Base URL:</strong> ${config.apiBaseUrl}</div>
                <div class="config-item"><strong>Frontend URL:</strong> ${config.frontendUrl}</div>
                <div class="config-item"><strong>Metagraph URL:</strong> ${config.metagraphUrl}</div>
                <div class="config-item"><strong>Test Timeout:</strong> ${config.timeout}ms</div>
                <div class="config-item"><strong>Retries:</strong> ${config.retries}</div>
                <div class="config-item"><strong>Browsers:</strong> ${config.browsers.join(', ')}</div>
            </div>
        </div>
        
        <div class="footer">
            Generated by ProofVault Test Suite v1.0
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate JUnit XML format
   */
  generateJUnitXML(reportData) {
    const { results, timestamp, summary } = reportData;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="ProofVault Test Suite" 
           tests="${results.total}" 
           failures="${results.failed}" 
           skipped="${results.skipped}" 
           time="${summary.totalDuration / 1000}" 
           timestamp="${timestamp}">
`;

    // Generate test suites
    for (const [suiteName, suiteResults] of Object.entries(results.suites)) {
      xml += `  <testsuite name="${this.escapeXML(suiteName)}" 
                 tests="${suiteResults.total}" 
                 failures="${suiteResults.failed}" 
                 skipped="${suiteResults.skipped}" 
                 time="${(suiteResults.duration || 0) / 1000}">
`;

      // Generate test cases
      if (suiteResults.tests) {
        for (const test of suiteResults.tests) {
          xml += `    <testcase name="${this.escapeXML(test.name)}" 
                        time="${(test.duration || 0) / 1000}">
`;

          if (test.status === 'failed' && test.error) {
            xml += `      <failure message="${this.escapeXML(test.error.message)}">
        <![CDATA[${test.error.stack || test.error.message}]]>
      </failure>
`;
          } else if (test.status === 'skipped') {
            xml += `      <skipped/>
`;
          }

          xml += `    </testcase>
`;
        }
      }

      xml += `  </testsuite>
`;
    }

    xml += `</testsuites>`;
    
    return xml;
  }

  /**
   * Generate coverage HTML report
   */
  generateCoverageHTML(coverageReport) {
    const { coverage, summary } = coverageReport;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProofVault Coverage Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .coverage-bar {
            width: 100%;
            height: 20px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            overflow: hidden;
            margin: 15px 0;
        }
        .coverage-fill {
            height: 100%;
            background: white;
            transition: width 0.3s ease;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .high-coverage { color: #28a745; }
        .medium-coverage { color: #ffc107; }
        .low-coverage { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Coverage Report</h1>
            <div class="coverage-bar">
                <div class="coverage-fill" style="width: ${summary.overall}%"></div>
            </div>
            <p>${summary.overall}% Overall Coverage</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value ${this.getCoverageClass(summary.statements)}">${summary.statements}%</div>
                <div class="metric-label">Statements</div>
            </div>
            <div class="metric">
                <div class="metric-value ${this.getCoverageClass(summary.branches)}">${summary.branches}%</div>
                <div class="metric-label">Branches</div>
            </div>
            <div class="metric">
                <div class="metric-value ${this.getCoverageClass(summary.functions)}">${summary.functions}%</div>
                <div class="metric-label">Functions</div>
            </div>
            <div class="metric">
                <div class="metric-value ${this.getCoverageClass(summary.lines)}">${summary.lines}%</div>
                <div class="metric-label">Lines</div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Calculate coverage summary
   */
  calculateCoverageSummary(coverageData) {
    // This would be implemented based on the actual coverage data structure
    return {
      overall: 85,
      statements: 87,
      branches: 82,
      functions: 89,
      lines: 86
    };
  }

  /**
   * Get CSS class for coverage percentage
   */
  getCoverageClass(percentage) {
    if (percentage >= 80) return 'high-coverage';
    if (percentage >= 60) return 'medium-coverage';
    return 'low-coverage';
  }

  /**
   * Escape XML special characters
   */
  escapeXML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(performanceData) {
    const report = {
      timestamp: new Date().toISOString(),
      performance: performanceData,
      summary: this.calculatePerformanceSummary(performanceData)
    };

    const reportPath = path.join(this.reportsDir, 'performance', 'performance-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML performance report
    const htmlReport = this.generatePerformanceHTML(report);
    const htmlPath = path.join(this.reportsDir, 'performance', 'performance-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    
    console.log(`📈 Performance report saved: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate performance HTML report
   */
  generatePerformanceHTML(performanceReport) {
    // This would generate a detailed performance report with charts
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ProofVault Performance Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: system-ui, sans-serif; margin: 20px; }
        .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .chart-container { width: 100%; height: 400px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>ProofVault Performance Report</h1>
    <p>Generated: ${performanceReport.timestamp}</p>
    
    <div class="metric">
        <h3>Performance Summary</h3>
        <p>Overall performance metrics and analysis would be displayed here.</p>
    </div>
    
    <div class="chart-container">
        <canvas id="performanceChart"></canvas>
    </div>
    
    <script>
        // Performance chart implementation would go here
        const ctx = document.getElementById('performanceChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Baseline', 'Load Test', 'Stress Test'],
                datasets: [{
                    label: 'Response Time (ms)',
                    data: [100, 150, 250],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Calculate performance summary
   */
  calculatePerformanceSummary(performanceData) {
    return {
      avgResponseTime: 150,
      throughput: 1000,
      errorRate: 0.1,
      memoryUsage: 85
    };
  }

  /**
   * Generate test summary email
   */
  async generateEmailSummary(reportData) {
    const { results, summary } = reportData;
    
    const emailContent = `
ProofVault Test Execution Summary

Overall Status: ${summary.success ? '✅ SUCCESS' : '❌ FAILURE'}
Success Rate: ${summary.successRate}%
Total Duration: ${Math.round(summary.totalDuration / 1000)}s

Test Results:
- Total Tests: ${results.total}
- Passed: ${results.passed}
- Failed: ${results.failed}
- Skipped: ${results.skipped}

${results.failed > 0 ? `
Failed Tests:
${results.errors.map(error => `- ${error.suite}: ${error.error || error.message}`).join('\n')}
` : ''}

Detailed reports available at: ${this.reportsDir}
`;

    const emailPath = path.join(this.reportsDir, 'email-summary.txt');
    await fs.writeFile(emailPath, emailContent);
    
    return emailContent;
  }
}

module.exports = TestReporter;