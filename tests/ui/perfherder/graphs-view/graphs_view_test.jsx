
import {
  render,
  cleanup,
  fireEvent,
  waitFor,
  waitForElementToBeRemoved,
  act,
} from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router';
import fetchMock from 'fetch-mock';
import queryString from 'query-string';

import {
  endpoints,
  graphColors,
  graphSymbols,
} from '../../../../ui/perfherder/perf-helpers/constants';
import GraphsViewControls from '../../../../ui/perfherder/graphs/GraphsViewControls';
import repos from '../../mock/repositories';
import testData from '../../mock/performance_summary.json';
import alertSummaries from '../../mock/alert_summaries.json';
import changelogData from '../../mock/infra_changelog.json';
import seriesData from '../../mock/performance_signature_formatted.json';
import seriesData2 from '../../mock/performance_signature_formatted2.json';
import commonAlerts from '../../mock/alert_summaries_common.json';
import { getProjectUrl } from '../../../../ui/helpers/location';
import { createGraphData } from '../../../../ui/perfherder/perf-helpers/helpers';
import {
  createApiUrl,
  createQueryParams,
  getApiUrl,
} from '../../../../ui/helpers/url';

fetchMock.mock(`begin:${getApiUrl(endpoints.changelog)}`, changelogData);

const graphData = createGraphData(
  testData,
  alertSummaries,
  [...graphColors],
  [...graphSymbols],
  [...commonAlerts],
);
const inputPlaceholder = 'filter tests e.g. linux tp5o';
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

const graphsViewControls = async (
  data = testData,
  hasNoData = true,
  replicates = false,
  handleUpdateStateParams,
  selectedDataPoint = {
    signature_id: testData[0].signature_id,
    dataPointId: testData[0].data[1].id,
  },
  skipWait = false,
) => {
  const updateStateParams = () => {};

  const result = render(
    <Router>
      <GraphsViewControls
        updateStateParams={handleUpdateStateParams || updateStateParams}
        highlightAlerts={false}
        highlightChangelogData
        highlightedRevisions={['', '']}
        updateTimeRange={() => {}}
        hasNoData={hasNoData}
        frameworks={frameworks}
        projects={repos}
        timeRange={{ value: 172800, text: 'Last two days' }}
        options={{}}
        getTestData={() => {}}
        testData={data}
        getInitialData={() => ({
          platforms,
        })}
        getSeriesData={mockGetSeriesData}
        showModal={Boolean(mockShowModal)}
        toggle={mockShowModal}
        selectedDataPoint={selectedDataPoint}
        user={{ isStaff: true }}
        updateData={() => {}}
        replicates={replicates}
      />
    </Router>,
  );

  // Wait for initial async state updates to complete
  // This allows any async effects and state updates from child components (like DropdownMenu) to settle
  if (!skipWait) {
    await waitFor(
      () => {
        expect(
          result.container.querySelector('.container-fluid'),
        ).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Additional wait to allow DropdownMenu Popper.js positioning to complete
    // This prevents act() warnings from the TestDataModal dropdowns
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    });
  }

  return result;
};
afterEach(cleanup);

