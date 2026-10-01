import { useEffect, useState } from 'react';

import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { bzBaseUrl } from '../helpers/url';

import Nav from './Nav';
import { chooseFullView } from './phone';
import {
  pushUrl,
  testFromErrorLine,
  jobShortName,
  platformName,
  plural,
  resultWord,
  splitTestPath,
} from './helpers';

// The failure summary for one job, sized for a phone: what failed, whether
// it's new, and the bugs it matches. The log is there, but it's the last
// resort, not the first tap.

const fetchJob = (repo, id) => getData(getProjectUrl(`/jobs/${id}/`, repo));
const fetchSuggestions = (repo, id) =>
  getData(getProjectUrl(`/jobs/${id}/bug_suggestions/`, repo));

// "TEST-UNEXPECTED-FAIL | path | message" → the message.
const messageOf = (search) => {
  const parts = search.split(' | ');
  return parts.length > 2 ? parts.slice(2).join(' | ') : search;
};

// Lines a failing test always drags along; they say nothing about why.
const FILLER = /^(profile uploaded in |finished in \d+ms$)/;

// One card per test, however many lines it logged; lines with no test (a
// harness error) are kept apart so they can't bury the ones that matter.
export const groupFailureLines = (lines) => {
  const tests = new Map();
  const other = [];
  for (const line of lines) {
    // A test file, or a named harness check like "leakcheck" from the line
    // itself; anything else (a bare harness error) goes with the rest.
    const named = line.path_end || '';
    const path =
      named.includes('/') || named.includes('.')
        ? named
        : testFromErrorLine(line.search);
    if (!path) {
      other.push(line);
      continue;
    }
    const g = tests.get(path) || {
      path,
      messages: [],
      isNew: false,
      counter: 0,
      bugs: new Map(),
    };
    const message = messageOf(line.search);
    if (!g.messages.includes(message)) g.messages.push(message);
    g.isNew = g.isNew || line.failure_new_in_rev || line.counter === 0;
    g.counter = Math.max(g.counter, line.counter || 0);
    for (const bug of [
      ...(line.bugs?.open_recent || []),
      ...(line.bugs?.all_others || []),
    ]) {
      // Internal issues have no Bugzilla id and often repeat one summary.
      const key = bug.id || `internal:${bug.summary}`;
      if (!g.bugs.has(key)) g.bugs.set(key, bug);
    }
    tests.set(path, g);
  }
  const groups = [...tests.values()].map((g) => {
    const real = g.messages.filter((m) => !FILLER.test(m));
    return { ...g, messages: real.length ? real : g.messages, bugs: [...g.bugs.values()] };
  });
  // New failures first: they're the ones to read.
  groups.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return { groups, other };
};

// A bug summary usually repeats the test path the card already shows.
const bugSummary = (summary, path) => {
  const trimmed = summary
    .replace(/^Intermittent\s+/i, '')
    .replace(path, '')
    .replace(/^[\s|]+/, '')
    .trim();
  return trimmed || summary;
};

const SHOWN_BUGS = 3;

const Bug = ({ bug, path }) => {
  const text = bugSummary(bug.summary || '', path);
  const label = bug.id ? (
    <span className="sv-bug-id">
      {bug.resolution ? <s>{bug.id}</s> : bug.id}
    </span>
  ) : (
    <span className="sv-bug-id sv-muted">Internal</span>
  );
  return (
    <li>
      {bug.id ? (
        <a className="sv-bug" href={`${bzBaseUrl}show_bug.cgi?id=${bug.id}`}>
          {label}
          <span className="sv-bug-summary">{text}</span>
        </a>
      ) : (
        <span className="sv-bug">
          {label}
          <span className="sv-bug-summary">{text}</span>
        </span>
      )}
    </li>
  );
};

