import React from 'react';
import { Provider } from 'react-redux';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
} from '@testing-library/react';

import PushJobs from '../../../ui/job-view/pushes/PushJobs';
import FilterModel from '../../../ui/models/filter';
import { store } from '../../../ui/job-view/redux/store';
import { PinnedJobs } from '../../../ui/job-view/context/PinnedJobs';
import { getUrlParam, setUrlParam } from '../../../ui/helpers/location';
import JobModel from '../../../ui/models/job';

const testPush = {
  id: 494796,
  revision: '1252c6014d122d48c6782310d5c3f4ae742751cb',
  author: 'reviewbot',
  revisions: [
    {
      result_set_id: 494796,
      repository_id: 4,
      revision: '1252c6014d122d48c6782310d5c3f4ae742751cb',
      author: 'pulselistener',
      comments:
        'try_task_config for code-review\nDifferential Diff: PHID-DIFF-iql6zm5yinpmva7jhjln',
    },
  ],
  revision_count: 10,
  push_timestamp: 1560354779,
  repository_id: 4,
  jobsLoaded: true,
};

const testPlatforms = [
  {
    name: 'Linux x64',
    option: 'opt',
    groups: [
      {
        name: 'Coverity Static Analysis',
        tier: 2,
        symbol: 'coverity',
        mapKey: '494796coverity2linux64opt',
        jobs: [
          new JobModel({
            build_architecture: '-',
            build_os: '-',
            build_platform: 'linux64',
            build_platform_id: 106,
            build_system_type: 'taskcluster',
            end_timestamp: 1560356302,
            failure_classification_id: 1,
            id: 250970255,
            job_group_description: '',
            job_group_id: 947,
            job_group_name: 'Coverity Static Analysis',
            job_group_symbol: 'coverity',
            job_guid: '2d180d39-8ac5-4200-995b-3f5c7b614596/0',
            job_type_description: '',
            job_type_id: 190421,
            job_type_name: 'source-test-coverity-coverity',
            job_type_symbol: 'cvsa',
            last_modified: '2019-06-12T16:18:26.649628',
            machine_name: 'i-0a2f82a56303c8ec2',
            machine_platform_architecture: '-',
            machine_platform_os: '-',
            option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
            platform: 'linux64',
            push_id: 494796,
            reason: 'scheduled',
            ref_data_name: '7542013e03efecbabf4b0bb931646f4fbff3a413',
            result: 'success',
            result_set_id: 494796,
            signature: '7542013e03efecbabf4b0bb931646f4fbff3a413',
            start_timestamp: 1560354928,
            state: 'completed',
            submit_timestamp: 1560354914,
            tier: 2,
            who: 'reviewbot@noreply.mozilla.org',
            platform_option: 'opt',
            visible: true,
            selected: false,
          }),
        ],
        visible: true,
      },
    ],
  },
  {
    name: 'Gecko Decision Task',
    option: 'opt',
    groups: [
      {
        name: 'unknown',
        tier: 1,
        symbol: '',
        mapKey: '4947961gecko-decisionopt',
        jobs: [
          new JobModel({
            build_architecture: '-',
            build_os: '-',
            build_platform: 'gecko-decision',
            build_platform_id: 107,
            build_system_type: 'taskcluster',
            end_timestamp: 1560354927,
            failure_classification_id: 1,
            id: 250970109,
            job_group_description: '',
            job_group_id: 2,
            job_group_name: 'unknown',
            job_group_symbol: '?',
            job_guid: '7dd39d25-8990-44d2-8ba4-b2a3b319cc4d/0',
            job_type_description: '',
            job_type_id: 6689,
            job_type_name: 'Gecko Decision Task',
            job_type_symbol: 'D',
            last_modified: '2019-06-12T15:55:29.549008',
            machine_name: 'i-080c18493f1aa3d95',
            machine_platform_architecture: '-',
            machine_platform_os: '-',
            option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
            platform: 'gecko-decision',
            push_id: 494796,
            reason: 'scheduled',
            ref_data_name: '2aa083621bb989d6acf1151667288d5fe9616178',
            result: 'success',
            result_set_id: 494796,
            signature: '2aa083621bb989d6acf1151667288d5fe9616178',
            start_timestamp: 1560354846,
            state: 'completed',
            submit_timestamp: 1560354844,
            tier: 1,
            who: 'reviewbot@noreply.mozilla.org',
            platform_option: 'opt',
            visible: true,
            selected: false,
          }),
        ],
        visible: true,
      },
    ],
  },
  {
    name: 'Linting',
    option: 'opt',
    groups: [
      {
        name: 'unknown',
        tier: 1,
        symbol: '',
        mapKey: '4947961lintopt',
        jobs: [
          new JobModel({
            build_architecture: '-',
            build_os: '-',
            build_platform: 'lint',
            build_platform_id: 144,
            build_system_type: 'taskcluster',
            end_timestamp: 1560355013,
            failure_classification_id: 1,
            id: 250970251,
            job_group_description: '',
            job_group_id: 2,
            job_group_name: 'unknown',
            job_group_symbol: '?',
            job_guid: '5df35b83-aff9-4ddf-b8c3-48eff52736f3/0',
            job_type_description: '',
            job_type_id: 114754,
            job_type_name: 'source-test-mozlint-codespell',
            job_type_symbol: 'spell',
            last_modified: '2019-06-12T15:56:54.537683',
            machine_name: 'i-081959e7fae55d041',
            machine_platform_architecture: '-',
            machine_platform_os: '-',
            option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
            platform: 'lint',
            push_id: 494796,
            reason: 'scheduled',
            ref_data_name: '6c2e8db7978ca4d5c0e38522552da4bc9b2e6b8b',
            result: 'success',
            result_set_id: 494796,
            signature: '6c2e8db7978ca4d5c0e38522552da4bc9b2e6b8b',
            start_timestamp: 1560354928,
            state: 'completed',
            submit_timestamp: 1560354914,
            tier: 1,
            who: 'reviewbot@noreply.mozilla.org',
            platform_option: 'opt',
            visible: true,
            selected: false,
          }),
        ],
        visible: true,
      },
    ],
  },
];

