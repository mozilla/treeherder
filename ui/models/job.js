import { slugid } from 'taskcluster-client-web';
import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';

import { createQueryParams, getApiUrl } from '../helpers/url';
import { formatTaskclusterError } from '../helpers/errorMessage';
import { addAggregateFields } from '../helpers/job';
import { getProjectUrl } from '../helpers/location';
import { getData } from '../helpers/http';

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
      const { results, job_property_names, next: nextUrl } = data;
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
      if (job_property_names) {
        // the results came as list of fields
        // we need to convert them to objects
        itemList = results.map(elem =>
          addAggregateFields(
            job_property_names.reduce(
              (prev, prop, i) => ({ ...prev, [prop]: elem[i] }),
              {},
            ),
          ),
        );
      } else {
        itemList = results.map(job_obj => addAggregateFields(job_obj));
      }
      return { data: [...itemList, ...nextPagesJobs], failureStatus: null };
    }
    return { data, failureStatus };
  }

  static get(repoName, pk, signal) {
    // a static method to retrieve a single instance of JobModel
    return fetch(`${getProjectUrl(uri)}${pk}/`, { signal }).then(
      async response => {
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

  static async retrigger(jobs, repoName, notify, currentRepo, times = 1) {
    const jobTerm = jobs.length > 1 ? 'jobs' : 'job';

    try {
      notify(`Attempting to retrigger/add ${jobTerm} via actions.json`, 'info');

      const pushIds = [...new Set(jobs.map(job => job.push_id))];
      const taskIdMap = await PushModel.getDecisionTaskMap(pushIds, notify);
      const uniquePerPushJobs = groupBy(jobs, job => job.push_id);

      // eslint-disable-next-line no-unused-vars
      for (const [key, value] of Object.entries(uniquePerPushJobs)) {
        const decisionTaskId = taskIdMap[key].id;

        TaskclusterModel.load(decisionTaskId, null, currentRepo).then(
          async results => {
            const actionTaskId = slugid();
            const taskLabels = value.map(job => job.job_type_name);

            let retriggerAction = results.actions.find(
              action => action.name === 'retrigger-multiple',
            );
            let actionInput = {
              requests: [{ tasks: taskLabels, times }],
            };
            if (!retriggerAction) {
              // The `retrigger-multiple` action as introduced in Bug 1521032, to all the action
              // to control whether new task are created, or existing ones re-run. We fall back
              // to `add-new-jobs` to support pushing old revision to try, where the duplicating
              // the release tasks impacted is unlikely to cause problems.
              retriggerAction = results.actions.find(
                action => action.name === 'add-new-jobs',
              );
              actionInput = {
                tasks: taskLabels,
              };
            }

            await TaskclusterModel.submit({
              action: retriggerAction,
              actionTaskId,
              decisionTaskId,
              taskId: null,
              task: null,
              input: actionInput,
              staticActionVariables: results.staticActionVariables,
              currentRepo,
            })
              .then(() =>
                notify(
                  `Request sent to retrigger/add new jobs via actions.json (${actionTaskId})`,
                ),
              )
              .catch(error => {
                notify(`Retrigger failed: ${error}`, 'danger', {
                  sticky: true,
                });
              });
          },
        );
      }
    } catch (e) {
      notify(`Unable to retrigger/add ${jobTerm}`, 'danger', { sticky: true });
    }
  }

  static async cancelAll(pushId, repoName, notify, currentRepo) {
    const { id: decisionTaskId } = await PushModel.getDecisionTaskId(
      pushId,
      notify,
    );
    const results = await TaskclusterModel.load(
      decisionTaskId,
      null,
      currentRepo,
    );
    const cancelAllTask = results.actions.find(
      result => result.name === 'cancel-all',
    );

    try {
      await TaskclusterModel.submit({
        action: cancelAllTask,
        decisionTaskId,
        input: {},
        staticActionVariables: results.staticActionVariables,
        currentRepo,
      });
    } catch (e) {
      // The full message is too large to fit in a Treeherder
      // notification box.
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }

    notify('Request sent to cancel all jobs via action.json', 'success');
  }

  static async cancel(jobs, repoName, notify, currentRepo) {
    const jobTerm = jobs.length > 1 ? 'jobs' : 'job';
    const taskIdMap = await PushModel.getDecisionTaskMap(
      [...new Set(jobs.map(job => job.push_id))],
      notify,
    );
    // Only the selected job will have the ``taskcluster_metadata`` field
    // which has the task_id we need.  So we must fetch all the task_ids
    // for the jobs in this list.
    const jobIds = jobs.map(job => job.id);
    const { data, failureStatus } = await getData(
      `${getApiUrl('/taskclustermetadata/')}?job_ids=${jobIds.join(',')}`,
    );

    if (failureStatus) {
      notify('Unable to cancel: Error getting task ids for jobs.', 'danger', {
        sticky: true,
      });
      return;
    }
    const tcMetadataMap = keyBy(data, 'job');

    try {
      notify(
        `Attempting to cancel selected ${jobTerm} via actions.json`,
        'info',
      );

      /* eslint-disable no-await-in-loop */
      // eslint-disable-next-line no-unused-vars
      for (const job of jobs) {
        job.taskcluster_metadata = tcMetadataMap[job.id];
        const decisionTaskId = taskIdMap[job.push_id].id;
        const results = await TaskclusterModel.load(
          decisionTaskId,
          job,
          currentRepo,
        );
        const cancelTask = results.actions.find(
          result => result.name === 'cancel',
        );

        try {
          await TaskclusterModel.submit({
            action: cancelTask,
            decisionTaskId,
            taskId: results.originalTaskId,
            input: {},
            staticActionVariables: results.staticActionVariables,
            currentRepo,
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
