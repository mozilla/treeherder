import {
  useSelectedJobStore,
  syncSelectionFromUrl,
} from '../../../../ui/shared/stores/selectedJobStore';

jest.mock('../../../../ui/models/job', () => ({
  __esModule: true,
  default: {
    getList: jest.fn(() => Promise.resolve({ data: [], failureStatus: null })),
  },
}));

const testJob = {
  id: 259537372,
  task_id: 'OeYt2-iLQSaQb2ashZ_VIQ',
  retry_id: 0,
  job_type_name: 'source-test-mozlint-spell',
};

const notify = jest.fn();

const setLocationSearch = (search) => {
  window.history.replaceState(null, null, `/jobs${search}`);
};

beforeEach(() => {
  notify.mockClear();
  useSelectedJobStore.setState({ selectedJob: null });
  setLocationSearch('?repo=autoland');
});

afterEach(() => {
  jest.restoreAllMocks();
  setLocationSearch('');
});

describe('syncSelectionFromUrl', () => {
  it('clears the selected job when the URL has no selection params', () => {
    // A task was selected, then the user navigated to a URL without
    // selectedTaskRun (e.g. switched repos via the watched-repo links).
    useSelectedJobStore.setState({ selectedJob: testJob });
    setLocationSearch('?repo=mozilla-central');

    syncSelectionFromUrl({}, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBeNull();
  });

  it('clears the selected job when the task is not in the loaded jobs', () => {
    // The URL still names a task, but the loaded pushes (e.g. after a repo
    // switch) don't contain it.
    useSelectedJobStore.setState({ selectedJob: testJob });
    setLocationSearch(
      '?repo=mozilla-central&selectedTaskRun=OeYt2-iLQSaQb2ashZ_VIQ.0',
    );

    syncSelectionFromUrl({}, notify);

    expect(useSelectedJobStore.getState().selectedJob).toBeNull();
  });

  it('keeps the selected job when the task is in the loaded jobs', () => {
    useSelectedJobStore.setState({ selectedJob: null });
    setLocationSearch(
      '?repo=autoland&selectedTaskRun=OeYt2-iLQSaQb2ashZ_VIQ.0',
    );

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);

    expect(useSelectedJobStore.getState().selectedJob).toEqual(testJob);
  });

  // Syncing derives state from the URL the user is already on, so it must
  // never add history entries: each one is an extra Back press, and an entry
  // pushed while the user is already going Back re-selects the job.
  it('does not add history entries when the URL is already normalized', () => {
    setLocationSearch(
      '?repo=autoland&selectedTaskRun=OeYt2-iLQSaQb2ashZ_VIQ.0',
    );
    const pushState = jest.spyOn(window.history, 'pushState');
    const replaceState = jest.spyOn(window.history, 'replaceState');

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(useSelectedJobStore.getState().selectedJob).toEqual(testJob);
  });

  it('rewrites a selectedJob URL to selectedTaskRun in place', () => {
    setLocationSearch(`?repo=autoland&selectedJob=${testJob.id}`);
    const pushState = jest.spyOn(window.history, 'pushState');
    const lengthBefore = window.history.length;

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);

    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(lengthBefore);
    expect(window.location.search).toBe(
      '?repo=autoland&selectedTaskRun=OeYt2-iLQSaQb2ashZ_VIQ.0',
    );
    expect(useSelectedJobStore.getState().selectedJob).toEqual(testJob);
  });

  it('removes a malformed selectedTaskRun in place', () => {
    setLocationSearch('?repo=autoland&selectedTaskRun=not-a-task-run');
    const pushState = jest.spyOn(window.history, 'pushState');

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);

    expect(pushState).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?repo=autoland');
  });
});
