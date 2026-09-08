import { render, screen, cleanup } from '@testing-library/react';
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

describe('SummaryTab divergence with the classic failure summary', () => {
  afterEach(cleanup);

  test('stacks the classic failure summary below when the two diverge', () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    expect(screen.getByText('Failure Summary (classic)')).toBeInTheDocument();
    // The classic-only line is rendered in the stacked section.
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

    expect(screen.getByText('Failure Summary (classic)')).toBeInTheDocument();
    expect(
      screen.getByText(/1 new failure line\(s\)\. First one is flagged/),
    ).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  test('renders no banner when no line is new', () => {
    renderSummaryTab(divergingWith({}));

    expect(screen.getByText('Failure Summary (classic)')).toBeInTheDocument();
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
