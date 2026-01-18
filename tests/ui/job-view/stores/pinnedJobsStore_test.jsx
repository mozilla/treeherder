import { cleanup } from '@testing-library/react';

import {
  usePinnedJobsStore,
  pinJob,
  unPinJob,
  pinJobs,
  addBug,
  removeBug,
  unPinAll,
  togglePinJob,
  setClassificationId,
  setClassificationComment,
  setPinBoardVisible,
} from '../../../../ui/job-view/stores/pinnedJobsStore';

// Mock the notification store
jest.mock('../../../../ui/job-view/stores/notificationStore', () => {
  const actualStore = jest.requireActual(
    '../../../../ui/job-view/stores/notificationStore',
  );
  return {
    ...actualStore,
    notify: jest.fn(),
  };
});

// Mock findJobInstance helper
jest.mock('../../../../ui/helpers/job', () => ({
  findJobInstance: jest.fn((jobId) => {
    // Return a mock job instance if needed
    if (jobId === 123) {
      return {
        props: {
          job: { id: 123, job_type_name: 'test', platform: 'linux' },
        },
      };
    }
    return null;
  }),
}));

const COUNT_ERROR = 'Max pinboard size of 500 reached.';
const DUPLICATE_BUG_WARNING = 'This bug (or a duplicate) is already pinned.';

