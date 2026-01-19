import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { waitFor } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';
import keyBy from 'lodash/keyBy';

import {
  setSelectedJob,
  setSelectedJobFromQueryString,
  clearSelectedJob,
  initialState,
  reducer,
  SELECT_JOB,
} from '../../../../ui/job-view/redux/stores/selectedJob';
import group from '../../mock/group_with_jobs';
import { getApiUrl } from '../../../../ui/helpers/url';
import jobListFixtureOne from '../../mock/job_list/job_1';

const jobMap = keyBy(group.jobs, 'id');
let notifications = [];

describe('SelectedJob Redux store', () => {
  const mockStore = configureMockStore([thunk]);
  const repoName = 'autoland';

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
    // Mock window.history.pushState for URL updates
    jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.reset();
    jest.restoreAllMocks();
  });

  test('setSelectedJob should select a job', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';
    const store = mockStore({
      selectedJob: { initialState },
    });

    await store.dispatch(setSelectedJob(group.jobs[0], true));
    const actions = store.getActions();

    // Should dispatch SELECT_JOB action
    expect(actions).toEqual([
      {
        job: group.jobs[0],
        type: SELECT_JOB,
      },
    ]);

    // URL should be updated via window.history.pushState
    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      '',
      expect.stringContaining(`selectedTaskRun=${taskRun}`),
    );
  });

  test('setSelectedJobFromQueryString found', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';

    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
    });

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString(() => {}, jobMap),
    );

    expect(reduced.selectedJob).toEqual(group.jobs[0]);
  });

  test('setSelectedJobFromQueryString not in jobMap', async () => {
    const taskRun = 'VaQoWKTbSdGSwBJn6UZV9g.0';

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
    });

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeUndefined();
    await waitFor(() =>
      expect(notifications[0]).toBe(
        'Selected task: VaQoWKTbSdGSwBJn6UZV9g not within current push range.',
      ),
    );
  });

  test('setSelectedJobFromQueryString not in DB', async () => {
    const taskRun = 'a824gBVmRQSBuEexnVW_Qg.0';

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
    });

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeUndefined();
    await waitFor(() =>
      expect(notifications[0]).toBe(
        'Task not found: a824gBVmRQSBuEexnVW_Qg, run 0',
      ),
    );
  });

  test('clearSelectedJob', async () => {
    const store = mockStore({
      selectedJob: { selectedJob: group.jobs[0] },
    });

    await store.dispatch(clearSelectedJob(0));
    const actions = store.getActions();

    // Should dispatch CLEAR_JOB action
    expect(actions).toEqual([
      {
        countPinnedJobs: 0,
        type: 'CLEAR_JOB',
      },
    ]);

    // URL should be updated via window.history.pushState
    expect(window.history.pushState).toHaveBeenCalled();
  });
});
