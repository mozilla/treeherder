import pick from 'lodash/pick';
import keyBy from 'lodash/keyBy';
import max from 'lodash/max';
import { push as pushRoute } from 'connected-react-router';

import { parseQueryParams, bugzillaBugsApi } from '../../../helpers/url';
import { getUrlParam, replaceLocation } from '../../../helpers/location';
import PushModel from '../../../models/push';
import { getTaskRunStr, isUnclassifiedFailure } from '../../../helpers/job';
import FilterModel from '../../../models/filter';
import JobModel from '../../../models/job';
import { thEvents } from '../../../helpers/constants';
import { processErrors, getData } from '../../../helpers/http';

import { notify } from './notifications';
import { setSelectedJob, clearSelectedJob } from './selectedJob';

export const LOADING = 'LOADING';
export const ADD_PUSHES = 'ADD_PUSHES';
export const ADD_BUG_SUMMARIES = 'ADD_BUG_SUMMARIES';
export const CLEAR_PUSHES = 'CLEAR_PUSHES';
export const SET_PUSHES = 'SET_PUSHES';
export const RECALCULATE_UNCLASSIFIED_COUNTS =
  'RECALCULATE_UNCLASSIFIED_COUNTS';
export const UPDATE_JOB_MAP = 'UPDATE_JOB_MAP';

const DEFAULT_PUSH_COUNT = 10;
// Keys that, if present on the url, must be passed into the push
// polling endpoint
const PUSH_POLLING_KEYS = ['tochange', 'enddate', 'revision', 'author'];
const PUSH_FETCH_KEYS = [...PUSH_POLLING_KEYS, 'fromchange', 'startdate'];

const getRevisionTips = (pushList) => {
  return {
    revisionTips: pushList.map((push) => ({
      revision: push.revision,
      author: push.author,
      title: push.revisions[0].comments.split('\n')[0],
    })),
  };
};

const getBugIds = (results) => {
  const bugIds = new Set();

  results.forEach((result) => {
    const { revisions } = result;

    revisions.forEach((revision) => {
      const comment = revision.comments.split('\n')[0];
      const bugMatches = comment.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
      if (bugMatches)
        bugMatches.forEach((bugMatch) => bugIds.add(bugMatch.split(' ')[1]));
    });
  });
  return bugIds;
};

const getBugSummaryMap = async (bugIds, dispatch, oldBugSummaryMap) => {
  const bugNumbers = [...bugIds];
  const { data } =
    bugNumbers.length > 0
      ? await getData(bugzillaBugsApi('bug', { id: bugNumbers }))
      : {};
  const bugData = data
    ? data.bugs.reduce((accumulator, curBug) => {
        accumulator[curBug.id] = curBug.summary;
        return accumulator;
      }, {})
    : {};
  const result = { ...bugData, ...oldBugSummaryMap };

  dispatch({
    type: ADD_BUG_SUMMARIES,
    pushResults: { bugSummaryMap: result },
  });
};

const getLastModifiedJobTime = (jobMap) => {
  const latest =
    max(
      Object.values(jobMap).map((job) => new Date(`${job.last_modified}Z`)),
    ) || new Date();

  latest.setSeconds(latest.getSeconds() - 3);
  return latest;
};

/**
 * Loops through the map of unclassified failures and checks if it is
 * within the enabled tiers and if the job should be shown. This essentially
 * gives us the difference in unclassified failures and, of those jobs, the
 * ones that have been filtered out
 */
const doRecalculateUnclassifiedCounts = (jobMap, router) => {
  const filterModel = new FilterModel({ pushRoute, router });
  const tiers = filterModel.urlParams.tier;
  let allUnclassifiedFailureCount = 0;
  let filteredUnclassifiedFailureCount = 0;

  Object.values(jobMap).forEach((job) => {
    if (isUnclassifiedFailure(job) && tiers.includes(String(job.tier))) {
      if (filterModel.showJob(job)) {
        filteredUnclassifiedFailureCount++;
      }
      allUnclassifiedFailureCount++;
    }
  });
  return {
    allUnclassifiedFailureCount,
    filteredUnclassifiedFailureCount,
  };
};

