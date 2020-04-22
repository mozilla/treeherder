import React from 'react';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import { render, cleanup, wait } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';
import keyBy from 'lodash/keyBy';

import {
  getUrlParam,
  replaceLocation,
  setUrlParam,
} from '../../../../ui/helpers/location';
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

const mockStore = configureMockStore([thunk]);
const jobMap = keyBy(group.jobs, 'id');
let notifications = [];

describe('SelectedJob Redux store', () => {
  const repoName = 'autoland';
  const testJobGroup = (store, group, filterModel) => {
    return (
      <Provider store={store}>
        <JobGroup
          group={group}
          repoName={repoName}
          filterModel={filterModel}
          filterPlatformCb={() => {}}
          pushGroupState="expanded"
          duplicateJobsVisible={false}
          groupCountsExpanded
        />
      </Provider>
    );
  };

  beforeEach(() => {
    fetchMock.get(
      getApiUrl('/jobs/?task_id=VaQoWKTbSdGSwBJn6UZV9g&retry_id=0'),
      jobListFixtureOne,
    );
    fetchMock.get(
      getApiUrl('/jobs/?task_id=VaQoWKTbSdGSwBJn6UZV9P&retry_id=0'),
      { results: [] },
    );
    setUrlParam('repo', repoName);
    notifications = [];
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    replaceLocation({});
  });

  test('setSelectedJob should select a job', async () => {
    const store = mockStore({ selectedJob: { initialState } });
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA-0';

    render(testJobGroup(store, group, new FilterModel()));

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJob(group.jobs[0], true),
    );

    expect(reduced.selectedJob).toEqual(group.jobs[0]);
    expect(getUrlParam('selectedTaskRun')).toEqual(taskRun);
  });

  test('setSelectedJobFromQueryString found', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA-0';
    const store = mockStore({ selectedJob: { initialState } });
    setUrlParam('selectedTaskRun', taskRun);

    render(testJobGroup(store, group, new FilterModel()));
    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString(() => {}, jobMap),
    );

    expect(reduced.selectedJob).toEqual(group.jobs[0]);
  });

  test('setSelectedJobFromQueryString not in jobMap', async () => {
    const taskRun = 'VaQoWKTbSdGSwBJn6UZV9g-0';

    setUrlParam('selectedTaskRun', taskRun);

    const reduced = await reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString(msg => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeUndefined();
    await wait(() =>
      expect(notifications[0]).toEqual(
        'Selected task: VaQoWKTbSdGSwBJn6UZV9g not within current push range.',
      ),
    );
  });

  test('setSelectedJobFromQueryString not in DB', async () => {
    const taskRun = 'VaQoWKTbSdGSwBJn6UZV9P-0';

    setUrlParam('selectedTaskRun', taskRun);

    const reduced = await reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString(msg => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeUndefined();
    await wait(() =>
      expect(notifications[0]).toEqual(
        'Task not found: VaQoWKTbSdGSwBJn6UZV9P, run 0',
      ),
    );
  });

  test('clearSelectedJob', () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA-0';

    setUrlParam('selectedTaskRun', taskRun);

    const reduced = reducer(
      { selectedJob: { selectedJob: group.jobs[0] } },
      clearSelectedJob(0),
    );

    expect(reduced.selectedJob).toBeNull();
  });
});
