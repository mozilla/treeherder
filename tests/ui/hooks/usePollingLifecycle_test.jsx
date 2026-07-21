import { renderHook, act } from '@testing-library/react';

import usePollingLifecycle, {
  PUSH_POLL_INTERVAL,
  IDLE_POLL_TIMEOUT_DEFAULT,
  IDLE_POLL_TIMEOUT_KEEPALIVE,
} from '../../../ui/hooks/usePollingLifecycle';
import { usePollControlStore } from '../../../ui/shared/stores/pollControlStore';

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('usePollingLifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    usePollControlStore.setState({ keepAlive: false, pollingPaused: false });
    setHidden(false);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('polls on the interval while the tab is visible', () => {
    const pollPushes = jest.fn();
    renderHook(() => usePollingLifecycle(pollPushes));

    act(() => jest.advanceTimersByTime(PUSH_POLL_INTERVAL * 3));

    expect(pollPushes).toHaveBeenCalledTimes(3);
  });

  test('stops polling after the idle timeout while backgrounded', () => {
    const pollPushes = jest.fn();
    renderHook(() => usePollingLifecycle(pollPushes));

    setHidden(true);
    act(() => jest.advanceTimersByTime(IDLE_POLL_TIMEOUT_DEFAULT));

    expect(usePollControlStore.getState().pollingPaused).toBe(true);

    // Interval is cleared: no further polls happen while stopped.
    pollPushes.mockClear();
    act(() => jest.advanceTimersByTime(PUSH_POLL_INTERVAL * 5));
    expect(pollPushes).not.toHaveBeenCalled();
  });

  test('resumes with a catch-up poll when brought back to the foreground', () => {
    const pollPushes = jest.fn();
    renderHook(() => usePollingLifecycle(pollPushes));

    setHidden(true);
    act(() => jest.advanceTimersByTime(IDLE_POLL_TIMEOUT_DEFAULT));
    expect(usePollControlStore.getState().pollingPaused).toBe(true);

    pollPushes.mockClear();
    setHidden(false);

    // Immediate catch-up poll on resume, and polling is no longer paused.
    expect(pollPushes).toHaveBeenCalledTimes(1);
    expect(usePollControlStore.getState().pollingPaused).toBe(false);

    act(() => jest.advanceTimersByTime(PUSH_POLL_INTERVAL));
    expect(pollPushes).toHaveBeenCalledTimes(2);
  });

  test('refocusing before the idle timeout keeps polling and resets the clock', () => {
    const pollPushes = jest.fn();
    renderHook(() => usePollingLifecycle(pollPushes));

    setHidden(true);
    act(() => jest.advanceTimersByTime(IDLE_POLL_TIMEOUT_DEFAULT - 1000));
    setHidden(false); // refocus just before the limit

    expect(usePollControlStore.getState().pollingPaused).toBe(false);
    // Was never paused, so no catch-up poll fired and the interval kept running.
    pollPushes.mockClear();
    act(() => jest.advanceTimersByTime(PUSH_POLL_INTERVAL));
    expect(pollPushes).toHaveBeenCalledTimes(1);
  });

  test('keep-alive extends the idle timeout to 12 hours', () => {
    const pollPushes = jest.fn();
    usePollControlStore.setState({ keepAlive: true });
    renderHook(() => usePollingLifecycle(pollPushes));

    setHidden(true);
    // Past the default limit but under the keep-alive limit: still polling.
    act(() => jest.advanceTimersByTime(IDLE_POLL_TIMEOUT_DEFAULT));
    expect(usePollControlStore.getState().pollingPaused).toBe(false);

    // Past the keep-alive limit: now stopped.
    act(() =>
      jest.advanceTimersByTime(
        IDLE_POLL_TIMEOUT_KEEPALIVE - IDLE_POLL_TIMEOUT_DEFAULT,
      ),
    );
    expect(usePollControlStore.getState().pollingPaused).toBe(true);
  });
});
