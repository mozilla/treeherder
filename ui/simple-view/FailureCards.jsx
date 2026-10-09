import { useEffect, useState } from 'react';

import { PUSH } from './constants';
import {
  fetchFirstFailingTest,
  jobShortName,
  platformName,
  resultWord,
  splitTestPath,
} from './helpers';
import { queued } from './hooks';
import { JobFailures } from './JobSummary';

const RunBar = ({ failed, total }) => {
  const cells = Math.min(total, 20);
  const red = Math.round((failed / total) * cells);
  return (
    <span className="sv-runbar" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={i < red ? 'sv-runbar-bad' : undefined} />
      ))}
    </span>
  );
};

const Chevron = ({ open }) => (
  <span className={`sv-chevron${open ? ' sv-chevron-open' : ''}`} aria-hidden="true" />
);

const RunRow = ({ run, repo, revision, under }) => {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        className="sv-run"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          {run.platform} {run.config}
          {run.symbol && <span className="sv-muted"> · {run.symbol}</span>}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <JobFailures
          inline
          repo={repo}
          revision={revision}
          jobId={run.id}
          under={under}
        />
      )}
    </li>
  );
};

export const TestCard = ({ group, jobs, repo, revision }) => {
  const [open, setOpen] = useState(false);
  const { dir, file } = splitTestPath(group.testName);
  const failed = group.jobIds.size;
  const runs = group.entries.flatMap((e) =>
    e.failedInJobs.map((id) => ({
      id,
      symbol: (jobs[e.jobName] || []).find((j) => j.id === id)?.job_type_symbol,
      config: e.config,
      platform: platformName(e.platform),
    })),
  );

  return (
    <li className={`sv-card${open ? ' sv-card-open' : ''}`}>
      <button
        type="button"
        className="sv-card-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="sv-test-file">{file}</span>
        {dir && <span className="sv-test-dir">{dir}</span>}
        <RunBar failed={failed} total={group.totalJobs} />
        <span className="sv-card-meta">
          {!group.failedInParent && <span className="sv-tag">{PUSH.newTag}</span>}
          {PUSH.failedRuns(failed, group.totalJobs)} ·{' '}
          {[...group.platforms].join(', ')} · {[...group.configs].join(', ')}
          <Chevron open={open} />
        </span>
      </button>
      {open && runs.length === 1 && (
        <JobFailures
          inline
          repo={repo}
          revision={revision}
          jobId={runs[0].id}
          under={group.testName}
        />
      )}
      {open && runs.length > 1 && (
        <ul className="sv-runs">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              repo={repo}
              revision={revision}
              under={group.testName}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

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

export const JobCard = ({ job, repo, revision }) => (
  <JobTile jobId={job.id} repo={repo} revision={revision}>
    {(open) => (
      <>
        <span className="sv-test-file">{jobShortName(job.job_type_name)}</span>
        <span className="sv-card-meta">
          {job.platform === 'lint' ? '' : `${platformName(job.platform)} · `}
          {resultWord(job.result)}
          <Chevron open={open} />
        </span>
      </>
    )}
  </JobTile>
);

export const SeenBefore = ({ jobs, repo, revision }) => {
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

export const LintCard = ({ jobs, repo, revision }) => (
  <li className="sv-card">
    <ul>
      {jobs.map((job) => (
        <RunRow
          key={job.id}
          run={{
            id: job.id,
            platform: jobShortName(job.job_type_name),
            config: '',
            symbol: resultWord(job.result),
          }}
          repo={repo}
          revision={revision}
        />
      ))}
    </ul>
  </li>
);

export const Section = ({ title, count, children, quiet }) =>
  count ? (
    <section className={`sv-section${quiet ? ' sv-section-quiet' : ''}`}>
      <h2 className="sv-section-title">
        {title} <span className="sv-muted">{count}</span>
      </h2>
      <ul className="sv-cards">{children}</ul>
    </section>
  ) : null;
