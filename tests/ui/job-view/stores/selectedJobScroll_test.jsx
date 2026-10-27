import {
  useSelectedJobStore,
  syncSelectionFromUrl,
} from '../../../../ui/shared/stores/selectedJobStore';
import {
  registerJobButton,
  clearJobButtonRegistry,
} from '../../../../ui/hooks/useJobButtonRegistry';
import {
  registerJobGroup,
  clearJobGroupRegistry,
} from '../../../../ui/hooks/useJobGroupRegistry';
import { getGroupMapKey } from '../../../../ui/helpers/aggregateId';

jest.mock('../../../../ui/models/job', () => ({
  __esModule: true,
  default: {
    getList: jest.fn(() => Promise.resolve({ data: [], failureStatus: null })),
  },
}));

const testJob = {
  id: 259537372,
  push_id: 1234,
  task_id: 'OeYt2-iLQSaQb2ashZ_VIQ',
  retry_id: 0,
  task_run: 'OeYt2-iLQSaQb2ashZ_VIQ.0',
  job_group_symbol: 'M',
  job_type_symbol: 'bc1',
  tier: 1,
  platform: 'linux64',
  platform_option: 'opt',
};

const groupKey = getGroupMapKey(
  testJob.push_id,
  testJob.job_group_symbol,
  testJob.tier,
  testJob.platform,
  testJob.platform_option,
);

const notify = jest.fn();

// Place the element far below the (empty) scroll container so it counts as
// off screen and a scroll is required.
const offScreen = (el) => {
  el.getBoundingClientRect = () => ({
    top: 2000,
    bottom: 2020,
    left: 0,
    right: 20,
    width: 20,
    height: 20,
  });
  el.scrollIntoView = jest.fn();
  return el;
};

const flushAnimationFrames = () => {
  jest.advanceTimersByTime(100);
};

describe('selecting a job from the URL scrolls it into view', () => {
  let pushList;

  beforeEach(() => {
    jest.useFakeTimers();
    notify.mockClear();
    clearJobButtonRegistry();
    clearJobGroupRegistry();
    useSelectedJobStore.setState({ selectedJob: null });
    window.history.replaceState(
      null,
      null,
      `/jobs?repo=autoland&selectedTaskRun=${testJob.task_run}`,
    );

    pushList = document.createElement('div');
    pushList.id = 'push-list';
    document.body.appendChild(pushList);
  });

  afterEach(() => {
    pushList.remove();
    jest.useRealTimers();
    window.history.replaceState(null, null, '/');
  });

  it('scrolls the job button into view once the selection has rendered', () => {
    const button = offScreen(document.createElement('button'));
    button.setAttribute('data-job-id', testJob.id);
    pushList.appendChild(button);
    registerJobButton(testJob.id, {
      props: { job: testJob },
      setSelected: jest.fn(),
    });

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);

    // The scroll is deferred so the details panel can open and resize the
    // push list first; scrolling synchronously lands at a stale offset.
    expect(button.scrollIntoView).not.toHaveBeenCalled();

    flushAnimationFrames();

    expect(button.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(useSelectedJobStore.getState().selectedJob).toEqual(testJob);
  });

  it('expands a collapsed group containing the job and scrolls to it', () => {
    const groupEl = offScreen(document.createElement('span'));
    groupEl.setAttribute('data-group-key', groupKey);
    pushList.appendChild(groupEl);
    const setExpanded = jest.fn();
    registerJobGroup(groupKey, { setExpanded });

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);

    expect(setExpanded).toHaveBeenCalledWith(true);

    flushAnimationFrames();

    expect(groupEl.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('prefers the job button over the group once the group has expanded', () => {
    const groupEl = offScreen(document.createElement('span'));
    groupEl.setAttribute('data-group-key', groupKey);
    pushList.appendChild(groupEl);
    const button = offScreen(document.createElement('button'));
    button.setAttribute('data-job-id', testJob.id);
    registerJobGroup(groupKey, {
      // Simulate React mounting the job button when the group expands.
      setExpanded: () => groupEl.appendChild(button),
    });

    syncSelectionFromUrl({ [testJob.id]: testJob }, notify);
    flushAnimationFrames();

    expect(button.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(groupEl.scrollIntoView).not.toHaveBeenCalled();
  });
});
