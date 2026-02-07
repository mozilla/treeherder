import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  findGroupElement,
  findGroupInstance,
  findJobInstance,
  findSelectedInstance,
  getTaskRun,
  getTaskRunStr,
  scrollToElement,
} from '../../helpers/job';
import { thJobNavSelectors } from '../../helpers/constants';
import { getUrlParam, setUrlParam, setUrlParams } from '../../helpers/location';
import { updateUrlSearch } from '../../helpers/router';
import JobModel from '../../models/job';
import { getJobsUrl } from '../../helpers/url';

const doSelectJob = (job) => {
  const selected = findSelectedInstance();

  if (selected) selected.setSelected(false);

  const newSelectedElement = findJobInstance(job.id);

  if (newSelectedElement) {
    newSelectedElement.setSelected(true);
  } else {
    const group = findGroupInstance(job);
    if (group) {
      group.setExpanded(true);
    }

    // If the job is in a group count, then the job element won't exist, but
    // its group will.  We can try scrolling to that.
    const groupEl = findGroupElement(job);
    if (groupEl) {
      scrollToElement(groupEl);
    }
  }

  return { selectedJob: job };
};

const doClearSelectedJob = (countPinnedJobs) => {
  if (!countPinnedJobs) {
    const selected = findSelectedInstance();
    if (selected) selected.setSelected(false);

    return { selectedJob: null };
  }
  return {};
};

const searchDatabaseForTaskRun = async (jobParams, notify) => {
  const repoName = getUrlParam('repo');
  const { failureStatus, data: taskList } = await JobModel.getList(jobParams);
  const { id, task_id: taskId, retry_id: runId } = jobParams;

  setUrlParam('selectedJob');
  setUrlParam('selectedTaskRun');

  if (taskList.length && !failureStatus) {
    const task = taskList[0];
    const newPushUrl = getJobsUrl({
      repo: repoName,
      revision: task.push_revision,
      selectedTaskRun: getTaskRunStr(task),
    });
    const message = taskId ? `Selected task: ${taskId}` : `Selected job: ${id}`;
    // The task exists, but isn't in any loaded push.
    // provide a message and link to load the right push

    notify(`${message} not within current push range.`, 'danger', {
      sticky: true,
      linkText: 'Load push',
      url: newPushUrl,
    });
  } else {
    // The task wasn't found in the db.  Either never existed,
    // or was expired and deleted.
    const message = taskId
      ? `Task not found: ${taskId}${runId ? `, run ${runId}` : ''}`
      : `Job ID not found: ${id}`;
    notify(message, 'danger', { sticky: true });
  }
};

export const useSelectedJobStore = create(
  devtools(
    (set) => ({
      selectedJob: null,

      setSelectedJob: (job, updateDetails = true) => {
        const result = doSelectJob(job);
        set(result);

        if (updateDetails) {
          const taskRun = job ? getTaskRunStr(job) : null;
          const params = setUrlParams([['selectedTaskRun', taskRun]]);
          updateUrlSearch(params);
        }
      },

      clearSelectedJob: (countPinnedJobs) => {
        const result = doClearSelectedJob(countPinnedJobs);
        set((state) => ({ ...state, ...result }));

        const params = setUrlParams([
          ['selectedTaskRun', null],
          ['selectedJob', null],
        ]);
        updateUrlSearch(params);
      },

      updateJobDetails: (job) => {
        set({ selectedJob: job });
        const taskRun = job ? getTaskRunStr(job) : null;
        const params = setUrlParams([['selectedTaskRun', taskRun]]);
        updateUrlSearch(params);
      },

      setSelectedJobFromQueryString: (notify, jobMap) => {
        const selectedTaskRun = getUrlParam('selectedTaskRun');
        if (selectedTaskRun) {
          const { taskId, runId } = getTaskRun(selectedTaskRun);

          if (taskId === undefined) {
            setUrlParam('selectedJob');
            setUrlParam('selectedTaskRun');
            set((state) => ({ ...state, ...doClearSelectedJob({}) }));
            return;
          }

          let task;
          if (runId) {
            const retryId = parseInt(runId, 10);
            task = Object.values(jobMap).find(
              (job) => job.task_id === taskId && job.retry_id === retryId,
            );
          } else {
            const runs = Object.values(jobMap)
              .filter((job) => job.task_id === taskId)
              .sort((left, right) => left.retry_id - right.retry_id);
            task = runs[runs.length - 1];
          }

          if (task) {
            setUrlParam('selectedJob');
            setUrlParam('selectedTaskRun', getTaskRunStr(task));
            set(doSelectJob(task));
            return;
          }

          if (getUrlParam('revision')) {
            /* A standalone push which got opened deliberately. Either a task of a
               different push was selected or none. */
            set((state) => ({ ...state, ...doClearSelectedJob({}) }));
            return;
          }
          // We are attempting to select a task, but that task is not in the current
          // range of pushes.  So we search for it in the database to help the user
          // locate it.
          searchDatabaseForTaskRun(
            { task_id: taskId, retry_id: runId },
            notify,
          );
          set((state) => ({ ...state, ...doClearSelectedJob({}) }));
          return;
        }

        // Try to find the Task by selectedJobId
        const selectedJob = getUrlParam('selectedJob');
        if (selectedJob) {
          const selectedJobId = parseInt(selectedJob, 10);
          const task = jobMap[selectedJobId];

          // select the job in question
          if (task) {
            setUrlParam('selectedJob');
            setUrlParam('selectedTaskRun', getTaskRunStr(task));
            set(doSelectJob(task));
            return;
          }

          if (getUrlParam('revision')) {
            /* A standalone push which got opened deliberately. Either a task of a
               different push was selected or none. */
            set((state) => ({ ...state, ...doClearSelectedJob({}) }));
            return;
          }
          // We are attempting to select a task, but that task is not in the current
          // range of pushes.  So we search for it in the database to help the user
          // locate it.
          searchDatabaseForTaskRun({ id: selectedJobId }, notify);
          set((state) => ({ ...state, ...doClearSelectedJob({}) }));
          return;
        }

        set((state) => ({ ...state, ...doClearSelectedJob({}) }));
      },
    }),
    { name: 'selected-job-store' },
  ),
);

