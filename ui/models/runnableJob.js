import { getProjectUrl } from "../helpers/url";
import JobModel from './job';

const uri = getProjectUrl("/runnable_jobs/");

export default class RunnableJobModel {
  constructor(data) {
    Object.assign(this, data);
  }

  static getList(repoName, params) {
    return JobModel.getList(repoName, params, { uri });
  }
}
