import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import pick from 'lodash/pick';
import keyBy from 'lodash/keyBy';
import max from 'lodash/max';

import { parseQueryParams, bugzillaBugsApi } from '../../helpers/url';
import { getUrlParam, replaceLocation } from '../../helpers/location';
import PushModel from '../../models/push';
import { getTaskRunStr, isUnclassifiedFailure } from '../../helpers/job';
import FilterModel from '../../models/filter';
import JobModel from '../../models/job';
import { thEvents } from '../../helpers/constants';
import { processErrors, getData } from '../../helpers/http';
import { updateUrlSearch } from '../../helpers/router';

import { notify } from './notificationStore';
import { clearJobViaUrl, setSelectedJob } from './selectedJobStore';

const DEFAULT_PUSH_COUNT = 10;
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

const getBugSummaryMap = async (bugIds, oldBugSummaryMap) => {
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

  usePushesStore.setState({ bugSummaryMap: result });
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
 * within the enabled tiers and if the job should be shown.
 */
const doRecalculateUnclassifiedCounts = (jobMap) => {
  const navigate = ({ search }) => updateUrlSearch(search);
  const filterModel = new FilterModel(navigate, window.location);
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

const addPushes = (data, pushList, jobMap, setFromchange, oldBugSummaryMap) => {
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
      ...doRecalculateUnclassifiedCounts(jobMap),
      ...getRevisionTips(newPushList),
    };

    getBugSummaryMap(bugIds, oldBugSummaryMap);

    const updatedLastRevision = newPushList[newPushList.length - 1].revision;

    if (setFromchange && getUrlParam('fromchange') !== updatedLastRevision) {
      const params = new URLSearchParams(window.location.search);
      params.set('fromchange', updatedLastRevision);
      replaceLocation(params);
      window.dispatchEvent(new CustomEvent(thEvents.filtersUpdated));
    }

    return newStuff;
  }
  return {};
};

const doUpdateJobMap = (jobList, jobMap, decisionTaskMap, pushList) => {
  if (jobList.length) {
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

export const initialState = {
  pushList: [],
  bugSummaryMap: {},
  jobMap: {},
  decisionTaskMap: {},
  revisionTips: [],
  jobsLoaded: false,
  loadingPushes: false,
  oldestPushTimestamp: null,
  allUnclassifiedFailureCount: 0,
  filteredUnclassifiedFailureCount: 0,
};

export const usePushesStore = create(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchPushes: async (
        count = DEFAULT_PUSH_COUNT,
        setFromchange = false,
      ) => {
        const { pushList, jobMap, oldestPushTimestamp, bugSummaryMap } = get();

        set({ loadingPushes: true });

        const locationSearch = parseQueryParams(window.location.search);

        const options = {
          ...pick(locationSearch, PUSH_FETCH_KEYS),
        };

        if (locationSearch.landoCommitID) {
          set({ loadingPushes: false });
          return;
        }

        if (oldestPushTimestamp) {
          delete options.fromchange;
          delete options.tochange;
          options.push_timestamp__lte = oldestPushTimestamp;
        }
        if (!options.fromchange) {
          options.count = count;
        }
        const { data, failureStatus } = await PushModel.getList(options);

        if (!failureStatus) {
          const pushResults = addPushes(
            data.results.length ? data : { results: [] },
            pushList,
            jobMap,
            setFromchange,
            bugSummaryMap,
          );
          set({ loadingPushes: false, ...pushResults });
        } else {
          notify('Error retrieving push data!', 'danger', { sticky: true });
          set({ loadingPushes: false });
        }
      },

      pollPushes: async () => {
        const { pushList, jobMap, bugSummaryMap, fetchNewJobs } = get();

        const locationSearch = parseQueryParams(window.location.search);
        const pushPollingParams = PUSH_POLLING_KEYS.reduce(
          (acc, prop) =>
            locationSearch[prop]
              ? { ...acc, [prop]: locationSearch[prop] }
              : acc,
          {},
        );

        if (locationSearch.landoCommitID) {
          // no-op
        } else if (pushList.length === 1 && locationSearch.revision) {
          fetchNewJobs();
        } else {
          if (pushList.length) {
            pushPollingParams.fromchange = pushList[0].revision;
          }
          const { data, failureStatus } =
            await PushModel.getList(pushPollingParams);

          if (!failureStatus) {
            const pushResults = addPushes(
              data.results.length ? data : { results: [] },
              pushList,
              jobMap,
              false,
              bugSummaryMap,
            );
            set({ loadingPushes: false, ...pushResults });
            fetchNewJobs();
          } else {
            notify('Error fetching new push data', 'danger', { sticky: true });
          }
        }
      },

      fetchNewJobs: async () => {
        const { pushList, jobMap } = get();

        if (!pushList.length) {
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
          const { data } = resp;
          const jobs = data.reduce((acc, job) => {
            const pushJobs = acc[job.push_id]
              ? [...acc[job.push_id], job]
              : [job];
            return { ...acc, [job.push_id]: pushJobs };
          }, {});

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
            setSelectedJob(updatedSelectedJob);
          }
        } else {
          for (const error of errors) {
            notify(error, 'danger', { sticky: true });
          }
        }
      },

      clearPushes: () => {
        set({ ...initialState });
      },

      setPushes: (pushList, jobMap) => {
        set({
          loadingPushes: false,
          pushList,
          jobMap,
          ...getRevisionTips(pushList),
          ...doRecalculateUnclassifiedCounts(jobMap),
          oldestPushTimestamp: pushList[pushList.length - 1].push_timestamp,
        });
      },

      recalculateUnclassifiedCounts: () => {
        const { jobMap } = get();
        set(doRecalculateUnclassifiedCounts(jobMap));
      },

      updateJobMap: (jobList) => {
        const { jobMap, decisionTaskMap, pushList } = get();
        set(doUpdateJobMap(jobList, jobMap, decisionTaskMap, pushList));
      },

      updateRange: (range) => {
        const { pushList, jobMap, clearPushes, fetchPushes, setPushes } = get();
        const { revision } = range;
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
          if (
            getUrlParam('selectedJob') ||
            getUrlParam('selectedTaskRun')
          ) {
            clearJobViaUrl();
          }
          setPushes(revisionPushList, revisionJobMap);
        } else {
          clearPushes();
          fetchPushes();
        }
      },
    }),
    { name: 'pushes-store' },
  ),
);

// Standalone functions for use outside React components
export const fetchPushes = (count, setFromchange) =>
  usePushesStore.getState().fetchPushes(count, setFromchange);
export const pollPushes = () => usePushesStore.getState().pollPushes();
export const clearPushes = () => usePushesStore.getState().clearPushes();
export const setPushes = (pushList, jobMap) =>
  usePushesStore.getState().setPushes(pushList, jobMap);
export const recalculateUnclassifiedCounts = () =>
  usePushesStore.getState().recalculateUnclassifiedCounts();
export const updateJobMap = (jobList) =>
  usePushesStore.getState().updateJobMap(jobList);
export const updateRange = (range) =>
  usePushesStore.getState().updateRange(range);
