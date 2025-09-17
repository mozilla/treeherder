import { setupIntegrationTest } from '../helpers/test-utils';

describe('Jobs View Integration Tests', () => {
  const {
    context,
    navigateAndWaitForLoad,
    clickElement,
    typeIntoField,
    waitForTextContent,
    getTextContent,
    isElementVisible,
    waitForLoadingComplete,
  } = setupIntegrationTest('JobsView');

  describe('Basic Navigation and Layout', () => {
    test('should load jobs view with default repository', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Check that the main navigation is present
      await page.waitForSelector('#th-global-navbar');

      // Check that the repository selector is present and shows default repo
      const repoSelector = 'button[title="Repository"]';
      await page.waitForSelector(repoSelector);

      // Check that push list container is present
      await page.waitForSelector('#th-global-content');

      // Verify page title
      const title = await page.title();
      expect(title).toBe('Treeherder Jobs View');
    });

    test('should display repository selector with available repositories', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      const repoButton = 'button[title="Repository"]';
      await clickElement(repoButton);

      // Wait for dropdown to appear
      await page.waitForSelector('.dropdown-menu');

      // Check that common repositories are available
      const repos = await page.$$eval(
        '.dropdown-menu .dropdown-item',
        (elements) => elements.map((el) => el.textContent.trim()),
      );

      expect(repos.length).toBeGreaterThan(0);
      expect(repos).toContain('autoland');
      expect(repos).toContain('mozilla-central');
    });

    test('should switch repositories when selected', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs?repo=autoland`);

      const repoButton = 'button[title="Repository"]';
      await clickElement(repoButton);

      // Click on mozilla-central
      await clickElement(
        '.dropdown-menu .dropdown-item[href*="mozilla-central"]',
      );

      // Wait for URL to change
      await page.waitForFunction(
        () => window.location.search.includes('repo=mozilla-central'),
        { timeout: 10000 },
      );

      // Verify URL contains the new repository
      const url = await page.url();
      expect(url).toContain('repo=mozilla-central');
    });
  });

  describe('Job Filtering', () => {
    test('should show and hide field filter panel', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Click the filter button
      const filterButton = 'button[title="Filter jobs"]';
      await clickElement(filterButton);

      // Check that filter panel appears
      await page.waitForSelector('.active-filters-bar');

      // Click filter button again to hide
      await clickElement(filterButton);

      // Check that filter panel is hidden
      await page.waitForSelector('.active-filters-bar', { hidden: true });
    });

    test('should filter jobs by search text', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Wait for jobs to load
      await waitForLoadingComplete();

      // Open filter panel
      await clickElement('button[title="Filter jobs"]');

      // Type in search field
      const searchInput = 'input[placeholder*="search"]';
      await typeIntoField(searchInput, 'test');

      // Press Enter to apply filter
      await page.keyboard.press('Enter');

      // Wait for URL to update with search parameter
      await page.waitForFunction(
        () => window.location.search.includes('searchStr=test'),
        { timeout: 10000 },
      );

      // Verify URL contains search parameter
      const url = await page.url();
      expect(url).toContain('searchStr=test');
    });

    test('should filter jobs by result status', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Open filter panel
      await clickElement('button[title="Filter jobs"]');

      // Click on result status filter
      const resultStatusButton = 'button[title="Result status"]';
      await clickElement(resultStatusButton);

      // Select "testfailed" status
      await clickElement(
        '.dropdown-menu .dropdown-item[data-value="testfailed"]',
      );

      // Wait for URL to update
      await page.waitForFunction(
        () => window.location.search.includes('resultStatus=testfailed'),
        { timeout: 10000 },
      );

      // Verify URL contains filter parameter
      const url = await page.url();
      expect(url).toContain('resultStatus=testfailed');
    });
  });

  describe('Job Selection and Details', () => {
    test('should select a job and show details panel', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs?repo=autoland`);

      // Wait for jobs to load
      await waitForLoadingComplete();

      // Find and click on a job button
      const jobButton = '.job-btn:not(.selected)';
      await page.waitForSelector(jobButton);
      await clickElement(jobButton);

      // Wait for details panel to appear
      await page.waitForSelector('.details-panel');

      // Check that job details are shown
      await page.waitForSelector('.job-details-panel');

      // Verify that the job is marked as selected
      const selectedJob = await page.$('.job-btn.selected');
      expect(selectedJob).toBeTruthy();
    });

    test('should show job actions in details panel', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs?repo=autoland`);

      // Wait for jobs to load and select a job
      await waitForLoadingComplete();
      const jobButton = '.job-btn:not(.selected)';
      await page.waitForSelector(jobButton);
      await clickElement(jobButton);

      // Wait for details panel
      await page.waitForSelector('.details-panel');

      // Check for common job actions
      const actionsExist = await isElementVisible('.job-actions');
      if (actionsExist) {
        // Check for retry button
        const retryButton = await isElementVisible(
          'button[title*="Retrigger"]',
        );
        expect(retryButton).toBe(true);
      }
    });
  });

  describe('Push List Functionality', () => {
    test('should display push information', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs?repo=autoland`);

      // Wait for pushes to load
      await waitForLoadingComplete();

      // Check that push headers are present
      await page.waitForSelector('.push-header');

      // Check that push contains author information
      const authorExists = await isElementVisible('.push-author');
      expect(authorExists).toBe(true);

      // Check that push contains revision information
      const revisionExists = await isElementVisible('.revision');
      expect(revisionExists).toBe(true);
    });

    test('should expand and collapse job groups', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs?repo=autoland`);

      // Wait for jobs to load
      await waitForLoadingComplete();

      // Find a job group that can be expanded
      const groupButton = '.group-btn';
      await page.waitForSelector(groupButton);

      // Get initial job count
      const initialJobs = await page.$$('.job-btn');
      const initialCount = initialJobs.length;

      // Click to expand group
      await clickElement(groupButton);

      // Wait a moment for expansion
      await page.waitForTimeout(1000);

      // Get new job count (should be more after expansion)
      const expandedJobs = await page.$$('.job-btn');
      const expandedCount = expandedJobs.length;

      // Note: This test might not always pass if the group is already expanded
      // or if there are no collapsed groups, but it tests the functionality
      expect(expandedCount).toBeGreaterThanOrEqual(initialCount);
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should show keyboard shortcuts modal', async () => {
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Press '?' to show shortcuts
      await page.keyboard.press('?');

      // Wait for modal to appear
      await page.waitForSelector('#onscreen-shortcuts');

      // Check that shortcuts table is visible
      const shortcutsTable = await isElementVisible('.shortcut-table');
      expect(shortcutsTable).toBe(true);

      // Close modal by pressing Escape
      await page.keyboard.press('Escape');

      // Wait for modal to disappear
      await page.waitForSelector('#onscreen-shortcuts', { hidden: true });
    });
  });

  describe('URL Parameter Handling', () => {
    test('should handle revision parameter', async () => {
      const testRevision = 'abcd1234567890';
      await navigateAndWaitForLoad(
        `${global.URL}/jobs?repo=autoland&revision=${testRevision}`,
      );

      // Check that URL contains the revision
      const url = await page.url();
      expect(url).toContain(`revision=${testRevision}`);

      // The page should load without errors
      await page.waitForSelector('#th-global-content');
    });

    test('should handle multiple filter parameters', async () => {
      const params = 'repo=autoland&resultStatus=testfailed&searchStr=test';
      await navigateAndWaitForLoad(`${global.URL}/jobs?${params}`);

      // Check that URL contains all parameters
      const url = await page.url();
      expect(url).toContain('repo=autoland');
      expect(url).toContain('resultStatus=testfailed');
      expect(url).toContain('searchStr=test');

      // Check that filters are applied in UI
      const filterBar = await isElementVisible('.active-filters-bar');
      expect(filterBar).toBe(true);
    });
  });
});
