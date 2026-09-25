// Show what we knew last time at once, then quietly replace it. A finished
// push never changes and a running one changes slowly, so the last answer is
// almost always the right first frame.

const PREFIX = 'pushView:';
const MAX_HEALTH = 8;
const MAX_SUMMARIES = 60;

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Full or disabled storage just means no head start next time.
  }
};

// A small map kept in one key, trimmed to the most recently written entries.
const boundedMap = (key, max) => ({
  get: (id) => read(key)?.[id]?.value ?? null,
  set: (id, value) => {
    const all = read(key) || {};
    all[id] = { value, at: Date.now() };
    const keep = Object.entries(all)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, max);
    write(key, Object.fromEntries(keep));
  },
});

const summaries = boundedMap('summaries', MAX_SUMMARIES);
const healths = boundedMap('health', MAX_HEALTH);
const pushRecords = boundedMap('push', MAX_SUMMARIES);

export const cachedPushes = (repo, author) => read(`pushes:${repo}:${author}`);
export const rememberPushes = (repo, author, pushes) =>
  write(`pushes:${repo}:${author}`, pushes);

export const cachedPush = (repo, revision) => pushRecords.get(`${repo}:${revision}`);
export const rememberPush = (repo, push) =>
  pushRecords.set(`${repo}:${push.revision}`, push);

export const cachedSummary = (repo, revision) =>
  summaries.get(`${repo}:${revision}`);
export const rememberSummary = (repo, revision, summary) =>
  summaries.set(`${repo}:${revision}`, summary);

export const cachedHealth = (repo, revision) =>
  healths.get(`${repo}:${revision}`);
export const rememberHealth = (repo, revision, health) =>
  healths.set(`${repo}:${revision}`, health);

// In-flight requests, so a fetch started when a finger lands on a row is the
// same one the detail screen waits on when it opens.
const inFlight = new Map();

export const shared = (key, start, freshMs = 5000) => {
  const hit = inFlight.get(key);
  if (hit && Date.now() - hit.at < freshMs) return hit.promise;
  const promise = start();
  inFlight.set(key, { promise, at: Date.now() });
  return promise;
};
