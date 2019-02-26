import $ from 'jquery';

import { thFailureResults, thPlatformMap } from './constants';
import { getGroupMapKey } from './aggregateId';
import { getAllUrlParams } from './location';
import { uiJobsUrlBase } from './url';

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
export const thUnclassifiedIds = [1, 7];

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
export const getBtnClass = function getBtnClass(
  resultStatus,
  failureClassificationId,
) {
  let btnClass = btnClasses[resultStatus] || 'btn-default';

  // handle if a job is classified
  // TODO: Check if the parseInt() is really needed here.
  const classificationId = parseInt(failureClassificationId, 10);
  if (classificationId > 1) {
    btnClass += '-classified';
    // autoclassification-only case
    if (classificationId === 7) {
      btnClass += ' autoclassified';
    }
  }
  return btnClass;
};

export const getJobBtnClass = function getJobBtnClass(job) {
  return getBtnClass(getStatus(job), job.failure_classification_id);
};

export const isReftest = function isReftest(job) {
  return (
    [job.job_group_name, job.job_type_name].some(name =>
      name.toLowerCase().includes('reftest'),
    ) || job.job_type_symbol.includes('wrench')
  );
};

export const isPerfTest = function isPerfTest(job) {
  return [job.job_group_name, job.job_type_name].some(
    name =>
      name.toLowerCase().includes('talos') ||
      name.toLowerCase().includes('raptor'),
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
  const key = Object.keys(el).find(key =>
    key.startsWith('__reactInternalInstance$'),
  );
  if (key) {
    const fiberNode = el[key];
    return fiberNode && fiberNode.return && fiberNode.return.stateNode;
  }
  return null;
};

// Fetch the React instance of the currently selected job.
export const findSelectedInstance = function findSelectedInstance() {
  const selectedEl = $('.th-view-content')
    .find('.job-btn.selected-job')
    .first();
  if (selectedEl.length) {
    return findInstance(selectedEl[0]);
  }
};

// Check if the element is visible on screen or not.
const isOnScreen = function isOnScreen(el) {
  const viewport = {};
  viewport.top =
    $(window).scrollTop() + $('#global-navbar-container').height() + 30;
  const filterbarheight = $('.active-filters-bar').height();
  viewport.top =
    filterbarheight > 0 ? viewport.top + filterbarheight : viewport.top;
  const updatebarheight = $('.update-alert-panel').height();
  viewport.top =
    updatebarheight > 0 ? viewport.top + updatebarheight : viewport.top;
  viewport.bottom = $(window).height() - $('#details-panel').height() - 20;
  const bounds = {};
  bounds.top = el.offset().top;
  bounds.bottom = bounds.top + el.outerHeight();
  return bounds.top <= viewport.bottom && bounds.bottom >= viewport.top;
};

// Scroll the element into view.
// TODO: see if Element.scrollIntoView() can be used here. (bug 1434679)
export const scrollToElement = function scrollToElement(el, duration) {
  if (duration === undefined) {
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

export const findGroupElement = function findGroupElement(job) {
  const { push_id, job_group_symbol, tier, platform, platform_option } = job;
  const groupMapKey = getGroupMapKey(
    push_id,
    job_group_symbol,
    tier,
    platform,
    platform_option,
  );
  const viewContent = $('.th-view-content');

  return viewContent.find(`span[data-group-key='${groupMapKey}']`).first();
};

export const findGroupInstance = function findGroupInstance(job) {
  const groupEl = findGroupElement(job);

  if (groupEl.length) {
    return findInstance(groupEl[0]);
  }
};

// Fetch the React instance based on the jobId, and if scrollTo
// is true, then scroll it into view.
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
  const symbolInfo = job.job_group_symbol === '?' ? '' : job.job_group_symbol;

  return [
    thPlatformMap[job.platform] || job.platform,
    job.platform_option,
    job.job_group_name === 'unknown' ? undefined : job.job_group_name,
    job.job_type_name,
    `${symbolInfo}(${job.job_type_symbol})`,
  ]
    .filter(item => typeof item !== 'undefined')
    .join(' ')
    .toLowerCase();
};

export const getJobSearchStrHref = function getJobSearchStrHref(jobSearchStr) {
  const params = getAllUrlParams();
  params.set('searchStr', jobSearchStr.split(' '));

  return `${uiJobsUrlBase}?${params.toString()}`;
};

export const getHoverText = function getHoverText(job) {
  const duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);

  return `${job.job_type_name} - ${getStatus(job)} - ${duration} mins`;
};
