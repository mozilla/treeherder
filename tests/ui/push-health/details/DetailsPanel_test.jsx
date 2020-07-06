import React from 'react';
import { render, waitFor } from '@testing-library/react';

import pushHealth from '../../mock/push_health.json';
import DetailsPanel from '../../../../ui/push-health/details/DetailsPanel';

const tests = pushHealth.metrics.tests.details.needInvestigation;
const repoName = 'autoland';

describe('DetailsPanel', () => {
  const testGroupedTests = (tests, groupedBy, orderedBy) => (
    <DetailsPanel
      group={tests}
      repo={repoName}
      revision={pushHealth.revision}
      groupedBy={groupedBy}
      orderedBy={orderedBy}
      currentRepo={{ name: repoName }}
      notify={() => {}}
    />
  );

  test('should group by test path', async () => {
    const { getAllByTestId } = render(testGroupedTests(tests, 'path', 'count'));

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      3,
    );
  });
});
