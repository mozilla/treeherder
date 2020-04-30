/* eslint-disable jest/expect-expect */
import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import projects from '../mock/repositories';
import CompareTableControls from '../../../ui/perfherder/compare/CompareTableControls';
import CompareTable from '../../../ui/perfherder/compare/CompareTable';
import ComparePageTitle from '../../../ui/perfherder/compare/ComparePageTitle';
import { compareTableText, filterText } from '../../../ui/perfherder/constants';
import JobModel from '../../../ui/models/job';

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
    isNoiseMetric: false,
    isRegression: true,
    links: [],
    magnitude: 11.162483800988202,
    name: 'linux64',
    needsMoreRuns: false,
    newIsBetter: false,
    newRuns: [],
    originalRetriggerableJobId: 111,
    originalRepoName: 'try',
    newRetriggerableJobId: 121,
    newRepoName: 'mozilla-central',
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
    originalRetriggerableJobId: null,
    originalRepoName: 'try',
    newRetriggerableJobId: null,
    newRepoName: 'mozilla-central',
  },
];

const results = new Map([['a11yr pgo e10s stylo', result]]);

jest.mock('../../../ui/models/job');

const mockHandlePermalinkClick = jest.fn();
const regexComptableHeaderId = /table-header-\d+/;
const regexComptableRowId = /table-row-\d+/;

beforeEach(() => {
  JobModel.retrigger.mockClear();
  JobModel.get.mockClear();
});
afterEach(cleanup);

const compareTableControlsNode = (
  userLoggedIn = false,
  isBaseAggregate = false,
) => {
  return (
    <CompareTableControls
      compareResults={results}
      filterOptions={{}}
      user={{ isLoggedIn: userLoggedIn }}
      notify={() => {}}
      isBaseAggregate={isBaseAggregate}
      onPermalinkClick={mockHandlePermalinkClick}
      projects={projects}
    />
  );
};

const compareTableControls = (
  userLoggedIn = false,
  isBaseAggregate = false,
  mockDataRetrigger = { retriggers: [] },
) =>
  render(
    compareTableControlsNode(userLoggedIn, isBaseAggregate, mockDataRetrigger),
  );

const compareTable = (userLoggedIn, isBaseAggregate = false) =>
  render(
    <CompareTable
      user={{ isLoggedIn: userLoggedIn }}
      data={result}
      testName="Test Name"
      notify={() => {}}
      onModalOpen={() => {}}
      isBaseAggregate={isBaseAggregate}
      projects={projects}
    />,
  );

const comparePageTitle = () =>
  render(
    <ComparePageTitle
      title="Perfherder Compare Revisions"
      updateParams={() => {}}
      pageTitleQueryParam="Perfherder Compare Revisions"
    />,
  );

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
  compareTableRows.forEach((row) => {
    expect(row).toHaveAttribute(
      'id',
      expect.stringMatching(regexComptableRowId),
    );
  });

  // each hash suffix is unique
  const tableSections = [compareTable, ...compareTableRows];
  const allHashSuffixes = tableSections.map(
    (section) => /table-\w+-(\d+)/g.exec(section.id)[1],
  );
  const uniqueHashSuffixes = [...new Set(allHashSuffixes)];

  expect(uniqueHashSuffixes).toHaveLength(tableSections.length);
});

