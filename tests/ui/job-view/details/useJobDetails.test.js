import { renderHook, waitFor, act } from '@testing-library/react';
import { Queue } from 'taskcluster-client-web';

import useJobDetails, {
  fetchTaskData,
} from '../../../../ui/job-view/details/useJobDetails';
import JobModel from '../../../../ui/models/job';
import JobLogUrlModel from '../../../../ui/models/jobLogUrl';
import PerfSeriesModel from '../../../../ui/models/perfSeries';
import JobClassificationModel from '../../../../ui/models/classification';
import BugJobMapModel from '../../../../ui/models/bugJobMap';
import { getData } from '../../../../ui/helpers/http';

jest.mock('../../../../ui/models/job', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('../../../../ui/models/jobLogUrl', () => ({
  __esModule: true,
  default: { getList: jest.fn() },
}));
jest.mock('../../../../ui/models/perfSeries', () => ({
  __esModule: true,
  default: { getJobData: jest.fn() },
}));
jest.mock('../../../../ui/models/classification', () => ({
  __esModule: true,
  default: { getList: jest.fn() },
}));
jest.mock('../../../../ui/models/bugJobMap', () => ({
  __esModule: true,
  default: { getList: jest.fn() },
}));
jest.mock('../../../../ui/helpers/http', () => ({
  getData: jest.fn(),
}));

const currentRepo = {
  name: 'autoland',
  tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
};
const frameworks = [];

const makeJob = (overrides = {}) => ({
  id: 1,
  task_id: 'TASK_A',
  retry_id: 0,
  push_id: 10,
  state: 'completed',
  result: 'testfailed',
  failure_classification_id: 1,
  job_type_name: 'test-linux-mochitest-1',
  job_type_symbol: 'M1',
  job_group_name: 'Mochitests',
  platform: 'linux1804-64',
  platform_option: 'opt',
  submit_timestamp: 1700000000,
  start_timestamp: 1700000100,
  end_timestamp: 1700000200,
  ...overrides,
});

const mockResolvedFetches = ({ artifactName = 'public/summary.jsonl' } = {}) => {
  JobModel.get.mockImplementation((repoName, id) =>
    Promise.resolve(makeJob({ id, logs: [] })),
  );
  JobLogUrlModel.getList.mockResolvedValue([]);
  PerfSeriesModel.getJobData.mockResolvedValue({
    failureStatus: null,
    data: { data: [] },
  });
  JobClassificationModel.getList.mockResolvedValue([]);
  BugJobMapModel.getList.mockResolvedValue([]);
  getData.mockResolvedValue({
    failureStatus: null,
    data: { artifacts: [{ name: artifactName, contentLength: 10 }] },
  });
};

describe('useJobDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolvedFetches();
  });

  const renderJobDetails = (initialProps) =>
    renderHook(
      (props) =>
        useJobDetails(
          props.selectedJob,
          props.currentRepo,
          props.pushList,
          props.frameworks,
        ),
      { initialProps },
    );

  it('clears stale artifact, perf, and test group data when a new job is selected', async () => {
    const jobA = makeJob();
    const pushList = [{ id: 10, revision: 'abc123' }];

    const { result, rerender } = renderJobDetails({
      selectedJob: jobA,
      currentRepo,
      pushList,
      frameworks,
    });

    await waitFor(() => expect(result.current.jobDetails).toHaveLength(1));
    expect(result.current.jobDetails[0].value).toBe('summary.jsonl');

    // Job B's requests never resolve, so any lingering data belongs to job A
    JobModel.get.mockImplementation(() => new Promise(() => {}));
    getData.mockImplementation(() => new Promise(() => {}));

    const jobB = makeJob({ id: 2, task_id: 'TASK_B' });
    await act(async () => {
      rerender({ selectedJob: jobB, currentRepo, pushList, frameworks });
    });

    expect(result.current.jobDetails).toEqual([]);
    expect(result.current.perfJobDetail).toEqual([]);
    expect(result.current.testGroups).toEqual([]);
  });

  it('does not refetch when the selected job and push list only change identity (poll)', async () => {
    const jobA = makeJob();
    const pushList = [{ id: 10, revision: 'abc123' }];

    const { result, rerender } = renderJobDetails({
      selectedJob: jobA,
      currentRepo,
      pushList,
      frameworks,
    });

    await waitFor(() => expect(result.current.jobDetails).toHaveLength(1));
    expect(JobModel.get).toHaveBeenCalledTimes(1);

    // Simulate a poll cycle: same job data, new object identities
    await act(async () => {
      rerender({
        selectedJob: { ...jobA },
        currentRepo,
        pushList: [...pushList],
        frameworks,
      });
    });

    // Wait past the debounce window to catch any scheduled reload
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });
    });

    expect(JobModel.get).toHaveBeenCalledTimes(1);
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('refetches when a meaningful job field changes (job completes)', async () => {
    const jobA = makeJob({ state: 'running', result: 'unknown' });
    const pushList = [{ id: 10, revision: 'abc123' }];

    const { result, rerender } = renderJobDetails({
      selectedJob: jobA,
      currentRepo,
      pushList,
      frameworks,
    });

    await waitFor(() => expect(result.current.jobDetails).toHaveLength(1));
    expect(JobModel.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({
        selectedJob: makeJob({ state: 'completed', result: 'testfailed' }),
        currentRepo,
        pushList,
        frameworks,
      });
    });

    // Same job id, so the reload is debounced
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });
    });

    expect(JobModel.get).toHaveBeenCalledTimes(2);
  });
});

describe('fetchTaskData', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns defaults without args and does not mark expired', async () => {
    expect(await fetchTaskData(null, null)).toEqual({
      testGroups: [],
      taskQueueId: null,
      taskExpired: false,
    });
  });

  it('marks taskExpired when the Taskcluster task lookup fails', async () => {
    Queue.mockImplementationOnce(() => ({
      task: jest.fn().mockRejectedValue(new Error('404: task not found')),
    }));

    const result = await fetchTaskData('EXPIRED_TASK_ID', 'https://tc.example');

    expect(result).toEqual({
      testGroups: [],
      taskQueueId: null,
      taskExpired: true,
    });
  });

  it('returns task data with taskExpired false on success', async () => {
    Queue.mockImplementationOnce(() => ({
      task: jest.fn().mockResolvedValue({
        taskQueueId: 'gecko-3/b-linux',
        payload: { env: {} },
      }),
    }));

    const result = await fetchTaskData('LIVE_TASK', 'https://tc.example');

    expect(result).toEqual({
      testGroups: [],
      taskQueueId: 'gecko-3/b-linux',
      taskExpired: false,
    });
  });
});
