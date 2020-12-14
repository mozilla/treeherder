import React from 'react';
import { render, waitFor } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import JobListMetric from '../../../ui/push-health/JobListMetric';

const repoName = 'autoland';
const { builds } = pushHealth.metrics;

describe('JobListMetric', () => {
  const testJobListMetric = (builds) => (
    <JobListMetric
      data={builds}
      repo={repoName}
      revision="abc"
      expanded
      setExpanded={() => {}}
    />
  );

  test('should show the build symbol', async () => {
    const { getByText } = render(testJobListMetric(builds));

    expect(await waitFor(() => getByText('arm64'))).toBeInTheDocument();
  });
});
