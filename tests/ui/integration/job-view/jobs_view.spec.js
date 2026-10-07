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
    'https://treestatus.prod.lando.prod.cloudops.mozgcp.net/**',
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

    if (test.info().project.name === 'mobile-firefox') {
      await page.getByRole('button', { name: 'Show job filters' }).click();
    }

    const quickFilter = page.locator('#quick-filter');
    await quickFilter.fill('yaml');
    await quickFilter.press('Enter');

    await expect(page).toHaveURL(/searchStr=yaml/);

    // Non-matching jobs are removed from the push list; matching ones remain.
    await expect(buildJobs).toHaveCount(0);
    await expect(yamlJobs.first()).toBeVisible();
  });

  test('mobile job field filters keep their actions in view', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-firefox');

    await page.getByRole('button', { name: 'Show job filters' }).click();
    await page.locator('button[title="Filter by a job field"]').click();

    const form = page.locator('.active-filters-bar form');
    await expect(form.getByRole('textbox', { name: 'Value' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'add' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'cancel' })).toBeVisible();
    expect(
      await form.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);

    await page
      .getByRole('combobox', { name: 'Field' })
      .selectOption('failure_classification_id');
    await expect(page.locator('#job-filter-choice-value')).toBeVisible();
    expect(
      await form.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  });

  test('mobile navigation and job details preserve the browsing flow', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-firefox');

    await expect(
      page.getByRole('button', { name: 'Open navigation' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(
      page.locator('#mobile-navigation').getByRole('button', { name: 'Repos' }),
    ).toBeVisible();
    await page
      .locator('#mobile-navigation')
      .getByRole('button', { name: 'Close' })
      .click();

    await expect(
      page.locator('#watched-repo-navbar .btn-watched-repo.active'),
    ).toBeVisible();
    const repoInfo = page
      .locator('#watched-repo-navbar .watched-repos .dropdown-toggle')
      .first();
    await expect(repoInfo).toBeVisible();
    await repoInfo.click();
    expect(
      await page.evaluate(() => {
        const row = document.querySelector(
          '#watched-repo-navbar .watched-repos',
        );
        const menu = row.querySelector('.dropdown-menu.show');
        const rect = menu.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + 16, rect.top + 24);
        return (
          rect.bottom > row.getBoundingClientRect().bottom && menu.contains(hit)
        );
      }),
    ).toBe(true);
    await repoInfo.click();
    await expect(page.locator('#quick-filter')).toBeHidden();
    await page.getByRole('button', { name: 'Show job filters' }).click();
    const quickFilter = page.locator('#quick-filter');
    await expect(quickFilter).toBeVisible();
    await quickFilter.fill('yaml');
    await quickFilter.press('Enter');
    await expect(page).toHaveURL(/searchStr=yaml/);
    await expect(
      page.getByRole('button', { name: 'Hide job filters' }),
    ).toBeVisible();
    await expect(quickFilter).toBeVisible();
    await quickFilter.fill('');
    await quickFilter.press('Enter');
    await expect(page).not.toHaveURL(/searchStr=/);
    await page.getByRole('button', { name: 'Hide job filters' }).click();
    await expect(quickFilter).toBeHidden();
    await expect(page.getByTestId('push-header').first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.getByTestId('job-btn').filter({ hasText: 'B' }).first().click();
    await expect(page.locator('.mobile-job-details')).toBeVisible();
    await expect(
      page.locator('.mobile-job-details #details-panel'),
    ).toContainText(BUILD_JOB.job_type_name);
    const sheet = page.locator('.mobile-job-details');
    await expect(sheet).toHaveCSS('height', '84px');
    await sheet
      .getByRole('slider', { name: 'Resize job details' })
      .press('End');
    await expect(sheet).toHaveCSS('height', '844px');
    await expect(
      page.locator('.mobile-job-details #pinboard-btn'),
    ).toBeHidden();
    const selectedTab = sheet.locator(
      '.tab-header-tabs [role="tab"].selected-tab',
    );
    await expect(selectedTab).toBeVisible();
    await sheet.getByRole('button', { name: 'More tab options' }).click();
    await sheet
      .locator('.tab-overflow-menu')
      .getByText('Artifacts and Debugging Tools')
      .click();
    await expect(
      sheet.getByRole('tab', { name: 'Artifacts and Debugging Tools' }),
    ).toBeVisible();
    await expect(sheet.locator('.tab-overflow-menu')).toBeHidden();
    await expect(page).toHaveURL(
      new RegExp(`selectedTaskRun=${BUILD_JOB.task_id}`),
    );

    await page.reload();
    await expect(
      page.locator('.mobile-job-details #details-panel'),
    ).toBeVisible();
    await page
      .locator('.mobile-job-details')
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(page).not.toHaveURL(/selectedTaskRun=/);
    await expect(page.getByTestId('push-header').first()).toBeVisible();
  });

  test('mobile Similar Jobs opens details from a list row', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-firefox');

    const jobIdIndex = jobList.job_property_names.indexOf('id');
    await page.route('**/api/failureclassification/', (route) =>
      route.fulfill(json([{ id: 1, name: 'Not classified' }])),
    );
    await page.route(
      `**/api/project/autoland/jobs/${BUILD_JOB.id}/similar_jobs/**`,
      (route) =>
        route.fulfill(
          json({
            job_property_names: jobList.job_property_names,
            results: jobList.results.filter(
              (row) => row[jobIdIndex] === BUILD_JOB.id,
            ),
          }),
        ),
    );
    await page.route('**/api/project/autoland/push/**', (route) => {
      if (new URL(route.request().url()).searchParams.has('id__in')) {
        return route.fulfill(json({ results: [pushList.results[0]] }));
      }
      return route.fallback();
    });
    await page.goto('/jobs?repo=autoland');

    await page.getByTestId('job-btn').filter({ hasText: 'B' }).first().click();
    const sheet = page.locator('.mobile-job-details');
    await sheet
      .getByRole('slider', { name: 'Resize job details' })
      .press('End');
    await sheet.getByRole('button', { name: 'More tab options' }).click();
    await sheet.locator('.tab-overflow-menu').getByText('Similar Jobs').click();

    const similarJobs = sheet.getByRole('region', { name: 'Similar Jobs' });
    const details = similarJobs.locator('.similar-job-detail-panel');
    await expect(
      similarJobs.getByLabel('Exclude successful jobs'),
    ).toBeVisible();
    await expect(
      similarJobs.locator('.similar-job-list tbody tr').first(),
    ).toBeVisible();
    await expect(details).toBeHidden();

    await similarJobs
      .locator('.similar-job-list tbody tr')
      .first()
      .locator('td')
      .first()
      .click();
    await expect(details).toBeVisible();
    await expect(details).toContainText('Job name');
    await details.getByRole('button', { name: 'Back to similar jobs' }).click();
    await expect(details).toBeHidden();
    await expect(similarJobs.locator('.similar-job-list')).toBeVisible();
  });
});