test('clicking compare table permalinks callbacks with unique hash-based ids', async () => {
  const { getByTitle, getAllByTitle } = compareTableControls();

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

test('retrigger buttons should appear only when the user is logged in', async () => {
  const { queryAllByTitle, rerender } = compareTableControls(false);
  let retriggerButtons = queryAllByTitle(compareTableText.retriggerButtonTitle);
  expect(retriggerButtons).toHaveLength(0);

  // simulate login
  rerender(compareTableControlsNode(true));

  retriggerButtons = queryAllByTitle(compareTableText.retriggerButtonTitle);
  expect(retriggerButtons).toHaveLength(2);
});

test('retrigger should trigger jobs for base and new repositories', async () => {
  const { queryAllByTitle, getByText } = compareTableControls(true, false);
  const retriggerButtons = queryAllByTitle(
    compareTableText.retriggerButtonTitle,
  );

  expect(retriggerButtons).toHaveLength(2);
  await fireEvent.click(retriggerButtons[0]);

  const retriggerButtonModal = await waitForElement(() =>
    getByText('Retrigger'),
  );
  expect(retriggerButtonModal).toBeInTheDocument();
  await fireEvent.click(retriggerButtonModal);

  expect(JobModel.retrigger).toHaveBeenCalledTimes(2);
  expect(JobModel.get).toHaveBeenCalledTimes(2);
  expect(JobModel.get.mock.calls[0][1]).toEqual(
    result[0].originalRetriggerableJobId,
  );
  expect(JobModel.get.mock.calls[1][1]).toEqual(
    result[0].newRetriggerableJobId,
  );
});

test('retrigger should only work on new repo when base is aggregate', async () => {
  const { queryAllByTitle, getByText } = compareTableControls(true, true);
  const retriggerButtons = queryAllByTitle(
    compareTableText.retriggerButtonTitle,
  );

  expect(retriggerButtons).toHaveLength(1);
  await fireEvent.click(retriggerButtons[0]);
  const retriggerButtonModal = await waitForElement(() =>
    getByText('Retrigger'),
  );
  expect(retriggerButtonModal).toBeInTheDocument();
  await fireEvent.click(retriggerButtonModal);

  expect(JobModel.retrigger).toHaveBeenCalledTimes(1);
  expect(JobModel.get).toHaveBeenCalledTimes(1);
  expect(JobModel.retrigger.mock.calls[0][0]).toHaveLength(1);
  expect(JobModel.get.mock.calls[0][1]).toEqual(
    result[0].newRetriggerableJobId,
  );
});

test('retrigger button should not appear for test with no jobs', async () => {
  const { queryAllByTitle } = compareTable(true, false);
  const retriggerButtons = queryAllByTitle(
    compareTableText.retriggerButtonTitle,
  );

  expect(retriggerButtons).toHaveLength(2);
  await fireEvent.click(retriggerButtons[1]);

  expect(JobModel.retrigger).toHaveBeenCalledTimes(0);
});

test('display of page title', async () => {
  const { getAllByTitle, getAllByText } = comparePageTitle();

  const pageTitleTitle = getAllByTitle('Click to change the page title');
  const pageTitleDefaultText = getAllByText('Perfherder Compare Revisions');

  // title defaults to 'Perfherder Compare Revisions'
  expect(pageTitleTitle[0]).toHaveTextContent('Perfherder Compare Revisions');
  expect(pageTitleDefaultText).toHaveLength(1);
});

test('Button hides when clicking on it and a Input is displayed', async () => {
  const { queryByText, container } = comparePageTitle();
  const pageTitleDefaultText = queryByText('Perfherder Compare Revisions');
  await fireEvent.click(pageTitleDefaultText);
  expect(container.firstChild).toHaveClass('input-group');
});

test('clicking the title button does not change the title', async () => {
  const { getByText, getByDisplayValue } = comparePageTitle();

  const pageTitleDefaultText = await waitForElement(() =>
    getByText('Perfherder Compare Revisions'),
  );

  fireEvent.click(pageTitleDefaultText);
  await waitForElement(() => getByDisplayValue('Perfherder Compare Revisions'));

  await waitForElement(() => getByDisplayValue('Perfherder Compare Revisions'));
});

test('setting a title on page updates the title accordingly', async () => {
  const { getByText, getByDisplayValue } = comparePageTitle();

  const pageTitleDefaultText = await waitForElement(() =>
    getByText('Perfherder Compare Revisions'),
  );

  fireEvent.click(pageTitleDefaultText);
  const inputField = await waitForElement(() =>
    getByDisplayValue('Perfherder Compare Revisions'),
  );
  fireEvent.change(inputField, {
    target: { value: 'some new value' },
  });
  // pressing 'Enter' has some issues on react-testing-library;
  // found workaround on https://github.com/testing-library/react-testing-library/issues/269
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  // ensure this updated the title
  await waitForElement(() => getByDisplayValue('some new value'));
});

test('re-editing the title is possible', async () => {
  const { getByText, getByDisplayValue } = comparePageTitle();

  const pageTitleDefaultText = await waitForElement(() =>
    getByText('Perfherder Compare Revisions'),
  );

  fireEvent.click(pageTitleDefaultText);
  const inputField = await waitForElement(() =>
    getByDisplayValue('Perfherder Compare Revisions'),
  );
  fireEvent.change(inputField, {
    target: { value: 'some new value' },
  });
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  await waitForElement(() => getByDisplayValue('some new value'));
  fireEvent.change(inputField, {
    target: { value: 'another new value' },
  });
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  await waitForElement(() => getByDisplayValue('another new value'));
});

test("'Escape' from partially edited title does not update original title", async () => {
  const { getByText, getByDisplayValue } = comparePageTitle();

  const pageTitleDefaultText = await waitForElement(() =>
    getByText('Perfherder Compare Revisions'),
  );

  fireEvent.click(pageTitleDefaultText);
  const inputField = await waitForElement(() =>
    getByDisplayValue('Perfherder Compare Revisions'),
  );
  fireEvent.change(inputField, {
    target: { value: 'new value' },
  });
  fireEvent.keyDown(inputField, { key: 'Escape' });

  await waitForElement(() => getByText('Perfherder Compare Revisions'));
});
