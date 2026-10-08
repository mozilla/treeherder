import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { createQueryParams, pushEndpoint } from '../helpers/url';
import { thPlatformMap } from '../helpers/constants';
import PushModel from '../models/push';

import { rememberHealth, rememberSummary, shared } from './cache';
import {
  ETA,
  NOT_RESULTS,
  PUSH_LIST_COUNT,
  RESULT_WORDS,
  SHORT_REVISION_LENGTH,
  TIME,
  UNCLASSIFIED_IDS,
} from './constants';

export const pushUrl = ({ repo, author, revision, job }) => {
  const q = new URLSearchParams({ repo });
  if (revision) q.set('revision', revision);
  if (job) q.set('job', job);
  if (author !== undefined && author !== null) q.set('author', author);
  return `/simple?${q}`;
};

export const authorName = (push) => {
  const people = (push?.revisions || [])
    .map((r) => r.author?.match(/^\s*(.*?)\s*<([^>]+)>/))
    .filter(Boolean)
    .map(([, name, email]) => ({ name, email: email.toLowerCase() }));
  const own = people.find((p) => p.email === push?.author?.toLowerCase());
  if (own?.name) return own.name;
  const names = new Set(people.map((p) => p.name).filter(Boolean));
  return names.size === 1 ? [...names][0] : null;
};

export const fetchPushes = (repo, author, count = PUSH_LIST_COUNT) =>
  getData(
    getProjectUrl(`${pushEndpoint}${createQueryParams({ author, count })}`, repo),
  );

export const fetchPush = (repo, revision) =>
  getData(
    getProjectUrl(`${pushEndpoint}${createQueryParams({ revision })}`, repo),
  );

export const fetchSummary = async (repo, revision) => {
  const { data, failureStatus } = await PushModel.getHealthSummary(
    repo,
    revision,
  );
  const summary = failureStatus || !Array.isArray(data) ? null : data[0];
  if (summary) rememberSummary(repo, revision, summary);
  return summary;
};

export const fetchHealth = (repo, revision) =>
  shared(`health:${repo}:${revision}`, async () => {
    const { data, failureStatus } = await PushModel.getHealth(repo, revision);
    if (failureStatus) return null;
    rememberHealth(repo, revision, data);
    return data;
  });

const isTrySyntax = (line) =>
  /^(Fuzzy query|try:|Try Chooser|Pushed via|Try task config)/i.test(line);

