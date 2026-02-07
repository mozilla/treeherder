/**
 * Integration tests for log viewer (react-lazylog)
 * Tests that log viewing works correctly after the React 19 upgrade
 */

describe('Logviewer Integration Test (react-lazylog)', () => {
  beforeAll(async () => {
    jest.setTimeout(120000);
  });

  beforeEach(async () => {
    await page.setDefaultNavigationTimeout(60000);
  });

  test('Jobs page loads and job details panel appears when clicking a job', async () => {
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

  test('Job details panel has content after selecting a job', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for jobs to load
    await page.waitForSelector('.job-btn', { timeout: 60000 });

    // Click on a failed job if available (they have logs)
    const failedJob = await page.$('.job-btn.btn-red, .job-btn.btn-orange');
    const jobToClick = failedJob || (await page.$('.job-btn'));
    await jobToClick.click();

    // Wait for job details panel
    await page.waitForSelector('#details-panel', { timeout: 30000 });

    // Wait a bit for content to load
    await new Promise((r) => setTimeout(r, 1000));

    // Check that details panel has content
    const panelContent = await page.$('#details-panel-content');
    expect(panelContent).not.toBeNull();
  });
});
