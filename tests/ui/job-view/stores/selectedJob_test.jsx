import React from 'react';
import fetchMock from 'fetch-mock';
import { Provider, ReactReduxContext } from 'react-redux';
import thunk from 'redux-thunk';
import { render, waitFor, screen } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';
import keyBy from 'lodash/keyBy';
import { createBrowserHistory } from 'history';
import { ConnectedRouter } from 'connected-react-router';

import { getUrlParam, setUrlParam } from '../../../../ui/helpers/location';
import FilterModel from '../../../../ui/models/filter';
import {
  setSelectedJob,
  setSelectedJobFromQueryString,
  clearSelectedJob,
  initialState,
  reducer,
} from '../../../../ui/job-view/redux/stores/selectedJob';
import JobGroup from '../../../../ui/job-view/pushes/JobGroup';
import group from '../../mock/group_with_jobs';
import { getApiUrl } from '../../../../ui/helpers/url';
import jobListFixtureOne from '../../mock/job_list/job_1';
import { configureStore } from '../../../../ui/job-view/redux/configureStore';

const jobMap = keyBy(group.jobs, 'id');
let notifications = [];
const history = createBrowserHistory();

describe('SelectedJob Redux store', () => {
  const mockStore = configureMockStore([thunk]);
  const repoName = 'autoland';
  const router = { location: history.location };

  const testJobGroup = () => {
    // const store = mockStore({
    //   selectedJob: { initialState },
    // });
    const store = configureStore(history);

    return (
      <Provider store={store} context={ReactReduxContext}>
        <ConnectedRouter history={history} context={ReactReduxContext}>
          <JobGroup
            group={group}
            repoName={repoName}
            filterModel={
              new FilterModel({
                push: history.push,
                router,
              })
            }
            filterPlatformCb={() => {}}
            pushGroupState="expanded"
            duplicateJobsVisible={false}
            groupCountsExpanded
            router={router}
          />
        </ConnectedRouter>
      </Provider>
    );
  };

  beforeEach(() => {
    fetchMock.get(
      getApiUrl('/jobs/?task_id=VaQoWKTbSdGSwBJn6UZV9g&retry_id=0'),
      jobListFixtureOne,
    );
    fetchMock.get(
      getApiUrl('/jobs/?task_id=a824gBVmRQSBuEexnVW_Qg&retry_id=0'),
      { results: [] },
    );
    notifications = [];
  });

  afterEach(() => {
    fetchMock.reset();
    history.push('/');
  });

  // test('setSelectedJob should select a job', async () => {
  //   const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';
  //   // history.push(`/jobs?repo=${repoName}&selectedJob=${group.jobs[0].id}`)
  //   const { getByText } = render(testJobGroup());

  //   const reduced = reducer(
  //     { selectedJob: { initialState } },
  //     setSelectedJob(group.jobs[0], true),
  //   );
  //   // const selectedJob = await waitFor(() => getByText('asan'));
  //   // screen.debug(selectedJob);
  //   // await waitFor(() => expect(selectedJob).toHaveClass('selected-job'));
  //   await waitFor(() => expect(reduced.selectedJob).toEqual(group.jobs[0]));
  //   // expect(getUrlParam('selectedTaskRun')).toEqual(taskRun);
  // });

  test('setSelectedJobFromQueryString found', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';

    history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString(() => {}, jobMap),
    );

    expect(reduced.selectedJob).toEqual(group.jobs[0]);
  });

  test('setSelectedJobFromQueryString not in jobMap', async () => {
    const taskRun = 'VaQoWKTbSdGSwBJn6UZV9g.0';

    history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeUndefined();
    await waitFor(() =>
      expect(notifications[0]).toEqual(
        'Selected task: VaQoWKTbSdGSwBJn6UZV9g not within current push range.',
      ),
    );
  });

  test('setSelectedJobFromQueryString not in DB', async () => {
    const taskRun = 'a824gBVmRQSBuEexnVW_Qg.0';

    history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeUndefined();
    await waitFor(() =>
      expect(notifications[0]).toEqual(
        'Task not found: a824gBVmRQSBuEexnVW_Qg, run 0',
      ),
    );
  });

  // test('clearSelectedJob', async () => {
  //   const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';

  //   // setUrlParam('selectedTaskRun', taskRun);
  //   history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);

  //   const reduced = reducer(
  //     { selectedJob: { selectedJob: group.jobs[0] } },
  //     clearSelectedJob(0),
  //   );

  //   await waitFor(() => expect(reduced.selectedJob).toBeNull());
  // });
});
