import { addAggregateFields } from '../helpers/job';
import { getRunnableJobsURL } from '../helpers/url';
import { escapeId } from '../helpers/aggregateId';

export default class RunnableJobModel {
  constructor(data) {
    Object.assign(this, data);
  }

  static async getList(repoName, params) {
    const { pushID, decisionTask } = params;
    const uri = getRunnableJobsURL(decisionTask);
    const rawJobs = await fetch(uri).then(response => response.json());

    return Object.entries(rawJobs).map(([key, value]) =>
      addAggregateFields({
        build_platform: value.platform || '',
        build_system_type: 'taskcluster',
        jobGroupName: value.groupName || '',
        jobGroupSymbol: value.groupSymbol || '',
        jobTypeName: key,
        jobTypeSymbol: value.symbol,
        platform: value.platform || '',
        platform_option: Object.keys(value.collection).join(' '),
        signature: key,
        state: 'runnable',
        result: 'runnable',
        pushID,
        id: escapeId(pushID + key),
      }),
    );
  }
}
