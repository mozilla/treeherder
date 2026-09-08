import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SummaryTab from '../../../../../ui/job-view/details/tabs/summaryTab/SummaryTab';
import {
  buildTestSummary,
  prepareBugSuggestions,
} from '../../../../../ui/helpers/testSummary';

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

// The classic section is folded by default; open it to read its content.
const expandClassic = () =>
  fireEvent.click(
    screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
  );

describe('SummaryTab divergence with the classic failure summary', () => {
  afterEach(cleanup);

  test('stacks the classic failure summary below when the two diverge', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    expect(screen.getByText('Failure Summary (classic)')).toBeInTheDocument();
    // Folded by default: the summary above already lists the failures.
    expect(screen.queryByText(/application crashed/)).toBeNull();

    expandClassic();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
  });

  test('renders no classic section when both summaries agree', () => {
    renderSummaryTab(prepareBugSuggestions([matchingSuggestion()]));

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
  });
});

describe('SummaryTab log viewer links', () => {
  const anchorMessage = 'ConsoleLogger online at 20260904 in /builds/worker';
  const anchoredJsonl = [
    `{"action":"console_anchor","line":1,"message":"${anchorMessage}"}`,
    '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html","line":40}',
    '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html","status":"FAIL","expected":"PASS","message":"assertion failed","line":42}',
  ].join('\n');

  afterEach(cleanup);

  test('links a failure line to its console line in the log viewer', () => {
    renderSummaryTab([], anchoredJsonl);

    const link = screen
      .getByTitle('Go to this line in the log viewer')
      .closest('a');
    const url = new URL(link.getAttribute('href'), 'https://treeherder.test');

    expect(url.pathname).toBe('/logviewer');
    expect(url.searchParams.get('job_id')).toBe('1');
    expect(url.searchParams.get('repo')).toBe('autoland');
    expect(url.searchParams.get('consoleLine')).toBe('42');
    expect(url.searchParams.get('consoleAnchorLine')).toBe('1');
    expect(url.searchParams.get('consoleAnchor')).toBe(anchorMessage);
    expect(url.searchParams.get('lineNumber')).toBeNull();
  });

  test('renders no log viewer link when the artifact has no anchor', () => {
    renderSummaryTab([]);

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(screen.queryByTitle('Go to this line in the log viewer')).toBeNull();
  });
});

describe('SummaryTab loading and error states', () => {
  afterEach(cleanup);

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

  test('overlays a spinner while the panel is loading the artifact', () => {
    renderWith({ summaryLoading: true });

    expect(screen.getByTitle('Loading...')).toBeInTheDocument();
    // The list keeps its shape rather than being replaced, and does not claim
    // the job has no failures before the artifact has been read.
    expect(screen.queryByText('No failures found in the summary.')).toBeNull();
  });

  test('reports an empty summary once loading is done', () => {
    renderWith({ summaryLoading: false, summary: buildTestSummary('') });

    expect(
      screen.getByText('No failures found in the summary.'),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Loading...')).toBeNull();
  });

  test('renders the error the panel reported', () => {
    renderWith({ summaryError: 'Failed to load summary (404)' });

    expect(
      screen.getByText('Failed to load summary (404)'),
    ).toBeInTheDocument();
  });
});

describe('SummaryTab new failure lines in the classic section', () => {
  afterEach(cleanup);

  // The classic section is only stacked below when the two summaries diverge,
  // so every case here needs a line the summary artifact does not have.
  const divergingWith = (overrides) =>
    prepareBugSuggestions([
      matchingSuggestion(),
      { ...classicOnlySuggestion(), ...overrides },
    ]);

  test('flags the first new failure and counts them all', () => {
    renderSummaryTab(divergingWith({ failure_new_in_rev: true }));

    expandClassic();

    expect(
      screen.getByText(/1 new failure line\(s\)\. First one is flagged/),
    ).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  test('renders no banner when no line is new', () => {
    renderSummaryTab(divergingWith({}));
    expandClassic();

    expect(screen.queryByText(/new failure line/)).toBeNull();
    expect(screen.queryByText('NEW')).toBeNull();
  });

  test('counts a never-seen line on try only', () => {
    renderSummaryTab(divergingWith({ counter: 0 }));
    expandClassic();
    expect(screen.queryByText('NEW')).toBeNull();
    cleanup();

    renderSummaryTab(divergingWith({ counter: 0 }), summaryJsonl, {
      name: 'try',
    });
    expandClassic();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  test('leaves the summary lines themselves unflagged', () => {
    renderSummaryTab(
      prepareBugSuggestions([
        { ...matchingSuggestion(), failure_new_in_rev: true },
      ]),
    );

    // The two summaries agree, so there is no classic section and nothing to
    // flag: the NEW button belongs to the classic list only.
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
    expect(screen.queryByText('NEW')).toBeNull();
  });
});

describe('SummaryTab classic section folding', () => {
  afterEach(cleanup);

  test('is folded by default when the summary lists failures', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    const toggle = screen.getByRole('button', {
      name: /Failure Summary \(classic\)/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/application crashed/)).toBeNull();
  });

  test('starts open when the summary artifact found no failures', () => {
    // An artifact with a passing test only (`expected` is written for
    // unexpected results only): nothing for the summary to list, so the
    // classic summary is the only content and opens on its own.
    const passingJsonl = [
      '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_pass.html"}',
      '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_pass.html","status":"PASS"}',
    ].join('\n');

    renderSummaryTab(
      prepareBugSuggestions([classicOnlySuggestion()]),
      passingJsonl,
    );

    expect(
      screen.getByRole('button', { name: /Failure Summary \(classic\)/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
  });

  test('folds and unfolds on click', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    expandClassic();
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();

    expandClassic();
    expect(screen.queryByText(/application crashed/)).toBeNull();
  });
});