export const pushTitle = (push) => {
  const lines = push.revisions.map((r) => r.comments.split('\n')[0].trim());
  const human = lines.find((line) => line && !isTrySyntax(line));
  if (human) return human;
  const query = lines[0]?.match(/^Fuzzy query=(.*)/);
  if (query) return query[1].replace(/&query=/g, ' · ').replace(/[\^$'"]/g, '');
  return push.revision.slice(0, SHORT_REVISION_LENGTH);
};

export const jobShortName = (name) =>
  name.replace(/^source-test-mozlint-/, '').replace(/^source-test-/, '');

export const resultWord = (result) => RESULT_WORDS[result] || result;

export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

export const ago = (epochSeconds) => {
  const minutes = Math.max(0, Math.round(Date.now() / 1000 - epochSeconds) / 60);
  if (minutes < 1) return TIME.justNow;
  if (minutes < 60) return TIME.minutesAgo(Math.round(minutes));
  const hours = minutes / 60;
  if (hours < 24) return TIME.hoursAgo(Math.round(hours));
  const days = Math.round(hours / 24);
  return days === 1 ? TIME.yesterday : TIME.daysAgo(days);
};

export const duration = (epochSeconds) => {
  const minutes = Math.round((Date.now() / 1000 - epochSeconds) / 60);
  if (minutes < 60) return TIME.minutes(minutes);
  return TIME.hoursMinutes(Math.floor(minutes / 60), minutes % 60);
};

export const finishedCount = (status) =>
  Object.entries(status || {})
    .filter(([key]) => !NOT_RESULTS.has(key))
    .reduce((n, [, count]) => n + count, 0);

// Push Health's status summary undercounts failures, so count from the job list.
export const statusFromJobs = (jobs) => {
  const status = { completed: 0, pending: 0, running: 0, unscheduled: 0 };
  for (const job of jobs) {
    if (job.tier > 2) continue;
    if (job.state === 'completed') {
      status.completed += 1;
      status[job.result] = (status[job.result] || 0) + 1;
    } else {
      status[job.state] = (status[job.state] || 0) + 1;
    }
  }
  return status;
};

export const testFromErrorLine = (line = '') => {
  const parts = line.split(' | ');
  if (parts.length >= 2 && /TEST-UNEXPECTED|PROCESS-CRASH/.test(parts[0])) {
    return parts[1].trim();
  }
  return null;
};

export const fetchFirstFailingTest = async (repo, jobId) => {
  const { data, failureStatus } = await getData(
    getProjectUrl(`/jobs/${jobId}/text_log_errors/`, repo),
  );
  if (failureStatus || !Array.isArray(data)) return null;
  for (const error of data) {
    const test = testFromErrorLine(error.line);
    if (test) return test;
  }
  return null;
};

export const progressOf = (status) => {
  if (!status) return null;
  const done = finishedCount(status);
  const left =
    (status.pending || 0) + (status.running || 0) + (status.unscheduled || 0);
  return { done, left, total: done + left, running: left > 0 };
};

const clock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const minutesUntil = (ms, now = Date.now()) =>
  Math.max(1, Math.round((ms - now) / 60000));

const buildName = (name) =>
  ETA.buildName(name.replace(/^build-/, '').replace(/\/.*$/, '').replace(/-/g, ' '));

export const describeEta = (eta, { started = false, now = Date.now() } = {}) => {
  if (!eta) return null;
  if (eta.confidence === 'firm') {
    const soon = eta.mostAt <= now;
    return {
      headline: soon ? ETA.mostSoon : ETA.mostIn(minutesUntil(eta.mostAt, now)),
      line: ETA.mostLine(clock(eta.mostAt), clock(eta.allAt)),
    };
  }
  if (eta.confidence === 'blockedOnBuild' && eta.blockingBuild) {
    const { name, finishAt, blockedJobs } = eta.blockingBuild;
    return {
      headline:
        finishAt <= now
          ? ETA.startSoon(started)
          : ETA.startIn(started, minutesUntil(finishAt, now)),
      line: ETA.waitingOn(blockedJobs, buildName(name)),
    };
  }
  return null;
};

export const platformName = (platform = '') =>
  thPlatformMap[platform] || platform;

export const splitTestPath = (testName) => {
  const i = testName.lastIndexOf('/');
  if (i < 0 || testName.includes('://')) return { dir: '', file: testName };
  return { dir: testName.slice(0, i + 1), file: testName.slice(i + 1) };
};

export const groupByTest = (failures) => {
  const groups = new Map();
  for (const f of failures) {
    const g = groups.get(f.testName) || {
      testName: f.testName,
      jobIds: new Set(),
      totalJobs: 0,
      platforms: new Set(),
      configs: new Set(),
      failedInParent: true,
      entries: [],
    };
    for (const id of f.failedInJobs) g.jobIds.add(id);
    g.totalJobs += f.totalJobs;
    g.platforms.add(platformName(f.platform));
    g.configs.add(f.config);
    g.failedInParent = g.failedInParent && f.failedInParent;
    g.entries.push(f);
    groups.set(f.testName, g);
  }
  return [...groups.values()].sort((a, b) => b.jobIds.size - a.jobIds.size);
};

export const retriggerableJobs = (jobs, pushId) => {
  const runs = new Map();
  for (const j of jobs) {
    if (j.tier > 2) continue;
    runs.set(j.jobTypeName, (runs.get(j.jobTypeName) || 0) + 1);
  }
  return jobs
    .filter(
      (j) =>
        j.tier <= 2 &&
        j.state === 'completed' &&
        j.result === 'testfailed' &&
        j.platform !== 'lint' &&
        j.symbol !== 'mozlint' &&
        !j.jobTypeName.includes('build') &&
        UNCLASSIFIED_IDS.has(j.classification) &&
        runs.get(j.jobTypeName) === 1,
    )
    .map((j) => ({ id: j.id, push_id: pushId, job_type_name: j.jobTypeName }));
};
