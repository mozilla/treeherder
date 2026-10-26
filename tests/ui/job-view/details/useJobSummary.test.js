import { renderHook, waitFor } from '@testing-library/react';

import useJobSummary, {
  getSummaryArtifactUrl,
  clearSummaryCache,
} from '../../../../ui/job-view/details/useJobSummary';

const summaryJsonl = [
  '{"action":"test_start","time":0,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html"}',
  '{"action":"test_end","time":10,"group":"dom/manifest.ini","test":"dom/tests/test_fail.html","status":"FAIL","expected":"PASS","message":"assertion failed"}',
].join('\n');

const artifactUrl = 'https://tc.example.com/task/TASK_A/runs/0/summary.jsonl';

const detailsFor = (url = artifactUrl) => [
  { value: 'live_backing.log', url: 'https://tc.example.com/log' },
  { value: 'summary.jsonl', url },
];

const makeJob = (overrides = {}) => ({ id: 1, state: 'completed', ...overrides });

const mockFetch = (text = summaryJsonl) => {
  window.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(text),
  });
  return window.fetch;
};

const renderJobSummary = (initialProps) =>
  renderHook((props) => useJobSummary(props.job, props.jobDetails), {
    initialProps,
  });

describe('getSummaryArtifactUrl', () => {
  it('finds summary.jsonl', () => {
    expect(getSummaryArtifactUrl(detailsFor())).toBe(artifactUrl);
  });

  it('falls back to a *_testsummary.jsonl artifact', () => {
    const details = [
      { value: 'live_backing.log', url: 'https://tc.example.com/log' },
      { value: 'mochitest_testsummary.jsonl', url: artifactUrl },
    ];

    expect(getSummaryArtifactUrl(details)).toBe(artifactUrl);
  });

  it('returns null when the task published neither', () => {
    expect(getSummaryArtifactUrl([{ value: 'live_backing.log' }])).toBeNull();
    expect(getSummaryArtifactUrl()).toBeNull();
  });
});

describe('useJobSummary', () => {
  beforeEach(() => {
    clearSummaryCache();
    mockFetch();
  });

  afterEach(() => {
    delete window.fetch;
  });

  it('fetches and parses the artifact once', async () => {
    const { result } = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });

    expect(result.current.summaryLoading).toBe(true);
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(result.current.summary.counts.FAIL).toBe(1);
    expect(result.current.summaryError).toBeNull();
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it('serves a remounted completed job from the cache, with no loading state', async () => {
    const { result, unmount } = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    unmount();

    const second = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });

    // Cached entries are read during render, so there is no loading frame.
    expect(second.result.current.summaryLoading).toBe(false);
    expect(second.result.current.summary).not.toBeNull();
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it('never caches a running job, whose artifact is still growing', async () => {
    const running = makeJob({ state: 'running' });
    const { result, unmount } = renderJobSummary({
      job: running,
      jobDetails: detailsFor(),
    });
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    unmount();

    const second = renderJobSummary({
      job: running,
      jobDetails: detailsFor(),
    });
    await waitFor(() => expect(second.result.current.summary).not.toBeNull());

    expect(window.fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches once when the job completes', async () => {
    const { result, rerender } = renderJobSummary({
      job: makeJob({ state: 'running' }),
      jobDetails: detailsFor(),
    });
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(window.fetch).toHaveBeenCalledTimes(1);

    rerender({ job: makeJob({ state: 'completed' }), jobDetails: detailsFor() });

    await waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(2));
    // And the completed result is now cached: no third request.
    rerender({ job: makeJob({ state: 'completed' }), jobDetails: detailsFor() });
    expect(window.fetch).toHaveBeenCalledTimes(2);
  });

  it('misses the cache for another run of the same job', async () => {
    const { result, rerender } = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });
    await waitFor(() => expect(result.current.summary).not.toBeNull());

    const retryUrl = 'https://tc.example.com/task/TASK_A/runs/1/summary.jsonl';
    rerender({ job: makeJob(), jobDetails: detailsFor(retryUrl) });

    await waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(2));
    expect(window.fetch).toHaveBeenLastCalledWith(
      retryUrl,
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('loads nothing when no job is selected', () => {
    const { result } = renderJobSummary({
      job: null,
      jobDetails: detailsFor(),
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.summaryLoading).toBe(false);
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('reports a failed response and remembers a 404 for a completed job', async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const { result, unmount } = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });
    await waitFor(() =>
      expect(result.current.summaryError).toBe('Failed to load summary (404)'),
    );
    unmount();

    const second = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });

    expect(second.result.current.summaryError).toBe(
      'Failed to load summary (404)',
    );
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries after a server error rather than caching it', async () => {
    window.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    const { result, unmount } = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });
    await waitFor(() =>
      expect(result.current.summaryError).toBe('Failed to load summary (503)'),
    );
    unmount();

    mockFetch();
    const second = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });
    await waitFor(() => expect(second.result.current.summary).not.toBeNull());
  });

  it('aborts the request when the job is switched mid-flight', async () => {
    let abortSignal;
    window.fetch = jest.fn((url, { signal }) => {
      abortSignal = signal;
      return new Promise(() => {});
    });

    const { rerender } = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(),
    });
    expect(abortSignal.aborted).toBe(false);

    rerender({ job: makeJob({ id: 2 }), jobDetails: [] });

    expect(abortSignal.aborted).toBe(true);
  });

  it('evicts the least recently used entry past the cap', async () => {
    const urlFor = (i) => `https://tc.example.com/task/T${i}/runs/0/summary.jsonl`;

    // 21 distinct artifacts: the first one is evicted by the last.
    for (let i = 0; i <= 20; i++) {
      const { result, unmount } = renderJobSummary({
        job: makeJob(),
        jobDetails: detailsFor(urlFor(i)),
      });
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(result.current.summary).not.toBeNull());
      unmount();
    }
    expect(window.fetch).toHaveBeenCalledTimes(21);

    const evicted = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(urlFor(0)),
    });
    await waitFor(() => expect(evicted.result.current.summary).not.toBeNull());
    expect(window.fetch).toHaveBeenCalledTimes(22);

    const kept = renderJobSummary({
      job: makeJob(),
      jobDetails: detailsFor(urlFor(20)),
    });
    expect(kept.result.current.summary).not.toBeNull();
    expect(window.fetch).toHaveBeenCalledTimes(22);
  });
});
