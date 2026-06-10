import { usePinnedJobsStore } from '../../../../ui/job-view/stores/pinnedJobsStore';
import { notify } from '../../../../ui/job-view/stores/notificationStore';

jest.mock('../../../../ui/job-view/stores/notificationStore', () => ({
  notify: jest.fn(),
}));

describe('pinnedJobsStore', () => {
  beforeEach(() => {
    usePinnedJobsStore.getState().unPinAll();
    jest.clearAllMocks();
  });

  it('should correctly synchronize when re-pinning jobs after some were removed (Bug 1390211)', () => {
    const store = usePinnedJobsStore.getState();

    // 1. Setup: Pin 500 jobs
    const initialJobs = Array.from({ length: 500 }, (_, i) => ({ id: i }));
    store.pinJobs(initialJobs);
    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(500);

    // 2. Manually remove 10 jobs
    const jobsToRemove = initialJobs.slice(0, 10);
    jobsToRemove.forEach(job => store.unPinJob(job));
    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(490);

    // 3. Pin All again (using the original 500 jobs)
    store.pinJobs(initialJobs);

    // Expected: The 10 removed jobs should be re-added, bringing total back to 500.
    // The 490 already there should have been filtered out and not counted against the limit.
    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(500);

    // We shouldn't see a "Max size reached" error because we didn't actually exceed the limit
    // with the *new* jobs being added.
    expect(notify).not.toHaveBeenCalledWith(expect.stringContaining('Max pinboard size'), 'danger', expect.anything());
  });

  it('should partially fill the pinboard and notify if the batch exceeds remaining space', () => {
    const store = usePinnedJobsStore.getState();

    // Fill to 495
    const initialJobs = Array.from({ length: 495 }, (_, i) => ({ id: i }));
    store.pinJobs(initialJobs);

    // Try to add 10 more (total would be 505)
    const extraJobs = Array.from({ length: 10 }, (_, i) => ({ id: i + 500 }));
    store.pinJobs(extraJobs);

    // Should have filled up to 500
    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(500);

    // Should have notified about the limit
    expect(notify).toHaveBeenCalledWith(
      'Max pinboard size of 500 reached.',
      'danger',
      { sticky: true }
    );
  });
});