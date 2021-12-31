import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

import { noResultsMessage } from '../../../ui/perfherder/perf-helpers/constants';
import TestsTable from '../../../ui/perfherder/tests/TestsTable';

const results = [
  {
    framework: 'awsy',
    suite: 'Base Content Explicit',
    test: 'test1',
    platforms: ['2', '1'],
    repositories: ['2', '1'],
    total_alerts: 202,
    total_regressions: 100,
  },
  {
    framework: 'awsy',
    suite: 'Base Content Heap Unclassified',
    test: 'test2',
    platforms: ['1'],
    repositories: ['2'],
    total_alerts: 97,
    total_regressions: 30,
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

  const message = await waitFor(() => getByText(noResultsMessage));

  expect(message).toBeInTheDocument();
});

test('Tests table should show data', async () => {
  const { getByText } = testsTable(results, projectsMap, platformsMap);

  const result1 = await waitFor(() => getByText(results[0].test));
  const result2 = await waitFor(() => getByText(results[1].test));

  expect(result1).toBeInTheDocument();
  expect(result2).toBeInTheDocument();
});

test('Clicking on platform icon displays the list of platforms', async () => {
  const { getAllByTestId, getByTestId } = testsTable(
    results,
    projectsMap,
    platformsMap,
  );

  const platformIcon = await waitFor(() => getAllByTestId('other-platform'));

  expect(platformIcon[0]).not.toBeNull();

  fireEvent.click(platformIcon[0]);

  const platformList = await waitFor(() =>
    getByTestId('displayed-platform-list'),
  );

  expect(platformList.childElementCount).toBe(2);
  expect(platformList.children[0]).toHaveTextContent('platform2');
  expect(platformList.children[1]).toHaveTextContent('platform1');
});

test('Test alerts from Alerts column are split into improvements and regressions', async () => {
  const { getAllByTestId } = testsTable(results, projectsMap, platformsMap);

  const improvements = await waitFor(() => getAllByTestId('improvements'));

  expect(improvements[0]).toBeInTheDocument();
  expect(improvements[0]).toHaveTextContent('102');

  const regressions = await waitFor(() => getAllByTestId('regressions'));

  expect(regressions[0]).toBeInTheDocument();
  expect(regressions[0]).toHaveTextContent('100');
});
