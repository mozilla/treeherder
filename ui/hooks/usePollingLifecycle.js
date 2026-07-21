import { useEffect, useRef, useCallback } from 'react';

import { usePollControlStore } from '../shared/stores/pollControlStore';

export const PUSH_POLL_INTERVAL = 60000; // 1 minute
export const IDLE_POLL_TIMEOUT_DEFAULT = 2 * 60 * 60 * 1000; // 2 hours
export const IDLE_POLL_TIMEOUT_KEEPALIVE = 12 * 60 * 60 * 1000; // 12 hours

// Manages the jobs-view push/job poll: a periodic interval plus a Page
// Visibility idle timeout. Once a tab has been backgrounded for longer than its
// idle limit (2h, or 12h with keep-alive) polling stops so a forgotten tab
// stops accumulating data. Bringing the tab back to the foreground resumes
// polling (with one immediate catch-up poll) and resets the idle clock.
export default function usePollingLifecycle(pollPushes) {
  const keepAlive = usePollControlStore((state) => state.keepAlive);
  const setPollingPaused = usePollControlStore(
    (state) => state.setPollingPaused,
  );

  const intervalRef = useRef(null);
  const idleTimerRef = useRef(null);
  // Read the current keep-alive value from a ref so toggling it never has to
  // re-register the visibility listener.
  const keepAliveRef = useRef(keepAlive);

  useEffect(() => {
    keepAliveRef.current = keepAlive;
  }, [keepAlive]);

  const startPolling = useCallback(() => {
    if (intervalRef.current === null) {
      intervalRef.current = setInterval(() => {
        pollPushes();
      }, PUSH_POLL_INTERVAL);
    }
    setPollingPaused(false);
  }, [pollPushes, setPollingPaused]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPollingPaused(true);
  }, [setPollingPaused]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Backgrounded: stop polling after the idle limit of continuous hiding.
      const limit = keepAliveRef.current
        ? IDLE_POLL_TIMEOUT_KEEPALIVE
        : IDLE_POLL_TIMEOUT_DEFAULT;
      idleTimerRef.current = setTimeout(stopPolling, limit);
    } else {
      // Foregrounded: cancel any pending idle stop; if polling had been paused,
      // resume it with an immediate catch-up poll.
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (intervalRef.current === null) {
        pollPushes();
        startPolling();
      }
    }
  }, [pollPushes, startPolling, stopPolling]);

  useEffect(() => {
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [startPolling, handleVisibilityChange]);
}
