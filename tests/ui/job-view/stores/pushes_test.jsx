import { fetchMock } from 'fetch-mock';
import thunk from 'redux-thunk';
import { cleanup } from '@testing-library/react';
import configureMockStore from 'redux-mock-store';

import {
  getProjectUrl,
  getQueryString,
  replaceLocation,
  setUrlParam,
} from '../../../../ui/helpers/location';
import pushListFixture from '../../mock/push_list';
import pushListFromChangeFixture from '../../mock/pushListFromchange';
import jobMap from '../../mock/job_map';
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
  fetchNextPushes,
  updateRange,
} from '../../../../ui/job-view/redux/stores/pushes';
import { addAggregateFields } from '../../../../ui/helpers/job';

const mockStore = configureMockStore([thunk]);

describe('Pushes Redux store', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    Object.values(jobMap).forEach(job => addAggregateFields(job));
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    replaceLocation({});
  });

  test('should get pushes with fetchPushes', async () => {
    fetchMock.get(
      getProjectUrl('/push/?full=true&count=10', repoName),
      pushListFixture,
    );
    fetchMock.get(
      getProjectUrl('/jobs/?push_id=1&count=2000&return_type=list', repoName),
      jobListFixtureOne,
    );

    fetchMock.mock(
      getProjectUrl('/jobs/?push_id=2&count=2000&return_type=list', repoName),
      jobListFixtureTwo,
    );
    const store = mockStore({ pushes: initialState });

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
        '/push/?full=true&count=10&fromchange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
        repoName,
      ),
      pollPushListFixture,
    );
    fetchMock.mock(
      `begin:${getProjectUrl(
        '/jobs/?push_id__in=511138&last_modified__gt',
        repoName,
      )}`,
      jobListFixtureTwo,
    );

    const initialPush = pushListFixture.results[0];
    const store = mockStore({
      pushes: { ...initialState, pushList: [initialPush] },
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

  test('fetchNextPushes should update revision param on url', async () => {
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=11&push_timestamp__lte=1562867957',
        repoName,
      ),
      pollPushListFixture,
    );

    const push = pushListFixture.results[0];
    const store = mockStore({
      pushes: {
        ...initialState,
        pushList: [push],
        oldestPushTimestamp: push.push_timestamp,
      },
    });
    setUrlParam('revision', push.revision);
    await store.dispatch(fetchNextPushes(10));

    expect(getQueryString()).toEqual(
      'tochange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0&fromchange=90da061f588d1315ee4087225d041d7474d9dfd8',
    );
  });

  test('should pare down to single revision updateRange', async () => {
    const store = mockStore({
      pushes: { ...initialState, pushList: pushListFixture.results },
    });

    await store.dispatch(
      updateRange({ revision: '9692347caff487cdcd889489b8e89a825fe6bbd1' }),
    );
    const actions = store.getActions();

    expect(actions).toEqual([
      { countPinnedJobs: 0, type: 'CLEAR_JOB' },
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
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=10&fromchange=9692347caff487cdcd889489b8e89a825fe6bbd1',
        repoName,
      ),
      pushListFromChangeFixture,
    );

    const store = mockStore({
      pushes: initialState,
    });

    setUrlParam('fromchange', '9692347caff487cdcd889489b8e89a825fe6bbd1');
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

    expect(reduced.pushList).toEqual([]);
    expect(reduced.allUnclassifiedFailureCount).toEqual(0);
    expect(reduced.filteredUnclassifiedFailureCount).toEqual(0);
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
    expect(reduced.allUnclassifiedFailureCount).toEqual(0);
    expect(reduced.filteredUnclassifiedFailureCount).toEqual(0);
  });

  test('should get new unclassified counts with recalculateUnclassifiedCounts', async () => {
    setUrlParam('job_type_symbol', 'cpp');
    const reduced = reducer(
      {
        ...initialState,
        jobMap,
      },
      { type: RECALCULATE_UNCLASSIFIED_COUNTS },
    );

    expect(Object.keys(reduced.jobMap)).toHaveLength(26);
    expect(reduced.allUnclassifiedFailureCount).toEqual(3);
    expect(reduced.filteredUnclassifiedFailureCount).toEqual(1);
  });

  test('should add to the jobMap with updateJobMap', async () => {
    const jobList = [{ id: 5 }, { id: 6 }, { id: 7 }];

    const reduced = reducer(
      { ...initialState, jobMap },
      { type: UPDATE_JOB_MAP, jobList },
    );

    expect(Object.keys(reduced.jobMap)).toHaveLength(29);
  });
});
