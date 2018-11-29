import { slugid } from 'taskcluster-client-web';

import { thMaxPushFetchSize } from '../helpers/constants';
import { getUrlParam } from '../helpers/location';
import taskcluster from '../helpers/taskcluster';
import { createQueryParams, getProjectUrl, pushEndpoint } from '../helpers/url';

import JobModel from './job';
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
  static getList(options = {}) {
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
    return fetch(
      `${getProjectUrl(pushEndpoint, repoName)}${createQueryParams(params)}`,
    );
  }

  static get(pk, options = {}) {
    const repoName = options.repo || getUrlParam('repo');
    return fetch(getProjectUrl(`${pushEndpoint}${pk}/`, repoName));
  }

  static getJobs(pushIds, options = {}) {
    const { lastModified, repo } = options;
    delete options.lastModified;
    delete options.repo;
    const params = {
      return_type: 'list',
      count: 2000,
      ...options,
    };

    if (!Array.isArray(pushIds)) {
      params.push_id = pushIds;
    } else {
      params.push_id__in = pushIds.join(',');
    }
    if (lastModified) {
      // XXX: should never happen, but maybe sometimes does? see bug 1287501
      if (!(lastModified instanceof Date)) {
        throw Error(
          `Invalid parameter passed to get job updates: ${lastModified}.  Please reload treeherder`,
        );
      }
      params.last_modified__gt = lastModified.toISOString().replace('Z', '');
    }
    return JobModel.getList(repo, params, { fetch_all: true });
  }

  static triggerMissingJobs(decisionTaskId) {
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
        () =>
          `Request sent to trigger missing jobs via actions.json (${actionTaskId})`,
      );
    });
  }

  static triggerAllTalosJobs(times, decisionTaskId) {
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

  static triggerNewJobs(buildernames, decisionTaskId) {
    const queue = taskcluster.getQueue();
    const url = queue.buildUrl(
      queue.getLatestArtifact,
      decisionTaskId,
      'public/full-task-graph.json',
    );

    return fetch(url).then(resp =>
      resp.json().then(graph => {
        // Build a mapping of buildbot buildername to taskcluster tasklabel for bbb tasks
        const builderToTask = Object.entries(graph).reduce(
          (currentMap, [key, value]) => {
            if (
              value &&
              value.task &&
              value.task.payload &&
              value.task.payload.buildername
            ) {
              currentMap[value.task.payload.buildername] = key;
            }
            return currentMap;
          },
          {},
        );
        const allLabels = Object.keys(graph);
        const tclabels = [];

        buildernames.forEach(name => {
          // The following has 2 cases that it accounts for
          // 1. The name is a taskcluster task label, in which case we pass it on
          // 2. The name is a buildbot buildername _scheduled_ through bbb, in which case we
          //    translate it to the taskcluster label that triggers it.
          name = builderToTask[name] || name;
          if (allLabels.indexOf(name) !== -1) {
            tclabels.push(name);
          }
        });
        if (tclabels.length === 0) {
          throw Error(`No tasks able to run for ${buildernames.join(', ')}`);
        }
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
            input: { tasks: tclabels },
            staticActionVariables: results.staticActionVariables,
          }).then(
            () =>
              `Request sent to trigger new jobs via actions.json (${actionTaskId})`,
          );
        });
      }),
    );
  }
}