const addPushes = (
  data,
  pushList,
  jobMap,
  setFromchange,
  dispatch,
  router,
  oldBugSummaryMap,
) => {
  if (data.results.length > 0) {
    const pushIds = pushList.map((push) => push.id);
    const newPushList = [
      ...pushList,
      ...data.results.filter((push) => !pushIds.includes(push.id)),
    ];

    newPushList.sort((a, b) => b.push_timestamp - a.push_timestamp);
    const oldestPushTimestamp =
      newPushList[newPushList.length - 1].push_timestamp;

    const bugIds = getBugIds(data.results);

    const newStuff = {
      pushList: newPushList,
      oldestPushTimestamp,
      ...doRecalculateUnclassifiedCounts(jobMap, router),
      ...getRevisionTips(newPushList),
    };

    if (dispatch) getBugSummaryMap(bugIds, dispatch, oldBugSummaryMap);

    // since we fetched more pushes, we need to persist the push state in the URL.
    const updatedLastRevision = newPushList[newPushList.length - 1].revision;

    if (setFromchange && getUrlParam('fromchange') !== updatedLastRevision) {
      const params = new URLSearchParams(window.location.search);
      params.set('fromchange', updatedLastRevision);
      replaceLocation(params);
      // We are silently updating the url params so we don't trigger an unnecessary update
      // in componentDidUpdate, but we still want to update the ActiveFilters bar to this new change.
      window.dispatchEvent(new CustomEvent(thEvents.filtersUpdated));
    }

    return newStuff;
  }
  return {};
};

const fetchNewJobs = () => {
  return async (dispatch, getState) => {
    const {
      pushes: { pushList, jobMap },
    } = getState();

    if (!pushList.length) {
      // If we have no pushes, then no need to get jobs.
      return;
    }

    const pushIds = pushList.map((push) => push.id);
    const lastModified = getLastModifiedJobTime(jobMap);

    const resp = await JobModel.getList(
      {
        push_id__in: pushIds.join(','),
        last_modified__gt: lastModified.toISOString().replace('Z', ''),
      },
      { fetchAll: true },
    );
    const errors = processErrors([resp]);

    if (!errors.length) {
      // break the jobs up per push
      const { data } = resp;
      const jobs = data.reduce((acc, job) => {
        const pushJobs = acc[job.push_id] ? [...acc[job.push_id], job] : [job];
        return { ...acc, [job.push_id]: pushJobs };
      }, {});
      // If a job is selected, and one of the jobs we just fetched is the
      // updated version of that selected job, then send that with the event.
      const selectedTaskRun = getUrlParam('selectedTaskRun');
      const updatedSelectedJob = selectedTaskRun
        ? data.find((job) => getTaskRunStr(job) === selectedTaskRun)
        : null;

      window.dispatchEvent(
        new CustomEvent(thEvents.applyNewJobs, {
          detail: { jobs },
        }),
      );
      if (updatedSelectedJob) {
        dispatch(setSelectedJob(updatedSelectedJob));
      }
    } else {
      for (const error of errors) {
        notify(error, 'danger', { sticky: true });
      }
    }
  };
};

const doUpdateJobMap = (jobList, jobMap, decisionTaskMap, pushList) => {
  if (jobList.length) {
    // lodash ``keyBy`` is significantly faster than doing a ``reduce``
    return {
      jobMap: { ...jobMap, ...keyBy(jobList, 'id') },
      decisionTaskMap: {
        ...decisionTaskMap,
        ...keyBy(
          jobList
            .filter(
              (job) =>
                job.job_type_name.includes('Decision Task') &&
                job.result === 'success' &&
                job.job_type_symbol === 'D',
            )
            .map((job) => ({
              push_id: job.push_id,
              id: job.task_id,
              run: job.retry_id,
            })),
          'push_id',
        ),
      },
      jobsLoaded: pushList.every((push) => push.jobsLoaded),
    };
  }
  return {};
};

export const fetchPushes = (
  count = DEFAULT_PUSH_COUNT,
  setFromchange = false,
) => {
  return async (dispatch, getState) => {
    const {
      pushes: { pushList, jobMap, oldestPushTimestamp },
      router,
    } = getState();

    dispatch({ type: LOADING });

    const locationSearch = parseQueryParams(window.location.search);

    // Only pass supported query string params to this endpoint.
    const options = {
      ...pick(locationSearch, PUSH_FETCH_KEYS),
    };

    if (locationSearch.landoCommitID) {
      return dispatch({ type: ADD_PUSHES });
    }

    if (oldestPushTimestamp) {
      // If we have an oldestTimestamp, then this isn't our first fetch,
      // we're fetching more pushes.  We don't want to limit this fetch
      // by the current ``fromchange`` or ``tochange`` value.  Deleting
      // these params here do not affect the params on the location bar.
      delete options.fromchange;
      delete options.tochange;
      options.push_timestamp__lte = oldestPushTimestamp;
    }
    if (!options.fromchange) {
      options.count = count;
    }
    const { data, failureStatus } = await PushModel.getList(options);

    if (!failureStatus) {
      return dispatch({
        type: ADD_PUSHES,
        pushResults: addPushes(
          data.results.length ? data : { results: [] },
          pushList,
          jobMap,
          setFromchange,
          dispatch,
          router,
        ),
      });
    }
    dispatch(notify('Error retrieving push data!', 'danger', { sticky: true }));
    return {};
  };
};

