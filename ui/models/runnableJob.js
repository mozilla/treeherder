import { getData } from '../helpers/http';
import { getRunnableJobsURL } from '../helpers/url';
import { escapeId } from '../helpers/aggregateId';

import JobModel from './job';

export default class RunnableJobModel {
  constructor(data) {
    Object.assign(this, data);
  }

  static async getList(repoName, params) {
    let rawJobs;
    /* Jobs are retried up to 5 times. Find the first successful one to
       download the list of runnable jobs. */
    for (let runNumber = 0; runNumber < 6; runNumber++) {
      const uri = getRunnableJobsURL(params.decision_task_id, runNumber);
      // eslint-disable-next-line no-await-in-loop
      const { data, failureStatus } = await getData(uri);
      if (!failureStatus) {
        rawJobs = data;
        break;
      }
    }
    if (!rawJobs) {
      return;
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