/**
 * Change job selection in the given direction
 * This is a standalone function since it's called from keyboard shortcuts
 * and needs to access DOM directly
 */
export const changeJob = (
  direction,
  unclassifiedOnly,
  countPinnedJobs,
  notify,
) => {
  const jobNavSelector = unclassifiedOnly
    ? thJobNavSelectors.UNCLASSIFIED_FAILURES
    : thJobNavSelectors.ALL_JOBS;
  const noMoreText = `No ${
    unclassifiedOnly ? 'unclassified failures' : 'jobs'
  } to select`;
  // Get the appropriate next index based on the direction and current job
  // selection (if any).  Must wrap end to end.
  const getIndex =
    direction === 'next'
      ? (idx, jobs) => (idx + 1 > jobs.length - 1 ? 0 : idx + 1)
      : (idx, jobs) => (idx - 1 < 0 ? jobs.length - 1 : idx - 1);

  // Filter the list of possible jobs down to ONLY ones in the .th-view-content
  // div (excluding pinBoard) and then to the specific selector passed
  // in.  And then to only VISIBLE (not filtered away) jobs.  The exception
  // is for the .selected-job.  Even if the ``visible`` field is set to false,
  // this includes it because it is the anchor from which we find
  // the next/previous job.
  //
  // The .selected-job can be ``visible: false``, but still showing to the
  // user.  This can happen when filtered to unclassified failures only,
  // and you then classify the selected job.  It's ``visible`` field is set
  // to false, but it is still showing to the user because it is still
  // selected.  This is very important to the sheriff workflow.  As soon as
  // selection changes away from it, the job will no longer be visible.
  const content = document.querySelector('#push-list');
  const jobs = Array.prototype.slice.call(
    content.querySelectorAll(jobNavSelector.selector),
  );

  if (jobs.length) {
    const selectedEl = content.querySelector('.selected-job, .selected-count');
    const selIdx = jobs.indexOf(selectedEl);
    const idx = getIndex(selIdx, jobs);
    const jobEl = jobs[idx];

    if (selIdx !== idx) {
      const jobId = jobEl.getAttribute('data-job-id');
      const jobInstance = findJobInstance(jobId, true);

      if (jobInstance) {
        // Delay updating details for the new job right away,
        // in case the user is switching rapidly between jobs
        return doSelectJob(jobInstance.props.job);
      }
    }
  }
  // if there was no new job selected, then ensure that we clear any job that
  // was previously selected.
  notify(noMoreText);
  return doClearSelectedJob(countPinnedJobs);
};

// Standalone functions for use outside React components
export const setSelectedJob = (job, updateDetails) =>
  useSelectedJobStore.getState().setSelectedJob(job, updateDetails);
export const clearSelectedJob = (countPinnedJobs) =>
  useSelectedJobStore.getState().clearSelectedJob(countPinnedJobs);
export const updateJobDetails = (job) =>
  useSelectedJobStore.getState().updateJobDetails(job);
export const setSelectedJobFromQueryString = (notify, jobMap) =>
  useSelectedJobStore.getState().setSelectedJobFromQueryString(notify, jobMap);

// ============================================================================
// URL-FIRST ARCHITECTURE FUNCTIONS
// These preserve the fixes from camd/fix-job-click-clear-bug
// ============================================================================

// Track when a job was last selected (for clearing race condition fix)
let lastJobSelectionTime = 0;

/**
 * Select a job via URL update (URL-first pattern).
 * This updates the Redux state directly and then updates the URL.
 * The URL change will NOT trigger syncSelectionFromUrl because
 * we've already updated the state.
 */
export const selectJobViaUrl = (job) => {
  const store = useSelectedJobStore.getState();
  if (job) {
    // Update state directly with the job object.
    // This avoids the race condition of looking up from jobMap.
    lastJobSelectionTime = Date.now();
    store.setSelectedJob(job, true); // true = update URL
  }
};

/**
 * Clear the selected job by updating the URL only.
 * The URL change will trigger syncSelectionFromUrl which updates state.
 */
export const clearJobViaUrl = () => {
  const store = useSelectedJobStore.getState();
  store.clearSelectedJob(0); // This will update URL
};

/**
 * Sync the selection state from the URL.
 * This is called when the URL changes (including initial load, clicks, back/forward).
 * It reads the URL parameters and updates the Zustand store.
 */
export const syncSelectionFromUrl = (jobMap, notify) => {
  const store = useSelectedJobStore.getState();
  store.setSelectedJobFromQueryString(notify, jobMap);
};

/**
 * Check if a job was just selected (within the last ~100ms).
 * Used to prevent clearing the selection immediately after selecting.
 */
export const wasJobJustSelected = () => {
  return Date.now() - lastJobSelectionTime < 100;
};
