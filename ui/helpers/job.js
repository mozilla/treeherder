import $ from 'jquery';
import _ from 'lodash';

import { thPlatformMap } from '../js/constants';
import { toDateStr } from './display';
import { getSlaveHealthUrl, getWorkerExplorerUrl } from './url';

const btnClasses = {
  busted: "btn-red",
  exception: "btn-purple",
  testfailed: "btn-orange",
  usercancel: "btn-pink",
  retry: "btn-dkblue",
  success: "btn-green",
  running: "btn-dkgray",
  pending: "btn-ltgray",
  superseded: "btn-ltblue",
  failures: "btn-red",
  'in progress': "btn-dkgray",
};

// The result will be unknown unless the state is complete, so much check both.
// TODO: We should consider storing either pending or running in the result,
// even when the job isn't complete.  It would simplify a lot of UI code and
// I can't think of a reason that would hurt anything.
export const getStatus = function getStatus(job) {
  return job.state === 'completed' ? job.result : job.state;
};

// Get the CSS class for job buttons as well as jobs that show in the pinboard.
// These also apply to result "groupings" like ``failures`` and ``in progress``
// for the colored filter chicklets on the nav bar.
export const getBtnClass = function getBtnClass(resultState, failureClassificationId) {
  let btnClass = btnClasses[resultState] || "btn-default";

  // handle if a job is classified
  const classificationId = parseInt(failureClassificationId, 10);
  if (classificationId > 1) {
    btnClass += "-classified";
    // autoclassification-only case
    if (classificationId === 7) {
      btnClass += " autoclassified";
    }
  }
  return btnClass;
};

export const getJobBtnClass = function getJobBtnClass(job) {
  return getBtnClass(getStatus(job), job.failure_classification_id);
};

export const isReftest = function isReftest(job) {
  return [job.job_group_name, job.job_type_name]
    .some(name => name.toLowerCase().includes('reftest'));
};

// Fetch the React instance of an object from a DOM element.
// Credit for this approach goes to SO: https://stackoverflow.com/a/48335220/333614
export const findInstance = function findInstance(el) {
  const key = Object.keys(el).find(key => key.startsWith('__reactInternalInstance$'));
  if (key) {
    const fiberNode = el[key];
    return fiberNode && fiberNode.return && fiberNode.return.stateNode;
  }
  return null;
};

// Fetch the React instance of the currently selected job.
export const findSelectedInstance = function findSelectedInstance() {
  const selectedEl = $('.th-view-content').find(".job-btn.selected-job").first();
  if (selectedEl.length) {
    return findInstance(selectedEl[0]);
  }
};

// Check if the element is visible on screen or not.
const isOnScreen = function isOnScreen(el) {
  const viewport = {};
  viewport.top = $(window).scrollTop() + $('#global-navbar-container').height() + 30;
  const filterbarheight = $('.active-filters-bar').height();
  viewport.top = filterbarheight > 0 ? viewport.top + filterbarheight : viewport.top;
  const updatebarheight = $('.update-alert-panel').height();
  viewport.top = updatebarheight > 0 ? viewport.top + updatebarheight : viewport.top;
  viewport.bottom = $(window).height() - $('#details-panel').height() - 20;
  const bounds = {};
  bounds.top = el.offset().top;
  bounds.bottom = bounds.top + el.outerHeight();
  return ((bounds.top <= viewport.bottom) && (bounds.bottom >= viewport.top));
};

// Scroll the element into view.
// TODO: see if Element.scrollIntoView() can be used here. (bug 1434679)
export const scrollToElement = function scrollToElement(el, duration) {
  if (_.isUndefined(duration)) {
    duration = 50;
  }
  if (el.position() !== undefined) {
    let scrollOffset = -50;
    if (window.innerHeight >= 500 && window.innerHeight < 1000) {
      scrollOffset = -100;
    } else if (window.innerHeight >= 1000) {
      scrollOffset = -200;
    }
    if (!isOnScreen(el)) {
      $('.th-global-content').scrollTo(el, duration, { offset: scrollOffset });
    }
  }
};

// Fetch the React instance based on the jobId, and if scrollTo is true, then
// scroll it into view.
export const findJobInstance = function findJobInstance(jobId, scrollTo) {
  const jobEl = $('.th-view-content')
    .find(`button[data-job-id='${jobId}']`)
    .first();

  if (jobEl.length) {
    if (scrollTo) {
      scrollToElement(jobEl);
    }
    return findInstance(jobEl[0]);
  }
};

export const getSearchStr = function getSearchStr(job) {
  // we want to join the group and type information together
  // so we can search for it as one token (useful when
  // we want to do a search on something like `fxup-esr(`)
  const symbolInfo = (job.job_group_symbol === '?') ? '' : job.job_group_symbol;

  return [
    thPlatformMap[job.platform] || job.platform,
    job.platform_option,
    (job.job_group_name === 'unknown') ? undefined : job.job_group_name,
    job.job_type_name,
    `${symbolInfo}(${job.job_type_symbol})`
  ].filter(item => typeof item !== 'undefined').join(' ');
};

export const getHoverText = function getHoverText(job) {
  const duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);

  return `${job.job_type_name} - ${getStatus(job)} - ${duration} mins`;
};

export const getJobMachineUrl = function getJobMachineUrl(job) {
  const { build_system_type, machine_name } = job;
  const machineUrl = (machine_name !== 'unknown' && build_system_type === 'buildbot') ?
    getSlaveHealthUrl(machine_name) :
    getWorkerExplorerUrl(job.taskcluster_metadata.task_id);

  return machineUrl;
};

export const getTimeFields = function getTimeFields(job) {
  // time fields to show in detail panel, but that should be grouped together
  const timeFields = {
    requestTime: toDateStr(job.submit_timestamp)
  };

  // If start time is 0, then duration should be from requesttime to now
  // If we have starttime and no endtime, then duration should be starttime to now
  // If we have both starttime and endtime, then duration will be between those two
  const endtime = job.end_timestamp || Date.now() / 1000;
  const starttime = job.start_timestamp || job.submit_timestamp;
  const duration = `${Math.round((endtime - starttime)/60, 0)} minute(s)`;

  if (job.start_timestamp) {
    timeFields.startTime = toDateStr(job.start_timestamp);
    timeFields.duration = duration;
  } else {
    timeFields.duration = `Not started (queued for ${duration})`;
  }

  if (job.end_timestamp) {
    timeFields.endTime = toDateStr(job.end_timestamp);
  }

  return timeFields;
};
