import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SummaryTab from '../../../../../ui/job-view/details/tabs/summaryTab/SummaryTab';
import {
  buildTestSummary,
  prepareBugSuggestions,
} from '../../../../../ui/helpers/testSummary';
import {
  requiredInternalOccurrences,
  thEvents,
} from '../../../../../ui/helpers/constants';

// The real filer posts to the API; a button standing for a successful
// submission is all the tab's callback needs.
jest.mock('../../../../../ui/shared/InternalIssueFiler', () => {
  const { createElement } = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ successCallback }) =>
      createElement(
        'button',
        { type: 'button', onClick: () => successCallback({ internal_id: 42 }) },
        'Submit internal issue',
      ),
  };
});

const selectedJob = {
  id: 1,
  platform: 'linux',
  job_group_name: 'Mochitest',
  job_type_name: 'test-linux1804-64/opt-mochitest-1',
  job_type_symbol: 'M-1',
};
const currentRepo = { name: 'autoland' };

const summaryJsonl = [
  '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html"}',
  '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html","status":"FAIL","expected":"PASS","message":"assertion failed"}',
].join('\n');

// The exact line buildFailureSuggestions derives from the artifact above.
const matchingSuggestion = () => ({
  search: 'TEST-UNEXPECTED-FAIL | dom/tests/test_fail.html | assertion failed',
  path_end: 'dom/tests/test_fail.html',
  bugs: { open_recent: [], all_others: [] },
});

// A line only the classic bug_suggestions API knows about.
const classicOnlySuggestion = () => ({
  search: 'PROCESS-CRASH | application crashed | dom/tests/test_fail.html',
  path_end: 'dom/tests/test_fail.html',
  bugs: { open_recent: [], all_others: [] },
});

const renderSummaryTab = (bugSuggestions, jsonl = summaryJsonl, repo = currentRepo) =>
  render(
    <MemoryRouter>
      <SummaryTab
        summary={buildTestSummary(jsonl)}
        summaryLoading={false}
        summaryError={null}
        selectedJob={selectedJob}
        jobLogUrls={[]}
        jobDetails={[]}
        addBug={() => {}}
        pinJob={() => {}}
        currentRepo={repo}
        bugSuggestions={bugSuggestions}
        bugSuggestionsLoading={false}
      />
    </MemoryRouter>,
  );

// Renders with only the props a case cares about; everything else is inert.
const renderWith = (props) =>
  render(
    <MemoryRouter>
      <SummaryTab
        selectedJob={selectedJob}
        jobLogUrls={[]}
        jobDetails={[]}
        addBug={() => {}}
        pinJob={() => {}}
        currentRepo={currentRepo}
        bugSuggestions={[]}
        bugSuggestionsLoading={false}
        {...props}
      />
    </MemoryRouter>,
  );

// Folds or unfolds the classic section. It starts folded, unless the classic
// list holds lines the summary lacks.
const toggleClassic = () =>
  fireEvent.click(
    screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
  );

