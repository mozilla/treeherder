import { createQueryParams, getProjectUrl } from "../helpers/url";
import { destroy, create } from "../helpers/http";

const uri = getProjectUrl("/bug-job-map/");

export default class BugJobMapModel {
  constructor(data) {
    Object.assign(this, data);
  }

  // the options parameter is used to filter/limit the list of objects
  static getList(options) {
    return fetch(`${uri}${createQueryParams(options)}`)
      .then(resp => resp.json().then(data => (
        data.map(elem => new BugJobMapModel(elem))
    )));
  }

  create() {
    return create(uri, this);
  }

  destroy() {
    return destroy(`${uri}${this.job_id}-${this.bug_id}/`);
  }
}
