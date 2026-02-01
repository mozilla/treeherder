import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { cleanup } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';

import {
  getProjectUrl,
  updatePushParams,
} from '../../../../ui/helpers/location';
import pushListFixture from '../../mock/push_list';
import pushListFromChangeFixture from '../../mock/pushListFromchange';
import pollPushListFixture from '../../mock/poll_push_list';
import jobListFixtureOne from '../../mock/job_list/job_1';
import jobListFixtureTwo from '../../mock/job_list/job_2';
import revisionTips from '../../mock/revisionTips';
import {
  LOADING,
  ADD_PUSHES,
  CLEAR_PUSHES,
  SET_PUSHES,
  RECALCULATE_UNCLASSIFIED_COUNTS,
  UPDATE_JOB_MAP,
  initialState,
  reducer,
  fetchPushes,
  pollPushes,
  updateRange,
} from '../../../../ui/job-view/redux/stores/pushes';
import { getApiUrl } from '../../../../ui/helpers/url';
import JobModel from '../../../../ui/models/job';

const mockStore = configureMockStore([thunk]);
const mockLocation = { search: '', pathname: '/jobs' };
const emptyBugzillaResponse = {
  bugs: [],
};

describe('Pushes Redux store', () => {
  const repoName = 'autoland';
  const originalLocation = window.location;

  beforeEach(() => {
    fetchMock.get(getApiUrl('/jobs/?push_id=1', repoName), jobListFixtureOne);
    fetchMock.get(getApiUrl('/jobs/?push_id=2', repoName), jobListFixtureTwo);
    // Mock window.history.pushState for URL updates
    jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    // Reset window.location to default for each test
    delete window.location;
    window.location = { ...originalLocation, search: '', pathname: '/jobs' };
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    jest.restoreAllMocks();
    // Restore original window.location
    delete window.location;
    window.location = originalLocation;
  });

  test('should get pushes with fetchPushes', async () => {
    fetchMock.get(
      getProjectUrl('/push/?full=true&count=10', repoName),
      pushListFixture,
    );
    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1556854%2C1555861%2C1559418%2C1563766%2C1561537%2C1563692`,
      emptyBugzillaResponse,
    );
    const store = mockStore({
      pushes: initialState,
      router: { location: mockLocation },
    });

    await store.dispatch(fetchPushes());
    const actions = store.getActions();

    expect(actions[0]).toEqual({ type: LOADING });
    expect(actions[1]).toEqual({
      type: ADD_PUSHES,
      pushResults: {
        pushList: pushListFixture.results,
        oldestPushTimestamp: 1562867109,
        allUnclassifiedFailureCount: 0,
        filteredUnclassifiedFailureCount: 0,
        revisionTips,
      },
    });
  });

  test('should add new push and jobs when polling', async () => {
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=100&fromchange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
        repoName,
      ),
      pollPushListFixture,
    );
    fetchMock.mock(
      `begin:${getApiUrl(
        '/jobs/?push_id__in=511138&last_modified__gt',
        repoName,
      )}`,
      jobListFixtureTwo,
    );

    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1506219`,
      emptyBugzillaResponse,
    );

    const initialPush = pushListFixture.results[0];
    const store = mockStore({
      pushes: { ...initialState, pushList: [initialPush] },
      router: { location: mockLocation },
    });

    await store.dispatch(pollPushes());
    const actions = store.getActions();

    expect(actions).toEqual([
      {
        type: ADD_PUSHES,
        pushResults: {
          pushList: [initialPush, ...pollPushListFixture.results],
          allUnclassifiedFailureCount: 0,
          filteredUnclassifiedFailureCount: 0,
          oldestPushTimestamp: 1562707488,
          revisionTips: [
            {
              author: 'jarilvalenciano@gmail.com',
              revision: 'ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
              title:
                "Fuzzy query='debugger | 'node-devtools&query='mozlint-eslint&query='mochitest-devtools",
            },
            {
              author: 'reviewbot',
              revision: '750b802afc594b92aba99de82a51772c75526c44',
              title: 'try_task_config for code-review',
            },
            {
              author: 'reviewbot',
              revision: '90da061f588d1315ee4087225d041d7474d9dfd8',
              title: 'try_task_config for code-review',
            },
          ],
        },
      },
    ]);
  });

  test('fetchPushes should update revision param on url', async () => {
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=11&push_timestamp__lte=1562867957',
        repoName,
      ),
      pollPushListFixture,
    );

    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1506219`,
      emptyBugzillaResponse,
    );

    const push = pushListFixture.results[0];
    const testLocation = {
      search: `?repo=${repoName}&revision=${push.revision}`,
      pathname: '/jobs',
    };
    const params = updatePushParams(testLocation);

    // Set window.location to match the updated params
    window.location = { search: params, pathname: '/jobs' };

    const store = mockStore({
      pushes: {
        ...initialState,
        pushList: [push],
        oldestPushTimestamp: push.push_timestamp,
      },
      router: { location: { search: params, pathname: '/jobs' } },
    });
    await store.dispatch(fetchPushes(10, true));

    // replaceLocation uses null, null for pushState
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      null,
      expect.stringContaining(
        'tochange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
      ),
    );
  });

  test('should pare down to single revision updateRange', async () => {
    const store = mockStore({
      pushes: { ...initialState, pushList: pushListFixture.results },
      router: { location: mockLocation },
    });

    await store.dispatch(
      updateRange({ revision: '9692347caff487cdcd889489b8e89a825fe6bbd1' }),
    );
    const actions = store.getActions();

    expect(actions).toEqual([
      {
        type: SET_PUSHES,
        pushResults: {
          pushList: [pushListFixture.results[2]],
          allUnclassifiedFailureCount: 0,
          filteredUnclassifiedFailureCount: 0,
          oldestPushTimestamp: 1562867702,
          revisionTips: [revisionTips[2]],
          jobMap: {},
        },
      },
    ]);
  });

  test('should fetch a new set of pushes with updateRange', async () => {
    // PushModel.getList adds count=100 by default
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=100&fromchange=9692347caff487cdcd889489b8e89a825fe6bbd1',
        repoName,
      ),
      pushListFromChangeFixture,
    );

    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1556854`,
      emptyBugzillaResponse,
    );

    // Set window.location to have the fromchange param
    window.location = {
      search: '?fromchange=9692347caff487cdcd889489b8e89a825fe6bbd1',
      pathname: '/jobs',
    };

    const store = mockStore({
      pushes: initialState,
      router: { location: mockLocation },
    });

    await store.dispatch(
      updateRange({ fromchange: '9692347caff487cdcd889489b8e89a825fe6bbd1' }),
    );
    const actions = store.getActions();

    expect(actions).toEqual([
      {
        type: CLEAR_PUSHES,
      },
      {
        type: LOADING,
      },
      {
        type: ADD_PUSHES,
        pushResults: {
          pushList: pushListFromChangeFixture.results,
          allUnclassifiedFailureCount: 0,
          filteredUnclassifiedFailureCount: 0,
          oldestPushTimestamp: 1562867702,
          revisionTips: revisionTips.slice(0, 3),
        },
      },
    ]);
  });

  test('should clear the pushList with clearPushes', async () => {
    const push = pushListFixture.results[0];
    const reduced = reducer(
      {
        ...initialState,
        pushList: pushListFixture.results,
        oldestPushTimestamp: push.push_timestamp,
      },
      { type: CLEAR_PUSHES },
    );

    expect(reduced.pushList).toStrictEqual([]);
    expect(reduced.allUnclassifiedFailureCount).toBe(0);
    expect(reduced.filteredUnclassifiedFailureCount).toBe(0);
  });

  test('should replace the pushList with setPushes', async () => {
    const push = pushListFixture.results[0];
    const push2 = pushListFixture.results[1];
    const reduced = reducer(
      {
        ...initialState,
        pushList: [push],
        oldestPushTimestamp: push.push_timestamp,
      },
      { type: SET_PUSHES, pushResults: { pushList: [push2] } },
    );

    expect(reduced.pushList).toEqual([push2]);
    expect(reduced.allUnclassifiedFailureCount).toBe(0);
    expect(reduced.filteredUnclassifiedFailureCount).toBe(0);
  });

  test('should get new unclassified counts with recalculateUnclassifiedCounts', async () => {
    // Set window.location to have the filter that will limit results
    window.location = { search: '?job_type_symbol=B', pathname: '/' };

    const { data: jobList } = await JobModel.getList({ push_id: 1 });

    const state = reducer(
      { ...initialState },
      { type: UPDATE_JOB_MAP, jobList },
    );

    const reduced = reducer(state, {
      type: RECALCULATE_UNCLASSIFIED_COUNTS,
    });

    expect(Object.keys(reduced.jobMap)).toHaveLength(5);
    expect(reduced.allUnclassifiedFailureCount).toBe(2);
    expect(reduced.filteredUnclassifiedFailureCount).toBe(1);
  });

  test('should add to the jobMap with updateJobMap', async () => {
    const { data: jobList } = await JobModel.getList({ push_id: 2 });
    const reduced = reducer(
      { ...initialState },
      { type: UPDATE_JOB_MAP, jobList },
    );

    expect(Object.keys(reduced.jobMap)).toHaveLength(4);
  });

  test('jobMap jobs should have fields required for retriggering', async () => {
    const { data: jobList } = await JobModel.getList({ push_id: 2 });
    const reduced = reducer(
      { ...initialState },
      { type: UPDATE_JOB_MAP, jobList },
    );

    expect(Object.keys(reduced.jobMap)).toHaveLength(4);
    const job = reduced.jobMap['259539684'];
    expect(job.signature).toBe('f64069faca8636e9dc415bef8e9a4ee055d56687');
    expect(job.job_type_name).toBe(
      'test-android-hw-p2-8-0-arm7-api-16/debug-fennec-jittest-1proc-2',
    );
  });
});
