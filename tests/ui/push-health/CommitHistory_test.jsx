import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitForElement } from '@testing-library/react';

import CommitHistory from '../../../ui/push-health/CommitHistory';
import pushHealth from '../mock/push_health';

beforeEach(() => {
  fetchMock.get(
    '/api/project/autoland/push/health_summary/?revision=eeb6fd68c0223a72d8714734a34d3e6da69995e1',
    { needInvestigation: 87, unsupported: 8 },
  );
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
});

describe('CommitHistory', () => {
  const testCommitHistory = history => <CommitHistory history={history} />;

  test('should show a parent commit and health icon for that parent', async () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;
    const { getByText, queryByTestId } = render(
      testCommitHistory(commitHistory),
    );
    expect(
      getByText('eeb6fd68c0223a72d8714734a34d3e6da69995e1'),
    ).toBeInTheDocument();
    expect(
      queryByTestId('health-status-eeb6fd68c0223a72d8714734a34d3e6da69995e1'),
    ).not.toBeInTheDocument();
    expect(
      await waitForElement(() => getByText('87 items')),
    ).toBeInTheDocument();
  });

  test('should show warning if not exact commit match', async () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;

    commitHistory.id = 123;
    commitHistory.parentSha = '00000827c820f34b3b595f887f57b4c847316fcc';
    commitHistory.exactMatch = false;

    const { getByText } = render(testCommitHistory(commitHistory));
    expect(
      getByText(
        'Warning: Could not find an exact match parent Push in Treeherder.',
      ),
    ).toBeInTheDocument();
    expect(getByText('Closest match:')).toBeInTheDocument();
    expect(
      getByText('eeb6fd68c0223a72d8714734a34d3e6da69995e1'),
    ).toBeInTheDocument();
    expect(
      getByText('00000827c820f34b3b595f887f57b4c847316fcc'),
    ).toBeInTheDocument();
    expect(
      await waitForElement(() => getByText('87 items')),
    ).toBeInTheDocument();
  });

  test('should not have parent PushHealthStatus if no push id', async () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;

    commitHistory.id = null;
    commitHistory.parentSha = '00000827c820f34b3b595f887f57b4c847316fcc';
    commitHistory.exactMatch = false;

    const { getByText, queryByTestId } = render(
      testCommitHistory(commitHistory),
    );
    expect(
      await waitForElement(() =>
        getByText(
          'Warning: Could not find an exact match parent Push in Treeherder.',
        ),
      ),
    ).toBeInTheDocument();
    expect(
      queryByTestId('health-status-eeb6fd68c0223a72d8714734a34d3e6da69995e1'),
    ).not.toBeInTheDocument();
  });
});
