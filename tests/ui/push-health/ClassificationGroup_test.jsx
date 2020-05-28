import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import ClassificationGroup from '../../../ui/push-health/ClassificationGroup';

const tests = pushHealth.metrics.tests.details.needInvestigation;
const repoName = 'autoland';

describe('GroupedTests', () => {
  const testClassificationGroup = (group) => (
    <ClassificationGroup
      group={group}
      name="Need Investigation"
      repo={repoName}
      revision={pushHealth.revision}
      currentRepo={{ name: repoName }}
      unfilteredLength={5}
      hasRetriggerAll
      notify={() => {}}
    />
  );

  test('should group by test path', async () => {
    const { getAllByTestId } = render(testClassificationGroup(tests));

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      2,
    );
  });

  test('should group by platform', async () => {
    const { getAllByTestId, findByTestId, findByText } = render(
      testClassificationGroup(tests),
    );
    const groupBy = await findByTestId('groupTestsDropdown');

    fireEvent.click(groupBy);
    const path = await findByText('Platform');
    fireEvent.click(path);

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      12,
    );
  });
});
