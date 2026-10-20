import { FAILED_RESULTS, VERDICT } from './constants';
import { groupByTest } from './helpers';

export const failedJobsOf = (jobs) =>
  (jobs || []).filter(
    (j) => j.tier <= 2 && j.state === 'completed' && FAILED_RESULTS.has(j.result),
  );

export const sortFailures = (health, jobs) => {
  const tests = health?.metrics.tests.details || {};
  const groups = groupByTest(tests.needInvestigation || []);
  const yours = groups.filter((g) => !g.failedInParent);
  const parentToo = groups.filter((g) => g.failedInParent);
  const known = groupByTest(tests.knownIssues || []);
  const builds = health?.metrics.builds.details || [];
  const lint = health?.metrics.linting.details || [];

  // Push Health only reports failures classified as new (id 6); show the rest too.
  const reported = new Set([
    ...groups.flatMap((g) => [...g.jobIds]),
    ...known.flatMap((g) => [...g.jobIds]),
    ...builds.map((j) => j.id),
    ...lint.map((j) => j.id),
  ]);
  const seenBefore = failedJobsOf(jobs).filter((j) => !reported.has(j.id));

  return { yours, parentToo, known, builds, lint, seenBefore };
};

export const verdict = ({ yours, parentToo, builds, lint, progress, eta, seenBefore }) => {
  const broke = [];
  if (yours.length) broke.push(VERDICT.testsBroke(yours.length));
  if (builds.length) broke.push(VERDICT.buildsBroke(builds.length));
  if (lint.length) broke.push(VERDICT.lintFailed);

  const sofar = progress.running
    ? VERDICT.soFar(progress.done, progress.total)
    : null;
  const others = seenBefore.length
    ? VERDICT.othersSeenBefore(seenBefore.length)
    : '';

  if (broke.length) {
    return {
      tone: 'bad',
      headline: VERDICT.sentence(broke),
      sub:
        (sofar ||
          (parentToo.length
            ? VERDICT.alsoOnParent(parentToo.length)
            : VERDICT.probablyYours)) + others,
    };
  }
  if (progress.running) {
    return {
      tone: 'running',
      headline: eta ? eta.headline : VERDICT.stillRunning,
      sub: VERDICT.nothingNewYet(sofar, others),
    };
  }
  if (seenBefore.length && !parentToo.length) {
    return {
      tone: 'good',
      headline: VERDICT.nothingNew,
      sub: VERDICT.likelyIntermittent(seenBefore.length),
    };
  }
  if (parentToo.length) {
    return {
      tone: 'good',
      headline: VERDICT.nothingNew,
      sub: VERDICT.failsOnParentToo(parentToo.length),
    };
  }
  return {
    tone: 'good',
    headline: VERDICT.allGreen,
    sub: VERDICT.nothingToLookAt(progress.total),
  };
};

// Push Health sorts the failures but can take 15s or more when Treeherder
// hasn't computed it lately. A push with no failures doesn't need it; one with
// failures says how many jobs failed, which stays true however they sort.
export const pushVerdict = ({ health, jobs, progress, eta, sorted }) => {
  if (!progress) return null;
  const failed = failedJobsOf(jobs);
  if (health || (jobs && !failed.length)) {
    return verdict({ ...sorted, progress, eta });
  }
  if (!jobs) return null;
  return {
    tone: 'quiet',
    headline: VERDICT.jobsFailed(failed.length),
    sub: VERDICT.checking,
  };
};
