

import { thPlatformMap } from '../js/constants';
import { createQueryParams, getProjectUrl } from '../helpers/url';
import { create } from '../helpers/http';

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
      .then(response => response.json().then(async (data) => {
        let item_list;
        let next_pages_jobs = [];
        // if the number of elements returned equals the page size, fetch the next pages
        if (fetch_all && (data.results.length === data.meta.count)) {
          const current_offset = parseInt(data.meta.offset);
          const page_size = parseInt(data.meta.count);
          const new_options = {
            ...options,
            offset: page_size + current_offset,
            count: page_size,
          };
          next_pages_jobs = await JobModel.getList(repoName, new_options, config);
        }
        if ('job_property_names' in data) {
          // the results came as list of fields
          // we need to convert them to objects
          item_list = data.results.map(elem => new JobModel(data.job_property_names.reduce((prev, prop, i) =>
                                                             ({ ...prev, [prop]: elem[i] }), {})));
        } else {
          item_list = data.results.map(job_obj => new JobModel(job_obj));
        }
        // next_pages_jobs is wrapped in a $q.when call because it could be
        // either a promise or a value
        return [...item_list, ...next_pages_jobs];
      }));
  }

  static get(repoName, pk, signal) {
    // a static method to retrieve a single instance of JobModel
    return fetch(`${uri}${pk}/`, { signal })
      .then(response => response.json().then(data => new JobModel(data)));
  }

  static getSimilarJobs(repoName, pk, options, config) {
    config = config || {};
    // The similar jobs endpoints returns the same type of objects as
    // the job list endpoint, so let's reuse the getList method logic.
    config.uri = `${uri}${pk}/similar_jobs/`;
    return JobModel.getList(repoName, options, config);
  }

  static retrigger(repoName, jobIds) {
    return create(`${uri}retrigger/`, { job_id_list: jobIds });
  }

  static cancel(repoName, jobIds) {
    return create(`${uri}cancel/`, { job_id_list: jobIds });
  }
}
