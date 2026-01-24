import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { waitFor, act } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';
import keyBy from 'lodash/keyBy';

import {
  setSelectedJob,
  setSelectedJobFromQueryString,
  clearSelectedJob,
  selectJobViaUrl,
  initialState,
  reducer,
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

  test('selectJobViaUrl should dispatch SELECT_JOB and update URL', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';
    const store = mockStore({
      selectedJob: { initialState },
    });

    // selectJobViaUrl dispatches SELECT_JOB directly (to avoid race conditions
    // with stale jobMap during rapid clicks), then updates the URL
    store.dispatch(selectJobViaUrl(group.jobs[0]));
    const actions = store.getActions();
    expect(actions).toEqual([
      {
        type: 'SELECT_JOB',
        job: group.jobs[0],
      },
    ]);

    // URL should be updated via window.history.pushState
    expect(window.history.pushState).toHaveBeenCalled();
    const lastCall = window.history.pushState.mock.calls.slice(-1)[0];
    expect(lastCall[2]).toContain(`selectedTaskRun=${taskRun}`);
  });

  test('setSelectedJob with updateUrl=true delegates to selectJobViaUrl', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';
    const store = mockStore({
      selectedJob: { initialState },
    });

    // Legacy API: setSelectedJob(job, true) now delegates to selectJobViaUrl
    // which dispatches SELECT_JOB then updates URL
    await store.dispatch(setSelectedJob(group.jobs[0], true));
    const actions = store.getActions();

    // Should dispatch SELECT_JOB action
    expect(actions).toEqual([
      {
        type: 'SELECT_JOB',
        job: group.jobs[0],
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

<<<<<<< HEAD
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
=======
    act(() => {
      history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
    });

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeNull();
    await waitFor(() =>
      expect(notifications[0]).toBe(
        'Selected task: VaQoWKTbSdGSwBJn6UZV9g not within current push range.',
      ),
    );
  });

  test('setSelectedJobFromQueryString not in DB', async () => {
    const taskRun = 'a824gBVmRQSBuEexnVW_Qg.0';

<<<<<<< HEAD
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
=======
    act(() => {
      history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
    });

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap),
    );

    expect(reduced.selectedJob).toBeNull();
    await waitFor(() =>
      expect(notifications[0]).toBe(
        'Task not found: a824gBVmRQSBuEexnVW_Qg, run 0',
      ),
    );
  });

  test('clearSelectedJob delegates to clearJobViaUrl (URL-first)', async () => {
    const store = mockStore({
      selectedJob: { selectedJob: group.jobs[0] },
    });

    // URL-first architecture: clearSelectedJob now only updates URL
    // The URL change triggers syncSelectionFromUrl which clears Redux state
    await store.dispatch(clearSelectedJob(0));
    const actions = store.getActions();

    // clearJobViaUrl doesn't dispatch any actions, just updates URL
    expect(actions).toEqual([]);

    // URL should be updated via window.history.pushState
    expect(window.history.pushState).toHaveBeenCalled();
  });
});
