// BuildWatch's push ETA model: per-job-type median run times, plus queue wait
// read live from jobs in the same worker pool that have already started.

import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { createQueryParams } from '../helpers/url';

const COLUMNS = {
  id: 'id',
  state: 'state',
  result: 'result',
  symbol: 'job_type_symbol',
  classification: 'failure_classification_id',
  tier: 'tier',
  platform: 'platform',
  platformOption: 'platform_option',
  jobTypeName: 'job_type_name',
  submit: 'submit_timestamp',
  start: 'start_timestamp',
  end: 'end_timestamp',
};

const STATES = new Set(['pending', 'running', 'completed', 'unscheduled']);

const stamp = (v) => (typeof v === 'number' && v > 0 ? v : null);

export const parseJobRows = ({ job_property_names: names, results }) => {
  if (!Array.isArray(names) || !Array.isArray(results)) return [];
  const at = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, name]) => [key, names.indexOf(name)]),
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
      state: STATES.has(state) ? state : 'pending',
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

const PAGE = 2000;

export const fetchPushJobs = async (repo, pushId) => {
  const jobs = new Map();
  for (let offset = 0; ; offset += PAGE) {
    const { data, failureStatus } = await getData(
      getProjectUrl(
        `/jobs/${createQueryParams({
          push_id: pushId,
          count: PAGE,
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
    if (data.results.length < PAGE || jobs.size === before) break;
  }
  return [...jobs.values()];
};

let tablePromise;
export const loadDurationTable = () => {
  tablePromise =
    tablePromise ||
    import(/* webpackChunkName: "job-durations" */ './job-durations.json').then(
      (m) => m.default || m,
    );
  return tablePromise;
};

const HARD_FALLBACK_MINUTES = 20.8;

export const familyKey = (name) => name.replace(/-\d+$/, '');

export const expectedRunTime = (job, table) => {
  const minutes =
    table?.exact?.[job.jobTypeName] ??
    table?.family?.[familyKey(job.jobTypeName)] ??
    table?.platform?.[`${job.platform}|${job.platformOption}`] ??
    table?.global ??
    HARD_FALLBACK_MINUTES;
  return minutes * 60;
};

const poolKey = (job) => `${job.platform}|${job.platformOption}`;

const queueWait = (job) =>
  job.submit != null && job.start != null && job.start > job.submit
    ? job.start - job.submit
    : null;

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

const TAIL_CALIBRATION = 1.25;

const FIRM_COVERAGE = 0.6;

const MINIMUM_ELAPSED = 8 * 60;

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

  const gate = buildGate(unresolved, poolWaits, globalWait, nowS, table);

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
    } else if (poolWaits.has(poolKey(job))) {
      observed += 1;
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
    projected[Math.min(projected.length - 1, Math.floor(projected.length * 0.9))];
  const last = projected[projected.length - 1];
  const mostS = Math.max(nowS, p90);
  const allS = Math.max(
    mostS,
    nowS + Math.max(0, last - nowS) * TAIL_CALIBRATION,
  );

  const coverage = observed / unresolved.length;
  let confidence = 'estimating';
  let blockingBuild = null;
  if (nowS - pushedS >= MINIMUM_ELAPSED && coverage >= FIRM_COVERAGE) {
    confidence = 'firm';
  } else if (gate && gate.releasesAt > nowS) {
    confidence = 'blockedOnBuild';
    blockingBuild = {
      name: gate.stage,
      finishAt: gate.releasesAt * 1000,
      blockedJobs: unresolved.filter(
        (j) => j.start == null && !poolWaits.has(poolKey(j)),
      ).length,
    };
  }

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
