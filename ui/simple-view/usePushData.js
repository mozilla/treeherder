import { useCallback, useEffect, useState } from 'react';

import { cachedHealth, cachedPush, cachedSummary, rememberPush } from './cache';
import { POLL_MS, PUSH } from './constants';
import { estimatePush, fetchPushJobs, loadDurationTable } from './eta';
import {
  describeEta,
  fetchHealth,
  fetchPush,
  progressOf,
  statusFromJobs,
} from './helpers';
import { usePoll } from './hooks';

const usePushData = (repo, revision) => {
  const [push, setPush] = useState(() => cachedPush(repo, revision));
  const [health, setHealth] = useState(() => cachedHealth(repo, revision));
  // The list already knows this push's counts, so the ring can draw before the
  // health report arrives.
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

  const loadHealth = useCallback(async () => {
    const h = await fetchHealth(repo, revision);
    if (h) setHealth(h);
  }, [repo, revision]);

  useEffect(() => {
    setHealth(cachedHealth(repo, revision));
    loadHealth();
  }, [loadHealth, repo, revision]);

  // The push's own job list: exact counts, the ETA's input, and the failures
  // Push Health leaves out.
  const [jobs, setJobs] = useState(null);
  const loadJobs = useCallback(async () => {
    if (!push) return;
    const list = await fetchPushJobs(repo, push.id);
    if (list) setJobs(list);
  }, [repo, push]);

  useEffect(() => {
    setJobs(null);
    loadJobs();
  }, [loadJobs]);

  const counts = jobs ? statusFromJobs(jobs) : health?.status || summary?.status;
  const progress = health && counts && progressOf(counts);
  const running = !!progress?.running;

  const [table, setTable] = useState(null);
  useEffect(() => {
    if (running && !table) loadDurationTable().then(setTable);
  }, [running, table]);
  const etaModel =
    running && jobs && table
      ? estimatePush(jobs, table, { pushedAt: push.push_timestamp * 1000 })
      : null;

  usePoll(
    () => {
      loadHealth();
      loadJobs();
    },
    POLL_MS.push,
    !health || running,
  );
  const eta = running
    ? describeEta(etaModel, { started: progress.done > 0 })
    : null;


  return { push, health, jobs, error, counts, progress, eta };
};

export default usePushData;