describe('SummaryTab divergence with the classic failure summary', () => {
  afterEach(cleanup);

  test('stacks the classic failure summary below, open, when it has lines the summary lacks', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    // Open by default, the heading saying what the summary above misses: a
    // reader classifying from the summary alone would never see that line.
    const toggle = screen.getByRole('button', {
      name: /Failure Summary \(classic\)/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('1 line not shown above');
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
    expect(
      screen.getByText(/differs from the summary above/),
    ).toBeInTheDocument();
  });

  test('stays folded when only the summary has lines the other lacks', () => {
    // Nothing is hidden from the reader: the extra line is in the summary.
    const twoFailuresJsonl = [
      summaryJsonl,
      '{"action":"test_start","time":20,"group":"dom/manifest.ini","test":"dom/tests/test_more.html"}',
      '{"action":"test_end","time":30,"group":"dom/manifest.ini","test":"dom/tests/test_more.html","status":"FAIL","expected":"PASS","message":"also failed"}',
    ].join('\n');
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion()]),
      twoFailuresJsonl,
    );

    const toggle = screen.getByRole('button', {
      name: /Failure Summary \(classic\)/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveTextContent('not shown above');
    // The two still differ, which the note says once the section is open.
    toggleClassic();
    expect(
      screen.getByText(/differs from the summary above/),
    ).toBeInTheDocument();
  });

  test('folds the section, without the divergence note, when they agree', () => {
    renderSummaryTab(prepareBugSuggestions([matchingSuggestion()]));

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    // Still reachable — the classic lines are no longer shown anywhere else —
    // but folded, and with nothing to say about a divergence.
    expect(
      screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    toggleClassic();
    expect(screen.queryByText(/differs from the summary above/)).toBeNull();
  });
});

describe('SummaryTab log viewer links', () => {
  const failingJsonl = [
    '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html"}',
    '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html","status":"FAIL","expected":"PASS","message":"assertion failed"}',
  ].join('\n');

  afterEach(cleanup);

  test('links a failure line to the log viewer by its text and time', () => {
    renderSummaryTab([], failingJsonl);

    const link = screen
      .getByTitle('Go to this line in the log viewer')
      .closest('a');
    const url = new URL(link.getAttribute('href'), 'https://treeherder.test');

    expect(url.pathname).toBe('/logviewer');
    expect(url.searchParams.get('job_id')).toBe('1');
    expect(url.searchParams.get('repo')).toBe('autoland');
    expect(url.searchParams.getAll('lineText')).toEqual([
      'dom/tests/test_fail.html',
      'assertion failed',
    ]);
    expect(url.searchParams.get('lineTime')).toBe('10');
    expect(url.searchParams.get('lineNumber')).toBeNull();
  });

  test('links the failures of any artifact, whatever produced it', () => {
    renderSummaryTab([]);

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(
      screen.getAllByTitle('Go to this line in the log viewer').length,
    ).toBeGreaterThan(0);
  });
});

describe('SummaryTab stacks', () => {
  const stack =
    'check@dom/tests/test_fail.html:12:5\nrun@dom/tests/test_fail.html:40:3\n';
  const failingJsonl = (end = {}) =>
    [
      '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html"}',
      JSON.stringify({
        action: 'test_end',
        time: 10,
        group: 'dom/manifest.ini',
        test: 'dom/tests/test_fail.html',
        status: 'FAIL',
        expected: 'PASS',
        message: 'assertion failed',
        ...end,
      }),
    ].join('\n');

  afterEach(cleanup);

  test('shows the stack of a line over it on hover', async () => {
    renderSummaryTab([], failingJsonl({ stack }));

    const line = screen.getByText(/assertion failed/);
    expect(line).toHaveClass('summary-stack-trigger');
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.mouseOver(line);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('check@dom/tests/test_fail.html:12:5');
    expect(tooltip).toHaveTextContent('run@dom/tests/test_fail.html:40:3');
  });

  test('leaves a line without a stack as it was', () => {
    const { container } = renderSummaryTab([], failingJsonl());

    expect(screen.getByText(/assertion failed/)).toBeInTheDocument();
    expect(container.querySelector('.summary-stack-trigger')).toBeNull();
  });
});

describe('SummaryTab worker lines', () => {
  // What the worker writes once a task outlives its max run time: after it
  // killed the harness, so the artifact cannot have it.
  const abortSuggestion = () => ({
    search: '[taskcluster:error] Aborting task...',
    path_end: null,
    line_number: 17752,
    bugs: {
      open_recent: [
        {
          id: 2073425,
          summary: 'High freq Talos [taskcluster:error] Aborting task...',
          resolution: '',
        },
      ],
      all_others: [],
    },
  });

  const passingJsonl = [
    '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_pass.html"}',
    '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_pass.html","status":"PASS"}',
  ].join('\n');

  afterEach(cleanup);

  test('lists them after the failures, linked to their log line', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), abortSuggestion()]),
    );

    // Shown once: in the summary, the classic section being folded.
    expect(screen.getAllByText(/Aborting task/)).toHaveLength(1);
    expect(screen.getByText(/High freq Talos/)).toBeInTheDocument();
    const urls = screen
      .getAllByTitle('Go to this line in the log viewer')
      .map(
        (img) =>
          new URL(
            img.closest('a').getAttribute('href'),
            'https://treeherder.test',
          ),
      );
    expect(urls).toHaveLength(2);
    expect(urls[1].searchParams.get('lineNumber')).toBe('17753');
    expect(urls[1].searchParams.get('lineText')).toBeNull();

    toggleClassic();
    expect(screen.queryByText(/differs from the summary above/)).toBeNull();
  });

  test('lists them when every test passed', () => {
    renderSummaryTab(prepareBugSuggestions([abortSuggestion()]), passingJsonl);

    expect(screen.queryByText('No failures found in the summary.')).toBeNull();
    expect(screen.getAllByText(/Aborting task/)).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  test('adds nothing for a job with no summary artifact', () => {
    renderWith({
      summary: null,
      summaryError: null,
      bugSuggestions: prepareBugSuggestions([abortSuggestion()]),
    });

    expect(
      screen.getByText('No summary artifact for this job.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
    expect(screen.getAllByText(/Aborting task/)).toHaveLength(1);
  });
});

describe('SummaryTab loading and error states', () => {
  afterEach(cleanup);

  test('overlays a spinner while the panel is loading the artifact', () => {
    renderWith({ summaryLoading: true });

    expect(screen.getByTitle('Loading...')).toBeInTheDocument();
    // The list keeps its shape rather than being replaced, and does not claim
    // the job has no failures before the artifact has been read.
    expect(screen.queryByText('No failures found in the summary.')).toBeNull();
  });

  test('shows every count, zeros included', () => {
    renderWith({ summary: buildTestSummary(summaryJsonl) });

    // The total sits in its own <strong>, hence the element-wise assertions.
    expect(screen.getByText('tests:', { exact: false })).toHaveTextContent(
      '1 tests: 0 passed, 1 failed, 0 skipped',
    );
    expect(screen.getByText('0 passed')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    // Shown even at zero, so the row does not change shape between jobs.
    expect(screen.getByText('0 skipped')).toBeInTheDocument();
  });

  test('reports an empty summary once loading is done', () => {
    renderWith({ summaryLoading: false, summary: buildTestSummary('') });

    expect(
      screen.getByText('No failures found in the summary.'),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Loading...')).toBeNull();
  });

  test('reports a failed load as a line in the list, like the classic tab', () => {
    renderWith({ summaryError: 'Failed to load summary (404)' });

    expect(
      screen.getByText('Failed to load summary (404)'),
    ).toBeInTheDocument();
    // The panel keeps its shape rather than being replaced by the message,
    // and does not claim the job has no failures when it could not read them.
    expect(screen.getByRole('region', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.queryByText('No failures found in the summary.')).toBeNull();
  });

  test('falls back to the classic failure summary, unfolded, when the load failed', () => {
    renderWith({
      summaryError: 'Failed to load summary (404)',
      bugSuggestions: prepareBugSuggestions([classicOnlySuggestion()]),
    });

    // The only content there is: no heading, nothing to fold.
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
    // Nothing diverged — there is no summary to differ from.
    expect(screen.queryByText(/differs from the summary above/)).toBeNull();
  });

  test('shows the classic summary, unfolded, for a job with no summary artifact', () => {
    // Plenty of tasks publish bug suggestions and no summary.jsonl at all —
    // there is no summary to diverge from, and the lines must still show.
    renderWith({
      summary: null,
      summaryError: null,
      bugSuggestions: prepareBugSuggestions([classicOnlySuggestion()]),
    });

    expect(
      screen.getByText('No summary artifact for this job.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
  });

  test('renders no classic section when the load failed and the API has nothing', () => {
    renderWith({
      summaryError: 'Failed to load summary (404)',
      bugSuggestions: [],
    });

    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
  });
});

describe('SummaryTab new failure lines in the classic section', () => {
  afterEach(cleanup);

  // Every case here needs a line the summary artifact does not have, for the
  // classic section to be stacked below; holding it, the section starts open.
  const divergingWith = (overrides) =>
    prepareBugSuggestions([
      matchingSuggestion(),
      { ...classicOnlySuggestion(), ...overrides },
    ]);

  test('flags the first new failure and counts them all', () => {
    renderSummaryTab(divergingWith({ failure_new_in_rev: true }));

    expect(
      screen.getByText(/1 new failure line\(s\)\. First one is flagged/),
    ).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  test('renders no banner when no line is new', () => {
    renderSummaryTab(divergingWith({}));

    expect(screen.queryByText(/new failure line/)).toBeNull();
    expect(screen.queryByText('NEW')).toBeNull();
  });

  test('counts a never-seen line on try only', () => {
    renderSummaryTab(divergingWith({ counter: 0 }));
    expect(screen.queryByText('NEW')).toBeNull();
    cleanup();

    renderSummaryTab(divergingWith({ counter: 0 }), summaryJsonl, {
      name: 'try',
    });
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  test('flags a line both summaries have in each of them', () => {
    renderSummaryTab(
      prepareBugSuggestions([
        { ...matchingSuggestion(), failure_new_in_rev: true },
      ]),
    );

    // The summary list flags it while the classic section is folded...
    expect(screen.getAllByText('NEW')).toHaveLength(1);

    // ...and the classic section flags its own copy once opened.
    toggleClassic();
    expect(screen.getAllByText('NEW')).toHaveLength(2);
    expect(screen.getAllByText(/1 new failure line\(s\)/)).toHaveLength(2);
  });
});

describe('SummaryTab new failure lines in the summary', () => {
  afterEach(cleanup);

  test('flags the first new failure without opening the classic section', () => {
    renderSummaryTab(
      prepareBugSuggestions([
        { ...matchingSuggestion(), failure_new_in_rev: true },
      ]),
    );

    expect(
      screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByText(/1 new failure line\(s\)\. First one is flagged/),
    ).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  test('leaves a line unflagged when only a classic line is new', () => {
    // The new line is another message of the same test: the backend said
    // nothing about the summary's own line.
    renderSummaryTab(
      prepareBugSuggestions([
        matchingSuggestion(),
        { ...classicOnlySuggestion(), failure_new_in_rev: true },
      ]),
    );

    // Fold the classic section, open since it holds a line the summary lacks,
    // to look at the summary's own flags.
    toggleClassic();
    expect(screen.queryByText(/new failure line/)).toBeNull();
    expect(screen.queryByText('NEW')).toBeNull();
  });

  test('counts a never-seen line on try only', () => {
    const neverSeen = () =>
      prepareBugSuggestions([{ ...matchingSuggestion(), counter: 0 }]);

    renderSummaryTab(neverSeen());
    expect(screen.queryByText('NEW')).toBeNull();
    cleanup();

    renderSummaryTab(neverSeen(), summaryJsonl, { name: 'try' });
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
});

describe('SummaryTab bug suggestions for its own lines', () => {
  afterEach(cleanup);

  // What /line_bug_suggestions/ returned for the artifact's line, when the
  // log was too big to parse and /bug_suggestions/ returned nothing.
  const lineBugSuggestions = (overrides = {}) =>
    new Map([
      [
        matchingSuggestion().search,
        {
          ...matchingSuggestion(),
          bugs: {
            open_recent: [
              {
                id: 1234,
                internal_id: 5,
                summary:
                  'Intermittent dom/tests/test_fail.html | assertion failed',
                resolution: '',
              },
            ],
            all_others: [],
          },
          line_number: null,
          counter: 3,
          failure_new_in_rev: false,
          ...overrides,
        },
      ],
    ]);

  test('lists the bugs found for a line the log parser never saw', () => {
    renderWith({
      summary: buildTestSummary(summaryJsonl),
      logParseStatus: 'skipped-size',
      jobLogUrls: [
        { id: 1, name: 'live_backing_log', parse_status: 'skipped-size' },
      ],
      lineBugSuggestions: lineBugSuggestions(),
    });

    expect(
      screen.getByText(
        'Log parsing was skipped since the log exceeds the size limit.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('bug-list-item')).toHaveTextContent('1234');
    expect(screen.queryByText('NEW')).toBeNull();
  });

  test('flags a never-seen line on try', () => {
    renderWith({
      summary: buildTestSummary(summaryJsonl),
      currentRepo: { name: 'try' },
      lineBugSuggestions: lineBugSuggestions({ counter: 0 }),
    });

    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
});

describe('SummaryTab classic section folding', () => {
  afterEach(cleanup);

  test('is folded by default when the summary holds every classic line', () => {
    renderSummaryTab(prepareBugSuggestions([matchingSuggestion()]));

    const toggle = screen.getByRole('button', {
      name: /Failure Summary \(classic\)/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveTextContent('not shown above');
    expect(
      document.getElementById('classic-failure-summary'),
    ).toBeEmptyDOMElement();
  });

  test('counts the classic lines the summary lacks in the heading', () => {
    renderSummaryTab(
      prepareBugSuggestions([
        matchingSuggestion(),
        classicOnlySuggestion(),
        {
          ...classicOnlySuggestion(),
          search:
            'TEST-UNEXPECTED-TIMEOUT | dom/tests/test_fail.html | Test timed out',
        },
      ]),
    );

    expect(
      screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).toHaveTextContent('2 lines not shown above');
  });

  test('has no heading to fold when the summary artifact found no failures', () => {
    // An artifact with a passing test only (`expected` is written for
    // unexpected results only): nothing for the summary to list, so the
    // classic summary is the only content and is shown as is.
    const passingJsonl = [
      '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_pass.html"}',
      '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_pass.html","status":"PASS"}',
    ].join('\n');

    renderSummaryTab(
      prepareBugSuggestions([classicOnlySuggestion()]),
      passingJsonl,
    );

    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
    // Nor a border or a divergence note: the two summaries do differ, but
    // there is nothing above for the lines to be set apart from.
    expect(screen.getByText(/application crashed/).closest('.border-top')).toBeNull();
    expect(screen.queryByText(/differs from the summary above/)).toBeNull();
  });

  test('drops the heading once the loaded artifact lists no failures', () => {
    const tab = props => (
      <MemoryRouter>
        <SummaryTab
          selectedJob={selectedJob}
          jobDetails={[]}
          pinJob={() => {}}
          currentRepo={currentRepo}
          bugSuggestions={prepareBugSuggestions([classicOnlySuggestion()])}
          {...props}
        />
      </MemoryRouter>
    );

    // Folded under its heading while the artifact is still loading...
    const { rerender } = render(tab({ summaryLoading: true }));
    expect(
      screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).toHaveAttribute('aria-expanded', 'false');

    // ...then the only content there is.
    rerender(tab({ summary: buildTestSummary('') }));
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
  });

  test('renders no classic section before the bug suggestions arrive', () => {
    renderWith({
      summary: buildTestSummary(summaryJsonl),
      bugSuggestions: undefined,
    });

    expect(screen.getByText(/assertion failed/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).not.toBeInTheDocument();
  });

  test('folds and unfolds on click', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    // Open at first: the classic line is one the summary lacks.
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();

    toggleClassic();
    expect(screen.queryByText(/application crashed/)).toBeNull();

    toggleClassic();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
  });
});

// Behaviour the Summary tab took over when the separate Failure Summary tab
// was removed.
describe('SummaryTab log parsing states', () => {
  afterEach(cleanup);

  const completedJob = { ...selectedJob, state: 'completed', result: 'busted' };

  test('says parsing is in progress and links the raw log', () => {
    renderWith({
      jobLogUrls: [
        {
          id: 7,
          name: 'live_backing_log',
          parse_status: 'pending',
          url: 'https://example.com/live_backing.log',
        },
      ],
    });

    expect(screen.getByText(/Log parsing in progress/)).toBeInTheDocument();
    expect(screen.getByText('The raw log')).toHaveAttribute(
      'href',
      'https://example.com/live_backing.log',
    );
  });

  test('reports a failed parse', () => {
    renderWith({
      logParseStatus: 'failed',
      jobLogUrls: [
        { id: 7, name: 'live_backing_log', parse_status: 'failed', url: 'u' },
      ],
    });

    expect(
      screen.getByText(/Log parsing failed\./),
    ).toBeInTheDocument();
  });

  test('reports a parse skipped for size', () => {
    renderWith({
      logParseStatus: 'skipped-size',
      jobLogUrls: [
        {
          id: 7,
          name: 'live_backing_log',
          parse_status: 'skipped-size',
          url: 'u',
        },
      ],
    });

    expect(
      screen.getByText(/exceeds the size limit/),
    ).toBeInTheDocument();
  });

  test('names the job state when it has no logs yet', () => {
    renderWith({ selectedJob: completedJob, jobLogUrls: [] });

    expect(
      screen.getByText('No logs yet available for this busted job.'),
    ).toBeInTheDocument();
  });

  test('says nothing once the log is parsed', () => {
    renderWith({
      logParseStatus: 'parsed',
      jobLogUrls: [
        { id: 7, name: 'live_backing_log', parse_status: 'parsed', url: 'u' },
      ],
    });

    expect(screen.queryByText(/Log parsing/)).toBeNull();
    expect(screen.queryByText(/No logs yet available/)).toBeNull();
  });
});

describe('SummaryTab internal issue escalation', () => {
  beforeEach(() => {
    // Escalating opens the bug filer, which looks up a Bugzilla component.
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ product: 'Core', component: 'DOM' }]),
    });
  });

  afterEach(() => {
    cleanup();
    delete window.fetch;
  });

  // An internal bug one occurrence short of the threshold: classifying it
  // once more should escalate it to a real Bugzilla bug.
  const internalBugSuggestions = (occurrences) => [
    {
      search: 'TEST-UNEXPECTED-FAIL | dom/tests/test_fail.html | boom',
      path_end: 'dom/tests/test_fail.html',
      // The bug filer opens on escalation and reads these.
      search_terms: ['test_fail.html', 'boom'],
      bugs: {
        open_recent: [{ id: null, internal_id: 42, occurrences }],
        all_others: [],
      },
    },
  ];

  test('files a bug once the internal issue reached its occurrences', () => {
    const pinJob = jest.fn();
    renderWith({
      pinJob,
      bugSuggestions: internalBugSuggestions(requiredInternalOccurrences - 1),
    });

    fireEvent(
      window,
      new CustomEvent(thEvents.internalIssueClassification, {
        detail: { internalBugId: 42 },
      }),
    );

    // fileBug pins the job before opening the filer.
    expect(pinJob).toHaveBeenCalledWith(selectedJob);
  });

  test('does nothing for an internal issue seen too few times', () => {
    const pinJob = jest.fn();
    renderWith({ pinJob, bugSuggestions: internalBugSuggestions(0) });

    fireEvent(
      window,
      new CustomEvent(thEvents.internalIssueClassification, {
        detail: { internalBugId: 42 },
      }),
    );

    expect(pinJob).not.toHaveBeenCalled();
  });

  test('drops its listener on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const addSpy = jest.spyOn(window, 'addEventListener');

    const { unmount } = renderWith({});
    const eventType = thEvents.internalIssueClassification;
    const added = addSpy.mock.calls.find(([type]) => type === eventType)[1];

    unmount();

    const removed = removeSpy.mock.calls.find(([type]) => type === eventType);
    expect(removed).toBeDefined();
    expect(removed[1]).toBe(added);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('SummaryTab filing from the classic section', () => {
  beforeEach(() => {
    // The bug filer looks up a Bugzilla component when it opens.
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ product: 'Core', component: 'DOM' }]),
    });
  });

  afterEach(() => {
    cleanup();
    delete window.fetch;
  });

  // A classic line with an internal issue one occurrence short of becoming a
  // Bugzilla bug. With no summary artifact, the classic section is all there is.
  const classicSuggestions = () => [
    {
      search: 'TEST-UNEXPECTED-FAIL | dom/tests/test_fail.html | boom',
      path_end: 'dom/tests/test_fail.html',
      search_terms: ['test_fail.html', 'boom'],
      bugs: {
        open_recent: [
          {
            id: null,
            internal_id: 42,
            occurrences: requiredInternalOccurrences - 1,
          },
        ],
        all_others: [],
      },
    },
  ];

  // Lets the bug filer that just opened finish its component lookup.
  const settleBugFiler = async () => {
    await waitFor(() => expect(window.fetch).toHaveBeenCalled());
    await act(async () => {});
  };

  test('pins the job when filing a bug for a classic line', async () => {
    const pinJob = jest.fn();
    renderWith({ pinJob, bugSuggestions: classicSuggestions() });

    fireEvent.click(screen.getByTitle('File a bug for this failure'));

    expect(pinJob).toHaveBeenCalledWith(selectedJob);
    await settleBugFiler();
  });

  test('classifies with the internal issue filed for a classic line, escalating it when due', async () => {
    const pinJob = jest.fn();
    const addBug = jest.fn().mockResolvedValue();
    const onSaveClassification = jest.fn();
    window.addEventListener(thEvents.saveClassification, onSaveClassification);
    renderWith({ pinJob, addBug, bugSuggestions: classicSuggestions() });

    fireEvent.click(
      screen.getByTitle('File an internal issue for this failure'),
    );
    expect(pinJob).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Submit internal issue' }),
    );

    // The new occurrence reaches the threshold: the bug filer opens, which
    // pins the job a second time.
    await waitFor(() => expect(pinJob).toHaveBeenCalledTimes(2));
    expect(addBug).toHaveBeenCalledWith({ internal_id: 42, newBug: 'i42' });
    expect(onSaveClassification).toHaveBeenCalledTimes(1);
    await settleBugFiler();

    window.removeEventListener(
      thEvents.saveClassification,
      onSaveClassification,
    );
  });
});
