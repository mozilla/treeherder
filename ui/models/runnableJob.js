import { addAggregateFields } from '../helpers/job';
import { getRunnableJobsURL } from '../helpers/url';
import { escapeId } from '../helpers/aggregateId';

export default class RunnableJobModel {
  constructor(data) {
    Object.assign(this, data);
  }

  static async getList(repoName, params) {
    const uri = getRunnableJobsURL(params.decision_task_id);
    const rawJobs = await fetch(uri).then(response => response.json());

    return Object.entries(rawJobs).map(([key, value]) =>
      addAggregateFields({
        build_platform: value.platform || '',
        build_system_type: 'taskcluster',
        job_group_name: value.groupName || '',
        job_group_symbol: value.groupSymbol || '',
        job_type_name: key,
        job_type_symbol: value.symbol,
        platform: value.platform || '',
        platform_option: Object.keys(value.collection).join(' '),
        signature: key,
        state: 'runnable',
        result: 'runnable',
        push_id: params.push_id,
        id: escapeId(params.push_id + key),
      }),
    );
  }
}