afterEach(() => {
  cleanup();
  setUrlParam('selectedJob', null);
});

const testPushJobs = filterModel => (
  <Provider store={store}>
    <PinnedJobs>
      <PushJobs
        push={testPush}
        platforms={testPlatforms}
        repoName="try"
        filterModel={filterModel}
        pushGroupState=""
        toggleSelectedRunnableJob={() => {}}
        runnableVisible={false}
        duplicateJobsVisible={false}
        groupCountsExpanded={false}
      />
    </PinnedJobs>
    ,
  </Provider>
);

test('select a job updates url', async () => {
  const { getByText } = render(testPushJobs(new FilterModel()));
  const spell = getByText('spell');

  expect(spell).toBeInTheDocument();

  fireEvent.mouseDown(spell);
  expect(spell).toHaveClass('selected-job');

  const selJobId = getUrlParam('selectedJob');

  expect(selJobId).toBe('250970251');
});

test('filter change keeps selected job visible', async () => {
  const filterModel = new FilterModel();
  const { getByText, rerender } = render(testPushJobs(filterModel));
  const spell = await waitForElement(() => getByText('spell'));

  expect(spell).toBeInTheDocument();

  fireEvent.mouseDown(spell);
  expect(spell).toHaveClass('selected-job');

  filterModel.addFilter('searchStr', 'linux');
  rerender(testPushJobs(new FilterModel()));

  const spell2 = getByText('spell');

  expect(spell2).toBeInTheDocument();
  expect(spell2).toHaveClass('filter-shown');
  expect(spell2).toHaveClass('selected-job');
});
