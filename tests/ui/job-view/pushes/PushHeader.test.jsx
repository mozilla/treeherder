import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import PushHeader from '../../../../ui/job-view/pushes/PushHeader';

const jobCounts = {
  completed: 0,
  fixedByCommit: 0,
  pending: 0,
  running: 0,
  test_failed: 0,
  build_failed: 0,
  lint_failed: 0,
};

const renderHeader = (props = {}) =>
  render(
    <MemoryRouter initialEntries={['/jobs?repo=try']}>
      <PushHeader
        push={{ id: 1 }}
        pushId={1}
        pushTimestamp={1378293517}
        author="someone@mozilla.com"
        revision="abc123"
        filterModel={{ getUrlParamsWithoutDefaults: () => ({}) }}
        runnableVisible={false}
        showRunnableJobs={() => {}}
        hideRunnableJobs={() => {}}
        showFuzzyJobs={() => {}}
        cycleWatchState={() => {}}
        expandAllPushGroups={() => {}}
        notificationSupported={false}
        getAllShownJobs={() => {}}
        selectedRunnableJobs={[]}
        collapsed={false}
        jobCounts={jobCounts}
        pushHealthVisibility="None"
        decisionTaskMap={{}}
        currentRepo={{ name: 'try' }}
        togglePushCollapsed={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('PushHeader branch badge', () => {
  test('shows the branch a push came from when set', () => {
    const { getByTestId } = renderHeader({ branch: 'releases/v1.2' });

    expect(getByTestId('push-branch-badge')).toHaveTextContent('releases/v1.2');
  });

  test('is hidden when the push has no branch', () => {
    const { queryByTestId } = renderHeader({ branch: null });

    expect(queryByTestId('push-branch-badge')).toBeNull();
  });
});

describe('PushHeader perf compare link', () => {
  const baseRevision = 'ba9c692786e95143b8df3f4b3e9b504dfbc589a0';
  const renderWithComments = (comments) =>
    renderHeader({ push: { id: 1, revisions: [{ comments }] } });

  test('links to the comparison with the recorded base revision', () => {
    const { getByTestId } = renderWithComments(
      `Perf base revision=${baseRevision}\nPerf framework=13`,
    );

    expect(getByTestId('push-perf-compare-link')).toHaveAttribute(
      'href',
      `https://perf.compare/compare-results?baseRev=${baseRevision}&baseRepo=try&newRev=abc123&newRepo=try&framework=13&sort=delta|desc`,
    );
  });

  test('links to the comparison with the recorded base lando landing job', () => {
    const { getByTestId } = renderWithComments(
      'Perf base lando job=lando-prod-2025/72544\nPerf framework=13',
    );

    expect(getByTestId('push-perf-compare-link')).toHaveAttribute(
      'href',
      'https://perf.compare/compare-lando-results?landoInstance=lando-prod-2025&baseLando=72544&baseRepo=try&newRev=abc123&newRepo=try&framework=13',
    );
  });

  test('is hidden on pushes that record no base push', () => {
    const { queryByTestId } = renderWithComments('Bug 1 - A patch');

    expect(queryByTestId('push-perf-compare-link')).toBeNull();
  });
});
