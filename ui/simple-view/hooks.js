import { useEffect, useRef, useState } from 'react';

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

export const usePulse = (key) => {
  const previous = useRef(key);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (previous.current !== undefined && previous.current !== key) {
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 1200);
      previous.current = key;
      return () => clearTimeout(id);
    }
    previous.current = key;
    return undefined;
  }, [key]);

  return pulsing;
};

const MAX_IN_FLIGHT = 4;
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
    if (inFlight < MAX_IN_FLIGHT) run();
    else waiting.push(run);
  });

export const useCountUp = (target, ms = 900) => {
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
