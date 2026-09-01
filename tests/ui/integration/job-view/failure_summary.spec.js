/**
 * Integration tests for the Failure Summary tab: bug suggestions
 * rendered for a failed job, and classifying a job from a suggested
 * bug through the pinboard.
 *
 * The bug suggestions themselves come from the bug_suggestions.json
 * fixture; generating them is backend logic covered by pytest
 * (tests/model/test_error_summary.py). These tests cover the wiring:
 * selected job -> failure summary tab -> pinboard -> save.
 */

const { test, expect } = require('@playwright/test');

const {
  mockJobsViewApi,
  seedLoggedInSession,
  BUILD_JOB,
  SHERIFF_USER,
  BUG_SUGGESTIONS,
} = require('./mockJobsApi');

// The open, recent bug on the first suggestion in bug_suggestions.json.
const SUGGESTED_BUG = BUG_SUGGESTIONS[0].bugs.open_recent[0];

const selectBuildJob = async (page) => {
  await page.getByTestId('job-btn').filter({ hasText: /^B$/ }).first().click();
  await expect(
    page.locator('#push-list .job-btn.selected-job').first(),
  ).toBeVisible();
};

// The pin button on the suggested bug's row in the failure summary.
const suggestedBugPinButton = (page, bugId) =>
  page
    .getByTestId('bug-list-item')
    .filter({ hasText: `bug ${bugId}` })
    .first()
    .getByTitle('Add to list of bugs to associate with all pinned jobs');

test.describe('Failure summary tab', () => {
  test('shows bug suggestions for a failed job', async ({ page }) => {
    await mockJobsViewApi(page, { bugSuggestions: BUG_SUGGESTIONS });
    await page.goto('/jobs?repo=autoland');
    await selectBuildJob(page);

    // The failure summary is the default tab for a failed job.
    await expect(
      page.getByRole('tab', { name: 'Failure Summary', selected: true }),
    ).toBeVisible();

    // The failure line and its suggested bug are rendered.
    const detailsPanel = page.locator('#details-panel');
    await expect(detailsPanel).toContainText(BUG_SUGGESTIONS[0].search);
    await expect(
      detailsPanel.getByRole('link', {
        name: new RegExp(`bug ${SUGGESTED_BUG.id}`),
      }),
    ).toBeVisible();
  });

  test('pinning a suggested bug pins the job with the bug attached', async ({
    page,
  }) => {
    await mockJobsViewApi(page, { bugSuggestions: BUG_SUGGESTIONS });
    await page.goto('/jobs?repo=autoland');
    await selectBuildJob(page);

    await suggestedBugPinButton(page, SUGGESTED_BUG.id).click();

    const pinboard = page.locator('#pinboard-panel');
    await expect(pinboard).toBeVisible();
    await expect(pinboard.locator('.pinned-job')).toHaveText('B');
    await expect(
      page.getByTestId(`pinboard-bug-${SUGGESTED_BUG.id}`),
    ).toBeVisible();
  });

  test('a logged-in user can classify from a suggested bug', async ({
    page,
  }) => {
    await seedLoggedInSession(page);
    const captured = await mockJobsViewApi(page, {
      user: [SHERIFF_USER],
      bugSuggestions: BUG_SUGGESTIONS,
    });
    await page.goto('/jobs?repo=autoland');
    await expect(page.locator('#th-global-navbar')).toContainText(
      'Sheriff Tester',
    );

    await selectBuildJob(page);
    await suggestedBugPinButton(page, SUGGESTED_BUG.id).click();

    const pinboard = page.locator('#pinboard-panel');
    await expect(
      page.getByTestId(`pinboard-bug-${SUGGESTED_BUG.id}`),
    ).toBeVisible();

    await pinboard.locator('.save-btn').click();

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
      bug_id: SUGGESTED_BUG.id,
      type: 'annotation',
    });

    // The pinboard is cleared after a successful save.
    await expect(pinboard.locator('.pinned-job')).toHaveCount(0);

    // The job now renders as classified in the push list: its button
    // on its own push gains the star icon and the classified marker.
    // (The star svg's <title> adds "classified" to the button text,
    // so a /^B$/ text filter would miss the classified button.)
    const classifiedB = page
      .getByTestId(`push-${BUILD_JOB.push_id}`)
      .locator('[data-testid="job-btn"][data-classified="true"]')
      .filter({ hasText: /^B/ });
    await expect(classifiedB).toHaveCount(1);
    await expect(classifiedB.locator('.classified-icon')).toBeVisible();
  });
});
