import React from 'react';
import { Provider, ReactReduxContext } from 'react-redux';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import { ConnectedRouter } from 'connected-react-router';
import { createBrowserHistory } from 'history';

import { addAggregateFields, findInstance } from '../../../ui/helpers/job';
import { getUrlParam, setUrlParam } from '../../../ui/helpers/location';
import { clearJobButtonRegistry } from '../../../ui/hooks/useJobButtonRegistry';
import PushJobs from '../../../ui/job-view/pushes/PushJobs';
import { configureStore } from '../../../ui/job-view/redux/configureStore';
import FilterModel from '../../../ui/models/filter';
import platforms from '../mock/platforms';

const history = createBrowserHistory();
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
  platforms.forEach((platform) => {
    platform.groups.forEach((group) => {
      group.jobs.forEach((job) => {
        addAggregateFields(job);
      });
    });
  });
});

beforeEach(() => {
  clearJobButtonRegistry();
});

afterEach(() => {
  cleanup();
  setUrlParam('selectedTaskRun', null);
  clearJobButtonRegistry();
});

const testPushJobs = (filtermodel = null) => {
  const store = configureStore(history);
  return (
    <Provider store={store} context={ReactReduxContext}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <div id="push-list">
          <PushJobs
            push={testPush}
            platforms={platforms}
            repoName="try"
            filterModel={
              filtermodel ||
              new FilterModel({
                router: { location: history.location, push: history.push },
              })
            }
            pushGroupState=""
            toggleSelectedRunnableJob={() => {}}
            runnableVisible={false}
            duplicateJobsVisible={false}
            groupCountsExpanded={false}
          />
        </div>
      </ConnectedRouter>
    </Provider>
  );
};

test('select a job updates url', async () => {
  const { getByText } = render(testPushJobs());
  const spell = getByText('spell');

  expect(spell).toBeInTheDocument();

  // Click the job - this dispatches selectJobViaUrl which updates the URL
  fireEvent.mouseDown(spell);

  // In the real app, PushList listens for URL changes and calls syncSelectionFromUrl,
  // which then calls setSelected(true) on the job instance.
  // Since we don't have PushList in this test, we manually trigger the selection sync.
  await waitFor(() => {
    const selTaskRun = getUrlParam('selectedTaskRun');
    expect(selTaskRun).toBe('OeYt2-iLQSaQb2ashZ_VIQ.0');
  });

  // Manually call setSelected on the job instance to simulate what syncSelectionFromUrl does
  const jobInstance = findInstance(spell);
  await act(async () => {
    jobInstance.setSelected(true);
  });

  expect(spell).toHaveClass('selected-job');
});

test('filter change keeps selected job visible', async () => {
  const { getByText, rerender } = render(testPushJobs());
  const spell = await waitFor(() => getByText('spell'));
  const filterModel = new FilterModel({
    router: { location: history.location },
    pushRoute: history.push,
  });

  expect(spell).toBeInTheDocument();

  // Click the job - this dispatches selectJobViaUrl which updates the URL
  fireEvent.mouseDown(spell);

  // Wait for URL to update
  await waitFor(() => {
    expect(getUrlParam('selectedTaskRun')).toBe('OeYt2-iLQSaQb2ashZ_VIQ.0');
  });

  // Manually call setSelected on the job instance to simulate what syncSelectionFromUrl does
  const jobInstance = findInstance(spell);
  await act(async () => {
    jobInstance.setSelected(true);
  });

  expect(spell).toHaveClass('selected-job');

  filterModel.addFilter('searchStr', 'linux');
  rerender(testPushJobs(filterModel));

  const spell2 = getByText('spell');

  expect(spell2).toBeInTheDocument();
  expect(spell2).toHaveClass('filter-shown');
  expect(spell2).toHaveClass('selected-job');
});
