import { push as pushRoute } from 'connected-react-router';

import {
  findGroupElement,
  findGroupInstance,
  findJobInstance,
  findSelectedInstance,
  getTaskRun,
  getTaskRunStr,
  scrollToElement,
} from '../../../helpers/job';
import {
  getCurrentlySelectedInstance,
  setCurrentlySelectedInstance,
  clearCurrentlySelectedInstance,
} from '../../../hooks/useJobButtonRegistry';
import { thJobNavSelectors } from '../../../helpers/constants';
import {
  getUrlParam,
  setUrlParam,
  setUrlParams,
} from '../../../helpers/location';
import JobModel from '../../../models/job';
import { getJobsUrl } from '../../../helpers/url';

// Action types
export const SYNC_JOB_FROM_URL = 'SYNC_JOB_FROM_URL';
export const UPDATE_JOB_DETAILS = 'UPDATE_JOB_DETAILS';

// Legacy action types (kept for backwards compatibility during migration)
export const SELECT_JOB = 'SELECT_JOB';
export const SELECT_JOB_FROM_QUERY_STRING = 'SELECT_JOB_FROM_QUERY_STRING';
export const CLEAR_JOB = 'CLEAR_JOB';

/**
 * URL-FIRST ARCHITECTURE
 *
 * The URL is the single source of truth for job selection.
 * All selection changes go through the URL, and a single sync effect
 * reads the URL and updates the Redux state and visual selection.
 *
 * Flow:
 * 1. User clicks job → selectJobViaUrl(job) → URL updates
 * 2. URL change detected → syncSelectionFromUrl(jobMap) → Redux + visual update
 *
 * This eliminates race conditions caused by updating Redux and URL separately.
 */

/**
 * Select a job by updating the URL only.
 * The URL change will trigger syncSelectionFromUrl which updates Redux state.
 * This is the PRIMARY way to select a job.
 */
export const selectJobViaUrl = (job) => {
  return (dispatch) => {
    const taskRun = job ? getTaskRunStr(job) : null;
    const params = setUrlParams([['selectedTaskRun', taskRun]]);
    dispatch(pushRoute({ search: params }));
  };
};

/**
 * Clear the selected job by updating the URL only.
 * The URL change will trigger syncSelectionFromUrl which updates Redux state.
 */
export const clearJobViaUrl = () => {
  return (dispatch) => {
    const params = setUrlParams([
      ['selectedTaskRun', null],
      ['selectedJob', null],
    ]);
    dispatch(pushRoute({ search: params }));
  };
};

/**
 * Sync the selection state from the URL.
 * This is the ONLY place where Redux selectedJob state is updated.
 * Called when URL changes (including initial load, clicks, back/forward).
 */
export const syncSelectionFromUrl = (jobMap, notify) => ({
  type: SYNC_JOB_FROM_URL,
  jobMap,
  notify,
});

/**
 * Update job details without changing selection.
 * Used when the selected job's data is refreshed (e.g., state change).
 */
export const updateJobDetails = (job) => {
  return async (dispatch) => {
    dispatch({
      type: UPDATE_JOB_DETAILS,
      job,
      meta: {
        debounce: 'nextJob',
      },
    });
    // Also update URL to ensure it reflects the latest task run
    const taskRun = job ? getTaskRunStr(job) : null;
    const params = setUrlParams([['selectedTaskRun', taskRun]]);
    dispatch(pushRoute({ search: params }));
  };
};

// ============================================================================
// LEGACY ACTIONS - Kept for backwards compatibility during migration
// These will be removed once all callers are updated to use URL-first pattern
// ============================================================================

/**
 * @deprecated Use selectJobViaUrl instead
 */
export const setSelectedJob = (job, updateUrl = true) => {
  return async (dispatch) => {
    // During migration, this now just updates the URL
    // The URL change will trigger syncSelectionFromUrl
    if (updateUrl) {
      dispatch(selectJobViaUrl(job));
    } else {
      // For cases where we explicitly don't want URL update (internal sync),
      // directly dispatch the sync action
      dispatch({
        type: SELECT_JOB,
        job,
      });
    }
  };
};

/**
 * @deprecated Use syncSelectionFromUrl instead
 */
export const setSelectedJobFromQueryString = (notify, jobMap) => ({
  type: SELECT_JOB_FROM_QUERY_STRING,
  notify,
  jobMap,
});

/**
 * @deprecated Use clearJobViaUrl instead
 */
