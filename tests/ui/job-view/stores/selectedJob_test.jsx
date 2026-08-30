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
    // The URL names a task that isn't in the loaded pushes, and the current
    // selection is a different job (a matching selection would be kept --
    // see selectedJobEagerResolve_test.jsx).
    useSelectedJobStore.setState({
      selectedJob: { ...testJob, id: 1, task_id: 'Za9t2-iLQSaQb2ashZ_VIQ' },
    });
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
});
