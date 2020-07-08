import React from 'react';
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
  .mockResolvedValueOnce(updates)
  .mockResolvedValue(updates);

const testDataModel = () => {
  const plottedUnits = new Set([]);
  return render(
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
    />,
  );
};

afterEach(cleanup);

test('Tags dropdown is not shown if series data has no tags', async () => {
  const { queryByTitle } = testDataModel();

  expect(queryByTitle('Tag')).toBeNull();
});

test('Tags dropdown is shown if series data has tags', async () => {
  const { getByTitle } = testDataModel();

  const dropdown = await waitFor(() => getByTitle('Tag'));

  expect(dropdown).toBeInTheDocument();
});

test('Tag used in multiple tests appears once in the dropdown', async () => {
  const { getByTitle, queryAllByText } = testDataModel();

  const tags = flatMap(seriesDataWithRepeatedTag, (data) => data.tags);
  const tagOccurency = tags.filter((tag) => tag === 'repeated-tag').length;

  expect(tagOccurency).toBeGreaterThan(1);

  const dropdown = await waitFor(() => getByTitle('Tag'));

  fireEvent.click(dropdown);

  const tag = await waitFor(() => queryAllByText('repeated-tag'));

  expect(tag).toHaveLength(1);
});

test("Tags dropdown has the default tag set to 'all tags'", async () => {
  const { getByTitle } = testDataModel();

  const dropdown = await waitFor(() => getByTitle('Tag'));

  const tag = dropdown.querySelector('button');

  expect(tag.innerHTML).toBe('all tags');
});
