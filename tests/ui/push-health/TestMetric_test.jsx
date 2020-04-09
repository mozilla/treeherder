import React from 'react';
import { render, waitFor } from '@testing-library/react';

import TestMetric from '../../../ui/push-health/TestMetric';
import pushHealth from '../mock/push_health';

const repoName = 'autoland';
const {
  jobs,
  metrics: { tests },
} = pushHealth;

describe('TestMetric', () => {
  const testTestMetric = (tests) => (
    <TestMetric
      data={tests}
      jobs={jobs}
      repo="autoland"
      revision="abc"
      currentRepo={{ name: repoName, tc_root_url: 'http://foo.com' }}
      notify={() => {}}
      searchStr=""
      updateParamsAndState={() => {}}
    />
  );

  test('should have a Possible Regressions section', async () => {
    const { getByText } = render(testTestMetric(tests, jobs));

    expect(
      await waitFor(() =>
        getByText('Possible Regressions (18)', { exact: false }),
      ),
    ).toBeInTheDocument();
  });

  test('should have a Known Issues section', async () => {
    const { getByText } = render(testTestMetric(tests, jobs));

    expect(
      await waitFor(() => getByText('Known Issues (41)', { exact: false })),
    ).toBeInTheDocument();
  });

  test('should show the test name', async () => {
    const { getByText } = render(testTestMetric(tests, jobs));

    expect(
      await waitFor(() =>
        getByText(
          'layout/reftests/high-contrast/backplate-bg-image-006.html == layout/reftests/high-contrast/',
          { exact: false },
        ),
      ),
    ).toBeInTheDocument();
  });
});
