import { useCallback, useEffect, useState } from 'react';

import {
  ago,
  authorName,
  FAILED_RESULTS,
  countWord,
  describeEta,
  fetchFirstFailingTest,
  duration,
  fetchHealth,
  fetchPush,
  groupByTest,
  jobShortName,
  platformName,
  plural,
  progressOf,
  pushesOf,
  pushTitle,
  pushUrl,
  resultWord,
  retriggerableJobs,
  splitTestPath,
  statusFromJobs,
} from './helpers';
import { queued, useCountUp, usePoll, usePulse } from './hooks';
import Ring from './Ring';
import Retrigger from './Retrigger';
import Nav from './Nav';
import { JobFailures } from './JobSummary';
import { chooseFullView } from './phone';
import {
  cachedHealth,
  cachedPush,
  cachedSummary,
  personName,
  rememberPerson,
  rememberPush,
} from './cache';
import { estimatePush, fetchPushJobs, loadDurationTable } from './eta';


// The whole screen exists to say this one sentence.
const verdict = ({ yours, parentToo, builds, lint, progress, eta, seenBefore }) => {
  const count = (n, noun) => `${countWord(n).toLowerCase()} ${plural(n, noun)}`;
  const broke = [];
  if (yours.length) broke.push(`${count(yours.length, 'test')} broke`);
  if (builds.length) broke.push(`${count(builds.length, 'build')} broke`);
  if (lint.length) broke.push('lint failed');
  const sentence = broke.join(', ');

  const sofar = progress.running
    ? `${progress.done} of ${progress.total} jobs done so far.`
    : null;
  const others = seenBefore.length
    ? ` ${countWord(seenBefore.length)} other ${plural(seenBefore.length, 'failure has', 'failures have')} been seen before.`
    : '';

  if (broke.length) {
    return {
      tone: 'bad',
      headline: `${sentence[0].toUpperCase()}${sentence.slice(1)}.`,
      sub:
        (sofar ||
          (parentToo.length
            ? `${parentToo.length} more ${plural(parentToo.length, 'test fails', 'tests fail')} on the parent too.`
            : "Nothing here fails on the parent, so it's probably yours.")) +
        others,
    };
  }
  if (progress.running && eta) {
    return {
      tone: 'running',
      headline: eta.headline,
      sub: `${sofar} Nothing new has broken.${others}`,
    };
  }
  if (progress.running) {
    return {
      tone: 'running',
      headline: 'Still running.',
      sub: `${sofar} Nothing new has broken.${others}`,
    };
  }
  if (seenBefore.length && !parentToo.length) {
    return {
      tone: 'good',
      headline: 'Nothing new broke.',
      sub: `${countWord(seenBefore.length)} ${plural(seenBefore.length, 'failure has', 'failures have')} been seen before, so ${plural(seenBefore.length, "it's", "they're")} likely intermittent.`,
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
      <span className="sv-ring-figure">
        {n}
        {running && <span className="sv-ring-unit">%</span>}
      </span>
      <span className="sv-ring-label">
        {running ? 'done' : plural(progress.total, 'job')}
      </span>
    </>
  );
};

// The full view's words and colours for each job state.
const LEGEND = [
  ['testfailed', 'failed'],
  ['busted', 'busted'],
  ['exception', 'exception'],
  ['success', 'passed'],
  ['running', 'running'],
  ['pending', 'pending'],
  ['unscheduled', 'waiting on a build'],
];

const Legend = ({ status }) => (
  <ul className="sv-legend">
    {LEGEND.map(([kind, label]) => {
      const n = status[kind] || 0;
      return n ? (
        <li key={kind} className={`sv-legend-${kind}`}>
          <span className="sv-legend-dot" />
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
    <span className="sv-runbar" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className={i < red ? 'sv-runbar-bad' : undefined} />
      ))}
    </span>
  );
};

// The failure summary opens under whatever was tapped, rather than on a new
// page: the tile you chose stays in view with its answer beneath it.
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

const TestCard = ({ group, jobs, repo, revision }) => {
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
          {!group.failedInParent && <span className="sv-tag">New</span>}
          Failed {failed} of {group.totalJobs} {plural(group.totalJobs, 'run')} ·{' '}
          {[...group.platforms].join(', ')} · {[...group.configs].join(', ')}
          <Chevron open={open} />
        </span>
      </button>
      {/* One failed run: its summary is the answer. Several: pick one. */}
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

// A card whose tap opens one job's failure summary beneath it.
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

const JobCard = ({ job, repo, revision }) => (
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

// Failures Treeherder had seen before, named by their first failing test and
// grouped, so five red jobs read as the tests they are.
const SeenBefore = ({ jobs, repo, revision }) => {
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
              {runs.length > 1 && `${runs.length} jobs · `}
              {where} · {runs.map((j) => j.symbol).join(', ')}
              <Chevron open={open} />
            </span>
          </>
        )}
      </JobTile>
    );
  });
};

