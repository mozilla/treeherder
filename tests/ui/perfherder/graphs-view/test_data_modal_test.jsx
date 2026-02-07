
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import flatMap from 'lodash/flatMap';

import TestDataModal from '../../../../ui/perfherder/graphs/TestDataModal';
import seriesData from '../../mock/performance_signature_formatted.json';
import seriesDataWithNoTags from '../../mock/performance_signature_with_no_tags.json';
import seriesDataWithRepeatedTag from '../../mock/performance_signature_with_repeated_tag.json';
import repos from '../../mock/repositories';

const platforms = ['linux64', 'windows10-64', 'windows7-32'];

const frameworks = [
  { id: 1, name: 'talos' },
  { id: 2, name: 'build_metrics' },
];

const updates = {
  filteredData: [],
  loading: false,
  relatedTests: [],
  seriesData,
  showNoRelatedTests: false,
};

const updatesWithNoTags = {
  filteredData: [],
  loading: false,
  relatedTests: [],
  seriesData: seriesDataWithNoTags,
  showNoRelatedTests: false,
};

const updatesWithRepeatedTag = {
  filteredData: [],
  loading: false,
  relatedTests: [],
  seriesData: seriesDataWithRepeatedTag,
  showNoRelatedTests: false,
};

const mockGetSeriesData = jest
  .fn()
  .mockResolvedValueOnce(updatesWithNoTags)
  .mockResolvedValueOnce(updates)
  .mockResolvedValueOnce(updatesWithRepeatedTag)
  .mockResolvedValueOnce(updatesWithRepeatedTag)
  .mockResolvedValue(updates);

const testDataModel = async () => {
  const plottedUnits = new Set([]);
  const renderResult = render(
    <TestDataModal
      projects={repos}
      plottedUnits={plottedUnits}
      timeRange={{ value: 172800, text: 'Last two days' }}
      getTestData={() => {}}
      options={{}}
      testData={[]}
      frameworks={frameworks}
      showModal
      toggle={() => {}}
      getInitialData={() => ({
        platforms,
      })}
      getSeriesData={mockGetSeriesData}
      updateTestsAndTimeRange={() => {}}
    />,
  );

  // Wait for async state updates from componentDidMount and processOptions
  await waitFor(() => {
    expect(renderResult.container).toBeInTheDocument();
  });

  return renderResult;
};

afterEach(cleanup);

test('Tags multi select is not shown if series data has no tags', async () => {
  const { queryByLabelText } = await testDataModel();

  expect(queryByLabelText('Tags')).toBeNull();
});

test('Tags multi select is shown if series data has tags', async () => {
  const { getByLabelText } = await testDataModel();
  const multiSelect = await waitFor(() => getByLabelText('Tags'));

  expect(multiSelect).toBeInTheDocument();
});

test('Tag used in multiple tests appears once in the tags list', async () => {
  const { getAllByTestId } = await testDataModel();
  const tags = flatMap(seriesDataWithRepeatedTag, (data) => data.tags);
  const tagOccurency = tags.filter((tag) => tag === 'repeated-tag').length;

  expect(tagOccurency).toBeGreaterThan(1);

  const tag = await waitFor(() => getAllByTestId('available-tag repeated-tag'));

  expect(tag).toHaveLength(1);
});

test('Selecting two tags from tags multi select shows the tests that have both tags', async () => {
  const { queryByTestId, getByText, queryAllByTestId } = await testDataModel();
  const activeTag1 = seriesDataWithRepeatedTag[0].tags[0];
  const activeTag2 = seriesDataWithRepeatedTag[0].tags[1];
  const activeTags = [activeTag1, activeTag2];
  const taggedTests = seriesDataWithRepeatedTag.filter((test) =>
    activeTags.every((activeTag) => test.tags.includes(activeTag)),
  );
  let tests = await waitFor(() => queryByTestId('tests'));

  expect(tests).toHaveLength(seriesDataWithRepeatedTag.length);

  const tag1 = await waitFor(() => getByText(activeTag1));
  const tag2 = await waitFor(() => getByText(activeTag2));

  fireEvent.click(tag1);
  fireEvent.click(tag2);

  await waitFor(() => {
    expect(queryAllByTestId(/active-tag/)).toHaveLength(activeTags.length);
  });

  tests = await waitFor(() => queryByTestId('tests'));

  expect(tests).toHaveLength(taggedTests.length);
});

test('Selecting a tag from tags multi select shows the tests that have the specific tag', async () => {
  const { queryByTestId, getByText, getByTestId } = await testDataModel();
  const tag = await waitFor(() => getByText(seriesData[0].tags[0]));

  fireEvent.click(tag);

  const activeTag = await waitFor(() =>
    getByTestId(`active-tag ${seriesData[0].tags[0]}`),
  );

  expect(activeTag).toBeInTheDocument();

  const tests = await waitFor(() => queryByTestId('tests'));
  const test = await waitFor(() => queryByTestId(seriesData[0].id.toString()));

  expect(tests).toContain(test);
});

test('Active tag can be deactivated by clicking on it from available tags list', async () => {
  const { queryByTestId, getByTestId } = await testDataModel();
  const availableTag = await waitFor(() =>
    getByTestId(`available-tag ${seriesData[0].tags[0]}`),
  );

  fireEvent.click(availableTag);

  let activeTag = await waitFor(() =>
    getByTestId(`active-tag ${seriesData[0].tags[0]}`),
  );

  expect(activeTag).toBeInTheDocument();

  fireEvent.click(availableTag);

  activeTag = await waitFor(() =>
    queryByTestId(`active-tag ${seriesData[0].tags[0]}`),
  );

  expect(activeTag).toBeNull();
});

test('Active tag can be deactivated by clicking on it from active tags list', async () => {
  const { queryByTestId, getByTestId } = await testDataModel();
  const availableTag = await waitFor(() =>
    getByTestId(`available-tag ${seriesData[0].tags[0]}`),
  );

  fireEvent.click(availableTag);

  let activeTag = await waitFor(() =>
    getByTestId(`active-tag ${seriesData[0].tags[0]}`),
  );

  expect(activeTag).toBeInTheDocument();

  fireEvent.click(activeTag);

  activeTag = await waitFor(() =>
    queryByTestId(`active-tag ${seriesData[0].tags[0]}`),
  );

  expect(activeTag).toBeNull();
});
