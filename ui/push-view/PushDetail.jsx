import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import {
  ago,
  countWord,
  describeEta,
  duration,
  fetchHealth,
  fetchPush,
  groupByTest,
  jobShortName,
  platformName,
  plural,
  progressOf,
  pushTitle,
  resultWord,
  splitTestPath,
} from './helpers';
import { useCountUp, usePoll, usePulse } from './hooks';
import Ring from './Ring';
import Retrigger from './Retrigger';
import { cachedHealth, cachedPush, cachedSummary, rememberPush } from './cache';
import { estimatePush, fetchPushJobs, loadDurationTable } from './eta';

const logUrl = (repo, jobId) => `/logviewer?job_id=${jobId}&repo=${repo}`;

// The whole screen exists to say this one sentence.
const verdict = ({ yours, parentToo, builds, lint, progress, eta }) => {
  const count = (n, noun) => `${countWord(n).toLowerCase()} ${plural(n, noun)}`;
  const broke = [];
  if (yours.length) broke.push(`${count(yours.length, 'test')} broke`);
  if (builds.length) broke.push(`${count(builds.length, 'build')} broke`);
  if (lint.length) broke.push('lint failed');
  const sentence = broke.join(', ');

  const sofar = progress.running
    ? `${progress.done} of ${progress.total} jobs done so far.`
    : null;

  if (broke.length) {
    return {
      tone: 'bad',
      headline: `${sentence[0].toUpperCase()}${sentence.slice(1)}.`,
      sub:
        sofar ||
        (parentToo.length
          ? `${parentToo.length} more ${plural(parentToo.length, 'test fails', 'tests fail')} on the parent too.`
          : "Nothing here fails on the parent, so it's probably yours."),
    };
  }
  if (progress.running && eta) {
    return {
      tone: 'running',
      headline: eta.headline,
      sub: `${sofar} Nothing new has broken.`,
    };
  }
  if (progress.running) {
    return {
      tone: 'running',
      headline: 'Still running.',
      sub: `${sofar} Nothing new has broken.`,
    };
  }
  if (parentToo.length) {
    return {
      tone: 'good',
      headline: 'Nothing new broke.',
      sub: `${countWord(parentToo.length)} ${plural(parentToo.length, 'test fails', 'tests fail')} here, but on the parent too.`,
    };
  }
  return {
    tone: 'good',
    headline: 'All green.',
    sub: `${progress.total} ${plural(progress.total, 'job')}, nothing needs a look.`,
  };
};

// What the middle of the ring says: how far along while it runs, how big the
// push was once it's done.
const RingCenter = ({ progress }) => {
  const running = progress.running;
  const pct = progress.total ? Math.floor((progress.done / progress.total) * 100) : 0;
  const n = useCountUp(running ? pct : progress.total);

  return (
    <>
      <span className="pv-ring-figure">
        {n}
        {running && <span className="pv-ring-unit">%</span>}
      </span>
      <span className="pv-ring-label">
        {running ? 'done' : plural(progress.total, 'job')}
      </span>
    </>
  );
};

const LEGEND = [
  ['bad', (s) => (s.testfailed || 0) + (s.busted || 0) + (s.exception || 0), 'failed'],
  ['good', (s) => s.success || 0, 'passed'],
  ['running', (s) => s.running || 0, 'running'],
  ['pending', (s) => (s.pending || 0) + (s.unscheduled || 0), 'waiting'],
];

const Legend = ({ status }) => (
  <ul className="pv-legend">
    {LEGEND.map(([kind, count, label]) => {
      const n = count(status);
      return n ? (
        <li key={kind} className={`pv-legend-${kind}`}>
          <span className="pv-legend-dot" />
          {n} {label}
        </li>
      ) : null;
    })}
  </ul>
);

// Failed runs out of all runs. Solid red is a real break; a scatter is flaky.
const RunBar = ({ failed, total }) => {
  const cells = Math.min(total, 20);
  const red = Math.round((failed / total) * cells);
  return (
    <span className="pv-runbar" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={i < red ? 'pv-runbar-bad' : undefined} />
      ))}
    </span>
  );
};

