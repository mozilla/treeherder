import fetchMock from 'fetch-mock';
import { waitFor } from '@testing-library/react';
import keyBy from 'lodash/keyBy';

import { useSelectedJobStore } from '../../../../ui/job-view/stores/selectedJobStore';
import { usePushStore } from '../../../../ui/job-view/stores/pushStore';
import group from '../../mock/group_with_jobs';
import { getApiUrl } from '../../../../ui/helpers/url';
import jobListFixtureOne from '../../mock/job_list/job_1';

const jobMap = keyBy(group.jobs, 'id');
let notifications = [];

describe('SelectedJob Zustand store', () => {
  const repoName = 'autoland';

  beforeEach(() => {
    // Reset stores before each test
    useSelectedJobStore.setState({
      selectedJob: null,
    });
    usePushStore.setState({
      pushList: [],
      jobMap: {},
      decisionTaskMap: {},
      revisionTips: [],
    });

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
    const job = group.jobs[0];

    useSelectedJobStore.getState().setSelectedJob(job, true);

    // Should update store state
    expect(useSelectedJobStore.getState().selectedJob).toEqual(job);

    // URL should be updated via window.history.pushState
    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      '',
      expect.stringContaining(`selectedTaskRun=${taskRun}`),
    );
  });

  test('setSelectedJobFromQueryString found in jobMap', async () => {
    const taskRun = 'UCctvnxZR0--JcxyVGc8VA.0';

    // Set up jobMap in push store
    usePushStore.setState({ jobMap });

    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
    });

    // setSelectedJobFromQueryString takes (notify, jobMap) as arguments
    await useSelectedJobStore
      .getState()
      .setSelectedJobFromQueryString(() => {}, jobMap);

    expect(useSelectedJobStore.getState().selectedJob).toEqual(group.jobs[0]);
  });

  test('setSelectedJobFromQueryString not in jobMap triggers notification', async () => {
    const taskRun = 'VaQoWKTbSdGSwBJn6UZV9g.0';

    // Set up jobMap in push store (without the job we're looking for)
    usePushStore.setState({ jobMap });

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
    });

    // setSelectedJobFromQueryString takes (notify, jobMap) as arguments
    await useSelectedJobStore
      .getState()
      .setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap);

    // Job not found in jobMap should trigger notification
    await waitFor(() =>
      expect(notifications[0]).toBe(
        'Selected task: VaQoWKTbSdGSwBJn6UZV9g not within current push range.',
      ),
    );
  });

  test('setSelectedJobFromQueryString not in DB', async () => {
    const taskRun = 'a824gBVmRQSBuEexnVW_Qg.0';

    // Set up jobMap in push store (without the job we're looking for)
    usePushStore.setState({ jobMap });

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: `?repo=${repoName}&selectedTaskRun=${taskRun}`,
        pathname: '/jobs',
      },
      writable: true,
    });

    // setSelectedJobFromQueryString takes (notify, jobMap) as arguments
    await useSelectedJobStore
      .getState()
      .setSelectedJobFromQueryString((msg) => notifications.push(msg), jobMap);

    await waitFor(() =>
      expect(notifications[0]).toBe(
        'Task not found: a824gBVmRQSBuEexnVW_Qg, run 0',
      ),
    );
  });

  test('clearSelectedJob', async () => {
    // First set a job
    useSelectedJobStore.setState({ selectedJob: group.jobs[0] });

    useSelectedJobStore.getState().clearSelectedJob(0);

    // Should clear the selected job
    expect(useSelectedJobStore.getState().selectedJob).toBeNull();

    // URL should be updated via window.history.pushState
    expect(window.history.pushState).toHaveBeenCalled();
  });
});
