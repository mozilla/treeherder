import { setupIntegrationTest } from '../helpers/test-utils';

describe('App Navigation Integration Tests', () => {
  const {
    navigateAndWaitForLoad,
    isElementVisible,
    waitForLoadingComplete,
  } = setupIntegrationTest('AppNavigation');

  describe('Cross-App Navigation', () => {
    test('should navigate between different Treeherder apps', async () => {
      // Start at jobs view
      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Verify we're on jobs view
      let title = await page.title();
      expect(title).toBe('Treeherder Jobs View');

      // Navigate to Perfherder
      await page.goto(`${global.URL}/perfherder`);
      await waitForLoadingComplete();

      title = await page.title();
      expect(title).toBe('Perfherder');

      // Navigate to Push Health
      await page.goto(`${global.URL}/push-health`);
      await waitForLoadingComplete();

      title = await page.title();
      expect(title).toBe('Push Health');

      // Navigate back to Jobs
      await page.goto(`${global.URL}/jobs`);
      await waitForLoadingComplete();

      title = await page.title();
      expect(title).toBe('Treeherder Jobs View');
    });

    test('should maintain proper favicon for each app', async () => {
      // Jobs view
      await navigateAndWaitForLoad(`${global.URL}/jobs`);
      let favicon = await page.$eval('link[rel="icon"]', (el) => el.href);
      expect(favicon).toContain('tree_open.png');

      // Perfherder
      await page.goto(`${global.URL}/perfherder`);
      await waitForLoadingComplete();
      favicon = await page.$eval('link[rel="icon"]', (el) => el.href);
      expect(favicon).toContain('line_chart.png');

      // Push Health
      await page.goto(`${global.URL}/push-health`);
      await waitForLoadingComplete();
      favicon = await page.$eval('link[rel="icon"]', (el) => el.href);
      expect(favicon).toContain('push-health-ok.png');
    });

    test('should handle deep linking with parameters', async () => {
      // Test jobs view with specific parameters
      const jobsUrl = `${global.URL}/jobs?repo=autoland&revision=abcd1234&selectedJob=12345`;
      await navigateAndWaitForLoad(jobsUrl);

      // Verify parameters are preserved
      const currentUrl = await page.url();
      expect(currentUrl).toContain('repo=autoland');
      expect(currentUrl).toContain('revision=abcd1234');

      // Test push health with parameters
      const pushHealthUrl = `${global.URL}/push-health/push?repo=mozilla-central&revision=xyz789`;
      await page.goto(pushHealthUrl);
      await waitForLoadingComplete();

      const pushHealthCurrentUrl = await page.url();
      expect(pushHealthCurrentUrl).toContain('repo=mozilla-central');
      expect(pushHealthCurrentUrl).toContain('revision=xyz789');
    });
  });

  describe('URL Compatibility and Redirects', () => {
    test('should handle legacy URL formats', async () => {
      // Test old .html format
      await page.goto(`${global.URL}/perf.html#/alerts`);
      await waitForLoadingComplete();

      // Should redirect to new format
      const currentUrl = await page.url();
      expect(currentUrl).toContain('/perfherder');

      // Test pushhealth.html redirect
      await page.goto(`${global.URL}/pushhealth.html`);
      await waitForLoadingComplete();

      const pushHealthUrl = await page.url();
      expect(pushHealthUrl).toContain('/push-health');
    });

    test('should handle root URL redirect', async () => {
      await page.goto(`${global.URL}/`);
      await waitForLoadingComplete();

      // Should redirect to jobs view
      const currentUrl = await page.url();
      expect(currentUrl).toContain('/jobs');
    });

    test('should preserve hash parameters during redirects', async () => {
      // Test with hash parameters that should be converted to search params
      await page.goto(`${global.URL}/perf.html#/alerts?id=12345`);
      await waitForLoadingComplete();

      const currentUrl = await page.url();
      expect(currentUrl).toContain('/perfherder');
      expect(currentUrl).toContain('id=12345');
    });
  });

  describe('Error Pages and 404 Handling', () => {
    test('should handle invalid routes gracefully', async () => {
      await page.goto(`${global.URL}/invalid-route-that-does-not-exist`);

      // Should either show 404 page or redirect to valid route
      const is404 = await isElementVisible('.not-found, .error-404');
      const redirected =
        page.url().includes('/jobs') || page.url().includes('/perfherder');

      expect(is404 || redirected).toBe(true);
    });

    test('should handle malformed URLs', async () => {
      // Test with malformed parameters
      await page.goto(
        `${global.URL}/jobs?repo=&revision=invalid&malformed=param=value`,
      );

      // Page should still load, possibly with default values
      await waitForLoadingComplete();
      const pageLoaded = await isElementVisible(
        '#th-global-content, .main-content',
      );
      expect(pageLoaded).toBe(true);
    });
  });

  describe('Browser Navigation', () => {
    test('should handle browser back and forward buttons', async () => {
      // Navigate through multiple pages
      await navigateAndWaitForLoad(`${global.URL}/jobs`);
      await page.goto(`${global.URL}/perfherder`);
      await waitForLoadingComplete();
      await page.goto(`${global.URL}/push-health`);
      await waitForLoadingComplete();

      // Use browser back button
      await page.goBack();
      await waitForLoadingComplete();

      let title = await page.title();
      expect(title).toBe('Perfherder');

      // Use browser back button again
      await page.goBack();
      await waitForLoadingComplete();

      title = await page.title();
      expect(title).toBe('Treeherder Jobs View');

      // Use browser forward button
      await page.goForward();
      await waitForLoadingComplete();

      title = await page.title();
      expect(title).toBe('Perfherder');
    });

    test('should handle page refresh', async () => {
      // Navigate to a page with parameters
      await navigateAndWaitForLoad(
        `${global.URL}/jobs?repo=autoland&searchStr=test`,
      );

      // Refresh the page
      await page.reload();
      await waitForLoadingComplete();

      // Parameters should be preserved
      const currentUrl = await page.url();
      expect(currentUrl).toContain('repo=autoland');
      expect(currentUrl).toContain('searchStr=test');

      // Page should still be functional
      const pageLoaded = await isElementVisible('#th-global-content');
      expect(pageLoaded).toBe(true);
    });
  });

  describe('Authentication Flow', () => {
    test('should handle login callback route', async () => {
      await page.goto(`${global.URL}/login`);

      // Should load login callback page
      const loginCallback = await isElementVisible(
        '.login-callback, .auth-callback',
      );
      const redirected = !page.url().includes('/login');

      // Either shows login callback or redirects (depending on auth state)
      expect(loginCallback || redirected).toBe(true);
    });

    test('should handle taskcluster auth callback', async () => {
      await page.goto(`${global.URL}/taskcluster-auth`);

      // Should load taskcluster auth callback
      const authCallback = await isElementVisible(
        '.taskcluster-callback, .auth-callback',
      );
      const redirected = !page.url().includes('/taskcluster-auth');

      expect(authCallback || redirected).toBe(true);
    });
  });

  describe('Documentation and Help', () => {
    test('should load user guide', async () => {
      await navigateAndWaitForLoad(`${global.URL}/userguide`);

      // Should show user guide content
      const userGuide = await isElementVisible('.userguide, .documentation');
      expect(userGuide).toBe(true);

      // Check title
      const title = await page.title();
      expect(title).toBe('Treeherder User Guide');
    });

    test('should load API documentation', async () => {
      await navigateAndWaitForLoad(`${global.URL}/docs`);

      // Should show API documentation (Redoc)
      const apiDocs = await isElementVisible('.redoc-wrap, .api-docs');
      expect(apiDocs).toBe(true);
    });
  });

  describe('Performance and Loading', () => {
    test('should load apps within reasonable time', async () => {
      const apps = [
        { url: `${global.URL}/jobs`, name: 'Jobs' },
        { url: `${global.URL}/perfherder`, name: 'Perfherder' },
        { url: `${global.URL}/push-health`, name: 'Push Health' },
      ];

      /* eslint-disable no-await-in-loop */
      for (const app of apps) {
        const startTime = Date.now();

        await navigateAndWaitForLoad(app.url, { timeout: 15000 });

        const loadTime = Date.now() - startTime;

        // Should load within 15 seconds
        expect(loadTime).toBeLessThan(15000);

        // App should be functional
        const appLoaded = await isElementVisible(
          '.main-content, #th-global-content, .push-health-content',
        );
        expect(appLoaded).toBe(true);
      }
      /* eslint-enable no-await-in-loop */
    });

    test('should handle concurrent navigation', async () => {
      // Rapidly navigate between apps
      await page.goto(`${global.URL}/jobs`);
      await page.goto(`${global.URL}/perfherder`);
      await page.goto(`${global.URL}/push-health`);
      await page.goto(`${global.URL}/jobs`);

      // Final navigation should complete successfully
      await waitForLoadingComplete();

      const title = await page.title();
      expect(title).toBe('Treeherder Jobs View');

      const pageLoaded = await isElementVisible('#th-global-content');
      expect(pageLoaded).toBe(true);
    });
  });

  describe('Mobile and Responsive Behavior', () => {
    test('should handle mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });

      await navigateAndWaitForLoad(`${global.URL}/jobs`);

      // Page should still load and be functional
      const pageLoaded = await isElementVisible('#th-global-content');
      expect(pageLoaded).toBe(true);

      // Reset viewport
      await page.setViewport({ width: 1200, height: 800 });
    });

    test('should handle tablet viewport', async () => {
      // Set tablet viewport
      await page.setViewport({ width: 768, height: 1024 });

      await navigateAndWaitForLoad(`${global.URL}/push-health`);

      // Page should still load and be functional
      const pageLoaded = await isElementVisible(
        '.push-health-content, .main-content',
      );
      expect(pageLoaded).toBe(true);

      // Reset viewport
      await page.setViewport({ width: 1200, height: 800 });
    });
  });
});
