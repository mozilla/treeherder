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
