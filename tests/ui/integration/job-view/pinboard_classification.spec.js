/**
 * Integration tests for the pinboard and the classification flow:
 * pinning jobs (keyboard, details panel, push header), attaching
 * related bugs, and saving classifications both logged out and
 * logged in.
 */

const { test, expect } = require('@playwright/test');

const {
  mockJobsViewApi,
  seedLoggedInSession,
  BUILD_JOB,
  SHERIFF_USER,
} = require('./mockJobsApi');

// The same fixture job list is served for every push, so a selected
// job lights up its copy on each push — assert on the first copy.
const selectBuildJob = async (page) => {
  await page.getByTestId('job-btn').filter({ hasText: /^B$/ }).first().click();
  await expect(
    page.locator('#push-list .job-btn.selected-job').first(),
  ).toBeVisible();
};

test.describe('Pinboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockJobsViewApi(page);
    await page.goto('/jobs?repo=autoland');
    await expect(page.getByTestId('push-header').first()).toBeVisible();
  });

  test('spacebar pins the selected job', async ({ page }) => {
    await selectBuildJob(page);
    await page.keyboard.press(' ');

    const pinboard = page.locator('#pinboard-panel');
    await expect(pinboard).toBeVisible();
    await expect(pinboard.locator('.pinned-job')).toHaveText('B');

    // Un-pinning the job leaves the pinboard empty again.
    await pinboard.getByTitle('un-pin this job').click();
    await expect(pinboard.locator('.pinned-job')).toHaveCount(0);
    await expect(pinboard).toContainText(
      'press spacebar to pin a selected job',
    );
  });

  test('the details panel pin button pins the selected job', async ({
    page,
  }) => {
    await selectBuildJob(page);
    await page.locator('#pin-job-btn').click();

    const pinboard = page.locator('#pinboard-panel');
    await expect(pinboard).toBeVisible();
    await expect(pinboard.locator('.pinned-job')).toHaveText('B');
  });

  test('the push header pin-all button pins every shown job on the push', async ({
    page,
  }) => {
    await page.locator('.pin-all-jobs-btn').first().click();

    const pinboard = page.locator('#pinboard-panel');
    await expect(pinboard).toBeVisible();
    // The fixture push has five jobs: D, B, yaml, Cpp and Meh.
    await expect(pinboard.locator('.pinned-job')).toHaveCount(5);
  });

  test('"b" pins the job and adds a related bug to the pinboard', async ({
    page,
  }) => {
    await selectBuildJob(page);
    await page.keyboard.press('b');

    const bugInput = page.locator('#related-bug-input');
    await expect(bugInput).toBeVisible();
    await expect(bugInput).toBeFocused();

    await bugInput.fill('123456');
    await bugInput.press('Enter');

    await expect(page.getByTestId('pinboard-bug-123456')).toBeVisible();
    await expect(
      page.locator('#pinboard-panel .pinned-job'),
    ).toHaveText('B');
  });
});

test.describe('Classification', () => {
  test('saving while logged out shows an error notification', async ({
    page,
  }) => {
    await mockJobsViewApi(page);
    await page.goto('/jobs?repo=autoland');
    await selectBuildJob(page);

    await page.keyboard.press(' ');
    await expect(
      page.locator('#pinboard-panel .pinned-job'),
    ).toHaveText('B');

    // The save button is pointer-inert while it can't save, so use the
    // keyboard shortcut, which is also how sheriffs normally save.
    await page.keyboard.press('Control+Enter');

    await expect(page.locator('#notification-box')).toContainText(
      'Must be logged in to save job classifications',
    );
  });

  test('a logged-in user can classify a pinned job with a bug', async ({
    page,
  }) => {
    await seedLoggedInSession(page);
    const captured = await mockJobsViewApi(page, { user: [SHERIFF_USER] });
    await page.goto('/jobs?repo=autoland');

    // Wait for the app to acknowledge the logged-in user.
    await expect(page.locator('#th-global-navbar')).toContainText(
      'Sheriff Tester',
    );

    await selectBuildJob(page);
    await page.keyboard.press(' ');
    const pinboard = page.locator('#pinboard-panel');
    await expect(pinboard.locator('.pinned-job')).toHaveText('B');

    // Attach a bug; the default classification type is "intermittent",
    // which requires a bug or a comment on non-try repos.
    await page.locator('#add-related-bug-button').click();
    const bugInput = page.locator('#related-bug-input');
    await bugInput.fill('123456');
    await bugInput.press('Enter');
    await expect(page.getByTestId('pinboard-bug-123456')).toBeVisible();

    await expect(
      pinboard.locator('#pinboard-classification-select'),
    ).toHaveValue('4');

    await pinboard.locator('.save-btn').click();

    // The classification and the bug association are written to the API...
    await expect
      .poll(() => captured.notes.length, { message: 'note POST sent' })
      .toBe(1);
    expect(captured.notes[0]).toMatchObject({
      job_id: BUILD_JOB.id,
      failure_classification_id: 4,
    });

    await expect
      .poll(() => captured.bugJobMaps.length, {
        message: 'bug-job-map POST sent',
      })
      .toBe(1);
    expect(captured.bugJobMaps[0]).toMatchObject({
      job_id: BUILD_JOB.id,
      bug_id: 123456,
      type: 'annotation',
    });

    // ...and the pinboard is cleared after a successful save.
    await expect(pinboard.locator('.pinned-job')).toHaveCount(0);
    await expect(pinboard).toContainText(
      'press spacebar to pin a selected job',
    );

    // The job now renders as classified in the push list: its button
    // on its own push gains the star icon and the classified marker.
    // (The star svg's <title> adds "classified" to the button text,
    // so a /^B$/ text filter would miss the classified button.)
    const jobPush = page.getByTestId(`push-${BUILD_JOB.push_id}`);
    const classifiedB = jobPush
      .locator('[data-testid="job-btn"][data-classified="true"]')
      .filter({ hasText: /^B/ });
    await expect(classifiedB).toHaveCount(1);
    await expect(classifiedB.locator('.classified-icon')).toBeVisible();

    // Deselect first (a selected job stays visible regardless of
    // filters), then filter to unclassified failures: the newly
    // classified job is no longer shown on its push.
    // Blur the related-bug input first: keyboard shortcuts are
    // ignored while an input has focus, and Firefox does not move
    // focus on button clicks.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/selectedTaskRun=/);
    await page.keyboard.press('u');
    await expect(page).toHaveURL(/classifiedState=unclassified/);
    await expect(
      jobPush.locator('[data-testid="job-btn"]').filter({ hasText: /^B/ }),
    ).toHaveCount(0);
  });
});
