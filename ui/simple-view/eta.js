// BuildWatch's push ETA model: per-job-type median run times, plus queue wait
// read live from jobs in the same worker pool that have already started.

import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { createQueryParams } from '../helpers/url';

import { ETA_MODEL, JOB_COLUMNS, JOB_PAGE_SIZE, JOB_STATES } from './constants';
import { orNull } from './helpers';

// Treeherder writes a missing timestamp as 0; left alone it reads as 1970.
const stamp = (v) => (typeof v === 'number' && v > 0 ? v : null);

export const parseJobRows = ({ job_property_names: names, results }) => {
  if (!Array.isArray(names) || !Array.isArray(results)) return [];
  const at = Object.fromEntries(
    Object.entries(JOB_COLUMNS).map(([key, name]) => [key, names.indexOf(name)]),
  );
  const get = (row, key) => (at[key] >= 0 ? row[at[key]] : undefined);

  const jobs = [];
  for (const row of results) {
    const id = get(row, 'id');
    const state = get(row, 'state');
    const platform = get(row, 'platform');
    if (typeof id !== 'number' || typeof state !== 'string' || !platform) {
      continue;
    }
    jobs.push({
      id,
      // An unknown state counts as pending: guessing "done" would promise a
      // finish with jobs still queued.
      state: JOB_STATES.has(state) ? state : 'pending',
      result: get(row, 'result') || 'unknown',
      symbol: get(row, 'symbol') || '',
      classification: get(row, 'classification') ?? 1,
      tier: get(row, 'tier') ?? 1,
      platform,
      platformOption: get(row, 'platformOption') || '',
      jobTypeName: get(row, 'jobTypeName') || '',
      submit: stamp(get(row, 'submit')),
      start: stamp(get(row, 'start')),
      end: stamp(get(row, 'end')),
    });
  }
  return jobs;
};

export const fetchPushJobs = orNull(async (repo, pushId) => {
  const jobs = new Map();
  for (let offset = 0; ; offset += JOB_PAGE_SIZE) {
    const { data, failureStatus } = await getData(
      getProjectUrl(
        `/jobs/${createQueryParams({
          push_id: pushId,
          count: JOB_PAGE_SIZE,
          offset,
          return_type: 'list',
          exclusion_profile: false,
        })}`,
        repo,
      ),
    );
    if (failureStatus) return null;
    const before = jobs.size;
    for (const job of parseJobRows(data)) jobs.set(job.id, job);
    // Stop on a short page, or one that added nothing new: list endpoints have
    // been seen to repeat rows rather than advance.
    if (data.results.length < JOB_PAGE_SIZE || jobs.size === before) break;
  }
  return [...jobs.values()];
});

// Loaded lazily so the 140 KB table is its own chunk and /jobs never pays for it.
let tablePromise;
export const loadDurationTable = () => {
  tablePromise =
    tablePromise ||
    import(/* webpackChunkName: "job-durations" */ './job-durations.json').then(
      (m) => m.default || m,
    );
  return tablePromise;
};

// Dropping the chunk number lets an unseen chunk inherit its siblings' timing.
export const familyKey = (name) => name.replace(/-\d+$/, '');

export const expectedRunTime = (job, table) => {
  const minutes =
    table?.exact?.[job.jobTypeName] ??
    table?.family?.[familyKey(job.jobTypeName)] ??
    table?.platform?.[`${job.platform}|${job.platformOption}`] ??
    table?.global ??
    ETA_MODEL.fallbackMinutes;
  return minutes * 60;
};

// Jobs sharing this key contend for the same workers, so share a queue wait.
const poolKey = (job) => `${job.platform}|${job.platformOption}`;

const queueWait = (job) =>
  job.submit != null && job.start != null && job.start > job.submit
    ? job.start - job.submit
    : null;

// A shippable build is a pipeline: instrumented-build makes a profiling
// binary, generate-profile runs it, and only then does build make what the
// tests consume.
export const buildStage = ({ jobTypeName: n }) => {
  if (n.startsWith('toolchain-')) return 0;
  if (n.startsWith('instrumented-build-')) return 1;
  if (n.startsWith('generate-profile-')) return 2;
  if (
    n.startsWith('build-') ||
    n.startsWith('spidermonkey-') ||
    n.includes('-build-')
  )
    return 3;
  return null;
};

const median = (values) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Walks the build chain stage by stage to find when tests are released. A
// running stage is projected from its own start; one that hasn't started
// from the previous stage's end plus a normal queue wait.
const buildGate = (unresolved, poolWaits, globalWait, now, table) => {
  let frontier = null;
  let running = null;

  for (let stage = 0; stage <= 3; stage += 1) {
    const ends = [];
    for (const job of unresolved) {
      if (buildStage(job) !== stage) continue;
      const run = expectedRunTime(job, table);
      if (job.start != null) {
        const end = job.start + run;
        ends.push(end);
        if (!running || end > running.end) {
          running = { end, name: job.jobTypeName };
        }
      } else if (frontier != null) {
        ends.push(frontier + globalWait + run);
      } else if (poolWaits.has(poolKey(job)) && job.submit != null) {
        const wait = Math.max(poolWaits.get(poolKey(job)), now - job.submit);
        ends.push(job.submit + wait + run);
      }
    }
    if (ends.length) {
      const stageEnd = Math.max(...ends);
      frontier = Math.max(frontier ?? stageEnd, stageEnd);
    }
  }

  return frontier != null && running
    ? { releasesAt: frontier, stage: running.name }
    : null;
};

