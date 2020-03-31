import { createQueryParams, getApiUrl } from '../helpers/url';

// This API is being depreciated for uploaded artifact retrieval
// (use the getArtifactsUrl helper to fetch from taskcluster);
// see bug 1603249 for details
export default class JobDetailModel {
  static getJobDetails(params, signal) {
    return fetch(`${getApiUrl('/jobdetail/')}${createQueryParams(params)}`, {
      signal,
    }).then(resp => resp.json().then(data => data.results));
  }
}
