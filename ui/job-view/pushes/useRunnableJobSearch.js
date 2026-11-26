import { useEffect, useMemo, useRef, useState } from 'react';

import { sortAlphaNum } from '../../helpers/sort';

export default function useRunnableJobSearch(jobs, query, isOpen) {
  const search = useRef(null);
  const [result, setResult] = useState(null);
  const [failedJobs, setFailedJobs] = useState(null);

  useEffect(() => {
    setResult(null);
    setFailedJobs(null);
    if (!isOpen) return;

    let worker;
    try {
      worker = new Worker(
        new URL('./runnableJobSearch.worker.js', import.meta.url),
      );
    } catch {
      setFailedJobs(jobs);
      return;
    }
    let latestQuery = '';
    let inFlight = false;

    function sendLatestQuery() {
      if (!latestQuery.trim()) return;
      inFlight = true;
      worker.postMessage(latestQuery);
    }

    // Keep just one search in flight so intermediate keystrokes cannot build
    // up a queue of obsolete searches while the worker is busy.
    search.current = (nextQuery) => {
      latestQuery = nextQuery;
      if (!inFlight) sendLatestQuery();
    };
    worker.onmessage = ({ data }) => {
      inFlight = false;
      if (data.query === latestQuery) {
        setResult({ jobs, ...data });
      } else {
        sendLatestQuery();
      }
    };
    worker.onerror = () => setFailedJobs(jobs);
    worker.postMessage(
      jobs.map(({ name, symbol, groupsymbol, symbolAliases }) => ({
        name,
        symbol,
        groupsymbol,
        symbolAliases,
      })),
    );

    return () => {
      search.current = null;
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };
  }, [jobs, isOpen]);

  useEffect(() => {
    search.current?.(query);
  }, [jobs, query, isOpen]);

  const browseList = useMemo(() => [...jobs].sort(sortAlphaNum), [jobs]);
  const currentResult = result?.jobs === jobs ? result : null;
  const isSearching = Boolean(query.trim());
  const matches = useMemo(
    () =>
      isSearching && currentResult
        ? Array.from(currentResult.indices, (index) => jobs[index])
        : browseList,
    [browseList, currentResult, isSearching, jobs],
  );

  return {
    matches,
    pending: isSearching && currentResult?.query !== query,
    failed: isSearching && failedJobs === jobs,
  };
}
