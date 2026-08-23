/**
 * Integration tests for job selection in the Jobs view: deep links,
 * keyboard navigation between jobs, and clearing the selection.
 *
 * Job selection is URL-first (the selectedTaskRun param is the source
 * of truth), so these tests assert both the visible selection and the
 * URL staying in sync — a recurring regression area.
 */

const { test, expect } = require('@playwright/test');

const {
  mockJobsViewApi,
  jobBySymbol,
  taskRunStr,
  BUILD_JOB,
} = require('./mockJobsApi');

// The two unclassified failures on each push: B (busted) and Meh
// (testfailed). Cpp is testfailed but already classified.
const MEH_JOB = jobBySymbol('Meh');

// The selected job's button on the push list. The same fixture job
// list is served for every push, so a selected job lights up its copy
// on each push — assert on the first copy.
const selectedJob = (page) =>
  page.locator('#push-list .job-btn.selected-job').first();

const clickJob = (page, symbol) =>
  page
    .getByTestId('job-btn')
    .filter({ hasText: new RegExp(`^${symbol}$`) })
    .first()
    .click();

test.describe('Job selection', () => {
  test('deep link with selectedTaskRun selects the job on load', async ({
    page,
  }) => {
    await mockJobsViewApi(page);
    await page.goto(
      `/jobs?repo=autoland&selectedTaskRun=${taskRunStr(BUILD_JOB)}`,
    );

    await expect(selectedJob(page)).toBeVisible();

    const detailsPanel = page.locator('#details-panel');
    await expect(detailsPanel).toBeVisible();
    await expect(detailsPanel).toContainText(BUILD_JOB.job_type_name);
  });

  test.describe('with the default view loaded', () => {
    test.beforeEach(async ({ page }) => {
      await mockJobsViewApi(page);
      await page.goto('/jobs?repo=autoland');
      await expect(page.getByTestId('push-header').first()).toBeVisible();
      // Keyboard navigation needs the job buttons rendered.
      await expect(page.getByTestId('job-btn').first()).toBeVisible();
    });

    test('"n" and "p" step through unclassified failures and update the URL', async ({
      page,
    }) => {
      // First "n" selects the first unclassified failure: the busted B job.
      await page.keyboard.press('n');
      await expect(selectedJob(page)).toHaveText('B');
      await expect(page).toHaveURL(
        new RegExp(`selectedTaskRun=${taskRunStr(BUILD_JOB)}`),
      );

      // Next unclassified failure on the same push is the Meh job
      // (Cpp is skipped because it is already classified).
      await page.keyboard.press('n');
      await expect(selectedJob(page)).toHaveText('Meh');
      await expect(page).toHaveURL(
        new RegExp(`selectedTaskRun=${taskRunStr(MEH_JOB)}`),
      );

      // "p" steps back to the previous unclassified failure.
      await page.keyboard.press('p');
      await expect(selectedJob(page)).toHaveText('B');
      await expect(page).toHaveURL(
        new RegExp(`selectedTaskRun=${taskRunStr(BUILD_JOB)}`),
      );
    });

    test('arrow keys step through all jobs regardless of status', async ({
      page,
    }) => {
      await clickJob(page, 'B');
      await expect(selectedJob(page)).toHaveText('B');

      // Right arrow moves to the next job of any result status — the
      // already-classified Cpp job, which "n"/"p" would skip.
      await page.keyboard.press('ArrowRight');
      await expect(selectedJob(page)).toHaveText(/^Cpp/);

      await page.keyboard.press('ArrowLeft');
      await expect(selectedJob(page)).toHaveText('B');
    });

    test('escape clears the selected job and the URL param', async ({
      page,
    }) => {
      await clickJob(page, 'B');
      await expect(selectedJob(page)).toBeVisible();
      await expect(page).toHaveURL(/selectedTaskRun=/);

      await page.keyboard.press('Escape');

      await expect(
        page.locator('#push-list .job-btn.selected-job'),
      ).toHaveCount(0);
      await expect(page).not.toHaveURL(/selectedTaskRun=/);
    });

    test('browser back after selecting a job clears the selection', async ({
      page,
    }) => {
      await clickJob(page, 'B');
      await expect(selectedJob(page)).toBeVisible();
      await expect(page).toHaveURL(/selectedTaskRun=/);

      // Selecting a job can push more than one (identical) history
      // entry, so step back until we reach the pre-selection entry.
      let backSteps = 0;
      do {
        await page.goBack();
        backSteps += 1;
      } while (/selectedTaskRun=/.test(page.url()) && backSteps < 5);

      await expect(page).not.toHaveURL(/selectedTaskRun=/);
      await expect(
        page.locator('#push-list .job-btn.selected-job'),
      ).toHaveCount(0);
    });
  });
});
