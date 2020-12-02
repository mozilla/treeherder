import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor } from '@testing-library/react';

import PushHealthStatus from '../../../ui/shared/PushHealthStatus';
import { getProjectUrl } from '../../../ui/helpers/location';

beforeEach(() => {
  fetchMock.get(
    getProjectUrl('/push/health_summary/?revision=failed', 'autoland'),
    [
      {
        testFailureCount: 2,
        buildFailureCount: 1,
        lintFailureCount: 0,
        needInvestigation: 3,
      },
    ],
  );
  fetchMock.get(
    getProjectUrl('/push/health_summary/?revision=passed', 'autoland'),
    [
      {
        testFailureCount: 0,
        buildFailureCount: 0,
        lintFailureCount: 0,
        needInvestigation: 0,
      },
    ],
  );
});

afterEach(() => {
  fetchMock.reset();
});

describe('PushHealthStatus', () => {
  const testPushHealthStatus = (revision) => (
    <PushHealthStatus
      revision={revision}
      repoName="autoland"
      jobCounts={{ pending: 0, running: 0, completed: 200 }}
      statusCallback={() => {}}
    />
  );

  test('should show the number of issues needing investigation', async () => {
    const { getByText } = render(testPushHealthStatus('failed'));

    expect(await waitFor(() => getByText('3 items'))).toBeInTheDocument();
  });

  test('should show when the push is OK', async () => {
    const { getByText } = render(testPushHealthStatus('passed'));

    expect(await waitFor(() => getByText('OK'))).toBeInTheDocument();
  });
});
