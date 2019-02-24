import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from 'react-testing-library';

import CompareTableControls from '../../../../ui/perfherder/CompareTableControls';
import { filterText } from '../../../../ui/perfherder/constants';

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

afterEach(cleanup);

const compareTableControls = () =>
  render(<CompareTableControls compareResults={results} filterOptions={{}} />);

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
  const { getByText, getByPlaceholderText } = compareTableControls();

  const result1 = await waitForElement(() => getByText(result[0].name));
  const result2 = await waitForElement(() => getByText(result[1].name));

  const filterInput = await waitForElement(() =>
    getByPlaceholderText(filterText.inputPlaceholder),
  );
  const filterButton = await waitForElement(() => getByText('filter'));

  fireEvent.change(filterInput, { target: { value: 'linux' } });
  fireEvent.click(filterButton);

  expect(filterInput.value).toBe('linux');
  expect(result1).toBeInTheDocument();
  expect(result2).not.toBeInTheDocument();

  const hideUncertain = getByText(filterText.hideUncertain);
  fireEvent.click(hideUncertain);

  expect(hideUncertain).toHaveClass('active');
  expect(result1).not.toBeInTheDocument();
  expect(result2).not.toBeInTheDocument();
});