export const pollPushes = () => {
  return async (dispatch, getState) => {
    const {
      pushes: { pushList, jobMap },
      router,
    } = getState();
    // these params will be passed in each time we poll to remain
    // within the constraints of the URL params
    const locationSearch = parseQueryParams(window.location.search);
    const pushPollingParams = PUSH_POLLING_KEYS.reduce(
      (acc, prop) =>
        locationSearch[prop] ? { ...acc, [prop]: locationSearch[prop] } : acc,
      {},
    );

    if (locationSearch.landoCommitID) {
      dispatch({ type: ADD_PUSHES });
    } else if (pushList.length === 1 && locationSearch.revision) {
      // If we are on a single revision, no need to poll for more pushes, but
      // we need to keep polling for jobs.
      dispatch(fetchNewJobs());
    } else {
      if (pushList.length) {
        // We have a range of pushes, but not bound to a single push,
        // so get only pushes newer than our latest.
        pushPollingParams.fromchange = pushList[0].revision;
      }
      // We will either have a ``revision`` param, but no push for it yet,
      // or a ``fromchange`` param because we have at least 1 push already.
      const { data, failureStatus } = await PushModel.getList(
        pushPollingParams,
      );

      if (!failureStatus) {
        dispatch({
          type: ADD_PUSHES,
          pushResults: addPushes(
            data.results.length ? data : { results: [] },
            pushList,
            jobMap,
            false,
            dispatch,
            router,
          ),
        });
        dispatch(fetchNewJobs());
      } else {
        dispatch(
          notify('Error fetching new push data', 'danger', { sticky: true }),
        );
      }
    }
  };
};

export const clearPushes = () => ({ type: CLEAR_PUSHES });

export const setPushes = (pushList, jobMap, router) => ({
  type: SET_PUSHES,
  pushResults: {
    pushList,
    jobMap,
    ...getRevisionTips(pushList),
    ...doRecalculateUnclassifiedCounts(jobMap, router),
    oldestPushTimestamp: pushList[pushList.length - 1].push_timestamp,
  },
});

export const recalculateUnclassifiedCounts = () => {
  return (dispatch, getState) => {
    const { router } = getState();
    return dispatch({
      type: RECALCULATE_UNCLASSIFIED_COUNTS,
      router,
    });
  };
};

export const updateJobMap = (jobList) => ({
  type: UPDATE_JOB_MAP,
  jobList,
});

export const updateRange = (range) => {
  return (dispatch, getState) => {
    const {
      pushes: { pushList, jobMap },
      router,
    } = getState();
    const { revision } = range;
    // change the range of pushes.  might already have them.
    const revisionPushList = revision
      ? pushList.filter((push) => push.revision === revision)
      : [];

    window.dispatchEvent(new CustomEvent(thEvents.clearPinboard));
    if (revisionPushList.length) {
      const { id: pushId } = revisionPushList[0];
      const revisionJobMap = {};
      for (const [id, job] of Object.entries(jobMap)) {
        if (job.push_id === pushId) {
          revisionJobMap[id] = job;
        }
      }
      if (getUrlParam('selectedJob') || getUrlParam('selectedTaskRun')) {
        dispatch(clearSelectedJob(0));
      }
      // We already have the one revision they're looking for,
      // so we can just erase everything else.
      dispatch(setPushes(revisionPushList, revisionJobMap, router));
    } else {
      // Clear and refetch everything.  We can't be sure if what we
      // already have is partially correct and just needs fill-in.
      dispatch(clearPushes());
      return dispatch(fetchPushes());
    }
  };
};

export const initialState = {
  pushList: [],
  bugSummaryMap: {},
  jobMap: {},
  decisionTaskMap: {},
  revisionTips: [],
  jobsLoaded: false,
  loadingPushes: true,
  oldestPushTimestamp: null,
  allUnclassifiedFailureCount: 0,
  filteredUnclassifiedFailureCount: 0,
};

export const reducer = (state = initialState, action) => {
  const { jobList, pushResults, setFromchange, router } = action;
  const { pushList, jobMap, decisionTaskMap } = state;

  switch (action.type) {
    case LOADING:
      return { ...state, loadingPushes: true };
    case ADD_PUSHES:
      return { ...state, loadingPushes: false, ...pushResults, setFromchange };
    case ADD_BUG_SUMMARIES:
      return { ...state, ...pushResults };
    case CLEAR_PUSHES:
      return { ...initialState };
    case SET_PUSHES:
      return { ...state, loadingPushes: false, ...pushResults };
    case RECALCULATE_UNCLASSIFIED_COUNTS:
      return { ...state, ...doRecalculateUnclassifiedCounts(jobMap, router) };
    case UPDATE_JOB_MAP:
      return {
        ...state,
        ...doUpdateJobMap(jobList, jobMap, decisionTaskMap, pushList),
      };
    default:
      return state;
  }
};
