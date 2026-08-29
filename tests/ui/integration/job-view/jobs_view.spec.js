/**
 * Integration tests for the Jobs view: rendering the push list,
 * selecting a job, viewing the details panel, and quick filtering.
 *
 * API responses are served from the JSON fixtures in tests/ui/mock/
 * (the same fixtures the Jest unit tests use), so the tests are
 * deterministic and independent of any backend.
 */

const fs = require('node:fs');
const path = require('node:path');

const { test, expect } = require('@playwright/test');

const MOCK_DIR = path.resolve(__dirname, '../../mock');
const loadFixture = (file) =>
  JSON.parse(fs.readFileSync(path.join(MOCK_DIR, file), 'utf8'));

const repositories = loadFixture('repositories.json');
const pushList = loadFixture('push_list.json');
const jobList = loadFixture('job_list/job_1.json');
const taskDefinition = loadFixture('task_definition.json');

// The job list endpoint returns rows of values keyed by job_property_names;
// zip them into objects for the /jobs/{id}/ detail endpoint.
const jobsById = new Map(
  jobList.results.map((row) => {
    const job = Object.fromEntries(
      jobList.job_property_names.map((name, i) => [name, row[i]]),
    );
    return [job.id, job];
  }),
);

// The busted build job on the first push in push_list.json.
const BUILD_JOB = [...jobsById.values()].find(
  (job) => job.job_type_symbol === 'B',
);

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function mockJobsViewApi(page) {
  await page.route('**/revision.txt', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'abc123' }),
  );
  await page.route('**/api/repository/', (route) =>
    route.fulfill(json(repositories)),
  );
  await page.route('**/api/user/', (route) => route.fulfill(json([])));
  await page.route('**/api/failureclassification/', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/performance/framework/', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/performance/tag/', (route) =>
    route.fulfill(json([])),
  );

  // Initial push list; polling and other push queries get empty results.
  await page.route('**/api/project/autoland/push/**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('count') === '10') {
      return route.fulfill(json(pushList));
    }
    return route.fulfill(json({ results: [] }));
  });

  // Job list per push.
  await page.route('**/api/jobs/**', (route) => route.fulfill(json(jobList)));

  // Details panel endpoints for the selected job.
  await page.route('**/api/project/autoland/jobs/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (
      pathname.endsWith('/text_log_errors/') ||
      pathname.endsWith('/bug_suggestions/')
    ) {
      return route.fulfill(json([]));
    }
    const match = pathname.match(/\/jobs\/(\d+)\/$/);
    const job = match && jobsById.get(Number(match[1]));
    if (job) {
      return route.fulfill(json(job));
    }
    return route.fulfill(json([]));
  });
  await page.route('**/api/project/autoland/note/**', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/project/autoland/bug-job-map/**', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/project/autoland/performance/job-data/**', (route) =>
    route.fulfill(json([])),
  );
  await page.route('**/api/project/autoland/job-log-url/**', (route) =>
    route.fulfill(json([])),
  );

  // External services.
  await page.route(
    'https://lando.moz.tools/**',
    (route) =>
      route.fulfill(
        json({ result: { status: 'open', reason: '', tree: 'autoland' } }),
      ),
  );
  await page.route('https://firefox-ci-tc.services.mozilla.com/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/artifacts')) {
      return route.fulfill(json({ artifacts: [] }));
    }
    if (pathname.includes(`/api/queue/v1/task/${BUILD_JOB.task_id}`)) {
      return route.fulfill(json(taskDefinition));
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.route('https://bugzilla.mozilla.org/rest/bug**', (route) =>
    route.fulfill(json({ bugs: [] })),
  );
}

test.describe('Jobs View', () => {
  test.beforeEach(async ({ page }) => {
    await mockJobsViewApi(page);
    await page.goto('/jobs?repo=autoland');
  });

  test('renders the push list with job buttons', async ({ page }) => {
    await expect(page.getByTestId('push-header').first()).toBeVisible();

    await expect(
      page.getByTestId('job-btn').filter({ hasText: 'B' }).first(),
    ).toBeVisible();
  });

  test('selecting a job shows the details panel', async ({ page }) => {
    const buildJob = page
      .getByTestId('job-btn')
      .filter({ hasText: 'B' })
      .first();
    await buildJob.click();

    await expect(page.locator('.job-btn.selected-job').first()).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`selectedTaskRun=${BUILD_JOB.task_id}`),
    );

    const detailsPanel = page.locator('#details-panel');
    await expect(detailsPanel).toBeVisible();
    await expect(detailsPanel).toContainText(BUILD_JOB.job_type_name);
  });

  test('quick filter narrows the displayed jobs', async ({ page }) => {
    const buildJobs = page.getByTestId('job-btn').filter({ hasText: 'B' });
    const yamlJobs = page.getByTestId('job-btn').filter({ hasText: 'yaml' });

    await expect(buildJobs.first()).toBeVisible();
    await expect(yamlJobs.first()).toBeVisible();

    const quickFilter = page.locator('#quick-filter');
    await quickFilter.fill('yaml');
    await quickFilter.press('Enter');

    await expect(page).toHaveURL(/searchStr=yaml/);

    // Non-matching jobs are removed from the push list; matching ones remain.
    await expect(buildJobs).toHaveCount(0);
    await expect(yamlJobs.first()).toBeVisible();
  });
});
