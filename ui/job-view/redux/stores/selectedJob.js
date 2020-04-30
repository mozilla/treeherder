import {
  findGroupElement,
  findGroupInstance,
  findJobInstance,
  findSelectedInstance,
  getTaskRun,
  getTaskRunStr,
  scrollToElement,
} from '../../../helpers/job';
import { thJobNavSelectors } from '../../../helpers/constants';
import { getUrlParam, setUrlParam } from '../../../helpers/location';
import JobModel from '../../../models/job';
import { getJobsUrl } from '../../../helpers/url';

export const SELECT_JOB = 'SELECT_JOB';
export const SELECT_JOB_FROM_QUERY_STRING = 'SELECT_JOB_FROM_QUERY_STRING';
export const CLEAR_JOB = 'CLEAR_JOB';
export const UPDATE_JOB_DETAILS = 'UPDATE_JOB_DETAILS';

export const setSelectedJob = (job, updateDetails = true) => ({
  type: SELECT_JOB,
  job,
  updateDetails,
});

export const setSelectedJobFromQueryString = (notify, jobMap) => ({
  type: SELECT_JOB_FROM_QUERY_STRING,
  notify,
  jobMap,
});

export const clearSelectedJob = (countPinnedJobs) => ({
  type: CLEAR_JOB,
  countPinnedJobs,
});

export const updateJobDetails = (job) => ({
  type: UPDATE_JOB_DETAILS,
  job,
  meta: {
    debounce: 'nextJob',
  },
});

const doUpdateJobDetails = (job) => {
  const taskRun = job ? getTaskRunStr(job) : null;

  setUrlParam('selectedTaskRun', taskRun);
  return { selectedJob: job };
};

export const doSelectJob = (job, updateDetails) => {
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
  if (updateDetails) {
    return doUpdateJobDetails(job);
  }
  return { selectedJob: job };
};

export const doClearSelectedJob = (countPinnedJobs) => {
  if (!countPinnedJobs) {
    const selected = findSelectedInstance();
    if (selected) selected.setSelected(false);
    setUrlParam('selectedTaskRun', null);
    setUrlParam('selectedJob', null);
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
      ? `Task not found: ${taskId}, run ${runId}`
      : `Job ID not found: ${id}`;
    notify(message, 'danger', { sticky: true });
  }
};

/**
 * If the URL has a query string param of ``selectedJob`` then select
 * that job on load.
 *
 * If that job isn't in any of the loaded pushes, then throw
 * an error and provide a link to load it with the right push.
 */
const doSetSelectedJobFromQueryString = (notify, jobMap) => {
  const selectedJobId = parseInt(getUrlParam('selectedJob') || '0', 10);
  const { taskId, runId } = getTaskRun(getUrlParam('selectedTaskRun'));

  // Try to find the Task by taskId and runID
  if (taskId) {
    const retryId = parseInt(runId, 10);
    const task = Object.values(jobMap).find(
      (job) => job.task_id === taskId && job.retry_id === retryId,
    );

    if (task) {
      setUrlParam('selectedJob');
      return doSelectJob(task);
    }
  }

  // Try to find the Task by selectedJobId
  if (selectedJobId) {
    const task = jobMap[selectedJobId];

    // select the job in question
    if (task) {
      setUrlParam('selectedJob');
      setUrlParam('selectedTaskRun', getTaskRunStr(task));

      return doSelectJob(task);
    }
  }

  // We are attempting to select a task, but that task is not in the current
  // range of pushes.  So we search for it in the database to help the user
  // locate it.
  if (taskId || selectedJobId) {
    const jobParams = taskId
      ? { task_id: taskId, retry_id: runId }
      : { id: selectedJobId };

    searchDatabaseForTaskRun(jobParams, notify);
  }

  return doClearSelectedJob({});
};

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
        return doSelectJob(jobInstance.props.job, false);
      }
    }
  }
  // if there was no new job selected, then ensure that we clear any job that
  // was previously selected.
  notify(noMoreText);
  return doClearSelectedJob(countPinnedJobs);
};

export const initialState = {
  selectedJob: null,
};

export const reducer = (state = initialState, action) => {
  const { job, jobMap, countPinnedJobs, updateDetails, notify } = action;

  switch (action.type) {
    case SELECT_JOB:
      return doSelectJob(job, updateDetails);
    case SELECT_JOB_FROM_QUERY_STRING:
      return doSetSelectedJobFromQueryString(notify, jobMap);
    case UPDATE_JOB_DETAILS:
      return doUpdateJobDetails(job);
    case CLEAR_JOB:
      return { ...state, ...doClearSelectedJob(countPinnedJobs) };
    default:
      return state;
  }
};
