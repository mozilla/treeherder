import { useEffect, useRef, useState } from 'react';

import { COUNT_UP_MS, MAX_REQUESTS_IN_FLIGHT, PULSE_MS } from './constants';

// Polls while the tab is visible, and once more the moment it becomes
// visible again (a phone coming out of a pocket).
export const usePoll = (load, intervalMs, enabled = true) => {
  const saved = useRef(load);
  saved.current = load;

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') saved.current();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
};

// True for one beat whenever `key` changes after its first value.
export const usePulse = (key) => {
  const previous = useRef(key);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (previous.current !== undefined && previous.current !== key) {
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), PULSE_MS);
      previous.current = key;
      return () => clearTimeout(id);
    }
    previous.current = key;
    return undefined;
  }, [key]);

  return pulsing;
};

// Keeps a list of pushes from asking for every summary at once.
let inFlight = 0;
const waiting = [];

export const queued = (task) =>
  new Promise((resolve, reject) => {
    const run = () => {
      inFlight += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          inFlight -= 1;
          if (waiting.length) waiting.shift()();
        });
    };
    if (inFlight < MAX_REQUESTS_IN_FLIGHT) run();
    else waiting.push(run);
  });

export const useCountUp = (target, ms = COUNT_UP_MS) => {
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    if (target == null) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.current = target;
      setValue(target);
      return undefined;
    }
    const from = shown.current;
    const start = performance.now();
    let frame;
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      shown.current = Math.round(from + (target - from) * eased);
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return value;
};
