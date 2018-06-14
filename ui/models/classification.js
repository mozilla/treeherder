import { createQueryParams, getProjectUrl } from '../helpers/url';
import { destroy, create } from '../helpers/http';

const uri = getProjectUrl('/note/');

export default class JobClassificationModel {
  // JobClassificationModel is the js counterpart of note
  constructor(data) {
    Object.assign(this, data);
  }

  static getList(params) {
    return fetch(`${uri}${createQueryParams(params)}`)
      .then(resp => resp.json().then(
        data => data.map(elem => new JobClassificationModel(elem))));
  }

  create() {
    return create(uri, this);
  }

  destroy() {
    return destroy(`${uri}${this.id}/`);
  }
}
