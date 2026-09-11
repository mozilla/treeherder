import {
  usePushesStore,
  fetchInitialPushes,
  initialState,
} from '../../../../ui/shared/stores/pushesStore';
import { useSelectedJobStore } from '../../../../ui/shared/stores/selectedJobStore';
import { clearJobButtonRegistry } from '../../../../ui/hooks/useJobButtonRegistry';

const mockJobGetList = jest.fn();
const mockPushGetList = jest.fn();

jest.mock('../../../../ui/models/job', () => ({
  __esModule: true,
  default: {
    getList: (...args) => mockJobGetList(...args),
  },
}));

jest.mock('../../../../ui/models/push', () => ({
  __esModule: true,
  default: {
    getList: (...args) => mockPushGetList(...args),
  },
}));

const taskId = 'OeYt2-iLQSaQb2ashZ_VIQ';
const pushRevision = '1252c6014d122d48c6782310d5c3f4ae742751cb';

const apiJob = {
  id: 259537372,
  task_id: taskId,
  retry_id: 0,
  push_id: 494796,
  push_revision: pushRevision,
  state: 'completed',
  result: 'success',
  job_type_name: 'source-test-mozlint-spell',
};

const notify = jest.fn();

const setLocationSearch = (search) => {
  window.history.replaceState(null, null, `/jobs${search}`);
};

beforeEach(() => {
  notify.mockClear();
  mockJobGetList.mockReset();
  mockPushGetList.mockReset();
  mockJobGetList.mockResolvedValue({ data: [apiJob], failureStatus: null });
  mockPushGetList.mockResolvedValue({
    data: { results: [] },
    failureStatus: null,
  });
  usePushesStore.setState({ ...initialState });
  useSelectedJobStore.setState({ selectedJob: null });
  clearJobButtonRegistry();
  setLocationSearch('?repo=autoland');
});

afterEach(() => {
  setLocationSearch('');
  clearJobButtonRegistry();
});

describe('fetchInitialPushes', () => {
  it('fetches only the resolved job push for a deep link without range params', async () => {
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    const job = await fetchInitialPushes(notify);

    expect(job.id).toBe(apiJob.id);
    // The job was resolved before any push fetch.
    expect(mockJobGetList).toHaveBeenCalledWith({
      task_id: taskId,
      retry_id: 0,
    });
    // The push fetch was limited to the job's revision.
    expect(mockPushGetList).toHaveBeenCalledTimes(1);
    expect(mockPushGetList.mock.calls[0][0]).toMatchObject({
      revision: pushRevision,
    });
    // The URL now names the revision, so get-next-N and reloads behave
    // consistently with a normal single-revision view.
    expect(window.location.search).toContain(`revision=${pushRevision}`);
    expect(window.location.search).toContain(`selectedTaskRun=${taskId}.0`);
    // The eager selection is set for the details panel.
    expect(useSelectedJobStore.getState().selectedJob.id).toBe(apiJob.id);
  });

  it('normalizes a selectedJob id param to selectedTaskRun in the URL', async () => {
    setLocationSearch(`?repo=autoland&selectedJob=${apiJob.id}`);

    await fetchInitialPushes(notify);

    expect(mockJobGetList).toHaveBeenCalledWith({ id: apiJob.id });
    expect(window.location.search).toContain(`selectedTaskRun=${taskId}.0`);
    expect(window.location.search).not.toContain('selectedJob=');
    expect(window.location.search).toContain(`revision=${pushRevision}`);
  });

  it('keeps an explicit range but still resolves the job eagerly', async () => {
    setLocationSearch(
      `?repo=autoland&fromchange=abcdef123456&selectedTaskRun=${taskId}.0`,
    );

    const job = await fetchInitialPushes(notify);

    expect(job).toBeNull();
    // The user's range params win; no revision rewrite happens.
    expect(window.location.search).toContain('fromchange=abcdef123456');
    expect(window.location.search).not.toContain('revision=');
    expect(mockPushGetList).toHaveBeenCalledTimes(1);
    expect(mockPushGetList.mock.calls[0][0]).toMatchObject({
      fromchange: 'abcdef123456',
    });
    // The eager resolution still happened, for details-first loading.
    expect(mockJobGetList).toHaveBeenCalledWith({
      task_id: taskId,
      retry_id: 0,
    });
  });

  it('fetches the default pushes when there is no selection param', async () => {
    setLocationSearch('?repo=autoland');

    const job = await fetchInitialPushes(notify);

    expect(job).toBeNull();
    expect(mockJobGetList).not.toHaveBeenCalled();
    expect(mockPushGetList).toHaveBeenCalledTimes(1);
    expect(mockPushGetList.mock.calls[0][0]).toMatchObject({ count: 10 });
  });

  it('falls back to the default pushes when the task cannot be resolved', async () => {
    mockJobGetList.mockResolvedValue({ data: [], failureStatus: null });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    const job = await fetchInitialPushes(notify);

    expect(job).toBeNull();
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining(taskId),
      'danger',
      { sticky: true },
    );
    expect(mockPushGetList).toHaveBeenCalledTimes(1);
    expect(mockPushGetList.mock.calls[0][0]).toMatchObject({ count: 10 });
    expect(mockPushGetList.mock.calls[0][0].revision).toBeUndefined();
  });
});