const TestCard = ({ group, jobs, repo }) => {
  const [open, setOpen] = useState(false);
  const { dir, file } = splitTestPath(group.testName);
  const failed = group.jobIds.size;
  const runs = group.entries.flatMap((e) =>
    e.failedInJobs.map((id) => ({
      id,
      job: (jobs[e.jobName] || []).find((j) => j.id === id),
      config: e.config,
      platform: platformName(e.platform),
    })),
  );

  return (
    <li className={`pv-card${open ? ' pv-card-open' : ''}`}>
      <button
        type="button"
        className="pv-card-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="pv-test-file">{file}</span>
        {dir && <span className="pv-test-dir">{dir}</span>}
        <RunBar failed={failed} total={group.totalJobs} />
        <span className="pv-card-meta">
          {!group.failedInParent && <span className="pv-tag">New</span>}
          Failed {failed} of {group.totalJobs} {plural(group.totalJobs, 'run')} ·{' '}
          {[...group.platforms].join(', ')} · {[...group.configs].join(', ')}
        </span>
      </button>
      {open && (
        <ul className="pv-runs">
          {runs.map(({ id, job, config, platform }) => (
            <li key={id}>
              <a className="pv-run" href={logUrl(repo, id)}>
                <span>
                  {platform} {config}
                  {job?.job_type_symbol && (
                    <span className="pv-muted"> · {job.job_type_symbol}</span>
                  )}
                </span>
                <span className="pv-run-action">Log</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const JobCard = ({ job, repo }) => (
  <li className="pv-card">
    <a className="pv-card-head" href={logUrl(repo, job.id)}>
      <span className="pv-test-file">{jobShortName(job.job_type_name)}</span>
      <span className="pv-card-meta">
        {job.platform === 'lint' ? '' : `${platformName(job.platform)} · `}
        {resultWord(job.result)}
        <span className="pv-run-action">Log</span>
      </span>
    </a>
  </li>
);

// Lint jobs are one-word names; seven of them read better as one card.
const LintCard = ({ jobs, repo }) => (
  <li className="pv-card">
    <ul>
      {jobs.map((job) => (
        <li key={job.id}>
          <a className="pv-run" href={logUrl(repo, job.id)}>
            <span>
              {jobShortName(job.job_type_name)}
              <span className="pv-muted"> · {resultWord(job.result)}</span>
            </span>
            <span className="pv-run-action">Log</span>
          </a>
        </li>
      ))}
    </ul>
  </li>
);

const Section = ({ title, count, children, quiet }) =>
  count ? (
    <section className={`pv-section${quiet ? ' pv-section-quiet' : ''}`}>
      <h2 className="pv-section-title">
        {title} <span className="pv-muted">{count}</span>
      </h2>
      <ul className="pv-cards">{children}</ul>
    </section>
  ) : null;

const PushDetail = ({ repo, revision }) => {
  const [push, setPush] = useState(() => cachedPush(repo, revision));
  const [health, setHealth] = useState(() => cachedHealth(repo, revision));
  // The list already knows this push's counts, so the ring can draw before
  // the full health report arrives.
  const summary = cachedSummary(repo, revision);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPush(repo, revision).then(({ data, failureStatus }) => {
      if (failureStatus || !data.results?.length) {
        setError('No push with that revision.');
      } else {
        setPush(data.results[0]);
        rememberPush(repo, data.results[0]);
      }
    });
  }, [repo, revision]);

  const loadHealth = useCallback(async () => {
    const h = await fetchHealth(repo, revision);
    if (h) setHealth(h);
  }, [repo, revision]);

  useEffect(() => {
    setHealth(cachedHealth(repo, revision));
    loadHealth();
  }, [loadHealth, repo, revision]);

  const progress = health && progressOf(health.status);
  const running = !!progress?.running;

  const [etaModel, setEtaModel] = useState(null);
  const loadEta = useCallback(async () => {
    if (!push || !running) return;
    const [jobs, table] = await Promise.all([
      fetchPushJobs(repo, push.id),
      loadDurationTable(),
    ]);
    if (jobs) {
      setEtaModel(
        estimatePush(jobs, table, { pushedAt: push.push_timestamp * 1000 }),
      );
    }
  }, [repo, push, running]);

  useEffect(() => {
    if (running) loadEta();
    else setEtaModel(null);
  }, [running, loadEta]);

  usePoll(
    () => {
      loadHealth();
      loadEta();
    },
    60 * 1000,
    !health || running,
  );
  const eta = running
    ? describeEta(etaModel, { started: progress.done > 0 })
    : null;

  const tests = health?.metrics.tests.details || {};
  const groups = groupByTest(tests.needInvestigation || []);
  const yours = groups.filter((g) => !g.failedInParent);
  const parentToo = groups.filter((g) => g.failedInParent);
  const known = groupByTest(tests.knownIssues || []);
  const builds = health?.metrics.builds.details || [];
  const lint = health?.metrics.linting.details || [];
  const said =
    health && verdict({ yours, parentToo, builds, lint, progress, eta });
  const pulsing = usePulse(said ? said.headline : undefined);

  // The jobs behind what broke here, once per job type: retriggering is by
  // label, so two runs of the same job would otherwise go twice.
  const failedJobs = health
    ? [
        ...yours.flatMap((g) =>
          g.entries.flatMap((e) =>
            (health.jobs[e.jobName] || []).filter((j) =>
              e.failedInJobs.includes(j.id),
            ),
          ),
        ),
        ...builds,
        ...lint,
      ].filter(
        (job, i, all) =>
          all.findIndex((j) => j.job_type_name === job.job_type_name) === i,
      )
    : [];

  const commits = push
    ? push.revisions.filter((r) => !/^Fuzzy query|^try:/i.test(r.comments))
    : [];

  return (
    <>
      <nav className="pv-nav">
        <Link to={`/push?repo=${repo}`} className="pv-back">
          Your pushes
        </Link>
      </nav>

      {error && <p className="pv-sub">{error}</p>}

      {push && (
        <header className="pv-push-head pv-rise">
          <span className="pv-eyebrow">
            {repo} · {ago(push.push_timestamp)} · {revision.slice(0, 12)}
          </span>
          {pushTitle(push) !== revision.slice(0, 12) && (
            <p className="pv-push-title">{pushTitle(push)}</p>
          )}
        </header>
      )}

      <div className={`pv-aurora pv-tone-${said?.tone || 'quiet'}`} />

      <section
        className={`pv-hero pv-tone-${said?.tone || 'quiet'}${pulsing ? ' pv-pulse' : ''}`}
        aria-live="polite"
      >
        {!error && (
          <Ring
            status={health?.status || summary?.status}
            loading={!health && !summary}
            size="min(240px, 64vw)"
          >
            {health && <RingCenter progress={progress} />}
          </Ring>
        )}
        {said ? (
          <div className="pv-rise pv-hero-words">
            <h1 className="pv-headline">{said.headline}</h1>
            <p className="pv-sub">{said.sub}</p>
            <Legend status={health.status} />
            {failedJobs.length > 0 && (
              <Retrigger jobs={failedJobs} repo={repo} />
            )}
            {eta && <p className="pv-eta-line">{eta.line}</p>}
            {progress.running && push && (
              <p className="pv-elapsed">{duration(push.push_timestamp)} in</p>
            )}
          </div>
        ) : (
          !error && (
            <div className="pv-hero-words" aria-label="Reading the results">
              <span className="pv-skeleton pv-skeleton-headline" />
              <span className="pv-skeleton" />
            </div>
          )
        )}
      </section>

      {health && (
        <div className="pv-rise">
          <Section title="Broken here" count={yours.length}>
            {yours.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} />
            ))}
          </Section>
          <Section title="Builds" count={builds.length}>
            {builds.map((job) => (
              <JobCard key={job.id} job={job} repo={repo} />
            ))}
          </Section>
          <Section title="Lint" count={lint.length}>
            <LintCard jobs={lint} repo={repo} />
          </Section>
          <Section title="Also failing on the parent" count={parentToo.length} quiet>
            {parentToo.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} />
            ))}
          </Section>
          <Section title="Known intermittents" count={known.length} quiet>
            {known.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} />
            ))}
          </Section>
        </div>
      )}

      {push && (
        <footer className="pv-footer">
          {commits.length > 0 && (
            <details className="pv-commits">
              <summary>
                {commits.length} {plural(commits.length, 'commit')}
              </summary>
              <ul>
                {commits.map((r) => (
                  <li key={r.revision}>{r.comments.split('\n')[0]}</li>
                ))}
              </ul>
            </details>
          )}
          <a className="pv-link" href={`/jobs?repo=${repo}&revision=${revision}`}>
            Every job, in the full view
          </a>
        </footer>
      )}
    </>
  );
};

export default PushDetail;
