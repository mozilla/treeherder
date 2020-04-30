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
import { getUrlParam, setUrlParam } from '../../../ui/helpers/location';
import platforms from '../mock/platforms';
import { addAggregateFields } from '../../../ui/helpers/job';

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

beforeAll(() => {
  platforms.forEach((platform) =>
    platform.groups.forEach((group) =>
      group.jobs.forEach((job) => addAggregateFields(job)),
    ),
  );
});

afterEach(() => {
  cleanup();
  setUrlParam('selectedTaskRun', null);
});

const testPushJobs = (filterModel) => (
  <Provider store={store}>
    <PushJobs
      push={testPush}
      platforms={platforms}
      repoName="try"
      filterModel={filterModel}
      pushGroupState=""
      toggleSelectedRunnableJob={() => {}}
      runnableVisible={false}
      duplicateJobsVisible={false}
      groupCountsExpanded={false}
    />
    ,
  </Provider>
);

test('select a job updates url', async () => {
  const { getByText } = render(testPushJobs(new FilterModel()));
  const spell = getByText('spell');

  expect(spell).toBeInTheDocument();

  fireEvent.mouseDown(spell);
  expect(spell).toHaveClass('selected-job');

  const selTaskRun = getUrlParam('selectedTaskRun');

  expect(selTaskRun).toBe('OeYt2-iLQSaQb2ashZ_VIQ-0');
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