describe('PinnedJobs Zustand store', () => {
  beforeEach(() => {
    // Reset store before each test
    usePinnedJobsStore.setState({
      pinnedJobs: {},
      pinnedJobBugs: [],
      failureClassificationComment: '',
      newBug: new Set(),
      failureClassificationId: 4,
      isPinBoardVisible: false,
    });

    // Clear notification mock
    const { notify } = require('../../../../ui/job-view/stores/notificationStore');
    notify.mockClear();

    // Mock the DOM element for pulsePinCount
    document.body.innerHTML = '<div id="pin-count-group"></div>';
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
  });

  describe('setClassificationId', () => {
    test('should set classification ID', () => {
      usePinnedJobsStore.getState().setClassificationId(7);
      const state = usePinnedJobsStore.getState();

      expect(state.failureClassificationId).toBe(7);
    });
  });

  describe('setClassificationComment', () => {
    test('should set classification comment', () => {
      const comment = 'This is a test comment';
      usePinnedJobsStore.getState().setClassificationComment(comment);
      const state = usePinnedJobsStore.getState();

      expect(state.failureClassificationComment).toBe(comment);
    });
  });

  describe('setPinBoardVisible', () => {
    test('should set pin board visibility to true', () => {
      usePinnedJobsStore.getState().setPinBoardVisible(true);
      const state = usePinnedJobsStore.getState();

      expect(state.isPinBoardVisible).toBe(true);
    });

    test('should set pin board visibility to false', () => {
      usePinnedJobsStore.setState({ isPinBoardVisible: true });
      usePinnedJobsStore.getState().setPinBoardVisible(false);
      const state = usePinnedJobsStore.getState();

      expect(state.isPinBoardVisible).toBe(false);
    });
  });

  describe('pinJob', () => {
    test('should pin a job', () => {
      const job = { id: 1, job_type_name: 'test', platform: 'linux' };
      usePinnedJobsStore.getState().pinJob(job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs[1]).toEqual(job);
      expect(Object.keys(state.pinnedJobs)).toHaveLength(1);
      expect(state.isPinBoardVisible).toBe(true);
    });

    test('should pin multiple jobs', () => {
      const job1 = { id: 1, job_type_name: 'test1' };
      const job2 = { id: 2, job_type_name: 'test2' };
      const job3 = { id: 3, job_type_name: 'test3' };

      usePinnedJobsStore.getState().pinJob(job1);
      usePinnedJobsStore.getState().pinJob(job2);
      usePinnedJobsStore.getState().pinJob(job3);
      const state = usePinnedJobsStore.getState();

      expect(Object.keys(state.pinnedJobs)).toHaveLength(3);
      expect(state.pinnedJobs[1]).toEqual(job1);
      expect(state.pinnedJobs[2]).toEqual(job2);
      expect(state.pinnedJobs[3]).toEqual(job3);
    });

    test('should not pin more than 500 jobs and show error', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');

      // Fill up to max
      const pinnedJobs = {};
      for (let i = 1; i <= 500; i++) {
        pinnedJobs[i] = { id: i, job_type_name: `test${i}` };
      }
      usePinnedJobsStore.setState({ pinnedJobs });

      // Try to pin one more
      const job = { id: 501, job_type_name: 'test501' };
      usePinnedJobsStore.getState().pinJob(job);
      const state = usePinnedJobsStore.getState();

      expect(Object.keys(state.pinnedJobs)).toHaveLength(500);
      expect(state.pinnedJobs[501]).toBeUndefined();
      expect(notify).toHaveBeenCalledWith(COUNT_ERROR, 'danger');
    });

    test('standalone pinJob function should work', () => {
      const job = { id: 1, job_type_name: 'test' };
      pinJob(job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs[1]).toEqual(job);
    });
  });

  describe('unPinJob', () => {
    test('should unpin a job', () => {
      const job1 = { id: 1, job_type_name: 'test1' };
      const job2 = { id: 2, job_type_name: 'test2' };

      usePinnedJobsStore.setState({
        pinnedJobs: { 1: job1, 2: job2 },
      });

      usePinnedJobsStore.getState().unPinJob(job1);
      const state = usePinnedJobsStore.getState();

      expect(Object.keys(state.pinnedJobs)).toHaveLength(1);
      expect(state.pinnedJobs[1]).toBeUndefined();
      expect(state.pinnedJobs[2]).toEqual(job2);
    });

    test('standalone unPinJob function should work', () => {
      const job = { id: 1, job_type_name: 'test' };
      usePinnedJobsStore.setState({ pinnedJobs: { 1: job } });

      unPinJob(job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs[1]).toBeUndefined();
    });
  });

  describe('pinJobs', () => {
    test('should pin multiple jobs at once', () => {
      const jobs = [
        { id: 1, job_type_name: 'test1' },
        { id: 2, job_type_name: 'test2' },
        { id: 3, job_type_name: 'test3' },
      ];

      usePinnedJobsStore.getState().pinJobs(jobs);
      const state = usePinnedJobsStore.getState();

      expect(Object.keys(state.pinnedJobs)).toHaveLength(3);
      expect(state.isPinBoardVisible).toBe(true);
    });

    test('should not pin jobs if no space remaining', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');

      // Fill up to max
      const pinnedJobs = {};
      for (let i = 1; i <= 500; i++) {
        pinnedJobs[i] = { id: i, job_type_name: `test${i}` };
      }
      usePinnedJobsStore.setState({ pinnedJobs });

      const newJobs = [{ id: 501, job_type_name: 'test501' }];
      usePinnedJobsStore.getState().pinJobs(newJobs);
      const state = usePinnedJobsStore.getState();

      expect(Object.keys(state.pinnedJobs)).toHaveLength(500);
      expect(notify).toHaveBeenCalledWith(COUNT_ERROR, 'danger', { sticky: true });
    });

    test('should show error if trying to pin more jobs than available space', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');

      // Fill to 498
      const pinnedJobs = {};
      for (let i = 1; i <= 498; i++) {
        pinnedJobs[i] = { id: i, job_type_name: `test${i}` };
      }
      usePinnedJobsStore.setState({ pinnedJobs });

      // Try to pin 5 jobs when only 2 slots available - should show error and not pin any
      const newJobs = [
        { id: 499, job_type_name: 'test499' },
        { id: 500, job_type_name: 'test500' },
        { id: 501, job_type_name: 'test501' },
        { id: 502, job_type_name: 'test502' },
        { id: 503, job_type_name: 'test503' },
      ];
      usePinnedJobsStore.getState().pinJobs(newJobs);
      const state = usePinnedJobsStore.getState();

      // Should not have pinned any new jobs
      expect(Object.keys(state.pinnedJobs)).toHaveLength(498);
      expect(notify).toHaveBeenCalledWith(COUNT_ERROR, 'danger', { sticky: true });
    });

    test('standalone pinJobs function should work', () => {
      const jobs = [
        { id: 1, job_type_name: 'test1' },
        { id: 2, job_type_name: 'test2' },
      ];
      pinJobs(jobs);
      const state = usePinnedJobsStore.getState();

      expect(Object.keys(state.pinnedJobs)).toHaveLength(2);
    });
  });

  describe('togglePinJob', () => {
    test('should pin a job if not already pinned', () => {
      const job = { id: 1, job_type_name: 'test' };
      usePinnedJobsStore.getState().togglePinJob(job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs[1]).toEqual(job);
    });

    test('should unpin a job if already pinned', () => {
      const job = { id: 1, job_type_name: 'test' };
      usePinnedJobsStore.setState({ pinnedJobs: { 1: job } });

      usePinnedJobsStore.getState().togglePinJob(job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs[1]).toBeUndefined();
    });

    test('standalone togglePinJob function should work', () => {
      const job = { id: 1, job_type_name: 'test' };
      togglePinJob(job);
      let state = usePinnedJobsStore.getState();
      expect(state.pinnedJobs[1]).toEqual(job);

      togglePinJob(job);
      state = usePinnedJobsStore.getState();
      expect(state.pinnedJobs[1]).toBeUndefined();
    });
  });

  describe('addBug', () => {
    test('should add a bug to pinnedJobBugs', () => {
      const bug = { id: 123456, summary: 'Test bug' };
      usePinnedJobsStore.getState().addBug(bug);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobBugs[0]).toEqual(bug);
    });

    test('should add multiple bugs', () => {
      const bug1 = { id: 123456, summary: 'Test bug 1' };
      const bug2 = { id: 789012, summary: 'Test bug 2' };

      usePinnedJobsStore.getState().addBug(bug1);
      usePinnedJobsStore.getState().addBug(bug2);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(2);
      expect(state.pinnedJobBugs[0]).toEqual(bug1);
      expect(state.pinnedJobBugs[1]).toEqual(bug2);
    });

    test('should add newBug to set when present', () => {
      const bug = { id: 123456, summary: 'Test bug', newBug: 'new-123' };
      usePinnedJobsStore.getState().addBug(bug);
      const state = usePinnedJobsStore.getState();

      expect(state.newBug.has('new-123')).toBe(true);
    });

    test('should not add duplicate newBug', () => {
      const bug1 = { id: 123456, summary: 'Test bug 1', newBug: 'new-123' };
      const bug2 = { id: 789012, summary: 'Test bug 2', newBug: 'new-123' };

      usePinnedJobsStore.getState().addBug(bug1);
      usePinnedJobsStore.getState().addBug(bug2);
      const state = usePinnedJobsStore.getState();

      expect(state.newBug.size).toBe(1);
      expect(state.newBug.has('new-123')).toBe(true);
    });

    test('should not add duplicate bug by ID and show warning', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');
      const bug1 = { id: 123456, summary: 'Test bug' };
      const bug2 = { id: 123456, summary: 'Duplicate bug' };

      usePinnedJobsStore.getState().addBug(bug1);
      usePinnedJobsStore.getState().addBug(bug2);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(notify).toHaveBeenCalledWith(DUPLICATE_BUG_WARNING, 'warning');
    });

    test('should not add bug if duplicate of existing bug', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');
      const bug1 = { id: 123456, summary: 'Original bug' };
      const bug2 = { id: 789012, dupe_of: 123456, summary: 'Duplicate bug' };

      usePinnedJobsStore.getState().addBug(bug1);
      usePinnedJobsStore.getState().addBug(bug2);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(notify).toHaveBeenCalledWith(DUPLICATE_BUG_WARNING, 'warning');
    });

    test('should not add bug if existing bug is duplicate', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');
      const bug1 = { id: 789012, dupe_of: 123456, summary: 'Duplicate bug' };
      const bug2 = { id: 123456, summary: 'Original bug' };

      usePinnedJobsStore.getState().addBug(bug1);
      usePinnedJobsStore.getState().addBug(bug2);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(notify).toHaveBeenCalledWith(DUPLICATE_BUG_WARNING, 'warning');
    });

    test('should not add duplicate internal issue', () => {
      const { notify } = require('../../../../ui/job-view/stores/notificationStore');
      const issue1 = { internal_id: 'INT-123', summary: 'Internal issue' };
      const issue2 = { internal_id: 'INT-123', summary: 'Duplicate issue' };

      usePinnedJobsStore.getState().addBug(issue1);
      usePinnedJobsStore.getState().addBug(issue2);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(notify).toHaveBeenCalledWith(DUPLICATE_BUG_WARNING, 'warning');
    });

    test('should pin job when job argument is provided', () => {
      const { findJobInstance } = require('../../../../ui/helpers/job');
      const bug = { id: 123456, summary: 'Test bug' };
      const job = { id: 123, job_type_name: 'test' };

      usePinnedJobsStore.getState().addBug(bug, job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobs[123]).toBeDefined();
      expect(findJobInstance).toHaveBeenCalledWith(123);
    });

    test('should use fallback job if jobInstance not found', () => {
      const { findJobInstance } = require('../../../../ui/helpers/job');
      const bug = { id: 123456, summary: 'Test bug' };
      const job = { id: 999, job_type_name: 'test' };

      findJobInstance.mockReturnValueOnce(null);

      usePinnedJobsStore.getState().addBug(bug, job);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobs[999]).toEqual(job);
    });

    test('standalone addBug function should work', () => {
      const bug = { id: 123456, summary: 'Test bug' };
      addBug(bug);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
    });
  });

  describe('removeBug', () => {
    test('should remove bug by ID', () => {
      const bug1 = { id: 123456, summary: 'Test bug 1' };
      const bug2 = { id: 789012, summary: 'Test bug 2' };

      usePinnedJobsStore.setState({
        pinnedJobBugs: [bug1, bug2],
      });

      usePinnedJobsStore.getState().removeBug(bug1);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobBugs[0]).toEqual(bug2);
    });

    test('should remove bug by dupe_of', () => {
      const bug1 = { id: 123456, summary: 'Original bug' };
      const bug2 = { id: 789012, summary: 'Another bug' };

      usePinnedJobsStore.setState({
        pinnedJobBugs: [bug1, bug2],
      });

      const dupeReference = { dupe_of: 123456 };
      usePinnedJobsStore.getState().removeBug(dupeReference);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobBugs[0]).toEqual(bug2);
    });

    test('should remove bug if pinned bug has dupe_of matching', () => {
      const bug1 = { id: 789012, dupe_of: 123456, summary: 'Duplicate bug' };
      const bug2 = { id: 999999, summary: 'Another bug' };

      usePinnedJobsStore.setState({
        pinnedJobBugs: [bug1, bug2],
      });

      const originalBug = { id: 123456 };
      usePinnedJobsStore.getState().removeBug(originalBug);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobBugs[0]).toEqual(bug2);
    });

    test('should remove internal issue by internal_id', () => {
      const issue1 = { internal_id: 'INT-123', summary: 'Internal issue 1' };
      const issue2 = { internal_id: 'INT-456', summary: 'Internal issue 2' };

      usePinnedJobsStore.setState({
        pinnedJobBugs: [issue1, issue2],
      });

      usePinnedJobsStore.getState().removeBug(issue1);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobBugs[0]).toEqual(issue2);
    });

    test('should not error when removing non-existent bug', () => {
      const bug1 = { id: 123456, summary: 'Test bug' };
      usePinnedJobsStore.setState({
        pinnedJobBugs: [bug1],
      });

      const nonExistent = { id: 999999 };
      usePinnedJobsStore.getState().removeBug(nonExistent);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(1);
      expect(state.pinnedJobBugs[0]).toEqual(bug1);
    });

    test('standalone removeBug function should work', () => {
      const bug = { id: 123456, summary: 'Test bug' };
      usePinnedJobsStore.setState({ pinnedJobBugs: [bug] });

      removeBug(bug);
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobBugs).toHaveLength(0);
    });
  });

  describe('unPinAll', () => {
    test('should clear all pinned jobs and bugs', () => {
      usePinnedJobsStore.setState({
        pinnedJobs: { 1: { id: 1 }, 2: { id: 2 } },
        pinnedJobBugs: [{ id: 123456 }, { id: 789012 }],
        failureClassificationId: 7,
        failureClassificationComment: 'Test comment',
        newBug: new Set(['new-1', 'new-2']),
      });

      usePinnedJobsStore.getState().unPinAll();
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs).toEqual({});
      expect(state.pinnedJobBugs).toEqual([]);
      expect(state.failureClassificationId).toBe(4);
      expect(state.failureClassificationComment).toBe('');
      expect(state.newBug.size).toBe(0);
    });

    test('standalone unPinAll function should work', () => {
      usePinnedJobsStore.setState({
        pinnedJobs: { 1: { id: 1 } },
        pinnedJobBugs: [{ id: 123456 }],
      });

      unPinAll();
      const state = usePinnedJobsStore.getState();

      expect(state.pinnedJobs).toEqual({});
      expect(state.pinnedJobBugs).toEqual([]);
    });
  });

  describe('standalone functions', () => {
    test('setClassificationId standalone function', () => {
      setClassificationId(2);
      const state = usePinnedJobsStore.getState();
      expect(state.failureClassificationId).toBe(2);
    });

    test('setClassificationComment standalone function', () => {
      setClassificationComment('New comment');
      const state = usePinnedJobsStore.getState();
      expect(state.failureClassificationComment).toBe('New comment');
    });

    test('setPinBoardVisible standalone function', () => {
      setPinBoardVisible(true);
      const state = usePinnedJobsStore.getState();
      expect(state.isPinBoardVisible).toBe(true);
    });
  });
});
