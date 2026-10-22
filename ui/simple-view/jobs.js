import { rememberJobs, rememberSummary, shared } from './cache';
import { fetchPushJobs } from './eta';
import { summarizeJobs } from './verdict';

// One request per push however many screens ask, and each answer is kept as
// both the job list and the counts the list's rows show.
export const loadPushJobs = (repo, pushId, revision) =>
  shared(`jobs:${repo}:${pushId}`, async () => {
    const jobs = await fetchPushJobs(repo, pushId);
    if (jobs) {
      rememberJobs(repo, pushId, jobs);
      rememberSummary(repo, revision, summarizeJobs(jobs));
    }
    return jobs;
  });
