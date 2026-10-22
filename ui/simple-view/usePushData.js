import { useCallback, useEffect, useState } from 'react';

import { cachedJobs, cachedPush, cachedSummary, rememberPush } from './cache';
import { POLL_MS, PUSH } from './constants';
import { estimatePush, loadDurationTable } from './eta';
import { describeEta, fetchPush, progressOf, statusFromJobs } from './helpers';
import { usePoll } from './hooks';
import { loadPushJobs } from './jobs';

const usePushData = (repo, revision) => {
  const [push, setPush] = useState(() => cachedPush(repo, revision));
  // The list already knows this push's counts, so the ring can draw before the
  // job list arrives.
  const summary = cachedSummary(repo, revision);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPush(repo, revision).then(
      ({ data, failureStatus }) => {
        if (failureStatus || !data.results?.length) {
          setError(PUSH.noPush);
        } else {
          setError(null);
          setPush(data.results[0]);
          rememberPush(repo, data.results[0]);
        }
      },
      () => setError(PUSH.loadError),
    );
  }, [repo, revision]);

  // The push's own job list: the counts, the failures and the ETA's input.
  // Usually already loaded by the list's row.
  const pushId = push?.id;
  const [jobs, setJobs] = useState(null);
  const loadJobs = useCallback(async () => {
    if (!pushId) return;
    const list = await loadPushJobs(repo, pushId, revision);
    if (list) setJobs(list);
  }, [repo, pushId, revision]);

  useEffect(() => {
    setJobs(pushId ? cachedJobs(repo, pushId) : null);
    loadJobs();
  }, [loadJobs, repo, pushId]);

  const counts = jobs ? statusFromJobs(jobs) : summary?.status;
  const progress = counts && progressOf(counts);
  const running = !!progress?.running;

  const [table, setTable] = useState(null);
  useEffect(() => {
    if (running && !table) loadDurationTable().then(setTable);
  }, [running, table]);
  const etaModel =
    running && jobs && table
      ? estimatePush(jobs, table, { pushedAt: push.push_timestamp * 1000 })
      : null;

  usePoll(loadJobs, POLL_MS.push, !jobs || running);
  const eta = running
    ? describeEta(etaModel, { started: progress.done > 0 })
    : null;

  return { push, jobs, error, counts, progress, eta };
};

export default usePushData;
