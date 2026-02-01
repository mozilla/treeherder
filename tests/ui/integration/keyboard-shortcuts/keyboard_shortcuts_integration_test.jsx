/**
 * Integration tests for keyboard shortcuts (react-hot-keys)
 * Tests that keyboard shortcuts work correctly after the React 19 upgrade
 */

describe('Keyboard Shortcuts Integration Test (react-hot-keys)', () => {
  beforeAll(async () => {
    jest.setTimeout(120000);
  });

  beforeEach(async () => {
    await page.setDefaultNavigationTimeout(60000);
  });

  test('Jobs page loads and keyboard shortcut "f" focuses quick filter input', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for page to load
    await page.waitForSelector('#quick-filter', { timeout: 60000 });

    // Press 'f' to focus the filter
    await page.keyboard.press('f');

    // Wait a moment for focus to change
    await new Promise((r) => setTimeout(r, 500));

    // Check that the quick filter is focused
    const isFocused = await page.$eval(
      '#quick-filter',
      (el) => el === document.activeElement,
    );

    expect(isFocused).toBe(true);
  });

  test('Keyboard shortcuts are filtered when typing in input fields', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for page to load
    await page.waitForSelector('#quick-filter', { timeout: 60000 });

    // Focus the quick filter
    await page.click('#quick-filter');

    // Type 'j' in the input field - this should NOT navigate to next job
    await page.type('#quick-filter', 'testfilter');

    // Wait a moment
    await new Promise((r) => setTimeout(r, 300));

    // The input should contain what we typed
    const inputValue = await page.$eval('#quick-filter', (el) => el.value);
    expect(inputValue).toContain('testfilter');
  });

  test('Keyboard shortcut "j" navigates to next job when job is selected', async () => {
    await page.goto(`${URL}/jobs?repo=autoland`, { waitUntil: 'networkidle0' });

    // Wait for jobs to load
    await page.waitForSelector('.job-btn', { timeout: 60000 });

    // Click on a job to select it
    await page.click('.job-btn');

    // Wait for job details to load
    await page.waitForSelector('#details-panel', { timeout: 30000 });

    // Verify a job is selected
    const selectedJob = await page.$('.job-btn.selected-job');
    expect(selectedJob).not.toBeNull();

    // Get the initial selected job's data attribute
    const initialJobId = await page.$eval('.job-btn.selected-job', (el) =>
      el.getAttribute('data-job-id'),
    );

    // Press 'j' to navigate to next job
    await page.keyboard.press('j');

    // Wait for selection to change
    await new Promise((r) => setTimeout(r, 500));

    // Get the new selected job
    const newJobId = await page.$eval('.job-btn.selected-job', (el) =>
      el.getAttribute('data-job-id'),
    );

    // Job should have changed
    expect(newJobId).not.toBe(initialJobId);
  });
});
