import { useEffect, useState } from 'react';

import { NEW_FAILURE_ID, PUSH } from './constants';
import {
  fetchFirstFailingTest,
  jobShortName,
  platformName,
  splitTestPath,
} from './helpers';
import { queued } from './hooks';
import { JobFailures } from './JobSummary';

const Chevron = ({ open }) => (
  <span className={`sv-chevron${open ? ' sv-chevron-open' : ''}`} aria-hidden="true" />
);

const JobTile = ({ jobId, repo, revision, under, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="sv-card">
      <button
        type="button"
        className="sv-card-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {children(open)}
      </button>
      {open && (
        <JobFailures
          inline
          repo={repo}
          revision={revision}
          jobId={jobId}
          under={under}
        />
      )}
    </li>
  );
};

// Failed jobs named by their first failing test and grouped, so five red jobs
// read as the tests they are.
export const FailureList = ({ jobs, repo, revision }) => {
  const [tests, setTests] = useState({});
  const ids = jobs.map((j) => j.id).join(',');

  useEffect(() => {
    let live = true;
    for (const id of ids.split(',').filter(Boolean)) {
      queued(() => fetchFirstFailingTest(repo, id)).then(
        (test) => live && setTests((t) => ({ ...t, [id]: test })),
      );
    }
    return () => {
      live = false;
    };
  }, [ids, repo]);

  const groups = new Map();
  for (const job of jobs) {
    const known = job.id in tests;
    const name = tests[job.id] || (known ? jobShortName(job.jobTypeName) : '');
    const key = name || `job:${job.id}`;
    const g = groups.get(key) || { name, jobs: [] };
    g.jobs.push(job);
    groups.set(key, g);
  }

  return [...groups.values()].map(({ name, jobs: runs }) => {
    const { dir, file } = splitTestPath(name);
    const where = [
      ...new Set(runs.map((j) => `${platformName(j.platform)} ${j.platformOption}`)),
    ].join(', ');
    return (
      <JobTile
        key={runs[0].id}
        jobId={runs[0].id}
        repo={repo}
        revision={revision}
        under={name}
      >
        {(open) => (
          <>
            <span className="sv-test-file">
              {file || <span className="sv-skeleton" />}
            </span>
            {dir && <span className="sv-test-dir">{dir}</span>}
            <span className="sv-card-meta">
              {runs.some((j) => j.classification === NEW_FAILURE_ID) && (
                <span className="sv-tag">{PUSH.newTag}</span>
              )}
              {runs.length > 1 && PUSH.jobCount(runs.length)}
              {where} · {runs.map((j) => j.symbol).join(', ')}
              <Chevron open={open} />
            </span>
          </>
        )}
      </JobTile>
    );
  });
};

export const Section = ({ title, count, children, quiet }) =>
  count ? (
    <section className={`sv-section${quiet ? ' sv-section-quiet' : ''}`}>
      <h2 className="sv-section-title">
        {title} <span className="sv-muted">{count}</span>
      </h2>
      <ul className="sv-cards">{children}</ul>
    </section>
  ) : null;
