import { slugid } from 'taskcluster-client-web';

import { thMaxPushFetchSize } from '../helpers/constants';
import { getData } from '../helpers/http';
import { getProjectUrl, getUrlParam } from '../helpers/location';
import { createQueryParams, pushEndpoint } from '../helpers/url';

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
      transformedOptions.push_timestamp__gte
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

  static async triggerMissingJobs(pushId, notify) {
    const decisionTaskId = await PushModel.getDecisionTaskId(pushId, notify);

    return TaskclusterModel.load(decisionTaskId).then(results => {
      const actionTaskId = slugid();
      const missingTestsTask = results.actions.find(
        action => action.name === 'run-missing-tests',
      );

      return TaskclusterModel.submit({
        action: missingTestsTask,
        actionTaskId,
        decisionTaskId,
        taskId: null,
        task: null,
        input: {},
        staticActionVariables: results.staticActionVariables,
      }).then(
        notify(
          `Request sent to trigger missing jobs (${actionTaskId})`,
          'success',
        ),
      );
    });
  }

  static async triggerAllTalosJobs(times, pushId, notify) {
    const decisionTaskId = await PushModel.getDecisionTaskId(pushId, notify);

    return TaskclusterModel.load(decisionTaskId).then(results => {
      const actionTaskId = slugid();
      const allTalosTask = results.actions.find(
        action => action.name === 'run-all-talos',
      );

      return TaskclusterModel.submit({
        action: allTalosTask,
        actionTaskId,
        decisionTaskId,
        taskId: null,
        task: null,
        input: { times },
        staticActionVariables: results.staticActionVariables,
      }).then(
        () =>
          `Request sent to trigger all talos jobs ${times} time(s) via actions.json (${actionTaskId})`,
      );
    });
  }

  static triggerNewJobs(jobs, decisionTaskId) {
    return TaskclusterModel.load(decisionTaskId).then(results => {
      const actionTaskId = slugid();
      const addNewJobsTask = results.actions.find(
        action => action.name === 'add-new-jobs',
      );

      return TaskclusterModel.submit({
        action: addNewJobsTask,
        actionTaskId,
        decisionTaskId,
        taskId: null,
        task: null,
        input: { tasks: jobs },
        staticActionVariables: results.staticActionVariables,
      }).then(
        () =>
          `Request sent to trigger new jobs via actions.json (${actionTaskId})`,
      );
    });
  }

  static getHealth(repoName, revision) {
    return getData(
      getProjectUrl(`${pushEndpoint}health/?revision=${revision}`, repoName),
    );
  }

  static getHealthSummary(repoName, pushId) {
    return getData(
      getProjectUrl(`${pushEndpoint}${pushId}/health_summary/`, repoName),
    );
  }

  static async getDecisionTaskId(pushId, notify) {
    const taskIdMap = await PushModel.getDecisionTaskMap([pushId], notify);

    return taskIdMap[pushId];
  }

  static async getDecisionTaskMap(pushIds, notify) {
    const { data, failureStatus } = await getData(
      getProjectUrl(`${pushEndpoint}decisiontask/?push_ids=${pushIds}`),
    );

    if (failureStatus) {
      const msg = `Error getting Gecko Decision Task Ids: ${failureStatus}: ${data}`;

      if (notify) {
        notify(msg, 'danger', { sticky: true });
      }
      throw Error(msg);
    }
    return data;
  }
}
