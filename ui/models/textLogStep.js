import { getProjectJobUrl } from '../helpers/urlHelper';

export default class TextLogStepModel {
  static get(jobId) {
    return fetch(getProjectJobUrl('/text_log_steps/', jobId))
      .then(resp => resp.json());
  }
}