export const clearSelectedJob = (countPinnedJobs, updateUrl = true) => {
  return async (dispatch) => {
    if (updateUrl) {
      dispatch(clearJobViaUrl());
    } else {
      // For cases where we explicitly don't want URL update (internal sync),
      // directly dispatch the clear action
      dispatch({
        type: CLEAR_JOB,
        countPinnedJobs,
      });
    }
  };
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Update the visual selection state (CSS classes, scroll into view).
 * Called by the reducer when selection changes.
 */
export const doSelectJob = (job) => {
  // Use the tracked instance first (more reliable), fall back to DOM query
  const selected = getCurrentlySelectedInstance() || findSelectedInstance();

  if (selected) selected.setSelected(false);

  const newSelectedElement = findJobInstance(job.id);

  if (newSelectedElement) {
    newSelectedElement.setSelected(true);
    // Track the newly selected instance for reliable deselection later
    setCurrentlySelectedInstance(job.id, newSelectedElement);
  } else {
    // Clear tracking since the job element doesn't exist
    clearCurrentlySelectedInstance();

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

/**
 * Clear the visual selection state.
 */
export const doClearSelectedJob = (countPinnedJobs) => {
  if (!countPinnedJobs) {
    const selected = getCurrentlySelectedInstance() || findSelectedInstance();
    if (selected) selected.setSelected(false);

    clearCurrentlySelectedInstance();

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

    notify(`${message} not within current push range.`, 'danger', {
      sticky: true,
      linkText: 'Load push',
      url: newPushUrl,
    });
  } else {
    const message = taskId
      ? `Task not found: ${taskId}${runId ? `, run ${runId}` : ''}`
      : `Job ID not found: ${id}`;
    notify(message, 'danger', { sticky: true });
  }
};

/**
 * Sync selection state from URL parameters.
 * This is the single source of truth for job selection.
 */
const doSyncSelectionFromUrl = (jobMap, notify) => {
  const selectedTaskRun = getUrlParam('selectedTaskRun');

  if (selectedTaskRun) {
    const { taskId, runId } = getTaskRun(selectedTaskRun);

    if (taskId === undefined) {
      setUrlParam('selectedJob');
      setUrlParam('selectedTaskRun');
      return doClearSelectedJob({});
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
      // Normalize URL to use consistent format
      setUrlParam('selectedJob');
      setUrlParam('selectedTaskRun', getTaskRunStr(task));
      return doSelectJob(task);
    }

    if (getUrlParam('revision')) {
      return doClearSelectedJob({});
    }

    // Task not in loaded pushes - search database
    searchDatabaseForTaskRun({ task_id: taskId, retry_id: runId }, notify);
    return doClearSelectedJob({});
  }

  // Check legacy selectedJob param
  const selectedJob = getUrlParam('selectedJob');
  if (selectedJob) {
    const selectedJobId = parseInt(selectedJob, 10);
    const task = jobMap[selectedJobId];

    if (task) {
      // Migrate to new URL format
      setUrlParam('selectedJob');
      setUrlParam('selectedTaskRun', getTaskRunStr(task));
      return doSelectJob(task);
    }

    if (getUrlParam('revision')) {
      return doClearSelectedJob({});
    }

    searchDatabaseForTaskRun({ id: selectedJobId }, notify);
    return doClearSelectedJob({});
  }

  // No selection in URL
  return doClearSelectedJob({});
};

/**
 * Navigate to next/previous job.
 * Returns the job to select (caller should update URL).
 */
export const findNextJob = (direction, unclassifiedOnly, notify) => {
  const jobNavSelector = unclassifiedOnly
    ? thJobNavSelectors.UNCLASSIFIED_FAILURES
    : thJobNavSelectors.ALL_JOBS;
  const noMoreText = `No ${
    unclassifiedOnly ? 'unclassified failures' : 'jobs'
  } to select`;

  const getIndex =
    direction === 'next'
      ? (idx, jobs) => (idx + 1 > jobs.length - 1 ? 0 : idx + 1)
      : (idx, jobs) => (idx - 1 < 0 ? jobs.length - 1 : idx - 1);

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
        return jobInstance.props.job;
      }
    }
  }

  notify(noMoreText);
  return null;
};

/**
 * @deprecated Use findNextJob + selectJobViaUrl instead
 */
export const changeJob = (
  direction,
  unclassifiedOnly,
  countPinnedJobs,
  notify,
) => {
  const job = findNextJob(direction, unclassifiedOnly, notify);
  if (job) {
    return doSelectJob(job);
  }
  return doClearSelectedJob(countPinnedJobs);
};

// ============================================================================
// REDUCER
// ============================================================================

export const initialState = {
  selectedJob: null,
};

export const reducer = (state = initialState, action) => {
  const { job, jobMap, countPinnedJobs, notify } = action;

  switch (action.type) {
    case SYNC_JOB_FROM_URL:
      return doSyncSelectionFromUrl(jobMap, notify);

    // Legacy actions - still supported during migration
    case SELECT_JOB:
      return doSelectJob(job);
    case SELECT_JOB_FROM_QUERY_STRING:
      return doSyncSelectionFromUrl(jobMap, notify);
    case UPDATE_JOB_DETAILS:
      return { selectedJob: job };
    case CLEAR_JOB:
      return { ...state, ...doClearSelectedJob(countPinnedJobs) };

    default:
      return state;
  }
};
