import { getProjectJobUrl } from '../helpers/location';

export default class BugSuggestionsModel {
  static get(jobId, signal) {
    return fetch(getProjectJobUrl('/bug_suggestions/', jobId), {
      signal,
    }).then((resp) => resp.json());
  }
}
