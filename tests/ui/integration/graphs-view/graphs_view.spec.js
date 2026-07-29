/**
 * Integration tests for the Perfherder Graphs view.
 *
 * API responses are replayed from the HAR recordings in
 * tests/ui/integration/recordings/ (originally captured with Polly.js).
 * Requests not present in the recordings fall through to the dev server,
 * which proxies /api to the configured backend.
 */

const fs = require('node:fs');
const path = require('node:path');

const { test, expect } = require('@playwright/test');

const RECORDINGS_DIR = path.resolve(
  __dirname,
  '../recordings/GraphsViewRecord-Test-Pupeteer_1324652544',
);

test.describe('Graphs View', () => {
  test('Add test data modal lists the recorded frameworks', async ({
    page,
  }) => {
    await page.routeFromHAR(
      path.join(RECORDINGS_DIR, 'Record-requests_2171382282/recording.har'),
      { url: '**/api/**', notFound: 'fallback' },
    );

    await page.goto('/perfherder/graphs');

    // Open the Add Test Data modal
    await page.locator('button[title="Add test data"]').click();

    // Open the Framework dropdown inside the modal and count its items
    const frameworkDropdown = page.locator('div[title="Framework"]');
    await frameworkDropdown.locator('button').click();

    await expect(frameworkDropdown.locator('a.dropdown-item')).toHaveCount(9);
  });

  test('Clicking on Table View / Graphs view button should toggle between views', async ({
    page,
  }) => {
    const harPath = path.join(
      RECORDINGS_DIR,
      'Clicking-on-Table-View_3574591457/Graphs-view-button-should-toggle-between-views_4072224546/recording.har',
    );

    await page.routeFromHAR(harPath, {
      url: '**/api/**',
      notFound: 'fallback',
    });

    // The performance/summary query params have changed since the HAR was
    // recorded (e.g. the replicates param was added), so exact-URL HAR
    // matching misses them. Serve those responses by signature instead.
    // Registered after routeFromHAR, so this route takes precedence.
    const har = JSON.parse(fs.readFileSync(harPath, 'utf8'));
    await page.route('**/api/performance/summary/**', (route) => {
      const signature = new URL(route.request().url()).searchParams.get(
        'signature',
      );
      const entry = har.log.entries.find(
        (e) =>
          e.request.url.includes('/api/performance/summary/') &&
          e.request.url.includes(`signature=${signature}&`),
      );
      if (entry) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: entry.response.content.text,
        });
      }
      return route.fallback();
    });

    await page.goto(
      '/perfherder/graphs?highlightAlerts=1&highlightChangelogData=1&highlightCommonAlerts=0&series=mozilla-central,3140832,1,1&series=mozilla-central,3140831,1,1&timerange=86400',
    );

    const toggleButton = page.locator(
      'button[title="Toggle between table view and graphs view"]',
    );

    await expect(toggleButton).toContainText('Table View');

    // Wait for pending data fetches to settle; the loading overlay
    // intercepts pointer events while present.
    await expect(page.locator('.loading')).toHaveCount(0);

    await toggleButton.click();

    await expect(toggleButton).toContainText('Graphs View');
  });
});
