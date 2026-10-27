import {
  FAILED_RESULTS,
  NEW_FAILURE_ID,
  UNCLASSIFIED_IDS,
  VERDICT,
} from './constants';
import { progressOf, statusFromJobs } from './helpers';

export const failedJobsOf = (jobs) =>
  (jobs || []).filter(
    (j) => j.tier <= 2 && j.state === 'completed' && FAILED_RESULTS.has(j.result),
  );

// Failed jobs split the way the full view's classifications do: still open
// (unclassified, some with an error line Treeherder hasn't seen before), or
// already classified by a sheriff or the author.
export const sortFailures = (jobs) => {
  const failed = failedJobsOf(jobs);
  const open = failed.filter((j) => UNCLASSIFIED_IDS.has(j.classification));
  return {
    failed,
    open,
    fresh: open.filter((j) => j.classification === NEW_FAILURE_ID),
    classified: failed.filter((j) => !UNCLASSIFIED_IDS.has(j.classification)),
  };
};

// Counts only, small enough to keep for every push in the list.
export const summarizeJobs = (jobs) => {
  const status = statusFromJobs(jobs);
  const { failed, open, fresh } = sortFailures(jobs);
  return {
    status,
    failed: failed.length,
    open: open.length,
    fresh: fresh.length,
    finished: !progressOf(status).running,
  };
};

export const verdict = ({ jobs, progress, eta }) => {
  if (!jobs || !progress) return null;
  const { failed, fresh, classified } = sortFailures(jobs);
  const sofar = progress.running
    ? VERDICT.soFar(progress.done, progress.total)
    : '';

  if (!failed.length) {
    return progress.running
      ? {
          tone: 'running',
          headline: eta ? eta.headline : VERDICT.stillRunning,
          sub: VERDICT.nothingFailedYet(sofar),
        }
      : {
          tone: 'good',
          headline: VERDICT.allGreen,
          sub: VERDICT.nothingToLookAt(progress.total),
        };
  }

  const headline = VERDICT.jobsFailed(failed.length);
  if (classified.length === failed.length) {
    return { tone: 'quiet', headline, sub: `${VERDICT.allClassified} ${sofar}`.trim() };
  }
  const sub = [
    fresh.length ? VERDICT.newErrors(fresh.length) : '',
    classified.length ? VERDICT.classified(classified.length) : '',
    sofar,
  ];
  return { tone: 'bad', headline, sub: sub.filter(Boolean).join(' ') };
};
