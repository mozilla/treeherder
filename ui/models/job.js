import { slugid } from 'taskcluster-client-web';
import groupBy from 'lodash/groupBy';

import { thPlatformMap } from '../helpers/constants';
import { createQueryParams } from '../helpers/url';
import { formatTaskclusterError } from '../helpers/errorMessage';
import { getProjectUrl } from '../helpers/location';

import PushModel from './push';
import TaskclusterModel from './taskcluster';

const uri = getProjectUrl('/jobs/');

// JobModel is the js counterpart of job
export default class JobModel {
  constructor(props) {
    Object.assign(this, props);
  }

  getTitle() {
    // we want to join the group and type information together
    // so we can search for it as one token (useful when
    // we want to do a search on something like `fxup-esr(`)
    let symbolInfo = this.job_group_symbol === '?' ? '' : this.job_group_symbol;
    symbolInfo += `(${this.job_type_symbol})`;

    return [
      thPlatformMap[this.platform] || this.platform,
      this.platform_option,
      this.job_group_name === 'unknown' ? undefined : this.job_group_name,
      this.job_type_name,
      symbolInfo,
    ]
      .filter(item => typeof item !== 'undefined')
      .join(' ');
  }

  getSearchStr() {
    return [
      this.getTitle(),
      this.ref_data_name,
      this.signature !== this.ref_data_name ? this.signature : undefined,
    ]
      .filter(item => typeof item !== 'undefined')
      .join(' ');
  }

  static getList(options, config) {
    // a static method to retrieve a list of JobModel
    config = config || {};
    const fetch_all = config.fetch_all || false;
    // The `uri` config allows to fetch a list of jobs from an arbitrary
    // endpoint e.g. the similar jobs endpoint. It defaults to the job
    // list endpoint.
    const jobUri = config.uri || uri;

    return fetch(`${jobUri}${options ? createQueryParams(options) : ''}`).then(
      async resp => {
        if (resp.ok) {
          const data = await resp.json();
          let itemList;
          let nextPagesJobs = [];

          // if the number of elements returned equals the page size, fetch the next pages
          if (fetch_all && data.results.length === data.meta.count) {
            const count = parseInt(data.meta.count, 10);
            const offset = parseInt(data.meta.offset, 10) + count;
            const newOptions = { ...options, offset, count };

            nextPagesJobs = await JobModel.getList(newOptions, config);
          }
          if ('job_property_names' in data) {
            // the results came as list of fields
            // we need to convert them to objects
            itemList = data.results.map(
              elem =>
                new JobModel(
                  data.job_property_names.reduce(
                    (prev, prop, i) => ({ ...prev, [prop]: elem[i] }),
                    {},
                  ),
                ),
            );
          } else {
            itemList = data.results.map(job_obj => new JobModel(job_obj));
          }
          return [...itemList, ...nextPagesJobs];
        }
        const text = await resp.text();
        throw Error(text);
      },
    );
  }

  static get(repoName, pk, signal) {
    // a static method to retrieve a single instance of JobModel
    return fetch(`${uri}${pk}/`, { signal }).then(async response => {
      if (response.ok) {
        const job = await response.json();
        return new JobModel(job);
      }
      const text = await response.text();
      throw Error(`Loading job with id ${pk} : ${text}`);
    });
  }

  static getSimilarJobs(pk, options, config) {
    config = config || {};
    // The similar jobs endpoints returns the same type of objects as
    // the job list endpoint, so let's reuse the getList method logic.
    config.uri = `${uri}${pk}/similar_jobs/`;
    return JobModel.getList(options, config);
  }

  static async retrigger(jobs, repoName, notify, times = 1) {
    const jobTerm = jobs.length > 1 ? 'jobs' : 'job';

    try {
      notify(`Attempting to retrigger/add ${jobTerm} via actions.json`, 'info');

      const pushIds = [...new Set(jobs.map(job => job.push_id))];
      const taskIdMap = await PushModel.getDecisionTaskMap(pushIds, notify);
      const uniquePerPushJobs = groupBy(jobs, job => job.push_id);

      for (const [key, value] of Object.entries(uniquePerPushJobs)) {
        const decisionTaskId = taskIdMap[key];

        TaskclusterModel.load(decisionTaskId).then(async results => {
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
          })
            .then(() =>
              notify(
                `Request sent to retrigger/add new jobs via actions.json (${actionTaskId})`,
              ),
            )
            .catch(error => {
              notify(`Retrigger failed: ${error}`, 'danger', { sticky: true });
            });
        });
      }
    } catch (e) {
      notify(`Unable to retrigger/add ${jobTerm}`, 'danger', { sticky: true });
    }
  }

  static async cancelAll(pushId, repoName, notify) {
    const decisionTaskId = await PushModel.getDecisionTaskId(pushId, notify);
    const results = await TaskclusterModel.load(decisionTaskId);
    const cancelAllTask = results.actions.find(
      result => result.name === 'cancel-all',
    );

    try {
      await TaskclusterModel.submit({
        action: cancelAllTask,
        decisionTaskId,
        input: {},
        staticActionVariables: results.staticActionVariables,
      });
    } catch (e) {
      // The full message is too large to fit in a Treeherder
      // notification box.
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    }

    notify('Request sent to cancel all jobs via action.json', 'success');
  }

  static async cancel(jobs, repoName, notify) {
    const jobTerm = jobs.length > 1 ? 'jobs' : 'job';
    const taskIdMap = await PushModel.getDecisionTaskMap(
      [...new Set(jobs.map(job => job.push_id))],
      notify,
    );

    try {
      notify(
        `Attempting to cancel selected ${jobTerm} via actions.json`,
        'info',
      );

      /* eslint-disable no-await-in-loop */
      for (const job of jobs) {
        const decisionTaskId = taskIdMap[job.push_id];
        const results = await TaskclusterModel.load(decisionTaskId, job);
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
