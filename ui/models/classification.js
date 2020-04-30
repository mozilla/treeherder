import { destroy, create } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { createQueryParams } from '../helpers/url';

const uri = '/note/';

export default class JobClassificationModel {
  // JobClassificationModel is the js counterpart of note
  constructor(data) {
    Object.assign(this, data);
  }

  static getList(params) {
    return fetch(
      `${getProjectUrl(uri)}${createQueryParams(params)}`,
    ).then((resp) =>
      resp
        .json()
        .then((data) => data.map((elem) => new JobClassificationModel(elem))),
    );
  }

  create() {
    return create(getProjectUrl(uri), this);
  }

  destroy() {
    return destroy(`${getProjectUrl(uri)}${this.id}/`);
  }
}
