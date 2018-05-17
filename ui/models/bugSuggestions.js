import { getProjectJobUrl } from '../helpers/urlHelper';

export default class BugSuggestionsModel {
  static get(jobId) {
    return fetch(getProjectJobUrl('/bug_suggestions/', jobId))
      .then(resp => resp.json());
  }
}
