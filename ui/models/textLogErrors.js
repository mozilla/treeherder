import { getApiUrl } from '../helpers/url';
import { update } from "../helpers/http";

const uri = getApiUrl('/text-log-error/');

export default class TextLogErrorsModel {
  constructor(data) {
    if (data.metadata === null) {
      data.metadata = {};
    }
    Object.assign(this, data);
  }

  static verifyMany(body) {
    if (!body.length) {
      return Promise.resolve();
    }
    return update(uri, body).then(resp => resp.json());
  }
}
