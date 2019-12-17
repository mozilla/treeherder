import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from '@testing-library/react';

import { filterText } from '../../../ui/perfherder/constants';
import GraphsViewControls from '../../../ui/perfherder/graphs/GraphsViewControls';
import repos from '../mock/repositories';
import testData from '../mock/performance_summary.json';
import seriesData from '../mock/performance_signature_formatted.json';
import seriesData2 from '../mock/performance_signature_formatted2.json';
import { createGraphData } from '../../../ui/perfherder/helpers';
import { graphColors } from '../../../ui/perfherder/constants';

const graphData = createGraphData(testData, [], [...graphColors]);

const frameworks = [
  { id: 1, name: 'talos' },
  { id: 2, name: 'build_metrics' },
];
const platforms = ['linux64', 'windows10-64', 'windows7-32'];

const updates = {
  filteredData: [],
  loading: false,
  relatedTests: [],
  seriesData,
  showNoRelatedTests: false,
};
const updates2 = { ...updates };
updates2.seriesData = seriesData2;

const setFilterText = (filterField, text) => {
  fireEvent.click(filterField);
  fireEvent.change(filterField, { target: { value: text } });
};

const mockGetSeriesData = jest
  .fn()
  .mockResolvedValueOnce(updates)
  .mockResolvedValueOnce(updates2)
  .mockResolvedValue(updates);

const mockShowModal = jest
  .fn()
  .mockReturnValueOnce(true)
  .mockReturnValueOnce(false);

const graphsViewControls = (hasNoData = true) =>
  render(
    <GraphsViewControls
      updateStateParams={() => {}}
      highlightAlerts={false}
      highlightedRevisions={['', '']}
      updateTimeRange={() => {}}
      hasNoData={hasNoData}
      frameworks={frameworks}
      projects={repos}
      timeRange={{ value: 172800, text: 'Last two days' }}
      options={{}}
      getTestData={() => {}}
      testData={graphData}
      getInitialData={() => ({
        platforms,
      })}
      getSeriesData={mockGetSeriesData}
      showModal={Boolean(mockShowModal)}
      toggle={mockShowModal}
      selectedDataPoint={{ signature_id: 1647494, dataPointId: 887279300 }}
      user={{ isStaff: true }}
      updateData={() => {}}
    />,
  );

afterEach(cleanup);

test('Changing the platform dropdown in the Test Data Model displays expected tests', async () => {
  const { getByText, queryByTestId, getByTitle } = graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  const platform = getByTitle('Platform');
  fireEvent.click(platform);

  const windowsPlatform = await waitForElement(() => getByText('windows7-32'));
  fireEvent.click(windowsPlatform);

  // 'mozilla-central windows7-32 a11yr opt e10s stylo'
  const existingTest = await waitForElement(() =>
    queryByTestId(seriesData2[0].id.toString()),
  );
  expect(existingTest).toBeInTheDocument();
  expect(mockShowModal.mock.calls).toHaveLength(1);
  mockShowModal.mockClear();
});

test('Tests section in Test Data Modal only shows tests not already displayed in graph', async () => {
  const { getByText, queryByTestId, getByLabelText } = graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  const testDataModal = getByText('Add Test Data');
  expect(testDataModal).toBeInTheDocument();

  // this test is already displayed (testData prop) in the legend and graph
  const existingTest = queryByTestId(testData[0].signature_id.toString());
  expect(existingTest).not.toBeInTheDocument();

  fireEvent.click(getByLabelText('Close'));
  expect(mockShowModal.mock.calls).toHaveLength(2);

  mockShowModal.mockClear();
});

test('Selecting a test in the Test Data Modal adds it to Selected Tests section; deselecting a test from Selected Tests removes it', async () => {
  const { getByText, getByTestId } = graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  const selectedTests = getByTestId('selectedTests');

  const testToSelect = await waitForElement(() =>
    getByText('about_preferences_basic opt e10s stylo'),
  );
  fireEvent.click(testToSelect);

  const fullTestToSelect = await waitForElement(() =>
    getByText('mozilla-central linux64 about_preferences_basic opt e10s stylo'),
  );
  fireEvent.click(fullTestToSelect);
  expect(mockShowModal.mock.calls).toHaveLength(1);
  expect(selectedTests).not.toContain(fullTestToSelect);
});

test('InputFilter from TestDataModal can filter by tags', async () => {
  const {
    getByText,
    getByTestId,
    getByPlaceholderText,
    getByTitle,
  } = graphsViewControls();

  const { name, tag, projectName, platform } = seriesData[0];
  const fullTestName = projectName.concat(' ', platform, ' ', name);

  fireEvent.click(getByText('Add test data'));

  const textInput = await waitForElement(() =>
    getByPlaceholderText(filterText.inputPlaceholder),
  );
  setFilterText(textInput, tag);

  const fullTestToSelect = await waitForElement(() => getByTitle(name));

  fireEvent.click(fullTestToSelect);

  const selectedTests = getByTestId('selectedTests');

  expect(selectedTests.children).toHaveLength(1);
  expect(selectedTests.children[0].text).toBe(fullTestName);
});

test("Selectable tests with different units than what's already plotted show warning in the Test Data Modal", async () => {
  const { getByText, getAllByTitle } = graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  // dromaeo_dom's unit is "score", while other tests don't have any
  const mismatchedTests = await waitForElement(() =>
    getAllByTitle(/^Warning:.*/i),
  );

  expect(mismatchedTests).toHaveLength(1);
});

test("Selecting a test with similar unit in the Test Data Modal doesn't give warning", async () => {
  const { getByText, getByTestId, queryAllByTitle } = graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  const matchingTest = await waitForElement(() =>
    getByTestId(seriesData[1].id.toString()),
  );

  fireEvent.click(matchingTest);

  const mismatchedTests = await waitForElement(() =>
    queryAllByTitle(/^Warning:.*/i),
  );

  // no extra warnings were added in selected tests' section
  expect(mismatchedTests).toHaveLength(1);
});

test('Using select query param displays tooltip for correct datapoint', async () => {
  const { getByTestId, getByText } = graphsViewControls(false);

  const graphContainer = await waitForElement(() =>
    getByTestId('graphContainer'),
  );

  expect(graphContainer).toBeInTheDocument();

  const graphTooltip = await waitForElement(() => getByTestId('graphTooltip'));
  const expectedRevision = '3afb892abb74c6d281f3e66431408cbb2e16b8c4';
  const revision = await waitForElement(() =>
    getByText(expectedRevision.slice(0, 13)),
  );

  expect(graphTooltip).toBeInTheDocument();
  expect(revision).toBeInTheDocument();
});
