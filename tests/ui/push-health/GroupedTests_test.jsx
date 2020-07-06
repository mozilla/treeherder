import React from 'react';
import { render, waitFor } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import GroupedTests from '../../../ui/push-health/GroupedTests';

const tests = pushHealth.metrics.tests.details.needInvestigation;
const repoName = 'autoland';

describe('GroupedTests', () => {
  const testGroupedTests = (tests, groupedBy, orderedBy) => (
    <GroupedTests
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

  test('should group by platform', async () => {
    const { getAllByTestId } = render(
      testGroupedTests(tests, 'platform', 'count'),
    );

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      12,
    );
  });

  test('should bold the test file', async () => {
    const { getAllByTestId } = render(testGroupedTests(tests, 'path', 'count'));

    expect(
      await waitFor(() => getAllByTestId('group-slash-bolded')),
    ).toHaveLength(2);
    expect(
      await waitFor(() => getAllByTestId('group-colon-bolded')),
    ).toHaveLength(1);
  });
});
