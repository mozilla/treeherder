import {
  similarJobsCache,
  SIMILAR_JOBS_CACHE_LIMIT,
  SIMILAR_JOBS_REVALIDATE_MS,
  getSimilarJobsSnapshot,
  setSimilarJobsSnapshot,
  isSnapshotFresh,
} from '../../../ui/job-view/details/tabs/similarJobsCache';

const snapshot = (overrides = {}) => ({
  similarJobs: [{ id: 1 }],
  page: 1,
  filterNoSuccessfulJobs: false,
  selectedSimilarJob: null,
  hasNextPage: false,
  timestamp: Date.now(),
  ...overrides,
});

describe('similarJobsCache', () => {
  afterEach(() => {
    similarJobsCache.clear();
  });

  test('stores and retrieves a snapshot by jobId', () => {
    const snap = snapshot();
    setSimilarJobsSnapshot(42, snap);

    expect(getSimilarJobsSnapshot(42)).toBe(snap);
    expect(getSimilarJobsSnapshot(99)).toBeNull();
  });

  test('evicts the oldest jobId once the limit is exceeded', () => {
    for (let jobId = 1; jobId <= SIMILAR_JOBS_CACHE_LIMIT; jobId++) {
      setSimilarJobsSnapshot(jobId, snapshot());
    }
    expect(similarJobsCache.size).toBe(SIMILAR_JOBS_CACHE_LIMIT);
    expect(getSimilarJobsSnapshot(1)).not.toBeNull();

    setSimilarJobsSnapshot(SIMILAR_JOBS_CACHE_LIMIT + 1, snapshot());

    expect(similarJobsCache.size).toBe(SIMILAR_JOBS_CACHE_LIMIT);
    expect(getSimilarJobsSnapshot(1)).toBeNull();
    expect(getSimilarJobsSnapshot(SIMILAR_JOBS_CACHE_LIMIT + 1)).not.toBeNull();
  });

  test('re-writing a jobId refreshes its eviction recency', () => {
    for (let jobId = 1; jobId <= SIMILAR_JOBS_CACHE_LIMIT; jobId++) {
      setSimilarJobsSnapshot(jobId, snapshot());
    }
    // Touch jobId 1 so it is no longer the oldest.
    setSimilarJobsSnapshot(1, snapshot());
    // Next insert should evict jobId 2 (now the oldest), not 1.
    setSimilarJobsSnapshot(SIMILAR_JOBS_CACHE_LIMIT + 1, snapshot());

    expect(getSimilarJobsSnapshot(1)).not.toBeNull();
    expect(getSimilarJobsSnapshot(2)).toBeNull();
  });

  test('isSnapshotFresh reflects the revalidate window', () => {
    expect(isSnapshotFresh(null)).toBe(false);
    expect(isSnapshotFresh(snapshot({ timestamp: Date.now() }))).toBe(true);
    expect(
      isSnapshotFresh(
        snapshot({ timestamp: Date.now() - SIMILAR_JOBS_REVALIDATE_MS - 1 }),
      ),
    ).toBe(false);
  });
});
