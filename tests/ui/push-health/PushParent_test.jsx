import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitForElement } from '@testing-library/react';

import PushParent from '../../../ui/push-health/PushParent';

beforeEach(() => {
  fetchMock.get(
    '/api/project/mozilla-central/push/health_summary/?revision=76ee1827c820f34b3b595f887f57b4c847316fcc',
    { needInvestigation: 87, unsupported: 8 },
  );
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
});

const getParent = (
  id = 636452,
  parentSha = '76ee1827c820f34b3b595f887f57b4c847316fcc',
  exactMatch = true,
) => {
  return {
    parentSha,
    exactMatch,
    revision: '76ee1827c820f34b3b595f887f57b4c847316fcc',
    repository: {
      id: 1,
      repository_group: {
        name: 'development',
        description:
          'Collection of repositories where code initially lands in the development process',
      },
      name: 'mozilla-central',
      dvcs_type: 'hg',
      url: 'https://hg.mozilla.org/mozilla-central',
      branch: null,
      codebase: 'gecko',
      description: '',
      active_status: 'active',
      performance_alerts_enabled: false,
      expire_performance_data: false,
      is_try_repo: false,
      tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
    },
    id,
    jobCounts: {
      completed: 8117,
      pending: 236,
      running: 117,
      success: 8025,
      retry: 40,
      testfailed: 52,
    },
  };
};

describe('PushParent', () => {
  const testPushParent = parent => <PushParent parent={parent} />;

  test('should show a parent commit and health icon for that parent', async () => {
    const parent = getParent();
    const { getByText, queryByTestId } = render(testPushParent(parent));
    expect(
      getByText('76ee1827c820f34b3b595f887f57b4c847316fcc'),
    ).toBeInTheDocument();
    expect(
      queryByTestId('health-status-76ee1827c820f34b3b595f887f57b4c847316fcc'),
    ).not.toBeInTheDocument();
    expect(
      await waitForElement(() => getByText('87 tests need investigation')),
    ).toBeInTheDocument();
  });

  test('should show warning if not exact commit match', async () => {
    const parent = getParent(
      123,
      '00000827c820f34b3b595f887f57b4c847316fcc',
      false,
    );
    const { getByText } = render(testPushParent(parent));
    expect(
      getByText('Warning: Could not find an exact match parent Push.'),
    ).toBeInTheDocument();
    expect(getByText('Closest match:')).toBeInTheDocument();
    expect(
      getByText('76ee1827c820f34b3b595f887f57b4c847316fcc'),
    ).toBeInTheDocument();
    expect(
      getByText('00000827c820f34b3b595f887f57b4c847316fcc'),
    ).toBeInTheDocument();
    expect(
      await waitForElement(() => getByText('87 tests need investigation')),
    ).toBeInTheDocument();
  });

  test('should not have parent PushHealthStatus if no push id', async () => {
    const parent = getParent(
      null,
      '00000827c820f34b3b595f887f57b4c847316fcc',
      false,
    );
    const { getByText, queryByTestId } = render(testPushParent(parent));
    expect(
      await waitForElement(() =>
        getByText('Warning: Could not find an exact match parent Push.'),
      ),
    ).toBeInTheDocument();
    expect(
      queryByTestId('health-status-76ee1827c820f34b3b595f887f57b4c847316fcc'),
    ).not.toBeInTheDocument();
  });
});
