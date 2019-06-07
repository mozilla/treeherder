import $ from 'jquery';

import {
  findGroupElement,
  findGroupInstance,
  findJobInstance,
  findSelectedInstance,
  scrollToElement,
} from '../../../helpers/job';
import { thJobNavSelectors } from '../../../helpers/constants';
import { getUrlParam, setUrlParam } from '../../../helpers/location';
import JobModel from '../../../models/job';
import PushModel from '../../../models/push';
import { getJobsUrl } from '../../../helpers/url';

const SELECT_JOB = 'SELECT_JOB';
const SELECT_JOB_FROM_QUERY_STRING = 'SELECT_JOB_FROM_QUERY_STRING';
const CLEAR_JOB = 'CLEAR_JOB';
const UPDATE_JOB_DETAILS = 'UPDATE_JOB_DETAILS';

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

export const clearSelectedJob = countPinnedJobs => ({
  type: CLEAR_JOB,
  countPinnedJobs,
});

export const updateJobDetails = job => ({
  type: UPDATE_JOB_DETAILS,
  job,
  meta: {
    debounce: 'nextJob',
  },
});

const doUpdateJobDetails = job => {
  const jobId = job ? job.id : null;

  setUrlParam('selectedJob', jobId);
  return { selectedJob: job };
};

export const doSelectJob = (job, updateDetails) => {
  const selected = findSelectedInstance();

  if (selected) selected.setSelected(false);

  const newSelectedElement = findJobInstance(job.id, true);

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

export const doClearSelectedJob = countPinnedJobs => {
  if (!countPinnedJobs) {
    const selected = findSelectedInstance();
    if (selected) selected.setSelected(false);
    setUrlParam('selectedJob', null);
    return { selectedJob: null };
  }
  return {};
};

/**
 * If the URL has a query string param of ``selectedJob`` then select
 * that job on load.
 *
 * If that job isn't in any of the loaded pushes, then throw
 * an error and provide a link to load it with the right push.
 */
const doSetSelectedJobFromQueryString = (notify, jobMap) => {
  const repoName = getUrlParam('repo');
  const selectedJobIdStr = getUrlParam('selectedJob');
  const selectedJobId = parseInt(selectedJobIdStr, 10);

  if (selectedJobIdStr) {
    const selectedJob = jobMap[selectedJobIdStr];

    // select the job in question
    if (selectedJob) {
      return doSelectJob(selectedJob);
    }
    setUrlParam('selectedJob');
    // If the ``selectedJob`` was not mapped, then we need to notify
    // the user it's not in the range of the current result set list.
    JobModel.get(repoName, selectedJobId)
      .then(job => {
        PushModel.get(job.push_id).then(async resp => {
          if (resp.ok) {
            const push = await resp.json();
            const newPushUrl = getJobsUrl({
              repo: repoName,
              revision: push.revision,
              selectedJob: selectedJobId,
            });

            // the job exists, but isn't in any loaded push.
            // provide a message and link to load the right push
            notify(
              `Selected job id: ${selectedJobId} not within current push range.`,
              'danger',
              { sticky: true, linkText: 'Load push', url: newPushUrl },
            );
          } else {
            throw Error(
              `Unable to find push with id ${job.push_id} for selected job`,
            );
          }
        });
      })
      .catch(error => {
        // the job wasn't found in the db.  Either never existed,
        // or was expired and deleted.
        this.doClearSelectedJob();
        notify(`Selected Job - ${error}`, 'danger', { sticky: true });
      });
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

  // TODO: (bug 1434679) Move from using jquery here to find the next/prev
  // component.  This could perhaps be done either with:
  // * Document functions like ``querySelectorAll``, etc.
  // * ReactJS with ReactDOM and props.children

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
  const jobs = $('.th-view-content')
    .find(jobNavSelector.selector)
    .filter(':visible, .selected-job, .selected-count');

  if (jobs.length) {
    const selectedEl = jobs.filter('.selected-job, .selected-count').first();
    const selIdx = jobs.index(selectedEl);
    const idx = getIndex(selIdx, jobs);
    const jobEl = $(jobs[idx]);

    if (selIdx !== idx) {
      const jobId = jobEl.attr('data-job-id');
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

const initialState = {
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
