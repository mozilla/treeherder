import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { findJobInstance } from '../../helpers/job';

import { notify } from './notificationStore';

const COUNT_ERROR = 'Max pinboard size of 500 reached.';
const DUPLICATE_BUG_WARNING = 'This bug (or a duplicate) is already pinned.';
const MAX_SIZE = 500;

const pulsePinCount = () => {
  const jobEl = document.getElementById('pin-count-group');

  if (jobEl) {
    jobEl.classList.add('pin-count-pulse');
    window.setTimeout(() => {
      jobEl.classList.remove('pin-count-pulse');
    }, 700);
  }
};

export const usePinnedJobsStore = create(
  devtools(
    (set, get) => ({
      pinnedJobs: {},
      pinnedJobBugs: [],
      failureClassificationComment: '',
      newBug: new Set(),
      failureClassificationId: 4,
      isPinBoardVisible: false,

      setClassificationId: (id) => {
        set({ failureClassificationId: id });
      },

      setClassificationComment: (text) => {
        set({ failureClassificationComment: text });
      },

      setPinBoardVisible: (isPinBoardVisible) => {
        set({ isPinBoardVisible });
      },

      pinJob: (job) => {
        const { pinnedJobs } = get();

        if (MAX_SIZE - Object.keys(pinnedJobs).length > 0) {
          set({
            pinnedJobs: { ...pinnedJobs, [job.id]: job },
            isPinBoardVisible: true,
          });
          pulsePinCount();
        } else {
          notify(COUNT_ERROR, 'danger');
        }
      },

      unPinJob: (job) => {
        const { pinnedJobs } = get();
        const newPinnedJobs = { ...pinnedJobs };
        delete newPinnedJobs[job.id];
        set({ pinnedJobs: newPinnedJobs });
        pulsePinCount();
      },

      pinJobs: (jobsToPin) => {
        const { pinnedJobs } = get();

        const spaceRemaining = MAX_SIZE - Object.keys(pinnedJobs).length;
        const showError = jobsToPin.length > spaceRemaining;
        const newPinnedJobs = jobsToPin
          .slice(0, spaceRemaining)
          .reduce((acc, job) => ({ ...acc, [job.id]: job }), {});

        if (!spaceRemaining || showError) {
          notify(COUNT_ERROR, 'danger', { sticky: true });
          return;
        }

        set({
          pinnedJobs: { ...pinnedJobs, ...newPinnedJobs },
          isPinBoardVisible: true,
        });
      },

      addBug: (bug, job = null) => {
        const { pinnedJobBugs, newBug, pinJob } = get();

        const newBugUpdate = new Set(newBug);
        if ('newBug' in bug) {
          if (!newBug.has(bug.newBug)) {
            newBugUpdate.add(bug.newBug);
          }
        }
        // Avoid duplicating an already pinned bug
        if (
          pinnedJobBugs.some(
            (b) =>
              // Check if a bug already in the pinboard is set as duplicate and that number matches either the bug number to be pinned or the bug it is as duplicate of
              (b.dupe_of &&
                (b.dupe_of === bug.id || b.dupe_of === bug.dupe_of)) ||
              // Check if a bug already in the pinboard has a number matching the number of the bug to be pinned or the number of the bug to which it is set as duplicate
              (b.id && (b.id === bug.id || b.id === bug.dupe_of)) ||
              // Check if an internal issue already in the pinboard if classified with internal issue (assumption internal issue will be converted to bug soon enough to not need support for duplicates)
              (b.internal_id && b.internal_id === bug.internal_id),
          )
        ) {
          notify(DUPLICATE_BUG_WARNING, 'warning');
          return;
        }

        set({
          pinnedJobBugs: [...pinnedJobBugs, bug],
          newBug: newBugUpdate,
        });

        if (job) {
          // ``job`` here is likely passed in from the DetailsPanel which is not
          // the same object instance as the job shown in the normal job field.
          // The one from the DetailsPanel is the ``selectedJobFull``.
          // As a result, if we pin the ``selectedJobFull``, and then update it when
          // classifying, it won't update the display of the same job in the main
          // job field.  Thus, it won't disappear when in "unclassified only" mode.
          const jobInstance = findJobInstance(job.id);
          // Fall back to the ``job`` just in case ``jobInstance`` can't be found.
          // Use this fallback so the job will still get classified, even if it
          // is somehow not displayed in the job field and therefore it does
          // not need to be visually updated.
          const jobToPin = jobInstance ? jobInstance.props.job : job;

          pinJob(jobToPin);
        }
      },

      removeBug: (bug) => {
        const { pinnedJobBugs } = get();
        const bugzillaId = bug.dupe_of || bug.id;
        const bugInternalId = bug.internal_id;

        let index = -1;
        if (bugzillaId) {
          index = pinnedJobBugs.findIndex(
            (b) => b.dupe_of === bugzillaId || b.id === bugzillaId,
          );
        } else if (bugInternalId) {
          index = pinnedJobBugs.findIndex(
            (b) => b.internal_id === bugInternalId,
          );
        }

        if (index >= 0) {
          set({
            pinnedJobBugs: [
              ...pinnedJobBugs.slice(0, index),
              ...pinnedJobBugs.slice(index + 1),
            ],
          });
        }
      },

      unPinAll: () => {
        set({
          failureClassificationId: 4,
          failureClassificationComment: '',
          newBug: new Set(),
          pinnedJobs: {},
          pinnedJobBugs: [],
        });
      },

      togglePinJob: (job) => {
        const { pinnedJobs, pinJob, unPinJob } = get();

        if (pinnedJobs[job.id]) {
          unPinJob(job);
        } else {
          pinJob(job);
        }
      },
    }),
    { name: 'pinned-jobs-store' },
  ),
);

// Standalone functions for use outside React components
export const pinJob = (job) => usePinnedJobsStore.getState().pinJob(job);
export const unPinJob = (job) => usePinnedJobsStore.getState().unPinJob(job);
export const pinJobs = (jobs) => usePinnedJobsStore.getState().pinJobs(jobs);
export const addBug = (bug, job) =>
  usePinnedJobsStore.getState().addBug(bug, job);
export const removeBug = (bug) => usePinnedJobsStore.getState().removeBug(bug);
export const unPinAll = () => usePinnedJobsStore.getState().unPinAll();
export const togglePinJob = (job) =>
  usePinnedJobsStore.getState().togglePinJob(job);
export const setClassificationId = (id) =>
  usePinnedJobsStore.getState().setClassificationId(id);
export const setClassificationComment = (text) =>
  usePinnedJobsStore.getState().setClassificationComment(text);
export const setPinBoardVisible = (visible) =>
  usePinnedJobsStore.getState().setPinBoardVisible(visible);
