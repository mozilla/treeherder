import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitFor } from '@testing-library/react';

import CommitHistory from '../../../ui/push-health/CommitHistory';
import pushHealth from '../mock/push_health';
import repositories from '../mock/repositories';
import RepositoryModel from '../../../ui/models/repository';

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
  const revision = 'b6affc2813062a8e5a227a3ecf679e13c0c7a853';
  const currentRepo = new RepositoryModel(repositories[1]);
  const testCommitHistory = (history) => (
    <CommitHistory
      history={history}
      revision={revision}
      currentRepo={currentRepo}
    />
  );

  test('should show the push header and the author', () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;
    const { getByTestId } = render(testCommitHistory(commitHistory));
    const headerText = getByTestId('headerText');
    const authorTime = getByTestId('authorTime');

    expect(headerText).toBeInTheDocument();
    expect(headerText).toHaveTextContent(
      'Backed out changeset f6ccc4ba38d9 (bug 1609356) for failures on browser_toolbox_dynamic_registration.js. CLOSED TREE',
    );
    expect(authorTime).toBeInTheDocument();
    expect(authorTime).toHaveTextContent(
      'Wed, May 6, 17:23:29-hiro@mozilla.com',
    );
  });

  test('should show a parent commit and health icon for that parent', async () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;
    const { getByText, getByTestId, queryByTestId } = render(
      testCommitHistory(commitHistory),
    );
    const parentLink = getByTestId('parent-commit-sha');

    expect(parentLink).toBeInTheDocument();
    expect(parentLink.text).toBe('eeb6fd68c0223a72d8714734a34d3e6da69995e1');
    expect(
      await waitFor(() =>
        queryByTestId('health-status-eeb6fd68c0223a72d8714734a34d3e6da69995e1'),
      ),
    ).toBeInTheDocument();
    expect(await waitFor(() => getByText('87 items'))).toBeInTheDocument();
  });

  test('should show warning if not exact commit match', async () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;

    commitHistory.id = 123;
    commitHistory.parentSha = '00000827c820f34b3b595f887f57b4c847316fcc';
    commitHistory.parentPushRevision = null;
    commitHistory.exactMatch = false;

    const { getByText, getByTestId, queryByTestId } = render(
      testCommitHistory(commitHistory),
    );
    expect(
      getByText(
        'Warning: Could not find an exact match parent Push in Treeherder.',
      ),
    ).toBeInTheDocument();
    expect(getByText('Closest match:')).toBeInTheDocument();
    const parentLink = getByTestId('parent-commit-sha');

    expect(parentLink).toBeInTheDocument();
    expect(parentLink.text).toBe('00000827c820f34b3b595f887f57b4c847316fcc');
    expect(
      queryByTestId('health-status-eeb6fd68c0223a72d8714734a34d3e6da69995e1'),
    ).not.toBeInTheDocument();
    // Should not have a parent PushHealthStatus when it's not an exact match.
    expect(
      queryByTestId('health-status-00000827c820f34b3b595f887f57b4c847316fcc'),
    ).not.toBeInTheDocument();
  });

  test('should not have parent PushHealthStatus if no push id', async () => {
    const { details: commitHistory } = pushHealth.metrics.commitHistory;

    commitHistory.id = null;
    commitHistory.parentSha = '00000827c820f34b3b595f887f57b4c847316fcc';
    commitHistory.parentPushRevision = null;
    commitHistory.exactMatch = false;

    const { getByText, queryByTestId } = render(
      testCommitHistory(commitHistory),
    );
    expect(
      await waitFor(() =>
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
