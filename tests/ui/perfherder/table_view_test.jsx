import React from 'react';
import { render, cleanup } from '@testing-library/react';

import TableView from '../../../ui/perfherder/graphs/TableView';
import { graphColors, graphSymbols } from '../../../ui/perfherder/constants';
import repos from '../mock/repositories';
import testData from '../mock/performance_summary.json';
import { createGraphData } from '../../../ui/perfherder/helpers';

const graphData = createGraphData(
  testData,
  [],
  [...graphColors],
  [...graphSymbols],
);

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
  const { getByText } = tableView(graphData);

  expect(getByText('a11yr opt e10s stylo')).toBeInTheDocument();
});

test('should have revision links', async () => {
  const { getAllByTitle } = tableView(graphData);

  expect(getAllByTitle('Revision Link')).toHaveLength(4);
});

test('cell should have highlighted aria-label when highlightAlert is true', async () => {
  const { getAllByLabelText } = tableView(graphData, true, [
    '2909b0a1eb06cc34ce0a11544e5e6826aba87c06',
  ]);

  expect(getAllByLabelText('highlighted', { exact: false })).toHaveLength(2);
});
