import groupBy from 'lodash/groupBy';

import { createQueryParams, getApiUrl } from '../helpers/url';
import { formatTaskclusterError } from '../helpers/errorMessage';
import { addAggregateFields } from '../helpers/job';
import { getProjectUrl } from '../helpers/location';
import { getData } from '../helpers/http';
import { getAction } from '../helpers/taskcluster';

import PushModel from './push';
import TaskclusterModel from './taskcluster';

const uri = '/jobs/';

// JobModel is the js counterpart of job
export default class JobModel {
  static async getList(options, config = {}) {
    // The `uri` config allows to fetch a list of jobs from an arbitrary
    // endpoint e.g. the similar jobs endpoint. It defaults to the job
    // list endpoint.
    const { fetchAll, uri: configUri } = config;
    const jobUri = configUri || getApiUrl(uri);
    const { data, failureStatus } = await getData(
      `${jobUri}${options ? createQueryParams(options) : ''}`,
    );

    if (!failureStatus) {
      const {
        results,
        job_property_names: jobPropertyNames,
        next: nextUrl,
      } = data;
      let itemList;
      let nextPagesJobs = [];

      if (fetchAll && nextUrl) {
        const page = new URLSearchParams(nextUrl.split('?')[1]).get('page');
        const newOptions = { ...options, page };
        const {
          data: nextData,
          failureStatus: nextFailureStatus,
        } = await JobModel.getList(newOptions, config);

        if (!nextFailureStatus) {
          nextPagesJobs = nextData;
        }
      }
      if (jobPropertyNames) {
        // the results came as list of fields
        // we need to convert them to objects
        itemList = results.map((elem) =>
          addAggregateFields(
            jobPropertyNames.reduce(
              (prev, prop, i) => ({ ...prev, [prop]: elem[i] }),
              {},
            ),
          ),
        );
      } else {
        itemList = results.map((jobObj) => addAggregateFields(jobObj));
      }
      return { data: [...itemList, ...nextPagesJobs], failureStatus: null };
    }
    return { data, failureStatus };
  }

  static get(repoName, pk, signal) {
    // a static method to retrieve a single instance of JobModel
    return fetch(`${getProjectUrl(uri, repoName)}${pk}/`, { signal }).then(
      async (response) => {
        if (response.ok) {
          const job = await response.json();
          return addAggregateFields(job);
        }
        const text = await response.text();
        throw Error(`Loading job with id ${pk} : ${text}`);
      },
    );
  }

  static getSimilarJobs(pk, options, config) {
    config = config || {};
    // The similar jobs endpoints returns the same type of objects as
    // the job list endpoint, so let's reuse the getList method logic.
    config.uri = `${getProjectUrl(uri)}${pk}/similar_jobs/`;
    return JobModel.getList(options, config);
  }

