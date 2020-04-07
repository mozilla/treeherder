import { slugid } from 'taskcluster-client-web';
import pick from 'lodash/pick';

import { thMaxPushFetchSize } from '../helpers/constants';
import { getData } from '../helpers/http';
import { getProjectUrl, getUrlParam } from '../helpers/location';
import { createQueryParams, pushEndpoint } from '../helpers/url';
import { formatTaskclusterError } from '../helpers/errorMessage';
import { getAction } from '../helpers/taskcluster';

import TaskclusterModel from './taskcluster';

const convertDates = function convertDates(locationParams) {
  // support date ranges.  we must convert the strings to a timezone
  // appropriate timestamp
  if ('startdate' in locationParams) {
    locationParams.push_timestamp__gte =
      Date.parse(locationParams.startdate) / 1000;

    delete locationParams.startdate;
  }
  if ('enddate' in locationParams) {
    locationParams.push_timestamp__lt =
      Date.parse(locationParams.enddate) / 1000 + 84600;

    delete locationParams.enddate;
  }
  return locationParams;
};

export const decisionTaskIdCache = {};

export default class PushModel {
  static async getList(options = {}) {
    const transformedOptions = convertDates(options);
    const repoName = transformedOptions.repo;
    delete transformedOptions.repo;
    const params = {
      full: true,
      count: 10,
      ...transformedOptions,
    };

    if (transformedOptions.push_timestamp__lte) {
      // we will likely re-fetch the oldest we already have, but
      // that's not guaranteed.  There COULD be two pushes
      // with the same timestamp, theoretically.
      params.count++;
    }
    if (
      params.count > thMaxPushFetchSize ||
      transformedOptions.push_timestamp__gte ||
      transformedOptions.fromchange
    ) {
      // fetch the maximum number of pushes
      params.count = thMaxPushFetchSize;
    }
    return getData(
      `${getProjectUrl(pushEndpoint, repoName)}${createQueryParams(params)}`,
    );
  }

  static get(pk, options = {}) {
    const repoName = options.repo || getUrlParam('repo');
    return fetch(getProjectUrl(`${pushEndpoint}${pk}/`, repoName));
  }

  static async triggerMissingJobs(pushId, notify, decisionTask, currentRepo) {
    const decisionTaskId = decisionTask
      ? decisionTask.id
      : (await PushModel.getDecisionTaskId(pushId, notify)).id;

    return TaskclusterModel.load(decisionTaskId, null, currentRepo).then(
      results => {
        const actionTaskId = slugid();

        try {
          const missingTestsTask = getAction(
            results.actions,
            'run-missing-tests',
          );

          return TaskclusterModel.submit({
            action: missingTestsTask,
            actionTaskId,
            decisionTaskId,
            taskId: null,
            task: null,
            input: {},
            staticActionVariables: results.staticActionVariables,
            currentRepo,
          }).then(
            notify(
              `Request sent to trigger missing jobs (${actionTaskId})`,
              'success',
            ),
          );
        } catch (e) {
          // The full message is too large to fit in a Treeherder
          // notification box.
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        }
      },
    );
  }

  static triggerNewJobs(jobs, decisionTaskId, currentRepo) {
    return TaskclusterModel.load(decisionTaskId, null, currentRepo).then(
      results => {
        const actionTaskId = slugid();
        const addNewJobsTask = getAction(results.actions, 'add-new-jobs');

        return TaskclusterModel.submit({
          action: addNewJobsTask,
          actionTaskId,
          decisionTaskId,
          taskId: null,
          task: null,
          input: { tasks: jobs },
          staticActionVariables: results.staticActionVariables,
          currentRepo,
        }).then(
          () =>
            `Request sent to trigger new jobs via actions.json (${actionTaskId})`,
        );
      },
    );
  }

  static getHealth(repoName, revision) {
    return getData(
      getProjectUrl(`${pushEndpoint}health/?revision=${revision}`, repoName),
    );
  }

  static getHealthSummary(repoName, revision) {
    return getData(
      getProjectUrl(
        `${pushEndpoint}health_summary/?revision=${revision}`,
        repoName,
      ),
    );
  }

  static async getDecisionTaskId(pushId, notify) {
    const taskId = decisionTaskIdCache[pushId];

    if (taskId) {
      return taskId;
    }
    Object.assign(
      decisionTaskIdCache,
      await PushModel.getDecisionTaskMap([pushId], notify),
    );
    return decisionTaskIdCache[pushId];
  }

  static async getDecisionTaskMap(pushIds, notify) {
    // If any Push ids are not yet in the cache, then fetch them.
    // Otherwise just return the map since it has everything
    // that's needed.
    const cachedMap = pick(decisionTaskIdCache, pushIds);
    const missedIds = pushIds.filter(id => !cachedMap[id]);

    if (!missedIds.length) {
      return cachedMap;
    }

    // Some Push ids were not yet in the cache, so must fetch them.
    const { data, failureStatus } = await getData(
      getProjectUrl(`${pushEndpoint}decisiontask/?push_ids=${missedIds}`),
    );

    if (failureStatus) {
      const msg = `Error getting Gecko Decision Tasks for ids: ${missedIds}: ${failureStatus}: ${data}`;

      if (notify) {
        notify(msg, 'danger', { sticky: true });
      }
      throw Error(msg);
    }
    // Update the cache with the new push ids / decision task ids.
    Object.assign(decisionTaskIdCache, data);
    return { ...cachedMap, ...data };
  }
}
