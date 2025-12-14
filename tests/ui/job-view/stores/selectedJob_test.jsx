import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { waitFor, act } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';
import keyBy from 'lodash/keyBy';
import { createBrowserHistory } from 'history';

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
const history = createBrowserHistory();

describe('SelectedJob Redux store', () => {
  const mockStore = configureMockStore([thunk]);
  const repoName = 'autoland';
  const router = { location: history.location };

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
    act(() => {
      history.push('/');
    });
  });

  test('setSelectedJob should select a job', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';
    const store = mockStore({
      selectedJob: { initialState },
      router,
    });

    store.dispatch(setSelectedJob(group.jobs[0], true));
    const actions = store.getActions();
    expect(actions).toEqual([
      {
        job: group.jobs[0],
        type: SELECT_JOB,
      },
      {
        payload: {
          args: [{ search: `?selectedTaskRun=${taskRun}` }],
          method: 'push',
        },
        type: '@@router/CALL_HISTORY_METHOD',
      },
    ]);
  });

  test('setSelectedJobFromQueryString found', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';

    act(() => {
      history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);
    });

    const reduced = reducer(
      { selectedJob: { initialState } },
      setSelectedJobFromQueryString(() => {}, jobMap),
    );

    expect(reduced.selectedJob).toEqual(group.jobs[0]);
  });

  test('setSelectedJobFromQueryString not in jobMap', async () => {
    const taskRun = 'VaQoWKTbSdGSwBJn6UZV9g.0';

    act(() => {
      history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);
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

    act(() => {
      history.push(`/jobs?repo=${repoName}&selectedTaskRun=${taskRun}`);
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
      router,
    });

    store.dispatch(clearSelectedJob(0));
    const actions = store.getActions();
    expect(actions).toEqual([
      {
        countPinnedJobs: 0,
        type: 'CLEAR_JOB',
      },
      {
        payload: {
          args: [
            {
              search: '?',
            },
          ],
          method: 'push',
        },
        type: '@@router/CALL_HISTORY_METHOD',
      },
    ]);
  });
});
