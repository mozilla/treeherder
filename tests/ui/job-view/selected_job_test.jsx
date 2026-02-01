
import { Provider, ReactReduxContext } from 'react-redux';
import {
  render,
  cleanup,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { addAggregateFields } from '../../../ui/helpers/job';
import { setUrlParam } from '../../../ui/helpers/location';
import { clearJobButtonRegistry } from '../../../ui/hooks/useJobButtonRegistry';
import PushJobs from '../../../ui/job-view/pushes/PushJobs';
import { configureStore } from '../../../ui/job-view/redux/configureStore';
import FilterModel from '../../../ui/models/filter';
import platforms from '../mock/platforms';

const mockLocation = { search: '', pathname: '/jobs' };
const mockNavigate = jest.fn();
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

beforeEach(() => {
  clearJobButtonRegistry();
<<<<<<< HEAD
  jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
=======
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
});

afterEach(() => {
  cleanup();
  setUrlParam('selectedTaskRun', null);
  clearJobButtonRegistry();
  jest.restoreAllMocks();
});

const testPushJobs = (filtermodel = null, store = null) => {
  const storeToUse = store || configureStore();
  return (
    <Provider store={storeToUse} context={ReactReduxContext}>
      <MemoryRouter>
        <div id="push-list">
          <PushJobs
            push={testPush}
            platforms={platforms}
            repoName="try"
            filterModel={
              filtermodel || new FilterModel(mockNavigate, mockLocation)
            }
            pushGroupState=""
            toggleSelectedRunnableJob={() => {}}
            runnableVisible={false}
            duplicateJobsVisible={false}
            groupCountsExpanded={false}
          />
        </div>
      </MemoryRouter>
    </Provider>
  );
};

test('select a job updates url', async () => {
  const { getByText } = render(testPushJobs());
  const spell = getByText('spell');

  expect(spell).toBeInTheDocument();

  // Click the job - this dispatches selectJobViaUrl which updates the URL
  fireEvent.mouseDown(spell);
  await waitFor(() => expect(spell).toHaveClass('selected-job'));

<<<<<<< HEAD
  // Verify pushState was called with the correct selectedTaskRun parameter
  await waitFor(() => {
    expect(window.history.pushState).toHaveBeenCalled();
  });

  // Get the last call to pushState and verify the URL contains the expected param
  const lastCall = window.history.pushState.mock.calls.slice(-1)[0];
  const url = lastCall[2]; // pushState(state, title, url)

  expect(url).toContain('selectedTaskRun=OeYt2-iLQSaQb2ashZ_VIQ.0');
=======
  const selTaskRun = getUrlParam('selectedTaskRun');

  expect(selTaskRun).toBe('OeYt2-iLQSaQb2ashZ_VIQ.0');
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
});

test('filter change keeps selected job visible', async () => {
  const store = configureStore();
  const filterModel = new FilterModel(mockNavigate, mockLocation);
  const { getByText, rerender } = render(testPushJobs(filterModel, store));
  const spell = await waitFor(() => getByText('spell'));

  expect(spell).toBeInTheDocument();

  // Click the job - this dispatches selectJobViaUrl which updates the URL
  fireEvent.mouseDown(spell);
  await waitFor(() => expect(spell).toHaveClass('selected-job'));

  act(() => {
    filterModel.addFilter('searchStr', 'linux');
  });
  rerender(testPushJobs(filterModel, store));

  const spell2 = getByText('spell');

  expect(spell2).toBeInTheDocument();
  expect(spell2).toHaveClass('filter-shown');
  await waitFor(() => expect(spell2).toHaveClass('selected-job'));
});
