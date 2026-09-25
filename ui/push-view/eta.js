// When a try push will be done. A port of BuildWatch's PushETA.
//
// A push doesn't finish smoothly: on a sampled 907-job push, 90% of the jobs
// were in at 47 minutes and the last at 144, and that tail was queueing, not
// working. So there are two numbers. `mostAt` (90% of jobs) is the headline:
// replayed over 77 finished pushes it has a median error of 2 minutes and
// overruns by more than 30 minutes 1% of the time. `allAt` (last job) is
// real but soft, 13 minutes median error, and should read as approximate.
//
// Run time comes from a table of per-job-type medians (job-durations.json);
// it varies about 5%. Queue wait is the hard part, and it's read live: in a
// worker pool, the jobs that have started tell you what the ones that haven't
// will wait.

import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { createQueryParams } from '../helpers/url';

// Taskcluster jobs come back as positional rows; these are the columns the
// model reads.
const COLUMNS = {
  id: 'id',
  state: 'state',
  tier: 'tier',
  platform: 'platform',
  platformOption: 'platform_option',
  jobTypeName: 'job_type_name',
  submit: 'submit_timestamp',
  start: 'start_timestamp',
  end: 'end_timestamp',
};

const STATES = new Set(['pending', 'running', 'completed', 'unscheduled']);

// Treeherder writes an absent timestamp as 0, not null. Left as 0 it reads as
// 1 January 1970, and every queued job looks like it started 56 years ago.
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
      // An unknown state is filed as pending, not completed: guessing "done"
      // is the error that promises a finish with jobs still queued.
      state: STATES.has(state) ? state : 'pending',
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
    // Stop on a short page, or on a page that added nothing new: Treeherder's
    // list endpoints have been seen to repeat rows rather than advance.
    if (data.results.length < PAGE || jobs.size === before) break;
  }
  return [...jobs.values()];
};

// Lazily, so the 140 KB table is its own chunk and /jobs never pays for it.
let tablePromise;
export const loadDurationTable = () => {
  tablePromise =
    tablePromise ||
    import(/* webpackChunkName: "job-durations" */ './job-durations.json').then(
      (m) => m.default || m,
    );
  return tablePromise;
};

// ---- the model ----

// The global median job, for when the table is missing entirely.
const HARD_FALLBACK_MINUTES = 20.8;

// Chunked suites are named `…-wdspec-headless-1`, `-2`…; dropping the chunk
// number lets an unseen chunk inherit its siblings' timing (misses 14% → 8%).
export const familyKey = (name) => name.replace(/-\d+$/, '');

// Expected run time in seconds, most specific match first.
export const expectedRunTime = (job, table) => {
  const minutes =
    table?.exact?.[job.jobTypeName] ??
    table?.family?.[familyKey(job.jobTypeName)] ??
    table?.platform?.[`${job.platform}|${job.platformOption}`] ??
    table?.global ??
    HARD_FALLBACK_MINUTES;
  return minutes * 60;
};

// Jobs sharing this key contend for the same workers, so share a queue wait.
const poolKey = (job) => `${job.platform}|${job.platformOption}`;

const queueWait = (job) =>
  job.submit != null && job.start != null && job.start > job.submit
    ? job.start - job.submit
    : null;

// A shippable build is a pipeline, not a task: instrumented-build produces a
// profiling binary, generate-profile runs it, and only then does build make
// what the tests consume.
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

// Uncorrected, the real finish is 1.9× the predicted remaining time at the
// median. 1.25 brings that to 1.5× and still overshoots 2× only 2% of the
// time. Erring long is the right direction for an ETA.
const TAIL_CALIBRATION = 1.25;

// The estimate holds once 60% of unresolved jobs sit in pools where something
// has started. Below that it's wrong by about 113 minutes, so say nothing.
// 83% of pushes clear the bar, at a median of 30 minutes in.
const FIRM_COVERAGE = 0.6;

// The decision task has to land before there's anything to estimate.
const MINIMUM_ELAPSED = 8 * 60;

// Walks the build chain stage by stage to find when tests are released. Each
// stage starts only once the earlier ones land, so the frontier is carried
// forward: a running stage is projected from its own start, one that hasn't
// started from the frontier plus a normal queue wait.
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
        // Name the latest-finishing running stage.
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

// Returns null when there's nothing to estimate: no jobs, or none unresolved.
// Otherwise `confidence` is one of:
//   'firm'           — show `mostAt` as the headline, `allAt` as approximate.
//   'blockedOnBuild' — tests wait on a running build; show `blockingBuild`.
//                      Build finishes land within 5 minutes 71% of the time.
//   'estimating'     — too early to know. `mostAt`/`allAt` are null so no
//                      screen can show a number that would be wrong.
// Every tier counts: one sampled push ran 209 tier-1 jobs against 545 tier-2,
// and an ETA that ignored them would promise a finish with hundreds queued.
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
    // A start stamp is an observation of the pool's queue whether or not the
    // job has since finished.
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

  // A job in a pool nothing has started in is usually waiting on a build, not
  // idly queued. One live push had 32 of 37 unresolved jobs unscheduled behind
  // a single running macOS build, with no pool observation at all.
  const gate = buildGate(unresolved, poolWaits, globalWait, nowS, table);

  const projected = [...resolvedEnds];
  let worstEnd = Number.NEGATIVE_INFINITY;
  let worstJob = null;
  let observed = 0;

  for (const job of unresolved) {
    const run = expectedRunTime(job, table);
    let end;
    if (job.start != null) {
      // Already running: all that's left to know is how long it runs.
      end = job.start + run;
    } else if (job.submit == null) {
      continue;
    } else if (poolWaits.has(poolKey(job))) {
      observed += 1;
      // Never predict a wait shorter than the one already served.
      const wait = Math.max(poolWaits.get(poolKey(job)), nowS - job.submit);
      end = job.submit + wait + run;
    } else if (gate) {
      // Released when the build chain lands, then a normal queue wait.
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

  // Only name a long pole when it's really holding things up. The true one is
  // in this estimator's top three 86% of the time but top one only 51%, so
  // it's a hint, not a fact.
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
    // Where `mostAt` sits along pushed → allAt, for marking a timeline.
    mostFraction: firm && span > 0 ? Math.min(1, Math.max(0, (mostS - pushedS) / span)) : null,
    pushedAt,
    blockingBuild,
    longPole,
    longPoleRemaining,
  };
};
