// Per-session cache of the Similar Jobs tab's full state, keyed by the
// investigated jobId. react-tabs unmounts the tab when inactive and remounts it
// on return, which would otherwise reset the list, pagination, selection and
// filter and refetch everything. We snapshot that state for an instant restore,
// then stale-while-revalidate in the background to pick up newly-arrived jobs
// and status changes on already-listed jobs.
//
// A snapshot's `timestamp` is the time of the last successful *list* fetch (not
// the last state change), so the revalidate dedup window below is meaningful.
export const similarJobsCache = new Map();
export const SIMILAR_JOBS_CACHE_LIMIT = 50;
// Skip the background revalidate if the snapshot's list was fetched within this
// window, so rapid tab toggling doesn't spam the backend.
export const SIMILAR_JOBS_REVALIDATE_MS = 30 * 1000;

export function getSimilarJobsSnapshot(jobId) {
  return similarJobsCache.get(jobId) || null;
}

export function setSimilarJobsSnapshot(jobId, snapshot) {
  // Re-insert so this jobId counts as the newest for eviction ordering (Map
  // preserves insertion order).
  similarJobsCache.delete(jobId);
  if (similarJobsCache.size >= SIMILAR_JOBS_CACHE_LIMIT) {
    similarJobsCache.delete(similarJobsCache.keys().next().value);
  }
  similarJobsCache.set(jobId, snapshot);
}

// True when the snapshot's list is recent enough to skip a background
// revalidate.
export function isSnapshotFresh(snapshot) {
  return (
    !!snapshot && Date.now() - snapshot.timestamp < SIMILAR_JOBS_REVALIDATE_MS
  );
}
