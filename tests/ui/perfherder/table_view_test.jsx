import React from 'react';
import { render, cleanup } from '@testing-library/react';

import TableView from '../../../ui/perfherder/graphs/TableView';
import repos from '../mock/repositories';
import testData from '../mock/performance_testData.json';

const tableView = (
  testData,
  highlightAlerts = false,
  highlightedRevisions = ['', ''],
  projects = repos,
) =>
  render(
    <TableView
      testData={testData}
      frameworks={[{ id: 1, name: 'talos' }]}
      highlightAlerts={highlightAlerts}
      highlightedRevisions={highlightedRevisions}
      projects={projects}
    />,
  );

afterEach(cleanup);

test('should display test name', async () => {
  const { getByText } = tableView(testData);

  expect(
    getByText('perf_reftest_singletons opt e10s stylo'),
  ).toBeInTheDocument();
  expect(getByText('tart_flex opt e10s stylo')).toBeInTheDocument();
});

test('should have revision links', async () => {
  const { getAllByTitle } = tableView(testData);

  expect(getAllByTitle('Revision Link')).toHaveLength(5);
});

test('cell should have highlighted aria-label when highlightAlert is true', async () => {
  const { getAllByLabelText } = tableView(testData, true, [
    '94c8f28a15e8a051aeaad4722deb3fcc8125dab2',
  ]);

  expect(getAllByLabelText('highlighted', { exact: false })).toHaveLength(3);
});
