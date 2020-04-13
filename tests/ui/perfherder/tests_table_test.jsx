import React from 'react';
import { render, cleanup, waitForElement } from '@testing-library/react';

import { noResultsMessage } from '../../../ui/perfherder/constants';
import TestsTable from '../../../ui/perfherder/tests/TestsTable';

const results = [
  {
    framework: 'awsy',
    suite: 'Base Content Explicit',
    test: 'test1',
    platforms: ['2', '1'],
    repositories: ['2', '1'],
    total_alerts: 202,
  },
  {
    framework: 'awsy',
    suite: 'Base Content Heap Unclassified',
    test: 'test2',
    platforms: ['1'],
    repositories: ['2'],
    total_alerts: 97,
  },
];

const projectsMap = {
  1: 'project1',
  2: 'project2',
};

const platformsMap = {
  1: 'platform1',
  2: 'platform2',
};

const testsTable = (data, projectsMap = false, platformsMap = false) =>
  render(
    <TestsTable
      results={data}
      projectsMap={projectsMap}
      platformsMap={platformsMap}
    />,
  );

afterEach(cleanup);

test('Tests table with no data displays appropriate message', async () => {
  const { getByText } = testsTable();

  const message = await waitForElement(() => getByText(noResultsMessage));

  expect(message).toBeInTheDocument();
});

test('Tests table should show data', async () => {
  const { getByText } = testsTable(results, projectsMap, platformsMap);

  const result1 = await waitForElement(() => getByText(results[0].test));
  const result2 = await waitForElement(() => getByText(results[1].test));

  expect(result1).toBeInTheDocument();
  expect(result2).toBeInTheDocument();
});
