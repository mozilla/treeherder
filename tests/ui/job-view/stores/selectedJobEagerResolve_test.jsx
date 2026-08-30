import {
  useSelectedJobStore,
  resolveSelectedJobFromUrl,
  syncSelectionFromUrl,
} from '../../../../ui/shared/stores/selectedJobStore';
import {
  setPendingScrollTaskRun,
  consumePendingScroll,
  clearJobButtonRegistry,
} from '../../../../ui/hooks/useJobButtonRegistry';

const mockGetList = jest.fn();

jest.mock('../../../../ui/models/job', () => ({
  __esModule: true,
  default: {
    getList: (...args) => mockGetList(...args),
  },
}));

const taskId = 'OeYt2-iLQSaQb2ashZ_VIQ';
const pushRevision = '1252c6014d122d48c6782310d5c3f4ae742751cb';

const apiJob = (overrides = {}) => ({
  id: 259537372,
  task_id: taskId,
  retry_id: 0,
  push_id: 494796,
  push_revision: pushRevision,
  state: 'completed',
  result: 'success',
  job_type_name: 'source-test-mozlint-spell',
  ...overrides,
});

const notify = jest.fn();

const setLocationSearch = (search) => {
  window.history.replaceState(null, null, `/jobs${search}`);
};

beforeEach(() => {
  notify.mockClear();
  mockGetList.mockReset();
  mockGetList.mockResolvedValue({ data: [], failureStatus: null });
  useSelectedJobStore.setState({ selectedJob: null });
  clearJobButtonRegistry();
  setLocationSearch('?repo=autoland');
});

afterEach(() => {
  setLocationSearch('');
  clearJobButtonRegistry();
  document.body.innerHTML = '';
});

