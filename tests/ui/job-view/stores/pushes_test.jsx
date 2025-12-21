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
import {
  usePushStore,
  fetchPushes,
} from '../../../../ui/job-view/stores/pushStore';
import { getApiUrl } from '../../../../ui/helpers/url';
import JobModel from '../../../../ui/models/job';

const emptyBugzillaResponse = {
  bugs: [],
};

describe('Pushes Zustand store', () => {
  const repoName = 'autoland';
  const originalLocation = window.location;

  beforeEach(() => {
    // Reset store before each test
    usePushStore.setState({
      pushList: [],
      jobMap: {},
      decisionTaskMap: {},
      revisionTips: [],
      allUnclassifiedFailureCount: 0,
      filteredUnclassifiedFailureCount: 0,
      oldestPushTimestamp: null,
      bugSummaryMap: {},
    });

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

    await fetchPushes();
    const state = usePushStore.getState();

    expect(state.pushList).toEqual(pushListFixture.results);
    expect(state.oldestPushTimestamp).toBe(1562867109);
  });

  test('should add new push when polling', async () => {
    // Set initial state with one push
    const initialPush = pushListFixture.results[0];
    usePushStore.setState({
      pushList: [initialPush],
      oldestPushTimestamp: initialPush.push_timestamp,
      revisionTips: [
        {
          author: 'jarilvalenciano@gmail.com',
          revision: 'ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
          title:
            "Fuzzy query='debugger | 'node-devtools&query='mozlint-eslint&query='mochitest-devtools",
        },
      ],
    });

    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=100&fromchange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
        repoName,
      ),
      pollPushListFixture,
    );
    // Mock any jobs fetch that happens during polling (includes all push IDs)
    fetchMock.mock(
      `begin:${getApiUrl('/jobs/?push_id__in=', repoName)}`,
      jobListFixtureTwo,
    );

    fetchMock.get(
      `https://bugzilla.mozilla.org/rest/bug?id=1506219`,
      emptyBugzillaResponse,
    );

    await usePushStore.getState().pollPushes();
    const state = usePushStore.getState();

    // Should have the initial push plus the polled pushes
    expect(state.pushList.length).toBeGreaterThan(1);
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

    // Set initial state
    usePushStore.setState({
      pushList: [push],
      oldestPushTimestamp: push.push_timestamp,
    });

    await fetchPushes(10, true);

    // replaceLocation uses null, null for pushState
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      null,
      expect.stringContaining(
        'tochange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
      ),
    );
  });

  test('should pare down to single revision with updateRange', async () => {
    // Set initial state with all pushes
    usePushStore.setState({
      pushList: pushListFixture.results,
      jobMap: {},
    });

    await usePushStore
      .getState()
      .updateRange({ revision: '9692347caff487cdcd889489b8e89a825fe6bbd1' });
    const state = usePushStore.getState();

    // Should only have the matching push
    expect(state.pushList).toEqual([pushListFixture.results[2]]);
  });

  test('should fetch a new set of pushes with updateRange', async () => {
    // PushModel.getList adds count=100 by default when fromchange is set
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

    // updateRange calls fetchPushes() without awaiting it, so we need to wait for state update
    usePushStore
      .getState()
      .updateRange({ fromchange: '9692347caff487cdcd889489b8e89a825fe6bbd1' });

    // Wait for the async fetch to complete
    await new Promise((resolve) => {
      const unsubscribe = usePushStore.subscribe((state) => {
        if (state.pushList.length > 0) {
          unsubscribe();
          resolve();
        }
      });
      // Timeout fallback
      setTimeout(() => {
        unsubscribe();
        resolve();
      }, 2000);
    });

    const state = usePushStore.getState();
    expect(state.pushList).toEqual(pushListFromChangeFixture.results);
  });

  test('should clear the pushList with clearPushes', async () => {
    const push = pushListFixture.results[0];
    usePushStore.setState({
      pushList: pushListFixture.results,
      oldestPushTimestamp: push.push_timestamp,
      allUnclassifiedFailureCount: 5,
      filteredUnclassifiedFailureCount: 3,
    });

    usePushStore.getState().clearPushes();
    const state = usePushStore.getState();

    expect(state.pushList).toStrictEqual([]);
    expect(state.allUnclassifiedFailureCount).toBe(0);
    expect(state.filteredUnclassifiedFailureCount).toBe(0);
  });

  test('should replace the pushList with setPushes', async () => {
    const push = pushListFixture.results[0];
    const push2 = pushListFixture.results[1];
    usePushStore.setState({
      pushList: [push],
      oldestPushTimestamp: push.push_timestamp,
    });

    usePushStore.getState().setPushes([push2]);
    const state = usePushStore.getState();

    expect(state.pushList).toEqual([push2]);
  });

  test('should build jobMap when pushes with jobs are set', async () => {
    const { data: jobList } = await JobModel.getList({ push_id: 2 });

    // In Zustand, jobs are nested within pushes and jobMap is built automatically
    const pushWithJobs = { ...pushListFixture.results[0], jobs: jobList };
    usePushStore.getState().setPushes([pushWithJobs]);
    const state = usePushStore.getState();

    expect(Object.keys(state.jobMap)).toHaveLength(4);
  });

  test('jobMap jobs should have fields required for retriggering', async () => {
    const { data: jobList } = await JobModel.getList({ push_id: 2 });

    // In Zustand, jobs are nested within pushes and jobMap is built automatically
    const pushWithJobs = { ...pushListFixture.results[0], jobs: jobList };
    usePushStore.getState().setPushes([pushWithJobs]);
    const state = usePushStore.getState();

    expect(Object.keys(state.jobMap)).toHaveLength(4);
    const job = state.jobMap['259539684'];
    expect(job.signature).toBe('f64069faca8636e9dc415bef8e9a4ee055d56687');
    expect(job.job_type_name).toBe(
      'test-android-hw-p2-8-0-arm7-api-16/debug-fennec-jittest-1proc-2',
    );
  });

  test('should update unclassified counts when pushes with jobs are set', async () => {
    // Set window.location to have the filter that will limit results
    window.location = { search: '?job_type_symbol=B', pathname: '/' };

    const { data: jobList } = await JobModel.getList({ push_id: 1 });

    // In Zustand, jobs are nested within pushes and counts are calculated automatically
    const pushWithJobs = { ...pushListFixture.results[0], jobs: jobList };
    usePushStore.getState().setPushes([pushWithJobs]);
    const state = usePushStore.getState();

    expect(Object.keys(state.jobMap)).toHaveLength(5);
    expect(state.allUnclassifiedFailureCount).toBe(2);
    expect(state.filteredUnclassifiedFailureCount).toBe(1);
  });
});