// Lint jobs are one-word names; seven of them read better as one card.
const LintCard = ({ jobs, repo, revision }) => (
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

const Section = ({ title, count, children, quiet }) =>
  count ? (
    <section className={`sv-section${quiet ? ' sv-section-quiet' : ''}`}>
      <h2 className="sv-section-title">
        {title} <span className="sv-muted">{count}</span>
      </h2>
      <ul className="sv-cards">{children}</ul>
    </section>
  ) : null;

const PushDetail = ({ repo, author, theme, revision }) => {
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

  // The push's own job list: exact counts, the ETA's input, and the failures
  // Push Health leaves out.
  const [jobs, setJobs] = useState(null);
  const loadJobs = useCallback(async () => {
    if (!push) return;
    const list = await fetchPushJobs(repo, push.id);
    if (list) setJobs(list);
  }, [repo, push]);

  useEffect(() => {
    setJobs(null);
    loadJobs();
  }, [loadJobs]);

  const counts = jobs ? statusFromJobs(jobs) : health?.status || summary?.status;
  const progress = health && counts && progressOf(counts);
  const running = !!progress?.running;

  const [table, setTable] = useState(null);
  useEffect(() => {
    if (running && !table) loadDurationTable().then(setTable);
  }, [running, table]);
  const etaModel =
    running && jobs && table
      ? estimatePush(jobs, table, { pushedAt: push.push_timestamp * 1000 })
      : null;

  usePoll(
    () => {
      loadHealth();
      loadJobs();
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

  // Push Health only reports failures Treeherder tagged as new: an error line
  // it had never seen before. Every other failed job still failed, so it gets
  // shown, not dropped.
  const reported = new Set([
    ...groups.flatMap((g) => [...g.jobIds]),
    ...known.flatMap((g) => [...g.jobIds]),
    ...builds.map((j) => j.id),
    ...lint.map((j) => j.id),
  ]);
  const seenBefore = (jobs || []).filter(
    (j) =>
      j.tier <= 2 &&
      j.state === 'completed' &&
      FAILED_RESULTS.has(j.result) &&
      !reported.has(j.id),
  );

  const said =
    health &&
    progress &&
    verdict({ yours, parentToo, builds, lint, progress, eta, seenBefore });
  const pulsing = usePulse(said ? said.headline : undefined);

  const failedJobs = push ? retriggerableJobs(jobs || [], push.id) : [];
  // Only once the job list is in, so the note never flashes before the button.
  const testsFailed =
    !!jobs &&
    jobs.some(
      (j) => j.tier <= 2 && j.result === 'testfailed' && j.platform !== 'lint',
    );

  const pushedBy = push?.author;
  const pushedByName = push ? authorName(push) : null;
  useEffect(() => rememberPerson(pushedBy, pushedByName), [pushedBy, pushedByName]);

  const commits = push
    ? push.revisions.filter((r) => !/^Fuzzy query|^try:/i.test(r.comments))
    : [];

  return (
    <>
      <Nav
        repo={repo}
        author={author}
        theme={theme}
        back={pushUrl({ repo, author })}
        backLabel={pushesOf(personName(author))}
        full={`/jobs?repo=${repo}&revision=${revision}`}
        filter={`revision: ${revision.slice(0, 12)}`}
      />

      {error && <p className="sv-sub">{error}</p>}

      {push && (
        <header className="sv-push-head sv-rise">
          <span className="sv-eyebrow">
            {ago(push.push_timestamp)} · {authorName(push) || push.author}
          </span>
          {pushTitle(push) !== revision.slice(0, 12) && (
            <p className="sv-push-title">{pushTitle(push)}</p>
          )}
        </header>
      )}

      <section
        className={`sv-hero sv-tone-${said?.tone || 'quiet'}${pulsing ? ' sv-pulse' : ''}`}
        aria-live="polite"
      >
        {!error && (
          <Ring
            status={counts}
            loading={!counts}
            size="min(240px, 64vw)"
          >
            {health && <RingCenter progress={progress} />}
          </Ring>
        )}
        {said ? (
          <div className="sv-rise sv-hero-words">
            <h1 className="sv-headline">{said.headline}</h1>
            <p className="sv-sub">{said.sub}</p>
            <Legend status={counts} />
            {failedJobs.length > 0 && (
              <Retrigger jobs={failedJobs} repo={repo} />
            )}
            {failedJobs.length === 0 && testsFailed && (
              <p className="sv-elapsed">
                Every failure has already been rerun or marked intermittent.
              </p>
            )}
            {eta && <p className="sv-eta-line">{eta.line}</p>}
            {progress.running && push && (
              <p className="sv-elapsed">{duration(push.push_timestamp)} in</p>
            )}
          </div>
        ) : (
          !error && (
            <div className="sv-hero-words" aria-label="Reading the results">
              <span className="sv-skeleton sv-skeleton-headline" />
              <span className="sv-skeleton" />
            </div>
          )
        )}
      </section>

      {health && (
        <div className="sv-rise">
          <Section title="Broken here" count={yours.length}>
            {yours.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} revision={revision} />
            ))}
          </Section>
          <Section title="Builds" count={builds.length}>
            {builds.map((job) => (
              <JobCard key={job.id} job={job} repo={repo} revision={revision} />
            ))}
          </Section>
          <Section title="Lint" count={lint.length}>
            <LintCard jobs={lint} repo={repo} revision={revision} />
          </Section>
          <Section title="Also failing on the parent" count={parentToo.length} quiet>
            {parentToo.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} revision={revision} />
            ))}
          </Section>
          <Section title="Seen before" count={seenBefore.length} quiet>
            <SeenBefore jobs={seenBefore} repo={repo} revision={revision} />
          </Section>
          <Section title="Known intermittents" count={known.length} quiet>
            {known.map((g) => (
              <TestCard key={g.testName} group={g} jobs={health.jobs} repo={repo} revision={revision} />
            ))}
          </Section>
        </div>
      )}

      {push && (
        <footer className="sv-footer">
          {commits.length > 0 && (
            <details className="sv-commits">
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
          <a
            className="sv-link"
            href={`/jobs?repo=${repo}&revision=${revision}`}
            onClick={chooseFullView}
          >
            Every job, in the full view
          </a>
        </footer>
      )}
    </>
  );
};

export default PushDetail;
