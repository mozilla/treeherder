import { createQueryParams, getProjectUrl } from '../helpers/url';

const uri = getProjectUrl('/job-log-url/');

export default class JobLogUrlModel {
  constructor(data) {
    Object.assign(this, data);
  }

  // the options parameter is used to filter/limit the list of objects
  // ``signal`` is an AbortController signal.
  static getList(options, signal) {
    return fetch(`${uri}${createQueryParams(options)}`, { signal })
      .then(resp => resp.json().then(data => (
        data.map((elem) => {
          const buildUrl = elem.url.slice(0, elem.url.lastIndexOf('/')) + '/';
          elem.buildUrl = buildUrl;
          return new JobLogUrlModel(elem);
        })
    )));
  }
}
