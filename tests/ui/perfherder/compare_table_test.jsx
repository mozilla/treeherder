import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import CompareTableControls from '../../../ui/perfherder/compare/CompareTableControls';
import { filterText } from '../../../ui/perfherder/constants';

// TODO addtional tests:
// 1) that the table is receiving the correct data structure after data
// is transformed in compare and comparesubtests views (Map containing objects with arrays as props)
// 2) if filterByFramework is true, frameworks returns a list
// 3) if a new framework is selected, results are updated

// TODO replace with mock data performance/summary API that is transformed
// by getResultsMap in compareView and comparesubtests view
const result = [
  {
    className: 'danger',
    confidence: 5.057234137528269,
    confidenceText: 'high',
    confidenceTextLong:
      "Result of running t-test on base versus new result distribution: A value of 'high' indicates more confidence that there is a significant change, however you should check the historical record for the test by looking at the graph to be more sure (some noisy tests can provide inconsistent results).",
    delta: 3.9191666666666265,
    deltaPercentage: 2.23249676019764,
    frameworkId: 1,
    isComplete: 1,
    isConfident: false,
    isEmpty: false,
    isImprovement: false,
    isMeaningful: true,
    isNoiseMetric: true,
    isRegression: true,
    links: [],
    magnitude: 11.162483800988202,
    name: 'linux64',
    needsMoreRuns: false,
    newIsBetter: false,
    newRuns: [],
  },
  {
    className: 'danger',
    confidence: 5.057234137528269,
    confidenceText: 'high',
    confidenceTextLong:
      "Result of running t-test on base versus new result distribution: A value of 'high' indicates more confidence that there is a significant change, however you should check the historical record for the test by looking at the graph to be more sure (some noisy tests can provide inconsistent results).",
    delta: 3.9191666666666265,
    deltaPercentage: 2.23249676019764,
    frameworkId: 1,
    isComplete: 1,
    isConfident: true,
    isEmpty: false,
    isImprovement: false,
    isMeaningful: true,
    isNoiseMetric: false,
    isRegression: true,
    links: [],
    magnitude: 11.162483800988202,
    name: 'osx-10-10',
    needsMoreRuns: false,
    newIsBetter: false,
    newRuns: [],
  },
];

const results = new Map([['a11yr pgo e10s stylo', result]]);

const regexComptableHeaderId = /table-header-\d+/;
const regexComptableRowId = /table-row-\d+/;

afterEach(cleanup);

const compareTableControls = onPermalinkClick => {
  // eslint-disable-next-line no-unused-vars
  const handlePermalinkClick = onPermalinkClick || (hashBasedValue => {});

  return render(
    <CompareTableControls
      compareResults={results}
      filterOptions={{}}
      onPermalinkClick={handlePermalinkClick}
    />,
  );
};

test('toggle buttons should filter results by selected filter', async () => {
  const { getByText } = compareTableControls();

  const result1 = await waitForElement(() => getByText(result[0].name));
  const result2 = await waitForElement(() => getByText(result[1].name));

  // default - no filters selected
  expect(result1).toBeInTheDocument();
  expect(result2).toBeInTheDocument();

  // one filter selected
  const showImportant = getByText(filterText.showImportant);
  fireEvent.click(showImportant);

  // active prop is treated as as a classname rather than an attribute
  // (toHaveAttribute), such as disabled
  expect(showImportant).toHaveClass('active');
  expect(result1).toBeInTheDocument();
  expect(result2).toBeInTheDocument();

  // two filters selected
  const hideUncertain = getByText(filterText.hideUncertain);
  fireEvent.click(hideUncertain);

  expect(hideUncertain).toHaveClass('active');
  expect(result1).not.toBeInTheDocument();
  expect(result2).toBeInTheDocument();
});

test('text input filter results should differ when filter button(s) are selected', async () => {
  const {
    getByText,
    getByPlaceholderText,
    queryByText,
  } = compareTableControls();

  const result1 = await waitForElement(() => getByText(result[0].name));
  const result2 = await waitForElement(() => getByText(result[1].name));

  const filterInput = await waitForElement(() =>
    getByPlaceholderText(filterText.inputPlaceholder),
  );

  fireEvent.change(filterInput, { target: { value: 'linux' } });

  expect(filterInput.value).toBe('linux');
  await waitForElementToBeRemoved(() => queryByText(result[1].name));
  expect(result1).toBeInTheDocument();

  const hideUncertain = getByText(filterText.hideUncertain);
  fireEvent.click(hideUncertain);

  expect(hideUncertain).toHaveClass('active');
  expect(result1).not.toBeInTheDocument();
  expect(result2).not.toBeInTheDocument();
});

test('table header & rows all have hash-based ids', async () => {
  const { getByLabelText, getAllByLabelText } = compareTableControls();

  const compareTable = await waitForElement(() =>
    getByLabelText('Comparison table'),
  );
  const compareTableRows = await waitForElement(() =>
    getAllByLabelText('Comparison table row'),
  );

  // ensure structure is the one we expect
  expect(compareTable).toHaveAttribute(
    'id',
    expect.stringMatching(regexComptableHeaderId),
  );
  compareTableRows.forEach(row => {
    expect(row).toHaveAttribute(
      'id',
      expect.stringMatching(regexComptableRowId),
    );
  });

  // each hash suffix is unique
  const tableSections = [compareTable, ...compareTableRows];
  const allHashSuffixes = tableSections.map(
    section => /table-\w+-(\d+)/g.exec(section.id)[1],
  );
  const uniqueHashSuffixes = [...new Set(allHashSuffixes)];

  expect(uniqueHashSuffixes).toHaveLength(tableSections.length);
});

test('clicking compare table permalinks callbacks with unique hash-based ids', async () => {
  const mockHandlePermalinkClick = jest.fn();
  const { getByTitle, getAllByTitle } = compareTableControls(
    mockHandlePermalinkClick,
  );

  const compareTablePermalink = await waitForElement(() =>
    getByTitle('Permalink to this test table'),
  );
  const compareTableRowPermalinks = await waitForElement(() =>
    getAllByTitle('Permalink to this test'),
  );

  fireEvent.click(compareTablePermalink);

  expect(mockHandlePermalinkClick.mock.calls).toHaveLength(1);
  expect(mockHandlePermalinkClick.mock.calls[0][0]).toMatch(
    regexComptableHeaderId,
  );

  for (let i = 1; i <= compareTableRowPermalinks.length; i++) {
    fireEvent.click(compareTableRowPermalinks[i - 1]);

    expect(mockHandlePermalinkClick.mock.calls).toHaveLength(1 + i);
    expect(mockHandlePermalinkClick.mock.calls[i][0]).toMatch(
      regexComptableRowId,
    );
  }
});