const Failure = ({ group, block, under }) => {
  // Opened under a tile that already names this test: skip straight to why.
  const repeat = block && under && group.path.endsWith(under);
  const [showAll, setShowAll] = useState(false);
  const { dir, file } = splitTestPath(group.path);
  const bugs = showAll ? group.bugs : group.bugs.slice(0, SHOWN_BUGS);
  const hidden = group.bugs.length - bugs.length;

  return (
    <li className={block ? 'sv-failure-block' : 'sv-card sv-failure'}>
      <div className="sv-card-body">
        {!repeat && <span className="sv-test-file">{file}</span>}
        {!repeat && dir && <span className="sv-test-dir">{dir}</span>}
        {group.messages.map((m) => (
          <p key={m} className="sv-failure-message">
            {m}
          </p>
        ))}
        <span className="sv-card-meta">
          {group.isNew ? (
            !repeat && <span className="sv-tag">New in this push</span>
          ) : (
            `Seen ${group.counter} ${plural(group.counter, 'time')} before`
          )}
        </span>
      </div>
      {group.bugs.length > 0 && (
        <ul className="sv-bugs">
          {bugs.map((bug) => (
            <Bug key={bug.id || bug.summary} bug={bug} path={group.path} />
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                className="sv-more"
                onClick={() => setShowAll(true)}
              >
                {hidden} more {plural(hidden, 'bug')}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
};

const OtherErrors = ({ lines, open }) => (
  <details className="sv-other-errors" open={open}>
    <summary>
      {lines.length} other log {plural(lines.length, 'error')}
    </summary>
    <ul>
      {lines.map((line) => (
        <li key={line.line_number} className="sv-failure-message">
          {line.search}
        </li>
      ))}
    </ul>
  </details>
);

// "test-macosx1500-aarch64/debug-mochitest-browser-chrome-15" → the suite;
// the platform and build type are already in the line above it.
const jobTitle = (name) =>
  jobShortName(name).replace(/^test-[^/]+\/[^-]+-/, '');

const useJob = (repo, jobId) => {
  const [job, setJob] = useState(null);
  const [lines, setLines] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([fetchJob(repo, jobId), fetchSuggestions(repo, jobId)]).then(
      ([j, s]) => {
        if (!live) return;
        if (j.failureStatus) setError("Couldn't load that job.");
        else setJob(j.data);
        setLines(s.failureStatus || !Array.isArray(s.data) ? [] : s.data);
      },
    );
    return () => {
      live = false;
    };
  }, [repo, jobId]);

  return { job, lines, error };
};

// Why a job failed: one entry per test, then the log lines that name no
// test. Those open by themselves when they're all there is, so the reason
// is never behind a tap.
export const JobFailures = ({ repo, revision, jobId, inline, under }) => {
  const { job, lines } = useJob(repo, jobId);
  const { groups, other } = groupFailureLines(lines || []);
  const rawLog = job?.logs?.find((l) => l.name === 'live_backing_log')?.url;
  const full = job
    ? `/jobs?repo=${repo}&revision=${revision}&selectedTaskRun=${job.task_id}.${job.retry_id}`
    : `/jobs?repo=${repo}&revision=${revision}`;

  const links = (
    <div className={inline ? 'sv-inline-links' : 'sv-footer'}>
      <a className="sv-link" href={`/logviewer?job_id=${jobId}&repo=${repo}`}>
        Log viewer
      </a>
      {rawLog && (
        <a className="sv-link" href={rawLog}>
          Raw log
        </a>
      )}
      {inline && (
        <a className="sv-link" href={full} onClick={chooseFullView}>
          Full view
        </a>
      )}
    </div>
  );

  if (!lines) {
    return (
      <div className={inline ? 'sv-inline' : undefined}>
        <span className="sv-skeleton" />
      </div>
    );
  }

  const body = (
    <>
      {!lines.length && (
        <p className="sv-sub">
          No failure lines were parsed for this job. The log has the rest.
        </p>
      )}
      {groups.length > 0 && (
        <ul className={inline ? 'sv-inline-failures' : 'sv-cards sv-rise'}>
          {groups.map((group) => (
            <Failure
              key={group.path}
              group={group}
              block={inline}
              under={under}
            />
          ))}
        </ul>
      )}
      {other.length > 0 && (
        <OtherErrors lines={other} open={groups.length === 0} />
      )}
    </>
  );

  return inline ? (
    <div className="sv-inline sv-rise">
      {body}
      {links}
    </div>
  ) : (
    <>
      <section className="sv-section">
        <h2 className="sv-section-title">
          Failure summary <span className="sv-muted">{groups.length}</span>
        </h2>
        {body}
      </section>
      {links}
    </>
  );
};

// The same summary as its own page, for a link straight to one job.
const JobSummary = ({ repo, author, theme, revision, jobId }) => {
  const { job, error } = useJob(repo, jobId);
  const full = job
    ? `/jobs?repo=${repo}&revision=${revision}&selectedTaskRun=${job.task_id}.${job.retry_id}`
    : `/jobs?repo=${repo}&revision=${revision}`;

  return (
    <>
      <Nav
        repo={repo}
        author={author}
        theme={theme}
        back={pushUrl({ repo, author, revision })}
        backLabel="This push"
        full={full}
        filter={`revision: ${revision.slice(0, 12)}${job ? ` · ${job.job_type_symbol}` : ''}`}
      />
      {error && <p className="sv-sub">{error}</p>}
      {job && (
        <header className="sv-push-head sv-rise">
          <span className="sv-eyebrow">
            {platformName(job.platform)} {job.platform_option} ·{' '}
            {job.job_type_symbol} · {resultWord(job.result)}
          </span>
          <h1 className="sv-job-title">{jobTitle(job.job_type_name)}</h1>
        </header>
      )}
      <JobFailures repo={repo} revision={revision} jobId={jobId} />
    </>
  );
};

export default JobSummary;
