import fetchMock from 'fetch-mock';
import { cleanup } from '@testing-library/react';

import {
  getProjectUrl,
  updatePushParams,
} from '../../../../ui/helpers/location';
import pushListFixture from '../../mock/push_list';
import pushListFromChangeFixture from '../../mock/pushListFromchange';
import pollPushListFixture from '../../mock/poll_push_list';
import jobListFixtureOne from '../../mock/job_list/job_1';
import jobListFixtureTwo from '../../mock/job_list/job_2';
import revisionTips from '../../mock/revisionTips.json';
import {
  usePushesStore,
  initialState,
} from '../../../../ui/job-view/stores/pushesStore';
import { getApiUrl } from '../../../../ui/helpers/url';
import JobModel from '../../../../ui/models/job';

const emptyBugzillaResponse = {
  bugs: [],
};

describe('Pushes Zustand store', () => {
  const repoName = 'autoland';
  const originalLocation = window.location;

  beforeEach(() => {
    fetchMock.get(getApiUrl('/jobs/?push_id=1', repoName), jobListFixtureOne);
    fetchMock.get(getApiUrl('/jobs/?push_id=2', repoName), jobListFixtureTwo);
    jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    delete window.location;
    window.location = { ...originalLocation, search: '', pathname: '/jobs' };
    // Reset store to initial state before each test
    usePushesStore.setState(initialState);
  });

  afterEach(() => {
    cleanup();
    fetchMock.reset();
    jest.restoreAllMocks();
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

    await usePushesStore.getState().fetchPushes();
    const state = usePushesStore.getState();

    expect(state.loadingPushes).toBe(false);
    expect(state.pushList).toEqual(pushListFixture.results);
    expect(state.oldestPushTimestamp).toBe(1562867109);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
    expect(state.revisionTips).toEqual(revisionTips);
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
      `begin:${getApiUrl('/jobs/?push_id__in=', repoName)}`,
      jobListFixtureTwo,
    );

    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1506219`,
      emptyBugzillaResponse,
    );

    const initialPush = pushListFixture.results[0];
    usePushesStore.setState({ ...initialState, pushList: [initialPush] });

    await usePushesStore.getState().pollPushes();
    const state = usePushesStore.getState();

    expect(state.pushList).toEqual([
      initialPush,
      ...pollPushListFixture.results,
    ]);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
    expect(state.oldestPushTimestamp).toBe(1562707488);
    expect(state.revisionTips).toEqual([
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

    window.location = { search: params, pathname: '/jobs' };

    usePushesStore.setState({
      ...initialState,
      pushList: [push],
      oldestPushTimestamp: push.push_timestamp,
    });

    await usePushesStore.getState().fetchPushes(10, true);

    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      null,
      expect.stringContaining(
        'tochange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
      ),
    );
  });

  test('should pare down to single revision updateRange', async () => {
    usePushesStore.setState({
      ...initialState,
      pushList: pushListFixture.results,
    });

    usePushesStore
      .getState()
      .updateRange({ revision: '9692347caff487cdcd889489b8e89a825fe6bbd1' });
    const state = usePushesStore.getState();

    expect(state.pushList).toEqual([pushListFixture.results[2]]);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
    expect(state.oldestPushTimestamp).toBe(1562867702);
    expect(state.revisionTips).toEqual([revisionTips[2]]);
    expect(state.jobMap).toEqual({});
  });

  test('should fetch a new set of pushes with updateRange', async () => {
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

    window.location = {
      search: '?fromchange=9692347caff487cdcd889489b8e89a825fe6bbd1',
      pathname: '/jobs',
    };

    usePushesStore.setState(initialState);

    // updateRange with no matching revision will clearPushes then fetchPushes
    usePushesStore.getState().updateRange({
      fromchange: '9692347caff487cdcd889489b8e89a825fe6bbd1',
    });

    // Wait for the async fetchPushes to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const state = usePushesStore.getState();

    expect(state.pushList).toEqual(pushListFromChangeFixture.results);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
    expect(state.oldestPushTimestamp).toBe(1562867702);
    expect(state.revisionTips).toEqual(revisionTips.slice(0, 3));
  });

  test('should clear the pushList with clearPushes', async () => {
    const push = pushListFixture.results[0];
    usePushesStore.setState({
      ...initialState,
      pushList: pushListFixture.results,
      oldestPushTimestamp: push.push_timestamp,
    });

    usePushesStore.getState().clearPushes();
    const state = usePushesStore.getState();

    expect(state.pushList).toStrictEqual([]);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
  });

  test('should replace the pushList with setPushes', async () => {
    const push = pushListFixture.results[0];
    const push2 = pushListFixture.results[1];
    usePushesStore.setState({
      ...initialState,
      pushList: [push],
      oldestPushTimestamp: push.push_timestamp,
    });

    usePushesStore.getState().setPushes([push2], {});
    const state = usePushesStore.getState();

    expect(state.pushList).toEqual([push2]);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
  });

  test('should get new unclassified counts with recalculateUnclassifiedCounts', async () => {
    window.location = { search: '?job_type_symbol=B', pathname: '/' };

    const { data: jobList } = await JobModel.getList({ push_id: 1 });

    usePushesStore.setState(initialState);
    usePushesStore.getState().updateJobMap(jobList);

    usePushesStore.getState().recalculateUnclassifiedCounts();
    const state = usePushesStore.getState();

    expect(Object.keys(state.jobMap)).toHaveLength(5);
    expect(state.allUnclassifiedFailureCount).toBe(2);
    expect(state.filteredUnclassifiedFailureCount).toBe(1);
  });

  test('should add to the jobMap with updateJobMap', async () => {
    const { data: jobList } = await JobModel.getList({ push_id: 2 });

    usePushesStore.setState(initialState);
    usePushesStore.getState().updateJobMap(jobList);
    const state = usePushesStore.getState();

    expect(Object.keys(state.jobMap)).toHaveLength(4);
  });

  test('jobMap jobs should have fields required for retriggering', async () => {
    const { data: jobList } = await JobModel.getList({ push_id: 2 });

    usePushesStore.setState(initialState);
    usePushesStore.getState().updateJobMap(jobList);
    const state = usePushesStore.getState();

    expect(Object.keys(state.jobMap)).toHaveLength(4);
    const job = state.jobMap['259539684'];
    expect(job.signature).toBe('f64069faca8636e9dc415bef8e9a4ee055d56687');
    expect(job.job_type_name).toBe(
      'test-android-hw-p2-8-0-arm7-api-16/debug-fennec-jittest-1proc-2',
    );
  });
});