describe('resolveSelectedJobFromUrl', () => {
  it('selects the job returned for a selectedTaskRun with a run id', async () => {
    const job = apiJob();
    mockGetList.mockResolvedValue({ data: [job], failureStatus: null });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    const resolved = await resolveSelectedJobFromUrl(notify);

    expect(mockGetList).toHaveBeenCalledWith({
      task_id: taskId,
      retry_id: 0,
    });
    expect(resolved.id).toBe(job.id);
    expect(useSelectedJobStore.getState().selectedJob.id).toBe(job.id);
    expect(useSelectedJobStore.getState().selectedJob.task_run).toBe(
      `${taskId}.0`,
    );
  });

  it('omits retry_id and picks the highest run when the URL has no run id', async () => {
    const run0 = apiJob({ id: 1, retry_id: 0 });
    const run1 = apiJob({ id: 2, retry_id: 1 });
    mockGetList.mockResolvedValue({ data: [run0, run1], failureStatus: null });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}`);

    const resolved = await resolveSelectedJobFromUrl(notify);

    expect(mockGetList).toHaveBeenCalledWith({ task_id: taskId });
    expect(resolved.retry_id).toBe(1);
    expect(useSelectedJobStore.getState().selectedJob.id).toBe(2);
  });

  it('resolves a selectedJob id param via the jobs endpoint', async () => {
    const job = apiJob();
    mockGetList.mockResolvedValue({ data: [job], failureStatus: null });
    setLocationSearch(`?repo=autoland&selectedJob=${job.id}`);

    const resolved = await resolveSelectedJobFromUrl(notify);

    expect(mockGetList).toHaveBeenCalledWith({ id: job.id });
    expect(resolved.id).toBe(job.id);
    expect(useSelectedJobStore.getState().selectedJob.id).toBe(job.id);
  });

  it('returns null without calling the API when no selection params exist', async () => {
    setLocationSearch('?repo=autoland');

    const resolved = await resolveSelectedJobFromUrl(notify);

    expect(resolved).toBeNull();
    expect(mockGetList).not.toHaveBeenCalled();
  });

  it('notifies and strips the params when the task is not found', async () => {
    mockGetList.mockResolvedValue({ data: [], failureStatus: null });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    const resolved = await resolveSelectedJobFromUrl(notify);

    expect(resolved).toBeNull();
    expect(useSelectedJobStore.getState().selectedJob).toBeNull();
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining(taskId),
      'danger',
      { sticky: true },
    );
    expect(window.location.search).not.toContain('selectedTaskRun');
  });
});

describe('setSelectedJobFromQueryString with an eagerly resolved job', () => {
  it('keeps the eager selection when the jobMap misses but the task matches', () => {
    const eagerJob = apiJob({ task_run: `${taskId}.0` });
    useSelectedJobStore.setState({ selectedJob: eagerJob });
    setLocationSearch(
      `?repo=autoland&revision=${pushRevision}&selectedTaskRun=${taskId}.0`,
    );

    syncSelectionFromUrl({}, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBe(eagerJob);
  });

  it('keeps the eager selection without querying the db when no revision is set', () => {
    const eagerJob = apiJob({ task_run: `${taskId}.0` });
    useSelectedJobStore.setState({ selectedJob: eagerJob });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    syncSelectionFromUrl({}, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBe(eagerJob);
    expect(mockGetList).not.toHaveBeenCalled();
  });

  it('keeps the eager selection for a selectedJob id param', () => {
    const eagerJob = apiJob({ task_run: `${taskId}.0` });
    useSelectedJobStore.setState({ selectedJob: eagerJob });
    setLocationSearch(`?repo=autoland&selectedJob=${eagerJob.id}`);

    syncSelectionFromUrl({}, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBe(eagerJob);
    expect(mockGetList).not.toHaveBeenCalled();
  });

  it('still clears a selection for a different task when the jobMap misses', () => {
    const otherJob = apiJob({
      task_id: 'Za9t2-iLQSaQb2ashZ_VIQ',
      task_run: 'Za9t2-iLQSaQb2ashZ_VIQ.0',
    });
    useSelectedJobStore.setState({ selectedJob: otherJob });
    setLocationSearch(
      `?repo=autoland&revision=${pushRevision}&selectedTaskRun=${taskId}.0`,
    );

    syncSelectionFromUrl({}, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBeNull();
  });

  it('marks a pending scroll for the resolved job', async () => {
    mockGetList.mockResolvedValue({ data: [apiJob()], failureStatus: null });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    await resolveSelectedJobFromUrl(notify);

    expect(consumePendingScroll(`${taskId}.0`)).toBe(true);
  });

  it('scrolls to the job button when the post-load sync finds the job', () => {
    const jobMapJob = apiJob({ task_run: `${taskId}.0` });
    document.body.innerHTML = `<div id="push-list"><button data-job-id="${jobMapJob.id}"></button></div>`;
    const button = document.querySelector('button');
    button.scrollIntoView = jest.fn();
    // Make isOnScreen() false so scrollToElement actually scrolls.
    button.getBoundingClientRect = () => ({ top: 500, bottom: 520 });
    setPendingScrollTaskRun(`${taskId}.0`);
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    syncSelectionFromUrl({ [jobMapJob.id]: jobMapJob }, notify);

    expect(button.scrollIntoView).toHaveBeenCalled();
    // The pending scroll was consumed.
    expect(consumePendingScroll(`${taskId}.0`)).toBe(false);
  });

  it('does not scroll on sync when no scroll is pending', () => {
    const jobMapJob = apiJob({ task_run: `${taskId}.0` });
    document.body.innerHTML = `<div id="push-list"><button data-job-id="${jobMapJob.id}"></button></div>`;
    const button = document.querySelector('button');
    button.scrollIntoView = jest.fn();
    button.getBoundingClientRect = () => ({ top: 500, bottom: 520 });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    syncSelectionFromUrl({ [jobMapJob.id]: jobMapJob }, notify);

    expect(button.scrollIntoView).not.toHaveBeenCalled();
  });

  it('swaps the eager selection for the jobMap instance on a hit', () => {
    const eagerJob = apiJob({ task_run: `${taskId}.0` });
    const jobMapJob = apiJob({ task_run: `${taskId}.0` });
    useSelectedJobStore.setState({ selectedJob: eagerJob });
    setLocationSearch(`?repo=autoland&selectedTaskRun=${taskId}.0`);

    syncSelectionFromUrl({ [jobMapJob.id]: jobMapJob }, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBe(jobMapJob);
  });
});
