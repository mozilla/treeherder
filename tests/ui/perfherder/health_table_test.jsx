import React from 'react';
import { render, cleanup, waitForElement } from '@testing-library/react';

import { noResultsMessage } from '../../../ui/perfherder/constants';
import HealthTable from '../../../ui/perfherder/health/HealthTable';

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

const healthTable = (data, projectsMap = false, platformsMap = false) =>
  render(
    <HealthTable
      results={data}
      projectsMap={projectsMap}
      platformsMap={platformsMap}
    />,
  );

afterEach(cleanup);

test('health table with no data displays appropriate message', async () => {
  const { getByText } = healthTable();

  const message = await waitForElement(() => getByText(noResultsMessage));

  expect(message).toBeInTheDocument();
});

test('health table should show data', async () => {
  const { getByText } = healthTable(results, projectsMap, platformsMap);

  const result1 = await waitForElement(() => getByText(results[0].test));
  const result2 = await waitForElement(() => getByText(results[1].test));

  expect(result1).toBeInTheDocument();
  expect(result2).toBeInTheDocument();
});
