import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import SummaryTab from '../../../../../ui/job-view/details/tabs/summaryTab/SummaryTab';
import { prepareBugSuggestions } from '../../../../../ui/helpers/testSummary';

const selectedJob = {
  id: 1,
  platform: 'linux',
  job_group_name: 'Mochitest',
  job_type_name: 'test-linux1804-64/opt-mochitest-1',
  job_type_symbol: 'M-1',
};
const currentRepo = { name: 'autoland' };

const artifactUrl = 'https://example.com/summary.jsonl';

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

const renderSummaryTab = (bugSuggestions) =>
  render(
    <MemoryRouter>
      <SummaryTab
        artifactUrl={artifactUrl}
        selectedJob={selectedJob}
        jobLogUrls={[]}
        jobDetails={[]}
        addBug={() => {}}
        pinJob={() => {}}
        currentRepo={currentRepo}
        bugSuggestions={bugSuggestions}
        bugSuggestionsLoading={false}
      />
    </MemoryRouter>,
  );

describe('SummaryTab divergence with the classic failure summary', () => {
  beforeEach(() => {
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(summaryJsonl),
    });
  });

  afterEach(() => {
    cleanup();
    delete window.fetch;
  });

  test('stacks the classic failure summary below when the two diverge', async () => {
    renderSummaryTab(
      prepareBugSuggestions([matchingSuggestion(), classicOnlySuggestion()]),
    );

    expect(
      await screen.findByText('Failure Summary (classic)'),
    ).toBeInTheDocument();
    // The classic-only line is rendered in the stacked section.
    expect(screen.getByText(/application crashed/)).toBeInTheDocument();
  });

  test('renders no classic section when both summaries agree', async () => {
    renderSummaryTab(prepareBugSuggestions([matchingSuggestion()]));

    // Wait for the summary artifact to render before asserting absence.
    expect(await screen.findByText(/1 failed/)).toBeInTheDocument();
    expect(screen.queryByText('Failure Summary (classic)')).toBeNull();
  });
});
