import TaskclusterModel from '../models/taskcluster';
import {
  getJobButtonInstance,
  getCurrentlySelectedInstance,
} from '../hooks/useJobButtonRegistry';

import { thFailureResults, thPlatformMap } from './constants';
import { getGroupMapKey } from './aggregateId';
import { getAllUrlParams, getRepo } from './location';
import { getAction } from './taskcluster';
import { formatTaskclusterError } from './errorMessage';

// failure classification ids that should be shown in "unclassified" mode
// TODO: consider dropping 8 from this list, only here for full compatibility
export const thUnclassifiedIds = [1, 6, 7, 8];

// Get the status and classification state for job buttons
// Returns an object with status value and classified boolean for data attributes
export const getBtnClass = function getBtnClass(
  resultStatus,
  failureClassificationId,
) {
  const status = resultStatus || 'unknown';

  // Check if a job is classified (> 1 and not "NEW failure" classification == 6)
  // TODO: consider dropping 8 from this list, only here for full compatibility
  const isClassified =
    failureClassificationId > 1 && ![6, 8].includes(failureClassificationId);

  return {
    status,
    isClassified,
  };
};

export const isReftest = function isReftest(job) {
  const {
    job_group_name: gName,
    job_type_name: jName,
    job_type_symbol: jSymbol,
  } = job;
  return (
    [gName, jName].some((name) => name.toLowerCase().includes('reftest')) ||
    jSymbol.includes('wrench') ||
    jName.includes('test-verify')
  );
};

export const isPerfTest = function isPerfTest(job) {
  return [job.job_group_name, job.job_type_name].some(
    (name) =>
      name.toLowerCase().includes('talos') ||
      name.toLowerCase().includes('raptor') ||
      name.toLowerCase().includes('browsertime') ||
      name.toLowerCase().includes('perftest'),
  );
};

export const canConfirmFailure = function canConfirmFailure(job) {
  const confirmRepos = ['autoland', 'mozilla-central', 'try'];
  const repoName = getRepo();
  if (!confirmRepos.includes(repoName)) {
    return false;
  }
  if (job.job_type_name.toLowerCase().includes('jsreftest')) {
    return false;
  }
  return [job.job_group_name, job.job_type_name].some(
    (name) =>
      !name.toLowerCase().includes('source-test') &&
      (name.toLowerCase().includes('crashtest') ||
        name.toLowerCase().includes('mochitest') ||
        name.toLowerCase().includes('reftest') ||
        name.toLowerCase().includes('web-platform') ||
        name.toLowerCase().includes('xpcshell')),
  );
};

export const confirmFailure = async function confirmFailure(
  job,
  notify,
  decisionTaskMap,
  currentRepo,
) {
  const { id: decisionTaskId } = decisionTaskMap[job.push_id];

  if (!canConfirmFailure(job)) {
    return;
  }

  if (!job.id) {
    notify('Job not yet loaded for failure confirmation', 'warning');

    return;
  }

  if (job.state !== 'completed') {
    notify('Job not yet completed. Try again later.', 'warning');

    return;
  }

  TaskclusterModel.load(decisionTaskId, job, currentRepo).then((results) => {
    try {
      const confirmFailureAction = getAction(
        results.actions,
        'confirm-failures',
      );

      if (!confirmFailureAction) {
        notify(
          'Request to confirm failure via actions.json failed could not find action.',
          'danger',
          { sticky: true },
        );
        return;
      }

      return TaskclusterModel.submit({
        action: confirmFailureAction,
        decisionTaskId,
        taskId: results.originalTaskId,
        input: {},
        staticActionVariables: results.staticActionVariables,
        currentRepo,
      }).then(
        () => {
          notify(
            'Request sent to confirm-failures job via actions.json',
            'success',
          );
        },
        (e) => {
          // The full message is too large to fit in a Treeherder
          // notification box.
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        },
      );
    } catch (e) {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }
  });
};

export const isClassified = function isClassified(job) {
  return !thUnclassifiedIds.includes(job.failure_classification_id);
};

export const isUnclassifiedFailure = function isUnclassifiedFailure(job) {
  return thFailureResults.includes(job.result) && !isClassified(job);
};

// Fetch the registered instance of a job button from a DOM element.
// Uses the job button registry which stores imperative handles for functional components.
// If the element doesn't have a data-job-id, traverse up the DOM tree to find one.
export const findInstance = function findInstance(el) {
  // First check the element itself
  let jobId = el.getAttribute('data-job-id');
  if (jobId) {
    return getJobButtonInstance(jobId);
  }

  // If not found, traverse up the DOM tree to find a parent with data-job-id
  // This handles clicks on child elements like SVG icons inside job buttons
  if (typeof el.closest === 'function') {
    const parentWithJobId = el.closest('[data-job-id]');
    if (parentWithJobId) {
      jobId = parentWithJobId.getAttribute('data-job-id');
      if (jobId) {
        return getJobButtonInstance(jobId);
      }
    }
  }

  return null;
};