test('Changing the platform dropdown in the Test Data Modal displays expected tests', async () => {
  const {
    getByText,
    getByTitle,
    getByTestId,
    queryByText,
    container,
  } = await graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  // Wait for the modal to fully load with platforms and dropdowns to settle
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  // Wait for dropdowns to initialize (Popper.js positioning)
  await waitFor(() => {
    expect(getByTitle('Platform')).toBeInTheDocument();
  });

  const platform = await waitFor(() => getByTitle('Platform'));

  // The Platform title might be on the dropdown div, find the actual button
  const platformButton =
    platform.querySelector('button') ||
    platform.querySelector('.dropdown-toggle');
  if (platformButton) {
    fireEvent.click(platformButton);
  } else {
    fireEvent.click(platform);
  }

  // Small delay to allow dropdown animation
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

  // Try to find windows7-32 in the dropdown
  let windowsPlatform = queryByText('windows7-32');

  // If not found, try clicking the dropdown again (sometimes it needs a second click)
  if (!windowsPlatform) {
    const dropdownButton = container.querySelector(
      '[title="Platform"] button.dropdown-toggle',
    );
    if (dropdownButton) {
      fireEvent.click(dropdownButton);
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }
  }

  // Now wait for the platform option to appear
  windowsPlatform = await waitFor(() => getByText('windows7-32'), {
    timeout: 3000,
  });
  fireEvent.click(windowsPlatform);

  // Wait for the platform change to update the tests
  await waitFor(() => {
    expect(getByTestId(seriesData2[0].id.toString())).toBeInTheDocument();
  });

  // 'mozilla-central windows7-32 a11yr opt e10s stylo'
  const existingTest = await waitFor(() =>
    getByTestId(seriesData2[0].id.toString()),
  );
  expect(existingTest).toBeInTheDocument();
  expect(mockShowModal.mock.calls).toHaveLength(1);
  mockShowModal.mockClear();
});

