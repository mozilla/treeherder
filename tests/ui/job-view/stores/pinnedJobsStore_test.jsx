import { usePinnedJobsStore } from '../../../../ui/shared/stores/pinnedJobsStore';
import { notify } from '../../../../ui/shared/stores/notificationStore';

// Mock the notification store
jest.mock('../../../../ui/shared/stores/notificationStore', () => ({
  notify: jest.fn(),
}));

// Mock pulsePinCount as it touches the DOM
document.getElementById = jest.fn();

describe('pinnedJobsStore', () => {
  beforeEach(() => {
    usePinnedJobsStore.getState().unPinAll();
    jest.clearAllMocks();
  });

  it('should pin jobs and handle max size correctly', () => {
    const store = usePinnedJobsStore.getState();
    const jobs = Array.from({ length: 505 }, (_, i) => ({
      id: i,
      name: `job-${i}`,
    }));

    // Pin first 490 jobs
    store.pinJobs(jobs.slice(0, 490));
    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(
      490,
    );

    // Try to pin all 505 jobs (including 490 already pinned)
    // There are 15 new jobs (490 to 504).
    // Remaining space is 500 - 490 = 10.
    // So it should pin 10 more (490 to 499) and show an error for the remaining 5.
    store.pinJobs(jobs);

    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(
      500,
    );
    expect(notify).toHaveBeenCalledWith(
      'Max pinboard size of 500 reached.',
      'danger',
      { sticky: true },
    );
  });

  it('should not show error if all jobs to pin are already pinned', () => {
    const store = usePinnedJobsStore.getState();
    const jobs = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      name: `job-${i}`,
    }));

    store.pinJobs(jobs);
    jest.clearAllMocks();

    store.pinJobs(jobs);
    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(
      10,
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('should only pin what fits and show error if some dont fit', () => {
    const store = usePinnedJobsStore.getState();
    // Fill up to 495
    const existingJobs = Array.from({ length: 495 }, (_, i) => ({
      id: i,
      name: `job-${i}`,
    }));
    store.pinJobs(existingJobs);

    // Try to add 10 more
    const moreJobs = Array.from({ length: 10 }, (_, i) => ({
      id: i + 500,
      name: `job-${i + 500}`,
    }));
    store.pinJobs(moreJobs);

    expect(Object.keys(usePinnedJobsStore.getState().pinnedJobs).length).toBe(
      500,
    );
    expect(notify).toHaveBeenCalledWith(
      'Max pinboard size of 500 reached.',
      'danger',
      { sticky: true },
    );
  });
});
