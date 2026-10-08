import { CACHE_LIMITS, STORAGE_PREFIX } from './constants';

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key));
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
  }
};

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

const summaries = boundedMap('summaries', CACHE_LIMITS.summaries);
const healths = boundedMap('health', CACHE_LIMITS.health);
const pushRecords = boundedMap('push', CACHE_LIMITS.summaries);

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

const inFlight = new Map();

export const shared = (key, start, freshMs = 5000) => {
  const hit = inFlight.get(key);
  if (hit && Date.now() - hit.at < freshMs) return hit.promise;
  const promise = start();
  inFlight.set(key, { promise, at: Date.now() });
  return promise;
};

export const recentPeople = () => read('people') || [];

export const rememberPerson = (email, name) => {
  if (!email) return;
  const key = email.toLowerCase();
  const people = recentPeople();
  const known = people.find((p) => p.email === key);
  const next = [
    { email: key, name: name || known?.name || null },
    ...people.filter((p) => p.email !== key),
  ].slice(0, CACHE_LIMITS.people);
  write('people', next);
};

export const clearRecentPeople = () => write('people', []);

export const personName = (email) =>
  recentPeople().find((p) => p.email === email?.toLowerCase())?.name || null;