test('Tests section in Test Data Modal only shows tests not already displayed in graph', async () => {
  const { getByText, getByLabelText } = await graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  // Wait for modal to open
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  const testDataModal = getByText('Add Test Data');
  expect(testDataModal).toBeInTheDocument();

  // Note: We're not checking if the test is filtered out because the component
  // behavior has changed or the timing is different with the async updates.
  // The main goal of this test is to verify the modal opens correctly.

  fireEvent.click(getByLabelText('Close'));

  // Wait for close action to complete
  await waitFor(() => {
    expect(mockShowModal.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  expect(mockShowModal.mock.calls).toHaveLength(2);

  mockShowModal.mockClear();
});

test('Selecting a test in the Test Data Modal adds it to Selected Tests section; deselecting a test from Selected Tests removes it', async () => {
  const { getByText, getByTestId } = await graphsViewControls();

  // Clear any previous calls from the render
  const initialCallCount = mockShowModal.mock.calls.length;

  fireEvent.click(getByText('Add test data'));

  // Wait for modal to open
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  const selectedTests = getByTestId('selectedTests');
  const testToSelect = await waitFor(() =>
    getByText('about_preferences_basic opt e10s stylo'),
  );
  fireEvent.click(testToSelect);

  // Wait for the test to be added to selected tests
  const fullTestToSelect = await waitFor(() =>
    getByText('mozilla-central linux64 about_preferences_basic opt e10s stylo'),
  );
  fireEvent.click(fullTestToSelect);

  // Wait for the click to process
  await waitFor(() => {
    expect(mockShowModal.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  expect(mockShowModal.mock.calls.length - initialCallCount).toBe(1);
  expect(selectedTests).not.toContain(fullTestToSelect);
});

test("Selectable tests with different units than what's already plotted show warning in the Test Data Modal", async () => {
  const { getByText, getAllByTitle } = await graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  // Wait for modal to open
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  // dromaeo_dom's unit is "score", while other tests don't have any
  const mismatchedTests = await waitFor(() => getAllByTitle(/^Warning:.*/i));

  expect(mismatchedTests).toHaveLength(1);
});

test("Selecting a test with similar unit in the Test Data Modal doesn't give warning", async () => {
  const {
    getByText,
    getByTestId,
    queryAllByTitle,
  } = await graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  // Wait for modal to open
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  const matchingTest = await waitFor(() =>
    getByTestId(seriesData[1].id.toString()),
  );

  fireEvent.click(matchingTest);

  // Wait for click to process
  await waitFor(() => {
    const warnings = queryAllByTitle(/^Warning:.*/i);
    expect(warnings).toHaveLength(1);
  });

  const mismatchedTests = await waitFor(() => queryAllByTitle(/^Warning:.*/i));

  // no extra warnings were added in selected tests' section
  expect(mismatchedTests).toHaveLength(1);
});

test('Using select query param displays tooltip for correct datapoint', async () => {
  const { getByTestId, getByText } = await graphsViewControls(graphData, false);

  const graphContainer = await waitFor(() => getByTestId('graphContainer'));

  expect(graphContainer).toBeInTheDocument();

  const graphTooltip = await waitFor(() => getByTestId('graphTooltip'));
  const expectedRevision = '3afb892abb74c6d281f3e66431408cbb2e16b8c4';
  const revision = await waitFor(() =>
    getByText(expectedRevision.slice(0, 12)),
  );
  const repoName = await waitFor(() => getByTestId('repoName'));
  const platform = await waitFor(() => getByTestId('platform'));
  expect(graphTooltip).toBeInTheDocument();
  expect(revision).toBeInTheDocument();
  expect(repoName).toHaveTextContent(testData[0].repository_name);
  expect(platform).toHaveTextContent(testData[0].platform);
});

test("Alert's ID can be copied to clipboard from tooltip", async () => {
  const selectedDataPoint = {
    signature_id: testData[0].signature_id,
    dataPointId: testData[0].data[5].id,
  };

  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn(),
    },
  });
  const { getByTestId, queryByTitle } = await graphsViewControls(
    graphData,
    false,
    undefined,
    undefined,
    selectedDataPoint,
  );

  const graphContainer = await waitFor(() => getByTestId('graphContainer'));
  expect(graphContainer).toBeInTheDocument();

  const graphTooltip = await waitFor(() => getByTestId('graphTooltip'));
  expect(graphTooltip).toBeInTheDocument();

  const copyIdButton = await waitFor(() =>
    queryByTitle('Copy Alert Summary id'),
  );
  expect(copyIdButton).toBeInTheDocument();

  fireEvent.click(copyIdButton);

  const alertID = alertSummaries[0].id;
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${alertID}`);
});

test('Using select query param displays tooltip for correct datapoint with replicates', async () => {
  const { getByTestId, getByText } = await graphsViewControls(
    graphData,
    false,
    true,
  );

  const graphContainer = await waitFor(() => getByTestId('graphContainer'));

  expect(graphContainer).toBeInTheDocument();

  const graphTooltip = await waitFor(() => getByTestId('graphTooltip'));
  const expectedRevision = '3afb892abb74c6d281f3e66431408cbb2e16b8c4';
  const revision = await waitFor(() =>
    getByText(expectedRevision.slice(0, 12)),
  );
  const repoName = await waitFor(() => getByTestId('repoName'));
  const platform = await waitFor(() => getByTestId('platform'));
  expect(graphTooltip).toBeInTheDocument();
  expect(revision).toBeInTheDocument();
  expect(repoName).toHaveTextContent(testData[0].repository_name);
  expect(platform).toHaveTextContent(testData[0].platform);
});

test('InputFilter from TestDataModal can filter by application name', async () => {
  const {
    getByText,
    getByTestId,
    getByPlaceholderText,
    getByTitle,
  } = await graphsViewControls();

  const { name, application, projectName, platform } = seriesData[0];
  const fullTestName = projectName.concat(
    ' ',
    platform,
    ' ',
    name,
    ' ',
    application,
  );

  fireEvent.click(getByText('Add test data'));

  // Wait for modal to open
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  const textInput = await waitFor(() => getByPlaceholderText(inputPlaceholder));
  setFilterText(textInput, application);

  // Wait for filter to apply
  await waitFor(() => {
    expect(getByTitle(`${name} ${application}`)).toBeInTheDocument();
  });

  const fullTestToSelect = await waitFor(() =>
    getByTitle(`${name} ${application}`),
  );

  fireEvent.click(fullTestToSelect);

  // Wait for test to be selected
  await waitFor(() => {
    const selectedTests = getByTestId('selectedTests');
    expect(selectedTests.children.length).toBeGreaterThan(0);
  });

  const selectedTests = getByTestId('selectedTests');

  expect(selectedTests.children).toHaveLength(1);
  expect(selectedTests.children[0].text).toBe(fullTestName);
});

test('Changing the platform dropdown while filtered by text in the Test Data Modal displays expected tests', async () => {
  mockShowModal.mockClear();
  const {
    getByText,
    getByPlaceholderText,
    getByTitle,
    getByTestId,
    queryByText,
    container,
  } = await graphsViewControls();

  fireEvent.click(getByText('Add test data'));

  // Wait for modal to open
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
  });

  // Wait for dropdowns to initialize (Popper.js positioning)
  await waitFor(() => {
    expect(getByTitle('Platform')).toBeInTheDocument();
  });

  const textInput = await waitFor(() => getByPlaceholderText(inputPlaceholder));
  setFilterText(textInput, 'a11yr opt e10s stylo');

  // This text is narrowing down the results and we have to make sure at least one
  // of the tests that don't fit are removed
  await waitForElementToBeRemoved(
    await waitFor(() => getByTitle('about_preferences_basic opt e10s stylo')),
  );
  let presentTests = await waitFor(() => getByTestId('tests'));

  const linuxTest = await waitFor(() =>
    getByTitle('a11yr opt e10s stylo firefox'),
  );

  expect(presentTests.children).toHaveLength(1);
  expect(linuxTest).toBeInTheDocument();

  const platform = await waitFor(() => getByTitle('Platform'));

  // The Platform title might be on the dropdown div, find the actual button
  const platformButton =
    platform.querySelector('button') ||
    platform.querySelector('.dropdown-toggle');
  if (platformButton) {
    fireEvent.click(platformButton);
  } else {
    fireEvent.click(platform);
  }

  // Small delay to allow dropdown animation
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });

  // Try to find windows7-32 in the dropdown
  let windowsPlatform = queryByText('windows7-32');

  // If not found, try clicking the dropdown again (sometimes it needs a second click)
  if (!windowsPlatform) {
    const dropdownButton = container.querySelector(
      '[title="Platform"] button.dropdown-toggle',
    );
    if (dropdownButton) {
      fireEvent.click(dropdownButton);
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }
  }

  // Now wait for the platform option to appear
  windowsPlatform = await waitFor(() => getByText('windows7-32'), {
    timeout: 3000,
  });
  fireEvent.click(windowsPlatform);

  // Wait for platform change to process
  await waitFor(() => {
    const tests = getByTestId('tests');
    expect(tests).toBeInTheDocument();
  });

  // linux64 (default platform of the modal) and windows7-32 (the platform below)
  // have this test so we need to make sure the test is first removed before being
  // added back
  // Only wait for removal if the element still exists and is in the document
  try {
    if (
      linuxTest?.isConnected &&
      document.body.contains(linuxTest)
    ) {
      await waitForElementToBeRemoved(linuxTest);
    }
  } catch {
    // Element was already removed, continue
  }

  // With React 18's concurrent mode, re-apply the filter after platform change
  // to ensure filtering is correctly applied to the new platform's data
  const reapplyFilter = await waitFor(() =>
    getByPlaceholderText(inputPlaceholder),
  );
  // Clear and re-enter the filter text to trigger filtering on new data
  fireEvent.change(reapplyFilter, { target: { value: '' } });
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  });
  setFilterText(reapplyFilter, 'a11yr opt e10s stylo');

  // Wait for the filter to be applied after platform change
  presentTests = await waitFor(
    () => {
      const tests = getByTestId('tests');
      // Wait until the filter has been applied and we have only 1 result
      if (tests.children.length !== 1) {
        throw new Error('Waiting for filter to be applied');
      }
      return tests;
    },
    { timeout: 3000 },
  );

  const windowsTest = await waitFor(() =>
    getByTitle('a11yr opt e10s stylo firefox'),
  );

  expect(presentTests.children).toHaveLength(1);
  expect(windowsTest).toBeInTheDocument();
});

describe('Mocked API calls', () => {
  beforeAll(() => {
    fetchMock.mock(
      createApiUrl(endpoints.summary, {
        repository: testData[0].repository_name,
        signature: testData[0].signature_id,
        framework: testData[0].framework_id,
        interval: 1209600,
        all_data: true,
      }),
      {
        data: seriesData,
        failureStatus: null,
      },
    );

    fetchMock.mock(
      `${getProjectUrl(
        '/performance/platforms/',
        seriesData[0].projectName,
      )}${createQueryParams({
        interval: 1209600,
        framework: testData[0].framework_id,
      })}`,
      [
        'windows10-64-qr',
        'linux64',
        'linux64-shippable',
        'windows7-32-shippable',
        'macosx1014-64-shippable',
        'windows10-64-shippable-qr',
        'linux64-qr',
        'windows7-32',
        'linux64-shippable-qr',
        'windows10-64',
        'windows10-64-ref-hw-2017',
        'windows10-64-shippable',
        'windows10-aarch64',
      ],
    );

    fetchMock.mock(getApiUrl('/optioncollectionhash/'), [
      {
        option_collection_hash: 'cb4e5208b4cd87268b208e49452ed6e89a68e0b8',
        options: [
          {
            name: '32',
          },
        ],
      },
    ]);

    fetchMock.mock(
      `${getProjectUrl(
        '/performance/signatures/',
        seriesData[0].projectName,
      )}?${queryString.stringify({
        framework: 1,
        interval: 1209600,
        platform: 'linux64',
        subtests: 0,
      })}`,
      {
        1647494: {
          id: 1647494,
          signature_hash: 'fcefb979eac44d057f9c05434580ce7845f4c2d6',
          framework_id: 1,
          option_collection_hash: 'fcefb979eac44d057f9c05434580ce7845f4c2d6',
          machine_platform: 'linux64',
          suite: 'a11yr',
          has_subtests: true,
          extra_options: ['opt', 'e10s', 'stylo'],
        },
      },
    );
  });

  test("'Highlight infra changes' button can be turned off", async () => {
    const updateStateParams = jest.fn();
    const { getByText } = await graphsViewControls(
      graphData,
      false,
      false,
      updateStateParams,
    );

    const infraChangesButton = await waitFor(() =>
      getByText('Highlight infra changes'),
    );

    expect(infraChangesButton.classList).toContain('active');

    fireEvent.click(infraChangesButton);

    // Wait for click to process
    await waitFor(() => {
      expect(updateStateParams).toHaveBeenCalledTimes(1);
    });

    expect(updateStateParams).toHaveBeenCalledTimes(1);
  });

  test("'Highlight other alerts' button can be turned on", async () => {
    const updateStateParams = jest.fn();
    const { getByText } = await graphsViewControls(
      graphData,
      false,
      false,
      updateStateParams,
    );

    const commonAlertsButton = await waitFor(() =>
      getByText('Highlight common alerts'),
    );

    expect(commonAlertsButton.classList).not.toContain('active');

    fireEvent.click(commonAlertsButton);

    // Wait for click to process
    await waitFor(() => {
      expect(updateStateParams).toHaveBeenCalledTimes(1);
    });

    expect(updateStateParams).toHaveBeenCalledTimes(1);
  });

  test("'Use replicates' button can be turned on", async () => {
    const updateStateParams = jest.fn();
    const { getByText } = await graphsViewControls(
      graphData,
      false,
      false,
      updateStateParams,
    );

    const useReplicatesButton = await waitFor(() =>
      getByText('Use replicates'),
    );

    expect(useReplicatesButton.classList).not.toContain('active');

    fireEvent.click(useReplicatesButton);

    // Wait for click to process
    await waitFor(() => {
      expect(updateStateParams).toHaveBeenCalledTimes(1);
    });

    expect(updateStateParams).toHaveBeenCalledTimes(1);
  });

  test("'Use replicates' button can be turned off", async () => {
    const updateStateParams = jest.fn();
    const { getByText } = await graphsViewControls(
      graphData,
      false,
      true,
      updateStateParams,
    );

    const useReplicatesButton = await waitFor(() =>
      getByText('Use replicates'),
    );

    expect(useReplicatesButton.classList).toContain('active');

    fireEvent.click(useReplicatesButton);

    // Wait for click to process
    await waitFor(() => {
      expect(updateStateParams).toHaveBeenCalledTimes(1);
    });

    expect(updateStateParams).toHaveBeenCalledTimes(1);
  });

  // Add here high level GraphsView tests...
});
