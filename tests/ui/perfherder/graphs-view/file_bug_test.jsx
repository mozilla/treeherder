import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import TestDataModal from '../../../../ui/perfherder/graphs/TestDataModal';
import {
  BUG_CC,
  MAX_URL_LENGTH,
  SUMMARY_PREFIX,
  buildBugDescription,
  buildBugUrl,
} from '../../../../ui/perfherder/graphs/fileBug';

const frameworks = [
  { id: 1, name: 'talos' },
  { id: 13, name: 'browsertime' },
];

const series = (overrides = {}) => ({
  repository_name: 'autoland',
  platform: 'android-hw-a55-14-0-aarch64-shippable',
  name: 'speedometer3 opt fission webrender',
  application: 'fenix',
  framework_id: 13,
  signature_id: 267971,
  signatureHash: 'fe4add3402d0aabbccdd',
  visible: true,
  ...overrides,
});

const page = (overrides = {}) => ({
  pageUrl: 'https://treeherder.mozilla.org/perfherder/graphs?series=autoland,267971,1,13',
  timeRange: { value: 1209600, text: 'Last 14 days' },
  testData: [series()],
  frameworks,
  highlightAlerts: true,
  highlightCommonAlerts: false,
  highlightChangelogData: false,
  highlightInitialDataPoints: false,
  showMissingJobs: false,
  replicates: false,
  showTable: false,
  selectedDataPoint: null,
  zoom: {},
  highlightedRevisions: ['', ''],
  userAgent: 'TestBrowser/1.0',
  ...overrides,
});

const params = (url) => new URL(url).searchParams;

describe('buildBugDescription', () => {
  test('starts with prompts for the reporter, then the graph configuration', () => {
    const description = buildBugDescription(page());

    expect(description).toMatch(
      /^\*\*What went wrong\?\*\*\n\n\n\*\*What did you expect to happen\?\*\*/,
    );
    expect(description).toContain('### Graph configuration');
    expect(description).toContain(
      '| Page | https://treeherder.mozilla.org/perfherder/graphs?series=autoland,267971,1,13 |',
    );
    expect(description).toContain('| Time range | Last 14 days |');
    expect(description).toContain('| View | graph |');
    expect(description).toContain('| Highlight alerts | yes |');
    expect(description).toContain('| Use replicates | no |');
    expect(description).toContain('| Browser | TestBrowser/1.0 |');
    // only shown when set
    expect(description).not.toContain('Selected data point');
    expect(description).not.toContain('Zoomed to');
    expect(description).not.toContain('Highlighted revisions');
  });

  test('lists every plotted test with its framework and signature', () => {
    const description = buildBugDescription(
      page({
        testData: [
          series(),
          series({
            repository_name: 'mozilla-central',
            platform: 'linux64',
            name: 'tp5o opt',
            application: null,
            framework_id: 1,
            signature_id: 42,
            signatureHash: undefined,
            visible: false,
          }),
        ],
      }),
    );

    expect(description).toContain('### Plotted tests (2)');
    expect(description).toContain(
      '| 1 | autoland | android-hw-a55-14-0-aarch64-shippable | speedometer3 opt fission webrender | fenix | browsertime | 267971 (fe4add3402d0) | yes |',
    );
    expect(description).toContain(
      '| 2 | mozilla-central | linux64 | tp5o opt |  | talos | 42 | no |',
    );
  });

  test('includes the selected data point, zoom, revisions and table view when set', () => {
    const description = buildBugDescription(
      page({
        showTable: true,
        replicates: true,
        selectedDataPoint: { signature_id: 267971, dataPointId: 123 },
        zoom: {
          x: [
            new Date('2026-11-01T00:00:00Z'),
            new Date('2026-11-08T00:00:00Z'),
          ],
          y: [0, 100],
        },
        highlightedRevisions: ['abc123', '', 'def456'],
      }),
    );

    expect(description).toContain('| View | table |');
    expect(description).toContain('| Use replicates | yes |');
    expect(description).toContain(
      '| Selected data point | signature 267971, data point 123 |',
    );
    expect(description).toContain(
      '| Zoomed to | 2026-11-01T00:00:00.000Z – 2026-11-08T00:00:00.000Z |',
    );
    expect(description).toContain(
      '| Highlighted revisions | abc123, def456 |',
    );
  });

  test('says when nothing is plotted', () => {
    const description = buildBugDescription(page({ testData: [] }));

    expect(description).toContain('### Plotted tests (0)');
    expect(description).toContain('No tests are plotted.');
  });

  test('keeps values from breaking the Markdown tables', () => {
    const description = buildBugDescription(
      page({ testData: [series({ name: 'weird | name\nwith newline' })] }),
    );

    expect(description).toContain('| weird \\| name with newline |');
  });

  test('leaves a cell empty when a value is missing', () => {
    const description = buildBugDescription(
      page({ testData: [series({ name: undefined })] }),
    );

    expect(description).toContain(
      '| 1 | autoland | android-hw-a55-14-0-aarch64-shippable |  | fenix |',
    );
  });

  test('can list only the first tests, pointing to the page for the rest', () => {
    const description = buildBugDescription(
      page({ testData: [series(), series({ signature_id: 2 })] }),
      1,
    );

    expect(description).toContain('### Plotted tests (2)');
    expect(description).not.toContain('| 2 | autoland');
    expect(description).toContain('…and 1 more; see the page link above.');
  });
});

