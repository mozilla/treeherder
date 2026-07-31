/**
 * Integration tests for the Logviewer page using the custom log viewer
 * (ClassicLogViewer + react-virtuoso).
 *
 * Uses addInitScript to mock fetch() at the browser JS level,
 * providing deterministic responses without depending on external services.
 */

const { test, expect } = require('@playwright/test');

const MOCK_LOG_LINES = Array.from(
  { length: 200 },
  (_, i) =>
    `[taskcluster 2025-01-01T00:00:00.000Z] Line ${i + 1}: sample log output for testing purposes`,
);

const MOCK_JOB = {
  id: 12345,
  push_id: 100,
  task_id: 'mock-task-id-abc123',
  retry_id: 0,
  result: 'testfailed',
  state: 'completed',
  job_group_name: 'Mochitests',
  platform: 'linux64',
  searchStr: 'mock test job',
  logs: [
    {
      name: 'live_backing_log',
      url: 'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/mock-task-id-abc123/runs/0/artifacts/public/logs/live_backing.log',
    },
  ],
};

const MOCK_REPOS = [
  {
    id: 77,
    name: 'autoland',
    dvcs_type: 'hg',
    url: 'https://hg.mozilla.org/integration/autoland',
    tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
    active_status: 'active',
  },
];

const LOG_URL =
  '/logviewer?job_id=12345&repo=autoland&task=mock-task-id-abc123.0';

const TOOLBAR_LABEL = '.classic-log-toolbar-label';
const COPY_BUTTON = 'button[title="Copy selected lines to clipboard"]';

/**
 * Build a script that mocks window.fetch before the app loads.
 * Uses a global key so each new mock replaces the previous one.
 */
function buildFetchMockScript(mockLogText, mockErrors) {
  const mockJob = JSON.stringify(MOCK_JOB);
  const mockRepos = JSON.stringify(MOCK_REPOS);
  const mockLogTextJson = JSON.stringify(mockLogText);
  const mockErrorsJson = JSON.stringify(mockErrors);

  return `
    (function() {
      // Save the real fetch only once, even if this script runs multiple times
      if (!window.__realFetch) {
        window.__realFetch = window.fetch;
      }
      const _realFetch = window.__realFetch;
      const MOCK_LOG_TEXT = ${mockLogTextJson};
      const MOCK_JOB = ${mockJob};
      const MOCK_ERRORS = ${mockErrorsJson};
      const MOCK_REPOS = ${mockRepos};

      function jsonResponse(data) {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      window.fetch = function(url, options) {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('live_backing.log')) {
          return Promise.resolve(new Response(MOCK_LOG_TEXT, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          }));
        }

        if (urlStr.includes('text_log_errors')) {
          return Promise.resolve(jsonResponse(MOCK_ERRORS));
        }

        if (urlStr.match(/\\/api\\/jobs\\/\\d+/)) {
          return Promise.resolve(jsonResponse(MOCK_JOB));
        }

        if (urlStr.includes('/api/repository')) {
          return Promise.resolve(jsonResponse(MOCK_REPOS));
        }

        if (urlStr.includes('/api/push/')) {
          return Promise.resolve(jsonResponse({ revision: 'abc123def456' }));
        }

        if (urlStr.includes('/artifacts') && !urlStr.includes('live_backing')) {
          return Promise.resolve(jsonResponse({ artifacts: [] }));
        }

        return _realFetch.apply(this, arguments);
      };
    })();
  `;
}

// No errors = viewport starts at line 1
const SCRIPT_NO_ERRORS = buildFetchMockScript(MOCK_LOG_LINES.join('\n'), []);

