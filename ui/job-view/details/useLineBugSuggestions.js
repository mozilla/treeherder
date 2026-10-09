import { useState, useEffect, useMemo } from 'react';

import {
  buildFailureSuggestions,
  linesWithoutClassicMatch,
} from '../../helpers/testSummary';
import BugSuggestionsModel from '../../models/bugSuggestions';

// Results by job and lines, as a Map from line text to its suggestion. Only
// completed jobs go in: their summary and parsed log no longer change. Bounded
// like the summary cache in useJobSummary, oldest entry evicted first.
const resultsCache = new Map();
const MAX_RESULTS_CACHE_ENTRIES = 20;

const cacheSet = (key, results) => {
  resultsCache.delete(key);
  resultsCache.set(key, results);
  while (resultsCache.size > MAX_RESULTS_CACHE_ENTRIES) {
    resultsCache.delete(resultsCache.keys().next().value);
  }
};

/** Test-only: drop everything the cache holds. */
export const clearLineBugSuggestionsCache = () => resultsCache.clear();

/**
 * Bug suggestions for the summary's failure lines the classic
 * `/bug_suggestions/` list holds no line for, typically every line of a job
 * whose log was too big to parse. Asked once the classic list is loaded, and
 * only when such lines exist.
 *
 * @param {?Object} selectedJob
 * @param {?Object} summary `buildTestSummary()` result
 * @param {?Array} bugSuggestions the classic list, `null` until loaded
 * @param {boolean} bugSuggestionsLoading
 * @returns {?Map<string, Object>} suggestion by line text, or null
 */
export default function useLineBugSuggestions(
  selectedJob,
  summary,
  bugSuggestions,
  bugSuggestionsLoading,
) {
  const jobId = selectedJob?.id ?? null;
  const isFinal = selectedJob?.state === 'completed';
  const ready =
    jobId !== null && !!summary && !!bugSuggestions && !bugSuggestionsLoading;
  const lines = useMemo(
    () =>
      ready
        ? linesWithoutClassicMatch(
            buildFailureSuggestions(summary),
            bugSuggestions,
          )
        : [],
    [ready, summary, bugSuggestions],
  );
  const key = lines.length ? `${jobId}:${JSON.stringify(lines)}` : null;
  const [state, setState] = useState({ key: null, results: null });

  useEffect(() => {
    if (!key || (isFinal && resultsCache.has(key))) return undefined;

    const controller = new AbortController();
    BugSuggestionsModel.getForLines(jobId, lines, controller.signal)
      .then(({ data, failureStatus }) => {
        const results =
          !failureStatus && Array.isArray(data)
            ? new Map(
                lines
                  .map((line, index) => [line, data[index]])
                  .filter(([, result]) => result),
              )
            : null;
        if (results && isFinal) cacheSet(key, results);
        setState({ key, results });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ key, results: null });
      });

    return () => controller.abort();
  }, [key, isFinal]);

  if (!key) return null;
  if (isFinal && resultsCache.has(key)) return resultsCache.get(key);
  return state.key === key ? state.results : null;
}
