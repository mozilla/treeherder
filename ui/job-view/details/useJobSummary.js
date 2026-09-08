import { useState, useEffect, useMemo } from 'react';

import { buildTestSummary } from '../../helpers/testSummary';

// Parsed summaries, keyed by artifact URL. The URL encodes task id, run and
// artifact path (see getArtifactsUrl), so a retrigger or a retry never reads
// the previous run's entry.
//
// Only artifacts of `completed` jobs go in: a running task is still appending
// to its summary.jsonl, and a completed task's artifacts are immutable until
// they expire. The tab that consumes this is unmounted whenever the user
// switches tabs (react-tabs renders nothing for unselected panels) or
// reselects a job, which is why the cache lives at module scope rather than
// in component state.
const summaryCache = new Map();

// Parsed summaries are not small (nested maps of every test and its results),
// so the cache is bounded rather than growing for the length of a triage
// session. Map iterates in insertion order, which is all an LRU needs.
const MAX_SUMMARY_CACHE_ENTRIES = 20;

const EMPTY_STATE = { url: null, status: 'idle', summary: null, error: null };

const cacheGet = (url) => {
  const entry = summaryCache.get(url);
  if (entry) {
    // Re-insert so the least recently used entry is evicted first.
    summaryCache.delete(url);
    summaryCache.set(url, entry);
  }
  return entry;
};

const cacheSet = (url, entry) => {
  summaryCache.delete(url);
  summaryCache.set(url, entry);
  while (summaryCache.size > MAX_SUMMARY_CACHE_ENTRIES) {
    summaryCache.delete(summaryCache.keys().next().value);
  }
};

/** Test-only: drop everything the cache holds. */
export const clearSummaryCache = () => summaryCache.clear();

/**
 * URL of the summary.jsonl artifact when the task published one, or null.
 *
 * @param {Array<{ value: string, url: string }>} jobDetails formatted artifacts
 * @returns {?string}
 */
export const getSummaryArtifactUrl = (jobDetails = []) =>
  jobDetails.find((detail) => detail.value === 'summary.jsonl')?.url ||
  jobDetails.find((detail) => detail.value?.endsWith('_testsummary.jsonl'))
    ?.url ||
  null;

/**
 * Load and parse the summary.jsonl artifact of the selected job.
 *
 * Lives in the details panel (rather than in the Summary tab) so the artifact
 * is downloaded and parsed once per job instead of once per tab switch.
 *
 * @param {?Object} selectedJob
 * @param {Array} jobDetails formatted artifacts of that job
 * @returns {{ summary: ?Object, summaryLoading: boolean, summaryError: ?string }}
 */
export default function useJobSummary(selectedJob, jobDetails) {
  // The artifact list outlives a deselection, so nothing is loaded without a
  // job to attribute it to (and the artifact of the job just deselected is
  // not refetched as if it were still running).
  const hasJob = Boolean(selectedJob);
  const url = useMemo(() => getSummaryArtifactUrl(jobDetails), [jobDetails]);
  const artifactUrl = hasJob ? url : null;
  // Only a finished job's artifact is worth keeping: a running one grows.
  const isFinal = selectedJob?.state === 'completed';
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    if (!artifactUrl) {
      setState(EMPTY_STATE);
      return undefined;
    }
    if (isFinal && cacheGet(artifactUrl)) {
      // Served from the cache during render below; nothing to fetch.
      return undefined;
    }

    const controller = new AbortController();
    setState({
      url: artifactUrl,
      status: 'loading',
      summary: null,
      error: null,
    });

    fetch(artifactUrl, { signal: controller.signal })
      .then((resp) => {
        if (!resp.ok) {
          const error = new Error(`Failed to load summary (${resp.status})`);
          // An expired or absent artifact stays absent, so remember it and
          // stop asking. A server or network error may well be transient.
          error.permanent = resp.status >= 400 && resp.status < 500;
          throw error;
        }
        return resp.text();
      })
      .then((text) => {
        const summary = buildTestSummary(text);
        if (isFinal) cacheSet(artifactUrl, { summary, error: null });
        setState({ url: artifactUrl, status: 'done', summary, error: null });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (isFinal && error.permanent) {
          cacheSet(artifactUrl, { summary: null, error: error.message });
        }
        setState({
          url: artifactUrl,
          status: 'error',
          summary: null,
          error: error.message,
        });
      });

    return () => controller.abort();
  }, [artifactUrl, isFinal]);

  // Derived during render, not in an effect: a cache hit then paints in the
  // same commit (no loading flash), and state left over from the previously
  // selected job is never rendered under this job's artifact.
  const cached = artifactUrl && isFinal ? summaryCache.get(artifactUrl) : null;
  const current = state.url === artifactUrl ? state : EMPTY_STATE;

  if (cached) {
    return {
      summary: cached.summary,
      summaryLoading: false,
      summaryError: cached.error,
    };
  }

  return {
    summary: current.summary,
    // 'idle' covers the render between the artifact URL arriving and the
    // effect starting the request.
    summaryLoading:
      Boolean(artifactUrl) &&
      (current.status === 'idle' || current.status === 'loading'),
    summaryError: current.error,
  };
}
