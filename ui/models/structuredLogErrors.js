import { getProjectJobUrl } from '../helpers/location';

export default class StructuredLogErrorsModel {
  static get(jobId) {
    return fetch(getProjectJobUrl('/structured_log_errors/', jobId)).then(
      (resp) => (resp.ok ? resp.json() : []),
    );
  }
}
