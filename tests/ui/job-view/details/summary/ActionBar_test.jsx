import { act, render, screen } from '@testing-library/react';

import ActionBar from '../../../../../ui/job-view/details/summary/ActionBar';
import {
  usePushesStore,
  initialState as pushesInitialState,
} from '../../../../../ui/shared/stores/pushesStore';
import { thEvents } from '../../../../../ui/helpers/constants';
import JobModel from '../../../../../ui/models/job';

jest.mock('../../../../../ui/models/job', () => ({
  __esModule: true,
  default: {
    retrigger: jest.fn(),
  },
}));

const baseProps = {
  selectedJobFull: {
    id: 1,
    task_id: 'TASK_ID',
    state: 'completed',
    push_id: 1,
    resultStatus: 'success',
    job_group_name: 'Build',
    job_type_name: 'build-linux',
    job_type_symbol: 'B',
    submit_timestamp: 0,
  },
  user: { isLoggedIn: true, email: 'me@example.com' },
  logParseStatus: 'parsed',
  currentRepo: { name: 'autoland', tc_root_url: 'https://tc.example' },
  jobLogUrls: [],
  jobDetails: [],
};

describe('ActionBar expired-task disabling', () => {
  beforeEach(() => {
    JobModel.retrigger.mockClear();
    usePushesStore.setState({
      ...pushesInitialState,
      decisionTaskMap: { 1: { id: 'DEC_TASK' } },
    });
  });

  it('does not disable Retrigger by default', () => {
    render(<ActionBar {...baseProps} />);

    expect(screen.getByTitle(/^Retrigger job/)).not.toBeDisabled();
  });

  it('disables Retrigger when taskExpired is true', () => {
    render(<ActionBar {...baseProps} taskExpired />);

    const retrigger = screen.getByTitle(/^Retrigger job/);
    expect(retrigger).toBeDisabled();
    expect(retrigger.getAttribute('title')).toContain(
      'Taskcluster task expired',
    );
  });

  // The jobRetrigger event (fired by the "r" keyboard shortcut) bypasses the
  // disabled button, so retriggerJob must guard against expired tasks itself.
  it('retriggers via the jobRetrigger event when not expired', () => {
    render(<ActionBar {...baseProps} />);

    window.dispatchEvent(
      new CustomEvent(thEvents.jobRetrigger, {
        detail: { job: baseProps.selectedJobFull },
      }),
    );

    expect(JobModel.retrigger).toHaveBeenCalledTimes(1);
  });

  it('ignores the jobRetrigger event when taskExpired is true', () => {
    render(<ActionBar {...baseProps} taskExpired />);

    window.dispatchEvent(
      new CustomEvent(thEvents.jobRetrigger, {
        detail: { job: baseProps.selectedJobFull },
      }),
    );

    expect(JobModel.retrigger).not.toHaveBeenCalled();
  });
});

// The window listeners are registered once on mount, so they must read the
// latest props/store values rather than those captured at mount time.
describe('ActionBar window event handlers use current values', () => {
  const dispatch = (name, detail) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  beforeEach(() => {
    JobModel.retrigger.mockClear();
    usePushesStore.setState({
      ...pushesInitialState,
      decisionTaskMap: { 1: { id: 'DEC_TASK' } },
    });
  });

  it('ignores jobRetrigger once taskExpired flips to true on rerender', () => {
    const { rerender } = render(<ActionBar {...baseProps} />);

    rerender(<ActionBar {...baseProps} taskExpired />);
    dispatch(thEvents.jobRetrigger, { job: baseProps.selectedJobFull });

    expect(JobModel.retrigger).not.toHaveBeenCalled();
  });

  it('retriggers with the latest decisionTaskMap from the store', () => {
    render(<ActionBar {...baseProps} />);

    act(() => {
      usePushesStore.setState({ decisionTaskMap: { 1: { id: 'NEW_TASK' } } });
    });
    dispatch(thEvents.jobRetrigger, { job: baseProps.selectedJobFull });

    expect(JobModel.retrigger).toHaveBeenCalledWith(
      [baseProps.selectedJobFull],
      baseProps.currentRepo,
      expect.any(Function),
      1,
      { 1: { id: 'NEW_TASK' } },
    );
  });

  it('opens the resource usage profile from jobDetails loaded after mount', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
    const { rerender } = render(<ActionBar {...baseProps} />);
    const profileUrl = 'https://tc.example/profile_resource-usage.json';

    rerender(
      <ActionBar
        {...baseProps}
        jobDetails={[{ value: 'profile_resource-usage.json', url: profileUrl }]}
      />,
    );
    dispatch(thEvents.openGeckoProfile);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(profileUrl)),
      '_blank',
    );
    openSpy.mockRestore();
  });

  it('removes its window listeners on unmount', () => {
    const { unmount } = render(<ActionBar {...baseProps} />);

    unmount();
    dispatch(thEvents.jobRetrigger, { job: baseProps.selectedJobFull });

    expect(JobModel.retrigger).not.toHaveBeenCalled();
  });
});