// Null when there's nothing to estimate. Otherwise `confidence` is:
//   'firm'           show `mostAt` (90% of jobs) and `allAt` (approximate)
//   'blockedOnBuild' tests wait on a running build; show `blockingBuild`
//   'estimating'     too early; `mostAt`/`allAt` are null
// Every tier counts: an ETA that skipped tier 2 would promise a finish with
// hundreds of jobs queued.
export const estimatePush = (jobs, table, { now = Date.now(), pushedAt }) => {
  if (!jobs?.length) return null;
  const nowS = now / 1000;
  const pushedS = pushedAt / 1000;

  const resolvedEnds = [];
  const unresolved = [];
  const waits = new Map();

  for (const job of jobs) {
    if (job.state === 'completed' && job.end != null) resolvedEnds.push(job.end);
    else unresolved.push(job);
    // A start stamp observes the pool's queue even if the job has since finished.
    const wait = queueWait(job);
    if (wait != null) {
      const key = poolKey(job);
      if (!waits.has(key)) waits.set(key, []);
      waits.get(key).push(wait);
    }
  }
  if (!unresolved.length) return null;

  const poolWaits = new Map([...waits].map(([k, v]) => [k, median(v)]));
  const globalWait = poolWaits.size ? median([...poolWaits.values()]) : 0;

  // A job in a pool where nothing has started is usually waiting on a build,
  // not idly queued.
  const gate = buildGate(unresolved, poolWaits, globalWait, nowS, table);
  // A test the build hasn't released yet can't start before the gate opens,
  // even if its pool already has an observed queue wait.
  const waitsOnGate = (job) =>
    gate && job.state === 'unscheduled' && buildStage(job) == null;

  const projected = [...resolvedEnds];
  let worstEnd = Number.NEGATIVE_INFINITY;
  let worstJob = null;
  let observed = 0;

  for (const job of unresolved) {
    const run = expectedRunTime(job, table);
    let end;
    if (job.start != null) {
      end = job.start + run;
    } else if (job.submit == null) {
      continue;
    } else if (waitsOnGate(job)) {
      const wait = poolWaits.get(poolKey(job)) ?? globalWait;
      end = Math.max(gate.releasesAt, nowS) + wait + run;
    } else if (poolWaits.has(poolKey(job))) {
      observed += 1;
      // Never predict a wait shorter than the one already served.
      const wait = Math.max(poolWaits.get(poolKey(job)), nowS - job.submit);
      end = job.submit + wait + run;
    } else if (gate) {
      end = Math.max(gate.releasesAt, nowS) + globalWait + run;
    } else {
      end = job.submit + Math.max(globalWait, nowS - job.submit) + run;
    }
    projected.push(end);
    if (end > worstEnd) {
      worstEnd = end;
      worstJob = job;
    }
  }

  if (projected.length <= resolvedEnds.length) return null;

  projected.sort((a, b) => a - b);
  const p90 =
    projected[Math.min(projected.length - 1, Math.floor(projected.length * ETA_MODEL.mostResultsQuantile))];
  const last = projected[projected.length - 1];
  const mostS = Math.max(nowS, p90);
  const allS = Math.max(
    mostS,
    nowS + Math.max(0, last - nowS) * ETA_MODEL.tailCalibration,
  );

  const coverage = observed / unresolved.length;
  let confidence = 'estimating';
  let blockingBuild = null;
  if (nowS - pushedS >= ETA_MODEL.minimumElapsedSeconds && coverage >= ETA_MODEL.firmCoverage) {
    confidence = 'firm';
  } else if (gate && gate.releasesAt > nowS) {
    confidence = 'blockedOnBuild';
    blockingBuild = {
      name: gate.stage,
      finishAt: gate.releasesAt * 1000,
      blockedJobs: unresolved.filter(
        (j) => j.start == null && (waitsOnGate(j) || !poolWaits.has(poolKey(j))),
      ).length,
    };
  }

  // Only name a long pole when it's really holding things up: it's a hint,
  // not a fact.
  let longPole = null;
  let longPoleRemaining = 0;
  if (worstJob && worstEnd > mostS + 5 * 60) {
    longPole = worstJob.platformOption
      ? `${worstJob.platform} ${worstJob.platformOption}`
      : worstJob.platform;
    longPoleRemaining = unresolved.filter(
      (j) => poolKey(j) === poolKey(worstJob),
    ).length;
  }

  const span = allS - pushedS;
  const firm = confidence === 'firm';
  return {
    confidence,
    mostAt: firm ? mostS * 1000 : null,
    allAt: firm ? allS * 1000 : null,
    mostFraction: firm && span > 0 ? Math.min(1, Math.max(0, (mostS - pushedS) / span)) : null,
    pushedAt,
    blockingBuild,
    longPole,
    longPoleRemaining,
  };
};
