import React from 'react';
import { render, waitFor } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import ClassificationGroup from '../../../ui/push-health/ClassificationGroup';

const { jobs, metrics } = pushHealth;
const { tests, unstructuredFailures } = metrics.tests.details.needInvestigation;
const repoName = 'autoland';

describe('ClassificationGroup', () => {
  const testClassificationGroup = (groupedBy) => (
    <ClassificationGroup
      jobs={jobs}
      tests={tests}
      unstructuredFailures={unstructuredFailures}
      name="Need Investigation"
      repo={repoName}
      revision={pushHealth.revision}
      currentRepo={{ name: repoName }}
      unfilteredLength={5}
      hasRetriggerAll
      notify={() => {}}
      groupedBy={groupedBy}
      updateParamsAndState={() => {}}
    />
  );

  test('should group by test path', async () => {
    const { getAllByTestId } = render(testClassificationGroup('path'));

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      3,
    );
  });

  test('should group by platform', async () => {
    const { getAllByTestId } = render(testClassificationGroup('platform'));

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      12,
    );
  });
});