describe('buildBugUrl', () => {
  test("opens Bugzilla's Enter Bug form for Perfherder, pre-filled", () => {
    const url = buildBugUrl(page());
    const query = params(url);

    expect(url.startsWith('https://bugzilla.mozilla.org/enter_bug.cgi?')).toBe(
      true,
    );
    expect(query.get('product')).toBe('Tree Management');
    expect(query.get('component')).toBe('Perfherder');
    expect(query.get('bug_type')).toBe('defect');
    expect(query.get('short_desc')).toBe(SUMMARY_PREFIX);
    expect(query.get('cc')).toBe(BUG_CC);
    expect(query.get('comment')).toBe(buildBugDescription(page()));
  });

  test('lists fewer tests rather than produce a link too long to open', () => {
    const manyTests = Array.from({ length: 80 }, (_, i) =>
      series({ signature_id: i + 1 }),
    );
    const url = buildBugUrl(page({ testData: manyTests }));
    const comment = params(url).get('comment');

    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(comment).toContain('### Plotted tests (80)');
    expect(comment).toMatch(/…and \d+ more; see the page link above\./);
  });

  test('still returns a link when even the configuration alone is long', () => {
    const url = buildBugUrl(
      page({ pageUrl: `https://example.com/?${'x'.repeat(MAX_URL_LENGTH)}` }),
    );

    expect(params(url).get('comment')).toContain(
      '…and 1 more; see the page link above.',
    );
  });
});

describe('"File a bug" button on the Add Test Data modal', () => {
  beforeEach(() => {
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    window.open.mockRestore();
  });

  const renderModal = async (props = {}) => {
    render(
      <TestDataModal
        projects={[]}
        plottedUnits={new Set()}
        timeRange={{ value: 1209600, text: 'Last 14 days' }}
        getTestData={() => {}}
        showModal
        toggle={() => {}}
        loadSignatures={async () => ({ data: [], failureStatus: null })}
        {...props}
      />,
    );
    // let the (empty) signature lists load
    await act(async () => {});
  };

  const openedComment = () =>
    params(window.open.mock.calls[0][0]).get('comment');

  test("opens Bugzilla's pre-filled form for the graph in a new tab", async () => {
    await renderModal({
      frameworks,
      testData: [series()],
      highlightAlerts: true,
      highlightCommonAlerts: true,
      highlightChangelogData: true,
      highlightInitialDataPoints: true,
      showMissingJobs: true,
      replicates: true,
      showTable: true,
      selectedDataPoint: { signature_id: 267971, dataPointId: 5 },
      zoom: { x: [0, 86400000], y: [0, 1] },
      highlightedRevisions: 'abc123',
    });

    fireEvent.click(screen.getByRole('button', {
        name: 'This is a redesigned view, file a bug for any issues here',
      }));

    expect(window.open).toHaveBeenCalledTimes(1);
    const [url, target, features] = window.open.mock.calls[0];
    expect(url.startsWith('https://bugzilla.mozilla.org/enter_bug.cgi?')).toBe(
      true,
    );
    expect(target).toBe('_blank');
    expect(features).toBe('noopener');
    const comment = openedComment();
    expect(comment).toContain(`| Page | ${window.location.href} |`);
    // the graph's own time range, not the picker's
    expect(comment).toContain('| Time range | Last 14 days |');
    expect(comment).toContain('| View | table |');
    expect(comment).toContain('| Highlight common alerts | yes |');
    expect(comment).toContain('| Show missing jobs | yes |');
    expect(comment).toContain('| Selected data point | signature 267971, data point 5 |');
    expect(comment).toContain('| Highlighted revisions | abc123 |');
    expect(comment).toContain(`| Browser | ${navigator.userAgent} |`);
    expect(comment).toContain('| browsertime |');
  });

  test('works with only the required props, before any tests are plotted', async () => {
    await renderModal();

    fireEvent.click(screen.getByRole('button', {
        name: 'This is a redesigned view, file a bug for any issues here',
      }));

    const comment = openedComment();
    expect(comment).toContain('| Highlight alerts | no |');
    expect(comment).toContain('| View | graph |');
    expect(comment).not.toContain('Selected data point');
    expect(comment).not.toContain('Zoomed to');
    expect(comment).toContain('No tests are plotted.');
  });
});