  static async retrigger(
    jobs,
    currentRepo,
    notify,
    times = 1,
    decisionTaskIdMap = null,
    testMode = false,
  ) {
    const jobTerm = jobs.length > 1 ? 'jobs' : 'job';
    try {
      notify(`Attempting to retrigger/add ${jobTerm} via actions.json`, 'info');

      const pushIds = [...new Set(jobs.map((job) => job.push_id))];
      const taskIdMap =
        decisionTaskIdMap ||
        (await PushModel.getDecisionTaskMap(pushIds, notify));
      const uniquePerPushJobs = groupBy(jobs, (job) => job.push_id);

      for (const [key, value] of Object.entries(uniquePerPushJobs)) {
        const decisionTaskId = taskIdMap[key].id;

        TaskclusterModel.load(decisionTaskId, null, currentRepo, testMode)
          .then(async (results) => {
            const taskLabels = value.map((job) => job.job_type_name);

            let retriggerAction = results.actions.find(
              (action) => action.name === 'retrigger-multiple',
            );
            let actionInput = {
              requests: [{ tasks: taskLabels, times }],
            };
            if (!retriggerAction) {
              // The `retrigger-multiple` action as introduced in Bug 1521032, to all the action
              // to control whether new task are created, or existing ones re-run. We fall back
              // to `add-new-jobs` to support pushing old revision to try, where the duplicating
              // the release tasks impacted is unlikely to cause problems.
              retriggerAction = getAction(results.actions, 'add-new-jobs');
              actionInput = {
                tasks: taskLabels,
              };
            }

            await TaskclusterModel.submit({
              action: retriggerAction,
              decisionTaskId,
              taskId: null,
              task: null,
              input: actionInput,
              staticActionVariables: results.staticActionVariables,
              currentRepo,
              testMode,
            })
              .then((actionTaskId) =>
                notify(
                  `Request sent to retrigger/add new jobs via actions.json (${actionTaskId})`,
                ),
              )
              .catch((error) => {
                notify(
                  `Retrigger failed with Decision task: ${decisionTaskId}: ${error}`,
                  'danger',
                  { sticky: true },
                );
              });
          })
          .catch((error) => notify(error.message, 'danger', { sticky: true }));
      }
    } catch (e) {
      notify(
        `Unable to retrigger/add ${jobTerm}.  ${formatTaskclusterError(e)}`,
        'danger',
        { sticky: true },
      );
    }
  }

  static async cancelAll(
    pushId,
    currentRepo,
    notify,
    decisionTask,
    testMode = false,
  ) {
    const { id: decisionTaskId } =
      decisionTask || (await PushModel.getDecisionTaskId(pushId, notify));
    let results;
    try {
      results = await TaskclusterModel.load(
        decisionTaskId,
        null,
        currentRepo,
        testMode,
      );
    } catch (e) {
      notify(e.message, 'danger', { sticky: true });
    }

    try {
      const cancelAllTask = getAction(results.actions, 'cancel-all');

      await TaskclusterModel.submit({
        action: cancelAllTask,
        decisionTaskId,
        input: {},
        staticActionVariables: results.staticActionVariables,
        currentRepo,
        testMode,
      });
    } catch (e) {
      // The full message is too large to fit in a Treeherder
      // notification box.
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }

    notify('Request sent to cancel all jobs via action.json', 'success');
  }

  static async cancel(
    jobs,
    currentRepo,
    notify,
    decisionTaskIdMap = null,
    testMode = false,
  ) {
    const jobTerm = jobs.length > 1 ? 'jobs' : 'job';
    const taskIdMap =
      decisionTaskIdMap ||
      (await PushModel.getDecisionTaskMap(
        [...new Set(jobs.map((job) => job.push_id))],
        notify,
      ));

    try {
      notify(
        `Attempting to cancel selected ${jobTerm} via actions.json`,
        'info',
      );

      /* eslint-disable no-await-in-loop */
      for (const job of jobs) {
        const decisionTaskId = taskIdMap[job.push_id].id;
        let results;
        try {
          results = await TaskclusterModel.load(
            decisionTaskId,
            job,
            currentRepo,
            testMode,
          );
        } catch (e) {
          notify(e.message, 'danger', { sticky: true });
        }

        try {
          const cancelTask = getAction(results.actions, 'cancel');

          await TaskclusterModel.submit({
            action: cancelTask,
            decisionTaskId,
            taskId: results.originalTaskId,
            input: {},
            staticActionVariables: results.staticActionVariables,
            currentRepo,
            testMode,
          });
        } catch (e) {
          // The full message is too large to fit in a Treeherder
          // notification box.
          notify(formatTaskclusterError(e), 'danger', { sticky: true });
        }
      }
      /* eslint-enable no-await-in-loop */

      notify(`Request sent to cancel ${jobTerm} via action.json`, 'success');
    } catch (e) {
      notify(`Unable to cancel ${jobTerm}`, 'danger', { sticky: true });
    }
  }
}
