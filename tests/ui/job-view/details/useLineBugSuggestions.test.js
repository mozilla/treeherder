import { act, renderHook, waitFor } from '@testing-library/react';

import { buildTestSummary } from '../../../../ui/helpers/testSummary';
import useLineBugSuggestions, {
  clearLineBugSuggestionsCache,
} from '../../../../ui/job-view/details/useLineBugSuggestions';

const failLine = 'TEST-UNEXPECTED-FAIL | dom/tests/test_fail.html | boom';
const summary = buildTestSummary(
  [
    {
      action: 'test_start',
      time: 0,
      group: 'g',
      test: 'dom/tests/test_fail.html',
    },
    {
      action: 'test_end',
      time: 10,
      group: 'g',
      test: 'dom/tests/test_fail.html',
      status: 'FAIL',
      expected: 'PASS',
      message: 'boom',
    },
  ]
    .map((record) => JSON.stringify(record))
    .join('\n'),
);

const lineResult = {
  search: failLine,
  search_terms: ['test_fail.html'],
  path_end: 'dom/tests/test_fail.html',
  bugs: { open_recent: [{ id: 1, internal_id: 1 }], all_others: [] },
  line_number: null,
  counter: 0,
  failure_new_in_rev: false,
};

const makeJob = (overrides = {}) => ({
  id: 1,
  state: 'completed',
  ...overrides,
});

const mockFetch = (body = [lineResult], status = 200) => {
  window.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    statusText: 'Error',
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  });
  return window.fetch;
};

const renderLineBugSuggestions = (initialProps) =>
  renderHook(
    (props) =>
      useLineBugSuggestions(
        props.job,
        props.summary,
        props.bugSuggestions,
        props.bugSuggestionsLoading,
      ),
    {
      initialProps: { summary, bugSuggestionsLoading: false, ...initialProps },
    },
  );

describe('useLineBugSuggestions', () => {
  beforeEach(() => {
    clearLineBugSuggestionsCache();
    mockFetch();
  });

  afterEach(() => {
    delete window.fetch;
  });

  it('asks for the lines the empty classic list lacks, by POST', async () => {
    const { result } = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: [],
    });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current.get(failLine)).toEqual(lineResult);
    expect(window.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = window.fetch.mock.calls[0];
    expect(url).toMatch(/\/jobs\/1\/line_bug_suggestions\/$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ lines: [failLine] });
    expect(options.signal).toBeDefined();
  });

  it('asks nothing when the classic list holds every line', () => {
    const { result } = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: [{ search: failLine }],
    });

    expect(result.current).toBeNull();
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('waits for the classic list to load', () => {
    const { rerender } = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: null,
    });
    rerender({
      job: makeJob(),
      summary,
      bugSuggestions: [],
      bugSuggestionsLoading: true,
    });

    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('serves a reselected completed job from the cache', async () => {
    const { result, unmount } = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: [],
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    unmount();

    const second = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: [],
    });

    expect(second.result.current.get(failLine)).toEqual(lineResult);
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it('never caches a running job', async () => {
    const running = makeJob({ state: 'running' });
    const { result, unmount } = renderLineBugSuggestions({
      job: running,
      bugSuggestions: [],
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    unmount();

    const second = renderLineBugSuggestions({
      job: running,
      bugSuggestions: [],
    });
    await waitFor(() => expect(second.result.current).not.toBeNull());

    expect(window.fetch).toHaveBeenCalledTimes(2);
  });

  it("drops the previous job's request when another job is selected", async () => {
    const { result, rerender } = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: [],
    });
    const { signal } = window.fetch.mock.calls[0][1];

    rerender({ job: makeJob({ id: 2 }), summary, bugSuggestions: [] });

    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(window.fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/jobs\/2\/line_bug_suggestions\/$/),
      expect.anything(),
    );
  });

  it('gives nothing when the request fails', async () => {
    mockFetch({ detail: 'boom' }, 500);
    const { result } = renderLineBugSuggestions({
      job: makeJob(),
      bugSuggestions: [],
    });

    await waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      await window.fetch.mock.results[0].value;
    });

    expect(result.current).toBeNull();
  });
});
