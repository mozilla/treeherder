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
  enforcePushLimit,
  getRepoPushCap,
} from '../../../../ui/shared/stores/pushesStore';
import { useSelectedJobStore } from '../../../../ui/shared/stores/selectedJobStore';
import { usePinnedJobsStore } from '../../../../ui/shared/stores/pinnedJobsStore';
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
    useSelectedJobStore.setState({ selectedJob: null });
    usePinnedJobsStore.setState({ pinnedJobs: {} });
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

  test('getRepoPushCap returns 200 for autoland and 100 for other repos', () => {
    window.location = { ...originalLocation, search: '?repo=autoland' };
    expect(getRepoPushCap()).toBe(200);

    window.location = { ...originalLocation, search: '?repo=try' };
    expect(getRepoPushCap()).toBe(100);

    window.location = { ...originalLocation, search: '' };
    expect(getRepoPushCap()).toBe(100);
  });

  test('fetchPushes floors retainedPushLimit at the repo push cap', async () => {
    fetchMock.get(
      getProjectUrl('/push/?full=true&count=10', repoName),
      pushListFixture,
    );
    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1556854%2C1555861%2C1559418%2C1563766%2C1561537%2C1563692`,
      emptyBugzillaResponse,
    );

    // No repo in the URL => default cap of 100 is the floor, above the 6-push
    // fixture, so the limit lands on the cap rather than the loaded count.
    usePushesStore.setState(initialState);
    await usePushesStore.getState().fetchPushes();

    expect(usePushesStore.getState().retainedPushLimit).toBe(100);
  });

  const buildPushList = (ids) =>
    ids.map((id) => ({
      id,
      revision: `rev${id}`,
      author: 'a@b.com',
      push_timestamp: 1000 + id,
      revisions: [{ comments: `title ${id}` }],
      jobsLoaded: true,
    }));

  test('enforcePushLimit evicts oldest pushes beyond retainedPushLimit and prunes jobMap', () => {
    const pushList = buildPushList([5, 4, 3, 2, 1]); // newest-first
    const jobMap = {};
    pushList.forEach((p) => {
      jobMap[p.id * 10] = {
        id: p.id * 10,
        push_id: p.id,
        state: 'completed',
        result: 'success',
        last_modified: '2019-08-05T20:00:00',
      };
    });

    usePushesStore.setState({
      ...initialState,
      pushList,
      jobMap,
      retainedPushLimit: 3,
    });

    usePushesStore.setState((state) => enforcePushLimit(state));
    const state = usePushesStore.getState();

    expect(state.pushList.map((p) => p.id)).toEqual([5, 4, 3]);
    expect(Object.keys(state.jobMap).sort()).toEqual(['30', '40', '50']);
    expect(state.oldestPushTimestamp).toBe(1003);
  });

  test('enforcePushLimit never evicts the selected or a pinned push', () => {
    const pushList = buildPushList([5, 4, 3, 2, 1]);

    usePushesStore.setState({ ...initialState, pushList, retainedPushLimit: 3 });
    // Select a job on the oldest push (id 1); pin a job on push id 2.
    useSelectedJobStore.setState({ selectedJob: { id: 999, push_id: 1 } });
    usePinnedJobsStore.setState({ pinnedJobs: { 998: { id: 998, push_id: 2 } } });

    usePushesStore.setState((state) => enforcePushLimit(state));
    const keptIds = usePushesStore.getState().pushList.map((p) => p.id);

    // 3 newest kept, plus protected pushes 1 and 2.
    expect(keptIds.sort((a, b) => b - a)).toEqual([5, 4, 3, 2, 1]);
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

  test('pollPushes trims the pushList back to retainedPushLimit', async () => {
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=100&fromchange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
        repoName,
      ),
      pollPushListFixture,
    );
    fetchMock.mock(`begin:${getApiUrl('/jobs/?push_id__in=', repoName)}`, {
      count: 0,
      next: null,
      results: [],
    });
    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1506219`,
      emptyBugzillaResponse,
    );

    const initialPush = pushListFixture.results[0];
    // limit 1 => after polling prepends pushes, only the newest remains.
    usePushesStore.setState({
      ...initialState,
      pushList: [initialPush],
      retainedPushLimit: 1,
    });

    await usePushesStore.getState().pollPushes();

    expect(usePushesStore.getState().pushList).toHaveLength(1);
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

  test('fetchNewJobs only queries incomplete, forced, or selected pushes', async () => {
    // push 1: running job (incomplete); push 2: all completed;
    // push 3: completed but force-flagged active.
    const pushList = [1, 2, 3].map((id) => ({ id, revision: `rev${id}` }));
    const jobMap = {
      10: {
        id: 10,
        push_id: 1,
        state: 'running',
        last_modified: '2019-08-05T20:00:00',
      },
      20: {
        id: 20,
        push_id: 2,
        state: 'completed',
        last_modified: '2019-08-05T20:00:00',
      },
      30: {
        id: 30,
        push_id: 3,
        state: 'completed',
        last_modified: '2019-08-05T20:00:00',
      },
    };

    usePushesStore.setState({
      ...initialState,
      pushList,
      jobMap,
      forcePollPushIds: new Set([3]),
    });

    let requestedUrl = '';
    fetchMock.mock(`begin:${getApiUrl('/jobs/?', repoName)}`, (url) => {
      requestedUrl = url;
      return { count: 0, next: null, results: [] };
    });

    window.location = { search: '', pathname: '/jobs' };
    await usePushesStore.getState().fetchNewJobs();

    const params = new URLSearchParams(requestedUrl.split('?')[1]);
    const ids = params
      .get('push_id__in')
      .split(',')
      .map(Number)
      .sort((a, b) => a - b);
    // push 2 (all completed, not forced, not selected) is excluded.
    expect(ids).toEqual([1, 3]);
  });

  test('markPushActive adds a push id to forcePollPushIds', () => {
    usePushesStore.setState({ ...initialState, forcePollPushIds: new Set() });

    usePushesStore.getState().markPushActive(42);

    expect(usePushesStore.getState().forcePollPushIds.has(42)).toBe(true);
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
