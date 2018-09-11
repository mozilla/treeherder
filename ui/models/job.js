import { thPlatformMap } from '../js/constants';
import { createQueryParams, getProjectUrl } from '../helpers/url';
import { formatTaskclusterError } from '../helpers/errorMessage';
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
    let symbolInfo = (this.job_group_symbol === '?') ? '' :
      this.job_group_symbol;
    symbolInfo += '(' + this.job_type_symbol + ')';

    return [
      thPlatformMap[this.platform] || this.platform,
      this.platform_option,
      (this.job_group_name === 'unknown') ? undefined : this.job_group_name,
      this.job_type_name,
      symbolInfo,
    ].filter(item => typeof item !== 'undefined').join(' ');
  }

  getSearchStr() {
    return [
      this.getTitle(),
      this.ref_data_name,
      (this.signature !== this.ref_data_name) ? this.signature : undefined,
    ].filter(item => typeof item !== 'undefined').join(' ');
  }

  static getList(repoName, options, config) {
    // a static method to retrieve a list of JobModel
    config = config || {};
    const fetch_all = config.fetch_all || false;
    // The `uri` config allows to fetch a list of jobs from an arbitrary
    // endpoint e.g. the similar jobs endpoint. It defaults to the job
    // list endpoint.
    const jobUri = config.uri || uri;

    return fetch(`${jobUri}${options ? createQueryParams(options) : ''}`)
      .then(async (resp) => {
        if (resp.ok) {
          const data = await resp.json();
          let itemList;
          let nextPagesJobs = [];

          // if the number of elements returned equals the page size, fetch the next pages
          if (fetch_all && (data.results.length === data.meta.count)) {
            const count = parseInt(data.meta.count);
            const offset = parseInt(data.meta.offset) + count;
            const newOptions = { ...options, offset, count };

            nextPagesJobs = await JobModel.getList(repoName, newOptions, config);
          }
          if ('job_property_names' in data) {
            // the results came as list of fields
            // we need to convert them to objects
            itemList = data.results.map(elem => new JobModel(
              data.job_property_names.reduce((prev, prop, i) => ({ ...prev, [prop]: elem[i] }), {}),
            ));
          } else {
            itemList = data.results.map(job_obj => new JobModel(job_obj));
          }
          return [...itemList, ...nextPagesJobs];
        }
        const text = await resp.text();
        throw Error(text);
      });
  }

  static get(repoName, pk, signal) {
    // a static method to retrieve a single instance of JobModel
    return fetch(`${uri}${pk}/`, { signal })
      .then(async (response) => {
        if (response.ok) {
          const job = await response.json();
          return new JobModel(job);
        }
        const text = await response.text();
        throw Error(`Loading job with id ${pk} : ${text}`);
      });
  }

  static getSimilarJobs(repoName, pk, options, config) {
    config = config || {};
    // The similar jobs endpoints returns the same type of objects as
    // the job list endpoint, so let's reuse the getList method logic.
    config.uri = `${uri}${pk}/similar_jobs/`;
    return JobModel.getList(repoName, options, config);
  }

  static retrigger(jobIds, repoName, ThResultSetStore, thNotify, notifyAfterEachRetrigger = false) {
    try {
      jobIds.forEach(async (id) => {
        const job = await JobModel.get(repoName, id);
        const decisionTaskId = await ThResultSetStore.getGeckoDecisionTaskId(job.result_set_id);
        const results = await TaskclusterModel.load(decisionTaskId, job);
        const retriggerTask = results && results.actions.find(result => result.name === 'retrigger');

        if (retriggerTask) {
          try {
            await TaskclusterModel.submit({
              action: retriggerTask,
              decisionTaskId,
              taskId: results.originalTaskId,
              input: {},
              staticActionVariables: results.staticActionVariables,
            });

            if (notifyAfterEachRetrigger) {
              thNotify.send(
                'Request sent to retrigger job via actions.json',
                'success');
            }
          } catch (e) {
            // The full message is too large to fit in a Treeherder
            // notification box.
            thNotify.send(
              formatTaskclusterError(e),
              'danger',
              { sticky: true });
          }
        }
      });
    } catch (e) {
      const message = jobIds.length > 1 ? 'Unable to retrigger all jobs' : 'Unable to retrigger this job type';

      thNotify.send(message, 'danger', { sticky: true });
    }
  }

  static cancel(jobIds, repoName, ThResultSetStore, thNotify, notifyAfterEachCancel = false) {
    try {
      jobIds.forEach(async (id) => {
        const job = await JobModel.get(repoName, id);
        const decisionTaskId = await ThResultSetStore.getGeckoDecisionTaskId(job.result_set_id);
        const results = await TaskclusterModel.load(decisionTaskId, job);
        const cancelTask = results && results.actions.find(result => result.name === 'cancel');

        if (cancelTask) {
          try {
            await TaskclusterModel.submit({
              action: cancelTask,
              decisionTaskId,
              taskId: results.originalTaskId,
              input: {},
              staticActionVariables: results.staticActionVariables,
            });

            if (notifyAfterEachCancel) {
              thNotify.send(
                'Request sent to cancel job via actions.json',
                'success');
            }
          } catch (e) {
            // The full message is too large to fit in a Treeherder
            // notification box.
            thNotify.send(
              formatTaskclusterError(e),
              'danger',
              { sticky: true });
          }
        }
      });
    } catch (e) {
      const message = jobIds.length > 1 ? 'Unable to cancel all jobs' : 'Unable to cancel this job type';

      thNotify.send(message, 'danger', { sticky: true });
    }
  }
}
