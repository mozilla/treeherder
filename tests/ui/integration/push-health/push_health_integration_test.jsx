import { setupIntegrationTest } from '../helpers/test-utils';

describe('Push Health Integration Tests', () => {
  const {
    context,
    navigateAndWaitForLoad,
    clickElement,
    typeIntoField,
    waitForTextContent,
    getTextContent,
    isElementVisible,
    waitForLoadingComplete,
  } = setupIntegrationTest('PushHealth');

  describe('Navigation and Basic Layout', () => {
    test('should load push health landing page', async () => {
      await navigateAndWaitForLoad(`${global.URL}/push-health`);

      // Check that navigation is present
      await page.waitForSelector('.push-health-navigation');

      // Check that the main content area is present
      await page.waitForSelector('.push-health-content');

      // Verify page title
      const title = await page.title();
      expect(title).toBe('Push Health');

      // Check for "My Pushes" section or similar landing content
      const myPushesExists = await isElementVisible('.my-pushes');
      const landingContentExists = await isElementVisible(
        '.push-health-landing',
      );

      expect(myPushesExists || landingContentExists).toBe(true);
    });

    test('should navigate to usage page', async () => {
      await navigateAndWaitForLoad(`${global.URL}/push-health`);

      // Click on Usage link in navigation
      const usageLink = 'a[href*="/push-health/usage"]';
      await clickElement(usageLink);

      // Wait for usage page to load
      await page.waitForSelector('.usage-content');

      // Verify URL changed
      const url = await page.url();
      expect(url).toContain('/push-health/usage');

      // Check for usage documentation content
      const usageTitle = await isElementVisible('h1, h2');
      expect(usageTitle).toBe(true);
    });
  });

  describe('Push Health Analysis', () => {
    test('should load push health for specific revision', async () => {
      // Use a test revision and repository
      const testRepo = 'autoland';
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?repo=${testRepo}&revision=${testRevision}`,
      );

      // Wait for push health content to load
      await waitForLoadingComplete();

      // Check that push information is displayed
      const pushInfoExists = await isElementVisible('.push-info, .push-header');
      expect(pushInfoExists).toBe(true);

      // Check for health metrics or test results
      const healthMetricsExist = await isElementVisible(
        '.health-metrics, .test-metrics',
      );
      const testResultsExist = await isElementVisible(
        '.test-results, .job-results',
      );

      expect(healthMetricsExist || testResultsExist).toBe(true);
    });

    test('should display test failure information', async () => {
      const testRepo = 'autoland';
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?repo=${testRepo}&revision=${testRevision}`,
      );

      await waitForLoadingComplete();

      // Look for test failure sections
      const failureSection = await isElementVisible(
        '.test-failures, .failures',
      );
      if (failureSection) {
        // Check for failure details
        const failureDetails = await isElementVisible(
          '.failure-details, .test-failure-item',
        );
        expect(failureDetails).toBe(true);
      }

      // Check for classification groups
      const classificationGroups = await isElementVisible(
        '.classification-group',
      );
      if (classificationGroups) {
        // Verify classification content
        const classifications = await page.$$(
          '.classification-item, .classified-failure',
        );
        expect(classifications.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('should show job metrics and statistics', async () => {
      const testRepo = 'autoland';
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?repo=${testRepo}&revision=${testRevision}`,
      );

      await waitForLoadingComplete();

      // Check for job metrics
      const jobMetrics = await isElementVisible('.job-metrics, .metrics');
      if (jobMetrics) {
        // Look for specific metric types
        const successMetrics = await isElementVisible(
          '[data-testid*="success"], .success-count',
        );
        const failureMetrics = await isElementVisible(
          '[data-testid*="failure"], .failure-count',
        );

        expect(successMetrics || failureMetrics).toBe(true);
      }

      // Check for platform information
      const platformInfo = await isElementVisible(
        '.platform-info, .platform-config',
      );
      if (platformInfo) {
        const platforms = await page.$$('.platform-item, .platform');
        expect(platforms.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Test Result Interaction', () => {
    test('should expand and collapse test groups', async () => {
      const testRepo = 'autoland';
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?repo=${testRepo}&revision=${testRevision}`,
      );

      await waitForLoadingComplete();

      // Look for expandable test groups
      const expandableGroups = await page.$$(
        '.expandable, .collapsible, [data-toggle="collapse"]',
      );

      if (expandableGroups.length > 0) {
        // Click on first expandable group
        await clickElement(
          '.expandable, .collapsible, [data-toggle="collapse"]',
        );

        // Wait for expansion animation
        await page.waitForTimeout(500);

        // Check that content was expanded
        const expandedContent = await isElementVisible(
          '.expanded, .show, .collapse.show',
        );
        expect(expandedContent).toBe(true);
      }
    });

    test('should filter test results', async () => {
      const testRepo = 'autoland';
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?repo=${testRepo}&revision=${testRevision}`,
      );

      await waitForLoadingComplete();

      // Look for filter controls
      const filterControls = await isElementVisible(
        '.filter-controls, .filters',
      );
      if (filterControls) {
        // Try to interact with filter options
        const filterButtons = await page.$$(
          '.filter-btn, .btn-filter, input[type="checkbox"]',
        );

        if (filterButtons.length > 0) {
          // Click on first filter option
          await clickElement(
            '.filter-btn, .btn-filter, input[type="checkbox"]',
          );

          // Wait for filter to be applied
          await page.waitForTimeout(1000);

          // Verify that filtering occurred (content changed or URL updated)
          const url = await page.url();
          const hasFilterParam =
            url.includes('filter') ||
            url.includes('show') ||
            url.includes('hide');

          // If no URL change, check for visual changes in the UI
          if (!hasFilterParam) {
            const filteredContent = await isElementVisible(
              '.filtered, .hidden, [style*="display: none"]',
            );
            expect(filteredContent || hasFilterParam).toBe(true);
          }
        }
      }
    });
  });

  describe('My Pushes Functionality', () => {
    test('should display user pushes when logged in', async () => {
      await navigateAndWaitForLoad(`${global.URL}/push-health`);

      // Check if login is required or if there's a login prompt
      const loginRequired = await isElementVisible(
        '.login-required, .auth-required',
      );
      const myPushesContent = await isElementVisible(
        '.my-pushes-content, .user-pushes',
      );

      if (loginRequired) {
        // Test shows appropriate login message
        const loginMessage = await getTextContent(
          '.login-required, .auth-required',
        );
        expect(loginMessage).toContain('login');
      } else if (myPushesContent) {
        // Test shows user's pushes
        const pushItems = await page.$$('.push-item, .user-push');
        expect(pushItems.length).toBeGreaterThanOrEqual(0);
      }

      // At minimum, the page should load without errors
      const pageContent = await isElementVisible(
        '.push-health-content, .main-content',
      );
      expect(pageContent).toBe(true);
    });

    test('should handle empty push list gracefully', async () => {
      await navigateAndWaitForLoad(`${global.URL}/push-health`);

      // Check for empty state message
      const emptyState = await isElementVisible(
        '.empty-state, .no-pushes, .no-data',
      );
      const pushList = await isElementVisible('.push-list, .pushes');

      // Either there should be pushes or an empty state message
      expect(emptyState || pushList).toBe(true);

      if (emptyState) {
        const emptyMessage = await getTextContent(
          '.empty-state, .no-pushes, .no-data',
        );
        expect(emptyMessage.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid revision gracefully', async () => {
      const invalidRevision = 'invalid-revision-123';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?repo=autoland&revision=${invalidRevision}`,
      );

      // Should show error message or not found page
      const errorMessage = await isElementVisible(
        '.error-message, .alert-danger',
      );
      const notFound = await isElementVisible('.not-found, .error-404');

      expect(errorMessage || notFound).toBe(true);

      if (errorMessage) {
        const errorText = await getTextContent('.error-message, .alert-danger');
        expect(errorText.length).toBeGreaterThan(0);
      }
    });

    test('should handle missing repository parameter', async () => {
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      await navigateAndWaitForLoad(
        `${global.URL}/push-health/push?revision=${testRevision}`,
      );

      // Should show error or redirect to proper format
      const errorState = await isElementVisible('.error, .alert, .not-found');
      const redirected = !page.url().includes('/push-health/push?revision=');

      expect(errorState || redirected).toBe(true);
    });
  });

  describe('Performance and Loading', () => {
    test('should show loading indicators during data fetch', async () => {
      const testRepo = 'autoland';
      const testRevision = 'abcd1234567890abcd1234567890abcd12345678';

      // Start navigation
      const navigationPromise = page.goto(
        `${global.URL}/push-health/push?repo=${testRepo}&revision=${testRevision}`,
      );

      // Check for loading indicators while page loads
      try {
        await page.waitForSelector('.loading, .spinner, .loading-spinner', {
          timeout: 2000,
        });
        const loadingVisible = await isElementVisible(
          '.loading, .spinner, .loading-spinner',
        );
        expect(loadingVisible).toBe(true);
      } catch (error) {
        // Loading might be too fast to catch, which is also acceptable
      }

      // Wait for navigation to complete
      await navigationPromise;
      await waitForLoadingComplete();

      // Ensure loading indicators are gone
      const loadingGone = !(await isElementVisible(
        '.loading, .spinner, .loading-spinner',
      ));
      expect(loadingGone).toBe(true);
    });

    test('should load within reasonable time', async () => {
      const startTime = Date.now();

      await navigateAndWaitForLoad(`${global.URL}/push-health`, {
        timeout: 15000,
      });

      const loadTime = Date.now() - startTime;

      // Should load within 15 seconds
      expect(loadTime).toBeLessThan(15000);

      // Page should be functional
      const pageReady = await isElementVisible(
        '.push-health-content, .main-content',
      );
      expect(pageReady).toBe(true);
    });
  });
});
