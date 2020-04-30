import { getProjectUrl } from '../helpers/location';
import { createQueryParams } from '../helpers/url';

const uri = '/job-log-url/';

export default class JobLogUrlModel {
  // the options parameter is used to filter/limit the list of objects
  // ``signal`` is an AbortController signal.
  static getList(options, signal) {
    return fetch(`${getProjectUrl(uri)}${createQueryParams(options)}`, {
      signal,
    }).then((resp) => resp.json());
  }
}