// Fetch the React instance of the currently selected job.
// Uses the tracked instance first (more reliable), then falls back to DOM query.
// This avoids race conditions where the DOM might not have the .selected-job class
// yet because React hasn't re-rendered after setSelected(true) was called.
export const findSelectedInstance = function findSelectedInstance() {
  // Try the tracked instance first - this is more reliable
  const trackedInstance = getCurrentlySelectedInstance();
  if (trackedInstance) {
    return trackedInstance;
  }

  // Fall back to DOM query for backwards compatibility
  const selectedEl = document.querySelector('#push-list .job-btn.selected-job');

  if (selectedEl) {
    return findInstance(selectedEl);
  }
};

// Check if the element is visible on screen or not.
const isOnScreen = function isOnScreen(el) {
  const bounding = el.getBoundingClientRect();
  const offset = el.getBoundingClientRect();
  const top = offset.top + document.body.scrollTop;
  const bottom = top + el.offsetHeight;

  return top >= bounding.bottom && bottom <= bounding.top;
};

// Scroll the element into view.
export const scrollToElement = function scrollToElement(el) {
  if (!isOnScreen(el)) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

export const findGroupElement = function findGroupElement(job) {
  const {
    push_id: pushId,
    job_group_symbol: jobGroupSymbol,
    tier,
    platform,
    platform_option: platformOption,
  } = job;
  const groupMapKey = getGroupMapKey(
    pushId,
    jobGroupSymbol,
    tier,
    platform,
    platformOption,
  );
  return document.querySelector(
    `#push-list span[data-group-key='${groupMapKey}']`,
  );
};

export const findGroupInstance = function findGroupInstance(job) {
  const groupEl = findGroupElement(job);

  if (groupEl) {
    return findInstance(groupEl);
  }
};

// Fetch the React instance based on the jobId, and if scrollTo
// is true, then scroll it into view.
export const findJobInstance = function findJobInstance(jobId, scrollTo) {
  const jobEl = document.querySelector(
    `#push-list button[data-job-id='${jobId}']`,
  );
  if (jobEl) {
    if (scrollTo) {
      scrollToElement(jobEl);
    }
    return findInstance(jobEl);
  }
};

export const getResultState = function getResultState(job) {
  const { result, state } = job;

  return state === 'completed' ? result : state;
};

export const addAggregateFields = function addAggregateFields(job) {
  const {
    job_group_name: jobGroupName,
    platform,
    platform_option: platformOption,
    submit_timestamp: submitTimestamp,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
  } = job;
  let { job_type_name: jobTypeName, job_type_symbol: jobTypeSymbol } = job;

  job.resultStatus = getResultState(job);

  // The current modification is to support backfilling of manifest based scheduling.
  // A backfilled task (e.g. bc2) ends up being named bc2-<revision>-bk
  // The label can also be different than the original task selected to be backfilled
  // For instance 'test-linux1804-64/debug-mochitest-browser-chrome-e10s-4' can be
  // 'test-linux1804-64/debug-mochitest-browser-chrome-e10s-1' yet the symbol be bc4
  const parts = jobTypeName.split('-');
  // This makes backfilled tasks have the same symbol as the original task
  if (jobTypeSymbol.endsWith('-bk')) {
    [jobTypeSymbol] = jobTypeSymbol.split('-');
  }
  const chunk = Number(parts.pop());
  if (Number.isInteger(chunk)) {
    jobTypeName = parts.join('-');
    jobTypeSymbol = jobTypeSymbol.split('-').shift();
  }
  job.searchStr = [
    thPlatformMap[platform] || platform,
    platformOption,
    jobGroupName === 'unknown' ? undefined : jobGroupName,
    jobTypeName,
    jobTypeSymbol,
  ]
    .filter((item) => typeof item !== 'undefined')
    .join(' ');

  if (!('duration' in job)) {
    // If start time is 0, then duration should be from requesttime to now
    // If we have starttime and no endtime, then duration should be starttime to now
    // If we have both starttime and endtime, then duration will be between those two
    const endtime = endTimestamp || Date.now() / 1000;
    const starttime = startTimestamp || submitTimestamp;
    const diff = Math.max(endtime - starttime, 60);

    job.duration = Math.round(diff / 60, 0);
  }

  job.hoverText = `${jobTypeName} - ${job.resultStatus} - ${job.duration} min${
    job.duration > 1 ? 's' : ''
  }`;
  return job;
};

export const getJobSearchStrHref = function getJobSearchStrHref(jobSearchStr) {
  const params = getAllUrlParams();
  params.set('searchStr', jobSearchStr.split(' '));

  // React Router v6 Link's to={{ search: ... }} adds the ? automatically
  return params.toString();
};

export const getTaskRunStr = (job) => `${job.task_id}.${job.retry_id}`;

// This matches as taskId, optionally followed by `.` or`-` and a runId.
// We support `-` for backwards compatability with the original format used.
const taskRunPattern = /^([A-Za-z0-9_-]{8}[Q-T][A-Za-z0-9_-][CGKOSWaeimquy26-][A-Za-z0-9_-]{10}[AQgw])(?:[-.]([0-9]+))?$/;

export const getTaskRun = function getTaskRun(taskRunStr) {
  const match = taskRunPattern.exec(taskRunStr);
  if (!match) {
    return {};
  }
  return { taskId: match[1], runId: match[2] };
};
