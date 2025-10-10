#!/usr/bin/env node
/**
 * Treeherder UI Comparison Tool
 * Compares UI between local and staging environments using Puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');

class TreeherderUIComparator {
  constructor(options = {}) {
    this.localBaseUrl = options.localBaseUrl || 'http://localhost:5000';
    this.stagingBaseUrl =
      options.stagingBaseUrl || 'https://treeherder.allizom.org';
    this.outputDir = options.outputDir || './comparison-results';
    this.viewport = options.viewport || { width: 1920, height: 1080 };
    this.timeout = options.timeout || 30000;

    // Key pages to compare
    this.pages = [
      { path: '/', name: 'homepage' },
      { path: '/#/jobs?repo=autoland', name: 'jobs-autoland' },
      { path: '/#/jobs?repo=try', name: 'jobs-try' },
      { path: '/perf.html', name: 'perfherder' },
      { path: '/perf.html#/alerts', name: 'perfherder-alerts' },
      { path: '/intermittent-failures.html', name: 'intermittent-failures' },
      { path: '/pushhealth.html', name: 'push-health' },
    ];
  }

  async initialize() {
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'screenshots'), {
      recursive: true,
    });
    await fs.mkdir(path.join(this.outputDir, 'diffs'), { recursive: true });

    console.log(`UI Comparison initialized:`);
    console.log(`  Local:   ${this.localBaseUrl}`);
    console.log(`  Staging: ${this.stagingBaseUrl}`);
    console.log(`  Output:  ${this.outputDir}`);
    console.log(`  Pages:   ${this.pages.length}`);
  }

  async launchBrowser() {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });
  }

  async capturePageScreenshot(browser, url, pageName, environment) {
    const page = await browser.newPage();

    try {
      await page.setViewport(this.viewport);

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TreeherderUIComparator/1.0',
      );

      console.log(`  Capturing ${environment}: ${pageName}`);

      // Navigate to page
      const startTime = Date.now();
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });
      const loadTime = Date.now() - startTime;

      // Wait for React to render
      await page.waitForTimeout(2000);

      // Hide dynamic elements that change frequently
      await page.evaluate(() => {
        // Hide timestamps, loading indicators, etc.
        const selectors = [
          '[data-testid="timestamp"]',
          '.loading',
          '.spinner',
          '.time-ago',
          '[title*="ago"]',
        ];

        selectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => (el.style.visibility = 'hidden'));
        });
      });

      // Take screenshot
      const screenshotPath = path.join(
        this.outputDir,
        'screenshots',
        `${pageName}-${environment}.png`,
      );
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      // Get page metrics
      const metrics = await page.metrics();
      const performanceEntries = await page.evaluate(() => {
        return JSON.stringify(performance.getEntriesByType('navigation'));
      });

      // Get console errors
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Get page title and URL
      const title = await page.title();
      const finalUrl = page.url();

      return {
        pageName,
        environment,
        url: finalUrl,
        title,
        screenshotPath,
        loadTime,
        metrics,
        performanceEntries: JSON.parse(performanceEntries),
        consoleErrors,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `Error capturing ${environment} ${pageName}:`,
        error.message,
      );
      return {
        pageName,
        environment,
        url,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    } finally {
      await page.close();
    }
  }

  async compareImages(localPath, stagingPath, diffPath) {
    // This is a placeholder for image comparison
    // In a real implementation, you'd use a library like pixelmatch
    try {
      const localExists = await fs
        .access(localPath)
        .then(() => true)
        .catch(() => false);
      const stagingExists = await fs
        .access(stagingPath)
        .then(() => true)
        .catch(() => false);

      if (!localExists || !stagingExists) {
        return {
          identical: false,
          error: `Missing screenshot: local=${localExists}, staging=${stagingExists}`,
        };
      }

      // Simple file size comparison (placeholder)
      const localStats = await fs.stat(localPath);
      const stagingStats = await fs.stat(stagingPath);

      const sizeDiff = Math.abs(localStats.size - stagingStats.size);
      const sizeThreshold = Math.max(localStats.size, stagingStats.size) * 0.05; // 5% threshold

      return {
        identical: sizeDiff < sizeThreshold,
        localSize: localStats.size,
        stagingSize: stagingStats.size,
        sizeDifference: sizeDiff,
        diffPath: diffPath,
      };
    } catch (error) {
      return {
        identical: false,
        error: error.message,
      };
    }
  }

  async runComparison() {
    await this.initialize();

    const browser = await this.launchBrowser();
    const results = [];

    try {
      for (const pageConfig of this.pages) {
        const localUrl = `${this.localBaseUrl}${pageConfig.path}`;
        const stagingUrl = `${this.stagingBaseUrl}${pageConfig.path}`;

        console.log(`\nComparing page: ${pageConfig.name}`);

        // Capture screenshots
        const [localResult, stagingResult] = await Promise.all([
          this.capturePageScreenshot(
            browser,
            localUrl,
            pageConfig.name,
            'local',
          ),
          this.capturePageScreenshot(
            browser,
            stagingUrl,
            pageConfig.name,
            'staging',
          ),
        ]);

        // Compare images if both screenshots were taken
        let imageComparison = null;
        if (localResult.screenshotPath && stagingResult.screenshotPath) {
          const diffPath = path.join(
            this.outputDir,
            'diffs',
            `${pageConfig.name}-diff.png`,
          );
          imageComparison = await this.compareImages(
            localResult.screenshotPath,
            stagingResult.screenshotPath,
            diffPath,
          );
        }

        const pageResult = {
          page: pageConfig.name,
          path: pageConfig.path,
          local: localResult,
          staging: stagingResult,
          imageComparison,
          loadTimeDifference:
            localResult.loadTime && stagingResult.loadTime
              ? localResult.loadTime - stagingResult.loadTime
              : null,
        };

        results.push(pageResult);

        // Print summary
        const imageMatch = imageComparison?.identical ? '✓' : '✗';
        const loadTimeLocal = localResult.loadTime
          ? `${localResult.loadTime}ms`
          : 'ERROR';
        const loadTimeStaging = stagingResult.loadTime
          ? `${stagingResult.loadTime}ms`
          : 'ERROR';

        console.log(
          `  Image match: ${imageMatch} | Load times: ${loadTimeLocal} / ${loadTimeStaging}`,
        );
      }
    } finally {
      await browser.close();
    }

    return results;
  }

  async generateReport(results, outputFile = null) {
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        localBaseUrl: this.localBaseUrl,
        stagingBaseUrl: this.stagingBaseUrl,
        totalPages: results.length,
        identicalPages: results.filter((r) => r.imageComparison?.identical)
          .length,
        errorPages: results.filter((r) => r.local.error || r.staging.error)
          .length,
        avgLoadTimeDifference: this.calculateAverageLoadTimeDifference(results),
      },
      results: results,
    };

    const reportPath =
      outputFile || path.join(this.outputDir, 'ui-comparison-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = path.join(this.outputDir, 'ui-comparison-report.html');
    await fs.writeFile(htmlPath, htmlReport);

    console.log('\n' + '='.repeat(60));
    console.log('UI COMPARISON SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total pages: ${report.summary.totalPages}`);
    console.log(`Identical pages: ${report.summary.identicalPages}`);
    console.log(`Pages with errors: ${report.summary.errorPages}`);
    console.log(
      `Average load time difference: ${report.summary.avgLoadTimeDifference}ms`,
    );
    console.log(`\nReports saved:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  HTML: ${htmlPath}`);

    return report;
  }

  calculateAverageLoadTimeDifference(results) {
    const validDifferences = results
      .map((r) => r.loadTimeDifference)
      .filter((diff) => diff !== null && !isNaN(diff));

    if (validDifferences.length === 0) return 0;

    return Math.round(
      validDifferences.reduce((sum, diff) => sum + diff, 0) /
        validDifferences.length,
    );
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Treeherder UI Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .page-result { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .screenshots { display: flex; gap: 20px; margin: 10px 0; }
        .screenshot { flex: 1; }
        .screenshot img { max-width: 100%; border: 1px solid #ccc; }
        .error { color: red; }
        .success { color: green; }
        .metrics { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <h1>Treeherder UI Comparison Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Timestamp:</strong> ${report.summary.timestamp}</p>
        <p><strong>Local URL:</strong> ${report.summary.localBaseUrl}</p>
        <p><strong>Staging URL:</strong> ${report.summary.stagingBaseUrl}</p>
        <p><strong>Total Pages:</strong> ${report.summary.totalPages}</p>
        <p><strong>Identical Pages:</strong> ${
          report.summary.identicalPages
        }</p>
        <p><strong>Pages with Errors:</strong> ${report.summary.errorPages}</p>
        <p><strong>Avg Load Time Difference:</strong> ${
          report.summary.avgLoadTimeDifference
        }ms</p>
    </div>
    
    ${report.results
      .map(
        (result) => `
        <div class="page-result">
            <h3>${result.page} (${result.path})</h3>
            
            <div class="metrics">
                <p><strong>Image Match:</strong> 
                    <span class="${
                      result.imageComparison?.identical ? 'success' : 'error'
                    }">
                        ${result.imageComparison?.identical ? 'Yes' : 'No'}
                    </span>
                </p>
                <p><strong>Load Times:</strong> 
                    Local: ${result.local.loadTime || 'ERROR'}ms, 
                    Staging: ${result.staging.loadTime || 'ERROR'}ms
                    ${
                      result.loadTimeDifference
                        ? `(Diff: ${result.loadTimeDifference}ms)`
                        : ''
                    }
                </p>
            </div>
            
            ${
              result.local.error || result.staging.error
                ? `
                <div class="error">
                    ${
                      result.local.error
                        ? `Local Error: ${result.local.error}<br>`
                        : ''
                    }
                    ${
                      result.staging.error
                        ? `Staging Error: ${result.staging.error}`
                        : ''
                    }
                </div>
            `
                : ''
            }
            
            <div class="screenshots">
                <div class="screenshot">
                    <h4>Local</h4>
                    ${
                      result.local.screenshotPath
                        ? `<img src="${path.relative(
                            this.outputDir,
                            result.local.screenshotPath,
                          )}" alt="Local screenshot">`
                        : '<p>No screenshot available</p>'
                    }
                </div>
                <div class="screenshot">
                    <h4>Staging</h4>
                    ${
                      result.staging.screenshotPath
                        ? `<img src="${path.relative(
                            this.outputDir,
                            result.staging.screenshotPath,
                          )}" alt="Staging screenshot">`
                        : '<p>No screenshot available</p>'
                    }
                </div>
            </div>
        </div>
    `,
      )
      .join('')}
    
</body>
</html>`;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    switch (key) {
      case 'local':
        options.localBaseUrl = value;
        break;
      case 'staging':
        options.stagingBaseUrl = value;
        break;
      case 'output':
        options.outputDir = value;
        break;
      case 'timeout':
        options.timeout = parseInt(value);
        break;
    }
  }

  const comparator = new TreeherderUIComparator(options);

  try {
    const results = await comparator.runComparison();
    const report = await comparator.generateReport(results);

    // Exit with error code if there are differences
    const hasErrors = report.summary.errorPages > 0;
    const hasDifferences =
      report.summary.identicalPages < report.summary.totalPages;

    if (hasErrors || hasDifferences) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Comparison failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TreeherderUIComparator;
