import { Queue } from 'taskcluster-client-web';

import { fetchTaskData } from '../../../../ui/job-view/details/useJobDetails';

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
