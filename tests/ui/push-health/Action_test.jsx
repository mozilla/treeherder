import React from 'react';
import { render, waitFor } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import Action from '../../../ui/push-health/Action';

const { jobs, metrics } = pushHealth;
const { tests } = metrics.tests.details.needInvestigation;
const repoName = 'autoland';

describe('Action', () => {
  const testAction = (tests, jobs, groupedBy, orderedBy) => (
    <Action
      name="Hiro Protagonist"
      tests={tests}
      jobs={jobs}
      revision={pushHealth.revision}
      groupedBy={groupedBy}
      orderedBy={orderedBy}
      currentRepo={{ name: repoName }}
      notify={() => {}}
    />
  );

  test('should group by test path', async () => {
    const { getAllByTestId } = render(testAction(tests, jobs, 'path', 'count'));

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      3,
    );
  });

  test('should group by platform', async () => {
    const { getAllByTestId } = render(
      testAction(tests, jobs, 'platform', 'count'),
    );

    expect(await waitFor(() => getAllByTestId('test-grouping'))).toHaveLength(
      12,
    );
  });

  test('should bold the test file', async () => {
    const { getAllByTestId } = render(testAction(tests, jobs, 'path', 'count'));

    expect(
      await waitFor(() => getAllByTestId('group-slash-bolded')),
    ).toHaveLength(2);
    expect(
      await waitFor(() => getAllByTestId('group-colon-bolded')),
    ).toHaveLength(1);
  });
});
