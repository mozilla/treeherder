import { createQueryParams, getApiUrl } from '../helpers/url';

export default class JobDetailModel {
  static getJobDetails(params, signal) {
    return fetch(`${getApiUrl("/jobdetail/")}${createQueryParams(params)}`, { signal })
      .then(resp => resp.json().then(data => data.results));
  }
}
