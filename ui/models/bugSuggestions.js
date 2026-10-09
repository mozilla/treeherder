import { getProjectJobUrl } from '../helpers/location';
import { create } from '../helpers/http';

export default class BugSuggestionsModel {
  static get(jobId, signal) {
    return fetch(getProjectJobUrl('/bug_suggestions/', jobId), {
      signal,
    }).then((resp) => resp.json());
  }

  // Bug suggestions for failure lines given as text, one per line, in order.
  static getForLines(jobId, lines, signal) {
    return create(
      getProjectJobUrl('/line_bug_suggestions/', jobId),
      { lines },
      { signal },
    );
  }
}
