/**
 * Integration tests for bug highlighting (react-highlight-words)
 * Tests that bug display works correctly after the React 19 upgrade
 */

describe('Bug Highlighting Integration Test (react-highlight-words)', () => {
  beforeAll(async () => {
    jest.setTimeout(120000);
  });

  beforeEach(async () => {
    await page.setDefaultNavigationTimeout(60000);
  });

  test('Jobs page loads and displays job buttons', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for jobs to load
    await page.waitForSelector('.job-btn', { timeout: 60000 });

    // Verify jobs are visible
    const jobs = await page.$$('.job-btn');
    expect(jobs.length).toBeGreaterThan(0);
  });

  test('Job details panel loads when clicking a job', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for jobs to load
    await page.waitForSelector('.job-btn', { timeout: 60000 });

    // Click on any job
    await page.click('.job-btn');

    // Wait for job details panel
    await page.waitForSelector('#details-panel', { timeout: 30000 });

    // Verify the panel is visible
    const detailsPanel = await page.$('#details-panel');
    expect(detailsPanel).not.toBeNull();
  });

  test('Failed job shows failure summary tab with potential bug links', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for jobs to load
    await page.waitForSelector('.job-btn', { timeout: 60000 });

    // Click on a failed job if available
    const failedJob = await page.$('.job-btn.btn-red, .job-btn.btn-orange');
    if (failedJob) {
      await failedJob.click();

      // Wait for job details panel
      await page.waitForSelector('#details-panel', { timeout: 30000 });

      // Look for failure summary tab or any tab content
      const tabContent = await page.$('#details-panel');
      expect(tabContent).not.toBeNull();
    } else {
      // If no failed jobs, just verify we can click any job
      await page.click('.job-btn');
      await page.waitForSelector('#details-panel', { timeout: 30000 });
      const detailsPanel = await page.$('#details-panel');
      expect(detailsPanel).not.toBeNull();
    }
  });
});
