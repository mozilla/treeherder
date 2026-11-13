import {
  render,
  cleanup,
  fireEvent,
  waitFor,
  act,
  within,
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
import {
  buildSearchText,
  createGraphData,
} from '../../../../ui/perfherder/perf-helpers/helpers';
import {
  createApiUrl,
  createQueryParams,
  getApiUrl,
} from '../../../../ui/helpers/url';

fetchMock.mock(`begin:${getApiUrl(endpoints.changelog)}`, changelogData);

// Mock the single-job endpoint so that request resolves in tests
fetchMock.mock(/\/jobs\/\d+\/$/, {
  id: 1,
  job_type_name: 'test-linux64/opt-talos-tp5o',
  job_type_symbol: 'tp5o',
  job_group_name: 'Talos performance tests',
  platform: 'linux64',
  platform_option: 'opt',
  result: 'success',
  state: 'completed',
  submit_timestamp: 0,
  start_timestamp: 0,
  end_timestamp: 0,
});

const graphData = createGraphData(
  testData,
  alertSummaries,
  [...graphColors],
  [...graphSymbols],
  [...commonAlerts],
);
const frameworks = [
  { id: 1, name: 'talos' },
  { id: 2, name: 'build_metrics' },
];

// one of the selectable tests is the series already plotted on the graph
const plottedSeries = {
  ...seriesData[0],
  id: testData[0].signature_id,
  name: testData[0].name,
};
const signatures = [plottedSeries, ...seriesData.slice(1), ...seriesData2].map(
  (series) => ({ ...series, searchText: buildSearchText(series, frameworks) }),
);
const mockLoadSignatures = jest.fn(async (repo) => ({
  data: repo === 'mozilla-central' ? signatures : [],
  failureStatus: null,
}));

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
  highlightInitialDataPoints = false,
  getTestData = () => {},
) => {
  const updateStateParams = () => {};

  const result = render(
    <Router>
      <GraphsViewControls
        updateStateParams={handleUpdateStateParams || updateStateParams}
        highlightAlerts={false}
        highlightChangelogData
        highlightInitialDataPoints={highlightInitialDataPoints}
        highlightedRevisions={['', '']}
        updateTimeRange={() => {}}
        hasNoData={hasNoData}
        frameworks={frameworks}
        projects={repos}
        timeRange={{ value: 172800, text: 'Last two days' }}
        options={{}}
        getTestData={getTestData}
        testData={data}
        loadSignatures={mockLoadSignatures}
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

const openModal = async ({ getByText, getByTestId }) => {
  fireEvent.click(getByText('Add test data'));
  await waitFor(() => {
    expect(getByText('Add Test Data')).toBeInTheDocument();
    expect(
      within(getByTestId('tests')).queryAllByRole('row'),
    ).toHaveLength(signatures.length);
  });
};

test('Test Data Modal lists tests from every platform without choosing one first', async () => {
  const result = await graphsViewControls();
  await openModal(result);

  expect(result.getByTestId(seriesData[1].id.toString())).toBeInTheDocument();
  expect(result.getByTestId(seriesData2[0].id.toString())).toBeInTheDocument();
  mockShowModal.mockClear();
});

test('Tests already displayed in the graph are checked and disabled in the Test Data Modal', async () => {
  const result = await graphsViewControls();
  await openModal(result);

  const plottedRow = result.getByTestId(plottedSeries.id.toString());
  expect(within(plottedRow).getByRole('checkbox')).toBeDisabled();
  expect(
    within(result.getByTestId(seriesData[1].id.toString())).getByRole(
      'checkbox',
    ),
  ).not.toBeDisabled();
  mockShowModal.mockClear();
});

test("Selectable tests with different units than what's already plotted show warning in the Test Data Modal", async () => {
  const result = await graphsViewControls();
  await openModal(result);

  // dromaeo_dom's unit is "score", while other tests don't have any
  expect(result.getAllByTitle(/^Warning:.*/i)).toEqual([
    result.getByTestId(seriesData[3].id.toString()),
  ]);
  mockShowModal.mockClear();
});

test('Searching and selecting a test in the Test Data Modal plots it', async () => {
  const getTestData = jest.fn();
  const result = await graphsViewControls(
    testData,
    true,
    false,
    undefined,
    undefined,
    false,
    false,
    getTestData,
  );
  await openModal(result);

  fireEvent.change(result.getByLabelText('Search tests'), {
    target: { value: 'windows7 about_preferences' },
  });
  await waitFor(() =>
    expect(
      within(result.getByTestId('tests')).queryAllByRole('row'),
    ).toHaveLength(1),
  );
  fireEvent.click(result.getByTestId(seriesData2[1].id.toString()));
  fireEvent.click(result.getByRole('button', { name: 'Plot graphs (1)' }));

  expect(getTestData).toHaveBeenCalledWith([
    {
      repository_name: 'mozilla-central',
      signature_id: seriesData2[1].id,
      framework_id: 1,
      replicates: false,
    },
  ]);
  mockShowModal.mockClear();
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

test('Job link includes searchStr query param to filter to the single job', async () => {
  const { getByRole } = await graphsViewControls(graphData, false);

  const jobLink = await waitFor(() => getByRole('link', { name: 'job' }));

  // The tokens come from the mocked job's searchStr, so the Job View filters
  // down to this job instead of showing every job on the push.
  await waitFor(() =>
    expect(decodeURIComponent(jobLink.search)).toContain(
      'searchStr=Linux,opt,Talos,performance,tests,test-linux64/opt-talos-tp5o,tp5o',
    ),
  );
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

  describe('Highlight Options Dropdown', () => {
    test("'Highlight alerts' option can be turned on", async () => {
      const updateStateParams = jest.fn();
      const { getByText } = await graphsViewControls(
        graphData,
        false,
        false,
        updateStateParams,
      );

      const dropdownToggle = await waitFor(() => getByText('Highlight'));
      fireEvent.click(dropdownToggle);

      const alertsOption = await waitFor(() => getByText('Highlight alerts'));

      expect(alertsOption.querySelector('svg')).toBeNull();

      fireEvent.click(alertsOption);

      await waitFor(() => {
        expect(updateStateParams).toHaveBeenCalledTimes(1);
      });
      expect(updateStateParams).toHaveBeenCalledWith({
        highlightAlerts: true,
      });
    });

    test("'Highlight infra changes' option can be turned off", async () => {
      const updateStateParams = jest.fn();
      const { getByText } = await graphsViewControls(
        graphData,
        false,
        false,
        updateStateParams,
      );

      const dropdownToggle = await waitFor(() => getByText('Highlight'));
      fireEvent.click(dropdownToggle);

      const infraChangesOption = await waitFor(() =>
        getByText('Highlight infra changes'),
      );

      expect(infraChangesOption.querySelector('svg')).not.toBeNull();

      fireEvent.click(infraChangesOption);

      await waitFor(() => {
        expect(updateStateParams).toHaveBeenCalledTimes(1);
      });
      expect(updateStateParams).toHaveBeenCalledWith({
        highlightChangelogData: false,
      });
    });

    test("'Highlight common alerts' option can be turned on", async () => {
      const updateStateParams = jest.fn();
      const { getByText } = await graphsViewControls(
        graphData,
        false,
        false,
        updateStateParams,
      );

      const dropdownToggle = await waitFor(() => getByText('Highlight'));
      fireEvent.click(dropdownToggle);

      const commonAlertsOption = await waitFor(() =>
        getByText('Highlight common alerts'),
      );

      expect(commonAlertsOption.querySelector('svg')).toBeNull();

      fireEvent.click(commonAlertsOption);

      await waitFor(() => {
        expect(updateStateParams).toHaveBeenCalledTimes(1);
      });
      expect(updateStateParams).toHaveBeenCalledWith({
        highlightCommonAlerts: true,
      });
    });

    test("'Highlight initial data points' option can be turned on", async () => {
      const updateStateParams = jest.fn();
      const { getByText } = await graphsViewControls(
        graphData,
        false,
        false,
        updateStateParams,
        undefined,
        false,
        false,
      );

      const dropdownToggle = await waitFor(() => getByText('Highlight'));
      fireEvent.click(dropdownToggle);

      const initialDataPointsOption = await waitFor(() =>
        getByText('Highlight initial data points'),
      );

      expect(initialDataPointsOption.querySelector('svg')).toBeNull();

      fireEvent.click(initialDataPointsOption);

      await waitFor(() => {
        expect(updateStateParams).toHaveBeenCalledTimes(1);
      });
      expect(updateStateParams).toHaveBeenCalledWith({
        highlightInitialDataPoints: true,
      });
    });

    test("'Highlight initial data points' option can be turned off", async () => {
      const updateStateParams = jest.fn();
      const { getByText } = await graphsViewControls(
        graphData,
        false,
        false,
        updateStateParams,
        undefined,
        false,
        true,
      );

      const dropdownToggle = await waitFor(() => getByText('Highlight'));
      fireEvent.click(dropdownToggle);

      const initialDataPointsOption = await waitFor(() =>
        getByText('Highlight initial data points'),
      );

      expect(initialDataPointsOption.querySelector('svg')).not.toBeNull();

      fireEvent.click(initialDataPointsOption);

      await waitFor(() => {
        expect(updateStateParams).toHaveBeenCalledTimes(1);
      });
      expect(updateStateParams).toHaveBeenCalledWith({
        highlightInitialDataPoints: false,
      });
    });
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

    updateStateParams.mockClear();
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

    updateStateParams.mockClear();
    fireEvent.click(useReplicatesButton);

    // Wait for click to process
    await waitFor(() => {
      expect(updateStateParams).toHaveBeenCalledTimes(1);
    });

    expect(updateStateParams).toHaveBeenCalledTimes(1);
  });

  // Add here high level GraphsView tests...
});
