import { thFailureResults, thPlatformMap } from './constants';
import { getGroupMapKey } from './aggregateId';
import { getAllUrlParams, getRepo } from './location';

const btnClasses = {
  busted: 'btn-red',
  exception: 'btn-purple',
  testfailed: 'btn-orange',
  usercancel: 'btn-pink',
  retry: 'btn-dkblue',
  success: 'btn-green',
  running: 'btn-dkgray',
  pending: 'btn-ltgray',
  superseded: 'btn-ltblue',
  failures: 'btn-red',
  'in progress': 'btn-dkgray',
};

// failure classification ids that should be shown in "unclassified" mode
export const thUnclassifiedIds = [1, 6, 7];

// Get the CSS class for job buttons as well as jobs that show in the pinboard.
// These also apply to result "groupings" like ``failures`` and ``in progress``
// for the colored filter chicklets on the nav bar.
export const getBtnClass = function getBtnClass(
  resultStatus,
  failureClassificationId,
) {
  let btnClass = btnClasses[resultStatus] || 'btn-default';

  // handle if a job is classified > 1
  // and not "NEW failure", classification == 6
  if (failureClassificationId > 1 && failureClassificationId !== 6) {
    btnClass += '-classified';
  }
  return btnClass;
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
      name.toLowerCase().includes('browsertime'),
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

export const isClassified = function isClassified(job) {
  return !thUnclassifiedIds.includes(job.failure_classification_id);
};

export const isUnclassifiedFailure = function isUnclassifiedFailure(job) {
  return thFailureResults.includes(job.result) && !isClassified(job);
};

// Fetch the React instance of an object from a DOM element.
// Credit for this approach goes to SO: https://stackoverflow.com/a/48335220/333614
export const findInstance = function findInstance(el) {
  const key = Object.keys(el).find((key) => key.startsWith('__reactFiber$'));
  if (key) {
    const fiberNode = el[key];
    return fiberNode && fiberNode.return && fiberNode.return.stateNode;
  }
  return null;
};

// Fetch the React instance of the currently selected job.
export const findSelectedInstance = function findSelectedInstance() {
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

// In order to support backfilling of manifest based scheduling, modify the job
// type name and symbol.
//
// Returns an array of modified jobTypeName and jobTypeSymbol, or undefined for
// each if no modification happened.
//
// A backfilled task (e.g. bc2) ends up being named bc2-<revision>-bk
// The label can also be different than the original task selected to be backfilled
// For instance 'test-linux1804-64/debug-mochitest-browser-chrome-e10s-4' can be
// 'test-linux1804-64/debug-mochitest-browser-chrome-e10s-1' yet the symbol be bc4
function generateJobTypeForBackfill(jobTypeName, jobTypeSymbol) {
  const originalJobTypeName = jobTypeName;
  const originalJobTypeSymbol = jobTypeSymbol;

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

  return [
    originalJobTypeName !== jobTypeName ? jobTypeName : undefined,
    originalJobTypeSymbol !== jobTypeSymbol ? jobTypeSymbol : undefined,
  ];
}

export const addAggregateFields = function addAggregateFields(job) {
  const {
    job_type_name: jobTypeName,
    job_type_symbol: jobTypeSymbol,
    job_group_name: jobGroupName,
    platform,
    platform_option: platformOption,
    submit_timestamp: submitTimestamp,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
  } = job;

  job.resultStatus = getResultState(job);

  const [
    jobTypeNameForBackfill,
    jobTypeSymbolForBackfill,
  ] = generateJobTypeForBackfill(jobTypeName, jobTypeSymbol);

  job.searchStr = [
    thPlatformMap[platform] || platform,
    platformOption,
    jobGroupName === 'unknown' ? undefined : jobGroupName,
    jobTypeName,
    jobTypeSymbol,
    jobTypeNameForBackfill,
    jobTypeSymbolForBackfill,
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

  return `?${params.toString()}`;
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