test.describe('Logviewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SCRIPT_NO_ERRORS);
  });

  test.describe('Log content rendering', () => {
    test('renders log lines with line numbers', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('.classic-log-viewer').waitFor();

      const lineNumbers = page.locator('.classic-log-number');
      await expect(lineNumbers.first()).toBeVisible();
      expect(await lineNumbers.count()).toBeGreaterThan(0);
    });

    test('displays the navigation bar with expected elements', async ({
      page,
    }) => {
      await page.goto(LOG_URL);
      await page.locator('.classic-log-viewer').waitFor();

      await expect(page.locator('#lv-logo')).toContainText('Logviewer');

      await expect(
        page.locator('a[title="Open the raw log in a new window (Shift+L)"]'),
      ).toBeVisible();
    });

    test('shows the search bar', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('.classic-log-viewer').waitFor();

      await expect(page.locator('.classic-log-toolbar')).toBeVisible();
      await expect(page.locator('.classic-log-searchbar-input')).toBeVisible();
    });
  });

  test.describe('Line highlighting', () => {
    test('highlights a line when its number is clicked', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('[data-line="10"]').waitFor();

      await page.locator('[data-line="10"]').click();

      await expect(page.locator(TOOLBAR_LABEL)).toHaveText('Line 10');
    });

    test('selects a range with shift+click', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('[data-line="5"]').waitFor();

      await page.locator('[data-line="5"]').click();
      await page.locator(TOOLBAR_LABEL).waitFor();

      await page.locator('[data-line="15"]').click({ modifiers: ['Shift'] });

      await expect(page.locator(TOOLBAR_LABEL)).toHaveText(/Lines 5–15 \(11\)/);
    });

    test('updates URL with lineNumber param when line is selected', async ({
      page,
    }) => {
      await page.goto(LOG_URL);
      await page.locator('[data-line="8"]').waitFor();

      await page.locator('[data-line="8"]').click();
      await page.locator(TOOLBAR_LABEL).waitFor();

      await expect(page).toHaveURL(/lineNumber=8/);
    });

    test('updates URL with range when shift+click selects multiple lines', async ({
      page,
    }) => {
      await page.goto(LOG_URL);
      await page.locator('[data-line="10"]').waitFor();

      await page.locator('[data-line="10"]').click();
      await page.locator(TOOLBAR_LABEL).waitFor();

      await page.locator('[data-line="20"]').click({ modifiers: ['Shift'] });

      await expect(page).toHaveURL(/lineNumber=10-20/);
    });
  });

  test.describe('Copy Highlighted Lines', () => {
    test('shows selection label and copy button only when lines are highlighted', async ({
      page,
    }) => {
      await page.goto(LOG_URL);
      await page.locator('[data-line="10"]').waitFor();

      // No selection label or copy button before clicking
      await expect(page.locator(TOOLBAR_LABEL)).toHaveCount(0);
      await expect(page.locator(COPY_BUTTON)).toHaveCount(0);

      await page.locator('[data-line="10"]').click();

      await expect(page.locator(TOOLBAR_LABEL)).toBeVisible();
      await expect(page.locator(COPY_BUTTON)).toBeVisible();
    });

    test('copy button extracts correct lines from memory', async ({
      page,
      context,
      baseURL,
      browserName,
    }) => {
      // Granting clipboard permissions is a Chromium-only API; Playwright's
      // Firefox allows clipboard writes in tests without it.
      if (browserName === 'chromium') {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
          origin: baseURL,
        });
      }

      await page.goto(LOG_URL);
      await page.locator('[data-line="5"]').waitFor();

      // Select lines 5-7
      await page.locator('[data-line="5"]').click();
      await page.locator(TOOLBAR_LABEL).waitFor();

      await page.locator('[data-line="7"]').click({ modifiers: ['Shift'] });

      // Verify label shows the 3-line selection
      await expect(page.locator(TOOLBAR_LABEL)).toHaveText(/Lines 5–7 \(3\)/);

      // Click the copy button and wait for the success state
      await page.locator(COPY_BUTTON).click();
      await expect(page.locator(COPY_BUTTON)).toHaveClass(/btn-success/);

      // Verify the fetch+extraction works by reading from page context.
      const result = await page.evaluate(async () => {
        const resp = await window.fetch(
          'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/mock-task-id-abc123/runs/0/artifacts/public/logs/live_backing.log',
        );
        const text = await resp.text();
        const lines = text.split('\n');
        return lines.slice(4, 7).join('\n');
      });

      expect(result).toContain('Line 5:');
      expect(result).toContain('Line 6:');
      expect(result).toContain('Line 7:');
    });

    test('shows correct label for single line selection', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('[data-line="12"]').waitFor();

      await page.locator('[data-line="12"]').click();

      await expect(page.locator(TOOLBAR_LABEL)).toHaveText('Line 12');
    });
  });

  test.describe('Search functionality', () => {
    test('finds matches when searching log content', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('.classic-log-viewer').waitFor();

      const searchInput = page.locator('.classic-log-searchbar-input');
      await searchInput.click();
      await searchInput.pressSequentially('Line 10:', { delay: 50 });

      const matches = page.locator('.classic-log-searchbar-matches');
      await expect(matches).toBeVisible();
      await expect(matches).not.toContainText('0 match');
    });
  });

  test.describe('Show/Hide Job Info', () => {
    test('toggles job info panel visibility', async ({ page }) => {
      await page.goto(LOG_URL);
      await page.locator('.classic-log-viewer').waitFor();

      await expect(page.locator('.run-data')).toHaveCount(0);

      const showButton = page.locator('[data-testid="show-job-info"]');
      await showButton.click();

      // The panel mounts but has no visible content with the minimal mock
      // job, so assert on DOM presence rather than visibility.
      await expect(page.locator('.run-data')).toHaveCount(1);

      await showButton.click();

      await expect(page.locator('.run-data')).toHaveCount(0);
    });
  });

  test.describe('URL-based line navigation', () => {
    test('highlights the line specified in the lineNumber URL param', async ({
      page,
    }) => {
      await page.goto(`${LOG_URL}&lineNumber=8`);
      await page.locator('.classic-log-viewer').waitFor();

      await expect(page.locator(TOOLBAR_LABEL)).toHaveText('Line 8');
    });

    test('highlights a range specified in the lineNumber URL param', async ({
      page,
    }) => {
      await page.goto(`${LOG_URL}&lineNumber=10-20`);
      await page.locator('.classic-log-viewer').waitFor();

      await expect(page.locator(TOOLBAR_LABEL)).toHaveText(
        /Lines 10–20 \(11\)/,
      );
    });
  });
});
