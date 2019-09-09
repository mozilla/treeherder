import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from '@testing-library/react';

import GraphsViewControls from '../../../ui/perfherder/graphs/GraphsViewControls';
import repos from '../mock/repositories';
import testData from '../mock/performance_summary.json';
import seriesData from '../mock/performance_signature_formatted.json';
import seriesData2 from '../mock/performance_signature_formatted2.json';

const frameworks = [{ id: 1, name: 'talos' }, { id: 2, name: 'build_metrics' }];
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

const mockGetSeriesData = jest
  .fn()
  .mockResolvedValueOnce(updates)
  .mockResolvedValueOnce(updates2)
  .mockResolvedValue(updates);

const mockShowModal = jest
  .fn()
  .mockReturnValueOnce(true)
  .mockReturnValueOnce(false);

const graphsViewControls = () =>
  render(
    <GraphsViewControls
      updateStateParams={() => {}}
      graphs={false}
      highlightAlerts={false}
      highlightedRevisions={['', '']}
      updateTimeRange={() => {}}
      hasNoData
      frameworks={frameworks}
      projects={repos}
      timeRange={{ value: 172800, text: 'Last two days' }}
      options={{}}
      getTestData={() => {}}
      testData={testData}
      getInitialData={() => ({
        platforms,
      })}
      getSeriesData={mockGetSeriesData}
      showModal={Boolean(mockShowModal)}
      toggle={mockShowModal}
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
