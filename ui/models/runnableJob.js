import { getProjectUrl, getRunnableJobsURL } from '../helpers/url';
import { escapeId } from '../helpers/aggregateId';

import JobModel from './job';

export default class RunnableJobModel {
  constructor(data) {
    Object.assign(this, data);
  }

  static async getList(repoName, params) {
    let uri = getRunnableJobsURL(params.decision_task_id);
    let rawJobs = await fetch(uri).then(response => response.json());

    // TODO: Remove this fallback once the gz artifacts expire
    if (rawJobs.code === 'ResourceNotFound') {
      uri = getProjectUrl('/runnable_jobs/');
      rawJobs = await JobModel.getList(repoName, params, { uri });
      rawJobs.forEach(job => {
        job.push_id = params.push_id;
        job.id = escapeId(params.push_id + job.ref_data_name);
      });
      return rawJobs;
    }

    return Object.entries(rawJobs).map(
      ([key, value]) =>
        new JobModel({
          build_platform: value.platform || '',
          build_system_type: 'taskcluster',
          job_group_name: value.groupName || '',
          job_group_symbol: value.groupSymbol || '',
          job_type_name: key,
          job_type_symbol: value.symbol,
          platform: value.platform || '',
          platform_option: Object.keys(value.collection).join(' '),
          ref_data_name: key,
          state: 'runnable',
          result: 'runnable',
          push_id: params.push_id,
          id: escapeId(params.push_id + key),
        }),
    );
  }
}
