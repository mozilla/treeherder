/**
 * Integration tests for the Jobs view: rendering the push list,
 * selecting a job, viewing the details panel, and filtering.
 *
 * API responses are served from the JSON fixtures in tests/ui/mock/
 * via the shared mocks in mockJobsApi.js, so the tests are
 * deterministic and independent of any backend.
 */

const { test, expect } = require('@playwright/test');

const { mockJobsViewApi, BUILD_JOB } = require('./mockJobsApi');

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

  test('"u" toggles the unclassified-failures filter', async ({ page }) => {
    const successJobs = page.getByTestId('job-btn').filter({ hasText: /^D$/ });
    const classifiedJobs = page
      .getByTestId('job-btn')
      .filter({ hasText: /^Cpp/ });
    const bustedJobs = page.getByTestId('job-btn').filter({ hasText: /^B$/ });

    await expect(successJobs.first()).toBeVisible();
    await expect(classifiedJobs.first()).toBeVisible();

    await page.keyboard.press('u');

    await expect(page).toHaveURL(/classifiedState=unclassified/);
    await expect(page).toHaveURL(/resultStatus=testfailed/);

    // Successful and already-classified jobs are filtered out;
    // unclassified failures remain.
    await expect(successJobs).toHaveCount(0);
    await expect(classifiedJobs).toHaveCount(0);
    await expect(bustedJobs.first()).toBeVisible();

    // Toggling again restores the unfiltered view.
    await page.keyboard.press('u');

    await expect(page).not.toHaveURL(/classifiedState/);
    await expect(successJobs.first()).toBeVisible();
    await expect(classifiedJobs.first()).toBeVisible();
  });
});

test.describe('Jobs View deep links', () => {
  test('loading a URL with searchStr applies the filter', async ({ page }) => {
    await mockJobsViewApi(page);
    await page.goto('/jobs?repo=autoland&searchStr=yaml');

    await expect(
      page.getByTestId('job-btn').filter({ hasText: 'yaml' }).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('job-btn').filter({ hasText: /^B$/ }),
    ).toHaveCount(0);
  });
});
