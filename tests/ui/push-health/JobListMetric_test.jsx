import React from 'react';
import { render, waitForElement } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import JobListMetric from '../../../ui/push-health/JobListMetric';

const repoName = 'autoland';
const { builds } = pushHealth.metrics;

describe('JobListMetric', () => {
  const testJobListMetric = (builds, showParentMatches) => (
    <JobListMetric
      data={builds}
      repo={repoName}
      revision="abc"
      expanded
      setExpanded={() => {}}
      showParentMatches={showParentMatches}
    />
  );

  test('should show the build symbol', async () => {
    const { getByText } = render(testJobListMetric(builds, true));

    expect(await waitForElement(() => getByText('arm64'))).toBeInTheDocument();
  });

  test('should not show the build symbol if hiding parent matches', async () => {
    const { getByText, queryByText } = render(testJobListMetric(builds, false));

    expect(queryByText('arm64')).not.toBeInTheDocument();
    expect(
      getByText('All failed Builds also failed in Parent Push'),
    ).toBeInTheDocument();
  });
});