describe('Review fixes', () => {
  test('a zoom that is not a valid date is left out instead of throwing', () => {
    const description = buildBugDescription(
      page({ zoom: { x: [new Date('abc'), new Date('def')], y: [1, 2] } }),
    );

    expect(description).not.toContain('Zoomed to');
  });

  test("describes the picker's own state when given", () => {
    const description = buildBugDescription(
      page({
        picker: {
          query: 'speedometer3 a55',
          repositories: ['mozilla-central', 'autoland'],
          timeRange: 'Last 7 days',
          includeSubtests: true,
          platforms: ['android-hw-a55-14-0-aarch64-shippable'],
          browsers: ['fenix', 'chrome-m'],
          frameworks: ['browsertime'],
          tags: ['fission'],
          related: 'Same test on other platforms as autoland a55 speedometer3',
          matching: 1234,
        },
      }),
    );

    expect(description).toContain('### Test picker');
    expect(description).toContain('| Search | "speedometer3 a55" |');
    expect(description).toContain(
      '| Repositories | mozilla-central, autoland |',
    );
    expect(description).toContain('| Time range | Last 7 days |');
    expect(description).toContain('| Include subtests | yes |');
    expect(description).toContain(
      '| Platforms | android-hw-a55-14-0-aarch64-shippable |',
    );
    expect(description).toContain('| Browsers | fenix, chrome-m |');
    expect(description).toContain('| Frameworks | browsertime |');
    expect(description).toContain('| Tags | fission |');
    expect(description).toContain(
      '| Related tests | Same test on other platforms as autoland a55 speedometer3 |',
    );
    expect(description).toContain('| Matching tests | 1,234 |');
  });

  test('says when the picker has no search, repositories or filters', () => {
    const description = buildBugDescription(
      page({
        picker: {
          query: '',
          repositories: [],
          timeRange: 'Last 30 days',
          includeSubtests: false,
          platforms: [],
          browsers: [],
          frameworks: [],
          tags: [],
          related: '',
          matching: 0,
        },
      }),
    );

    expect(description).toContain('| Search | (none) |');
    expect(description).toContain('| Repositories | (none) |');
    expect(description).toContain('| Platforms | all |');
    expect(description).toContain('| Tags | all |');
    expect(description).not.toContain('Related tests');
    expect(description).toContain('| Matching tests | 0 |');
  });

  test('leaves the picker section out when not given', () => {
    expect(buildBugDescription(page())).not.toContain('### Test picker');
  });
});

describe("The button reports the picker's state", () => {
  beforeEach(() => {
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    window.open.mockRestore();
  });

  const signature = {
    id: 1,
    name: 'speedometer3 opt',
    suite: 'speedometer3',
    platform: 'linux64',
    projectName: 'mozilla-central',
    application: 'firefox',
    frameworkId: 13,
    tags: [],
    measurementUnit: 'score',
    searchText: 'mozilla-central linux64 speedometer3 opt firefox browsertime',
  };
  const buttonName = 'This is a redesigned view, file a bug for any issues here';
  const openedComment = () =>
    new URL(window.open.mock.calls[0][0]).searchParams.get('comment');

  test('with the search, a picked framework and the time range picked in it', async () => {
    render(
      <TestDataModal
        projects={[]}
        plottedUnits={new Set()}
        timeRange={{ value: 1209600, text: 'Last 14 days' }}
        getTestData={() => {}}
        showModal
        toggle={() => {}}
        frameworks={frameworks}
        loadSignatures={async (repo) => ({
          data: repo === 'mozilla-central' ? [signature] : [],
          failureStatus: null,
        })}
      />,
    );
    await act(async () => {});

    fireEvent.change(screen.getByLabelText('Search tests'), {
      target: { value: 'speedometer3' },
    });
    fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
    fireEvent.click(screen.getByRole('button', { name: /^browsertime/ }));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    const comment = openedComment();
    // the graph's range and the picker's own range are both reported
    expect(comment).toContain('| Time range | Last 14 days |');
    expect(comment).toContain('| Time range | Last 30 days |');
    expect(comment).toContain('| Search | "speedometer3" |');
    expect(comment).toContain('| Repositories | mozilla-central, autoland |');
    expect(comment).toContain('| Frameworks | browsertime |');
    expect(comment).toContain('| Matching tests | 1 |');
  });

  test('including a related-tests view', async () => {
    render(
      <TestDataModal
        projects={[]}
        plottedUnits={new Set()}
        timeRange={{ value: 1209600, text: 'Last 14 days' }}
        getTestData={() => {}}
        showModal
        toggle={() => {}}
        frameworks={frameworks}
        options={{
          option: 'addRelatedPlatform',
          relatedSeries: {
            name: 'speedometer3 opt',
            platform: 'windows11-64',
            repository_name: 'mozilla-central',
            application: 'firefox',
            framework_id: 13,
          },
        }}
        loadSignatures={async () => ({ data: [], failureStatus: null })}
      />,
    );
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(openedComment()).toContain(
      '| Related tests | Same test on other platforms as mozilla-central windows11-64 speedometer3 opt firefox |',
    );
  });
});
