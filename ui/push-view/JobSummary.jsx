import { useEffect, useState } from 'react';

import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { bzBaseUrl } from '../helpers/url';

import Nav from './Nav';
import {
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
    const path = line.path_end || '';
    if (!path.includes('/') && !path.includes('.')) {
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
    <span className="pv-bug-id">
      {bug.resolution ? <s>{bug.id}</s> : bug.id}
    </span>
  ) : (
    <span className="pv-bug-id pv-muted">Internal</span>
  );
  return (
    <li>
      {bug.id ? (
        <a className="pv-bug" href={`${bzBaseUrl}show_bug.cgi?id=${bug.id}`}>
          {label}
          <span className="pv-bug-summary">{text}</span>
        </a>
      ) : (
        <span className="pv-bug">
          {label}
          <span className="pv-bug-summary">{text}</span>
        </span>
      )}
    </li>
  );
};

const Failure = ({ group }) => {
  const [showAll, setShowAll] = useState(false);
  const { dir, file } = splitTestPath(group.path);
  const bugs = showAll ? group.bugs : group.bugs.slice(0, SHOWN_BUGS);
  const hidden = group.bugs.length - bugs.length;

  return (
    <li className="pv-card pv-failure">
      <div className="pv-card-body">
        <span className="pv-test-file">{file}</span>
        {dir && <span className="pv-test-dir">{dir}</span>}
        {group.messages.map((m) => (
          <p key={m} className="pv-failure-message">
            {m}
          </p>
        ))}
        <span className="pv-card-meta">
          {group.isNew ? (
            <span className="pv-tag">New in this push</span>
          ) : (
            `Seen ${group.counter} ${plural(group.counter, 'time')} before`
          )}
        </span>
      </div>
      {group.bugs.length > 0 && (
        <ul className="pv-bugs">
          {bugs.map((bug) => (
            <Bug key={bug.id || bug.summary} bug={bug} path={group.path} />
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                className="pv-more"
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

const OtherErrors = ({ lines }) => (
  <details className="pv-other-errors">
    <summary>
      {lines.length} other log {plural(lines.length, 'error')}
    </summary>
    <ul>
      {lines.map((line) => (
        <li key={line.line_number} className="pv-failure-message">
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

const JobSummary = ({ repo, revision, jobId }) => {
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

  const { groups, other } = groupFailureLines(lines || []);
  const rawLog = job?.logs?.find((l) => l.name === 'live_backing_log')?.url;
  const full = job
    ? `/jobs?repo=${repo}&revision=${revision}&selectedTaskRun=${job.task_id}.${job.retry_id}`
    : `/jobs?repo=${repo}&revision=${revision}`;

  return (
    <>
      <div className="pv-aurora pv-tone-bad" />
      <Nav
        back={`/push?repo=${repo}&revision=${revision}`}
        backLabel="This push"
        full={full}
      />

      {error && <p className="pv-sub">{error}</p>}

      {job && (
        <header className="pv-push-head pv-rise">
          <span className="pv-eyebrow">
            {platformName(job.platform)} {job.platform_option} ·{' '}
            {job.job_type_symbol} · {resultWord(job.result)}
          </span>
          <h1 className="pv-job-title">{jobTitle(job.job_type_name)}</h1>
        </header>
      )}

      <section className="pv-section">
        <h2 className="pv-section-title">
          Failure summary{' '}
          {lines && <span className="pv-muted">{groups.length}</span>}
        </h2>
        {!lines && <span className="pv-skeleton pv-skeleton-headline" />}
        {lines && !lines.length && (
          <p className="pv-sub">
            No failure lines were parsed for this job. The log has the rest.
          </p>
        )}
        {groups.length > 0 && (
          <ul className="pv-cards pv-rise">
            {groups.map((group) => (
              <Failure key={group.path} group={group} />
            ))}
          </ul>
        )}
        {other.length > 0 && <OtherErrors lines={other} />}
      </section>

      <footer className="pv-footer">
        <a className="pv-link" href={`/logviewer?job_id=${jobId}&repo=${repo}`}>
          Open in the log viewer
        </a>
        {rawLog && (
          <a className="pv-link" href={rawLog}>
            Raw log
          </a>
        )}
      </footer>
    </>
  );
};

export default JobSummary;
