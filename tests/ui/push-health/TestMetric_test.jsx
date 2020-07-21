import React from 'react';
import { render, waitFor } from '@testing-library/react';

import TestMetric from '../../../ui/push-health/TestMetric';
import pushHealth from '../mock/push_health';

const repoName = 'autoland';
const { tests } = pushHealth.metrics;

describe('TestMetric', () => {
  const testTestMetric = (tests) => (
    <TestMetric
      data={tests}
      repo="autoland"
      revision="abc"
      currentRepo={{ name: repoName, tc_root_url: 'http://foo.com' }}
      notify={() => {}}
      searchStr=""
      showParentMatches={false}
    />
  );

  test('should have a Possible Regressions section', async () => {
    const { getByText } = render(testTestMetric(tests));

    expect(
      await waitFor(() => getByText('Possible Regressions', { exact: false })),
    ).toBeInTheDocument();
  });

  test('should have a Known Issues section', async () => {
    const { getByText } = render(testTestMetric(tests));

    expect(
      await waitFor(() => getByText('Known Issues', { exact: false })),
    ).toBeInTheDocument();
  });

  test('should show the test name', async () => {
    const { getByText } = render(testTestMetric(tests));

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
