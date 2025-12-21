import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import pick from 'lodash/pick';

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
import { setSelectedJob, clearSelectedJob } from './selectedJobStore';

const DEFAULT_PUSH_COUNT = 10;
// Keys that, if present on the url, must be passed into the push polling endpoint
const PUSH_POLLING_KEYS = ['tochange', 'enddate', 'revision', 'author'];
const PUSH_FETCH_KEYS = [...PUSH_POLLING_KEYS, 'fromchange', 'startdate'];

const getRevisionTips = (pushList) => {
  return pushList.map((push) => ({
    revision: push.revision,
    author: push.author,
    title: push.revisions[0].comments.split('\n')[0],
  }));
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

const fetchBugSummaries = async (bugIds, currentMap = {}) => {
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
  return { ...bugData, ...currentMap };
};

const getLastModifiedJobTime = (pushList) => {
  let maxTime = null;
  for (const push of pushList) {
    for (const job of push.jobs || []) {
      const jobTime = new Date(`${job.last_modified}Z`);
      if (!maxTime || jobTime > maxTime) {
        maxTime = jobTime;
      }
    }
  }
  if (maxTime) {
    maxTime.setSeconds(maxTime.getSeconds() - 3);
  }
  return maxTime || new Date();
};

/**
 * Calculate unclassified counts across all jobs in all pushes
 */
const doRecalculateUnclassifiedCounts = (pushList) => {
  // Create a minimal navigate function for FilterModel
  const navigate = ({ search }) => updateUrlSearch(search);
  const filterModel = new FilterModel(navigate, window.location);
  const tiers = filterModel.urlParams.tier;
  let allUnclassifiedFailureCount = 0;
  let filteredUnclassifiedFailureCount = 0;

  for (const push of pushList) {
    for (const job of push.jobs || []) {
      if (isUnclassifiedFailure(job) && tiers.includes(String(job.tier))) {
        if (filterModel.showJob(job)) {
          filteredUnclassifiedFailureCount++;
        }
        allUnclassifiedFailureCount++;
      }
    }
  }
  return {
    allUnclassifiedFailureCount,
    filteredUnclassifiedFailureCount,
  };
};

/**
 * Build the jobMap from all jobs in all pushes (for compatibility during migration)
 */
const buildJobMap = (pushList) => {
  const jobMap = {};
  for (const push of pushList) {
    for (const job of push.jobs || []) {
      jobMap[job.id] = job;
    }
  }
  return jobMap;
};

/**
 * Build the decision task map from jobs
 */
const buildDecisionTaskMap = (pushList) => {
  const decisionTaskMap = {};
  for (const push of pushList) {
    for (const job of push.jobs || []) {
      if (
        job.job_type_name.includes('Decision Task') &&
        job.result === 'success' &&
        job.job_type_symbol === 'D'
      ) {
        decisionTaskMap[push.id] = {
          push_id: push.id,
          id: job.task_id,
          run: job.retry_id,
        };
        break;
      }
    }
  }
  return decisionTaskMap;
};

export const usePushStore = create(
  devtools(
    (set, get) => ({
      pushList: [],
      bugSummaryMap: {},
      jobMap: {}, // Kept for compatibility during migration
      decisionTaskMap: {},
      revisionTips: [],
      jobsLoaded: false,
      loadingPushes: false,
      oldestPushTimestamp: null,
      allUnclassifiedFailureCount: 0,
      filteredUnclassifiedFailureCount: 0,

      // === Getters ===
      getJobById: (id) => {
        for (const push of get().pushList) {
          const job = (push.jobs || []).find((j) => j.id === id);
          if (job) return job;
        }
        return null;
      },

      getJobByTaskRun: (taskId, retryId) => {
        for (const push of get().pushList) {
          const job = (push.jobs || []).find(
            (j) => j.task_id === taskId && j.retry_id === retryId,
          );
          if (job) return job;
        }
        return null;
      },

      getPushJobs: (pushId) => {
        const push = get().pushList.find((p) => p.id === pushId);
        return push?.jobs || [];
      },

      // === Actions ===
      setLoading: (loading) => set({ loadingPushes: loading }),

      clearPushes: () =>
        set({
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
        }),

      setPushes: (newPushList) => {
        const jobMap = buildJobMap(newPushList);
        const counts = doRecalculateUnclassifiedCounts(newPushList);
        const decisionTaskMap = buildDecisionTaskMap(newPushList);
        set({
          pushList: newPushList,
          jobMap,
          decisionTaskMap,
          revisionTips: getRevisionTips(newPushList),
          oldestPushTimestamp: newPushList.length
            ? newPushList[newPushList.length - 1].push_timestamp
            : null,
          ...counts,
        });
      },

      addPushes: (newPushes, setFromchange = false) => {
        const { pushList, bugSummaryMap } = get();

        if (newPushes.length === 0) {
          set({ loadingPushes: false });
          return;
        }

        const pushIds = new Set(pushList.map((push) => push.id));
        const filteredNewPushes = newPushes.filter(
          (push) => !pushIds.has(push.id),
        );
        const mergedList = [...pushList, ...filteredNewPushes];
        mergedList.sort((a, b) => b.push_timestamp - a.push_timestamp);

        const oldestPushTimestamp =
          mergedList[mergedList.length - 1].push_timestamp;
        const jobMap = buildJobMap(mergedList);
        const counts = doRecalculateUnclassifiedCounts(mergedList);
        const decisionTaskMap = buildDecisionTaskMap(mergedList);
        const bugIds = getBugIds(newPushes);

        // Fetch bug summaries asynchronously
        if (bugIds.size > 0) {
          fetchBugSummaries(bugIds, bugSummaryMap).then((newBugSummaryMap) => {
            set({ bugSummaryMap: newBugSummaryMap });
          });
        }

        // Update fromchange URL param if needed
        if (setFromchange) {
          const updatedLastRevision =
            mergedList[mergedList.length - 1].revision;
          if (getUrlParam('fromchange') !== updatedLastRevision) {
            const params = new URLSearchParams(window.location.search);
            params.set('fromchange', updatedLastRevision);
            replaceLocation(params);
            window.dispatchEvent(new CustomEvent(thEvents.filtersUpdated));
          }
        }

        set({
          pushList: mergedList,
          jobMap,
          decisionTaskMap,
          oldestPushTimestamp,
          revisionTips: getRevisionTips(mergedList),
          loadingPushes: false,
          ...counts,
        });
      },

      updatePushJobs: (pushId, jobs) => {
        const { pushList } = get();
        const newPushList = pushList.map((push) => {
          if (push.id !== pushId) return push;

          const existingJobs = push.jobs || [];
          const newJobIds = new Set(jobs.map((j) => j.id));
          const filteredExisting = existingJobs.filter(
            (j) => !newJobIds.has(j.id),
          );
          const mergedJobs = [...filteredExisting, ...jobs].map((job) => ({
            ...job,
            task_run: getTaskRunStr(job),
          }));

          return {
            ...push,
            jobs: mergedJobs,
            jobsLoaded: true,
          };
        });

        const jobMap = buildJobMap(newPushList);
        const counts = doRecalculateUnclassifiedCounts(newPushList);
        const decisionTaskMap = buildDecisionTaskMap(newPushList);
        const jobsLoaded = newPushList.every((push) => push.jobsLoaded);

        set({
          pushList: newPushList,
          jobMap,
          decisionTaskMap,
          jobsLoaded,
          ...counts,
        });
      },

      recalculateUnclassifiedCounts: () => {
        const { pushList } = get();
        const counts = doRecalculateUnclassifiedCounts(pushList);
        set(counts);
      },

      // === Async Actions ===
      fetchPushes: async (
        count = DEFAULT_PUSH_COUNT,
        setFromchange = false,
      ) => {
        const { oldestPushTimestamp } = get();

        set({ loadingPushes: true });

        const locationSearch = parseQueryParams(window.location.search);
        const options = { ...pick(locationSearch, PUSH_FETCH_KEYS) };

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
          get().addPushes(data.results || [], setFromchange);
        } else {
          notify('Error retrieving push data!', 'danger', { sticky: true });
          set({ loadingPushes: false });
        }
      },

      fetchNewJobs: async () => {
        const { pushList } = get();

        if (!pushList.length) return;

        const pushIds = pushList.map((push) => push.id);
        const lastModified = getLastModifiedJobTime(pushList);

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
          // Group jobs by push_id
          const jobsByPush = data.reduce((acc, job) => {
            const pushJobs = acc[job.push_id]
              ? [...acc[job.push_id], job]
              : [job];
            return { ...acc, [job.push_id]: pushJobs };
          }, {});

          // Dispatch event for Push components to update (during migration)
          window.dispatchEvent(
            new CustomEvent(thEvents.applyNewJobs, {
              detail: { jobs: jobsByPush },
            }),
          );

          // Also update the selected job if it was updated
          const selectedTaskRun = getUrlParam('selectedTaskRun');
          const updatedSelectedJob = selectedTaskRun
            ? data.find((job) => getTaskRunStr(job) === selectedTaskRun)
            : null;
          if (updatedSelectedJob) {
            setSelectedJob(updatedSelectedJob);
          }
        } else {
          for (const error of errors) {
            notify(error, 'danger', { sticky: true });
          }
        }
      },

      pollPushes: async () => {
        const { pushList, fetchNewJobs } = get();
        const locationSearch = parseQueryParams(window.location.search);
        const pushPollingParams = PUSH_POLLING_KEYS.reduce(
          (acc, prop) =>
            locationSearch[prop]
              ? { ...acc, [prop]: locationSearch[prop] }
              : acc,
          {},
        );

        if (locationSearch.landoCommitID) {
          return;
        }

        if (pushList.length === 1 && locationSearch.revision) {
          // Single revision, just poll for new jobs
          fetchNewJobs();
        } else {
          if (pushList.length) {
            pushPollingParams.fromchange = pushList[0].revision;
          }

          const { data, failureStatus } = await PushModel.getList(
            pushPollingParams,
          );

          if (!failureStatus) {
            get().addPushes(data.results || [], false);
            fetchNewJobs();
          } else {
            notify('Error fetching new push data', 'danger', { sticky: true });
          }
        }
      },

      updateRange: (range) => {
        const { pushList, setPushes, clearPushes, fetchPushes } = get();
        const { revision } = range;

        const revisionPushList = revision
          ? pushList.filter((push) => push.revision === revision)
          : [];

        window.dispatchEvent(new CustomEvent(thEvents.clearPinboard));

        if (revisionPushList.length) {
          if (getUrlParam('selectedJob') || getUrlParam('selectedTaskRun')) {
            clearSelectedJob(0);
          }
          setPushes(revisionPushList);
        } else {
          clearPushes();
          fetchPushes();
        }
      },
    }),
    { name: 'push-store' },
  ),
);

// Standalone functions for use outside React components
export const fetchPushes = (count, setFromchange) =>
  usePushStore.getState().fetchPushes(count, setFromchange);
export const pollPushes = () => usePushStore.getState().pollPushes();
export const updateRange = (range) =>
  usePushStore.getState().updateRange(range);
export const clearPushes = () => usePushStore.getState().clearPushes();
export const recalculateUnclassifiedCounts = () =>
  usePushStore.getState().recalculateUnclassifiedCounts();
export const updatePushJobs = (pushId, jobs) =>
  usePushStore.getState().updatePushJobs(pushId, jobs);

// For compatibility with existing code that uses updateJobMap
export const updateJobMap = (jobList) => {
  // Add jobs to the jobMap directly
  // This directly updates the jobMap without changing pushList
  // to maintain backwards compatibility with existing job loading flow
  if (!jobList || jobList.length === 0) return;

  const currentJobMap = usePushStore.getState().jobMap || {};
  const newJobMap = { ...currentJobMap };

  jobList.forEach((job) => {
    newJobMap[job.id] = job;
  });

  usePushStore.setState({ jobMap: newJobMap });
  usePushStore.getState().recalculateUnclassifiedCounts();
};
