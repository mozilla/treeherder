import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  ago,
  authorName,
  fetchHealth,
  fetchPushes,
  fetchSummary,
  progressOf,
  pushesOf,
  pushTitle,
  pushUrl,
} from './helpers';
import { queued, usePoll, usePulse } from './hooks';
import Ring from './Ring';
import Kit from './Kit';
import Nav from './Nav';
import {
  cachedPushes,
  cachedSummary,
  rememberPerson,
  rememberPush,
  rememberPushes,
} from './cache';

// One short phrase for where a push stands, and a tone for its edge.
export const describeSummary = (summary) => {
  if (!summary) return { tone: 'quiet', text: '' };
  const progress = progressOf(summary.status);
  // testFailureCount is per test *per config*, so it would disagree with the
  // detail screen's per-test count. Say what is failing; the detail counts it.
  const broken = [
    [summary.testFailureCount, 'tests'],
    [summary.buildFailureCount, 'build'],
    [summary.lintFailureCount, 'lint'],
  ]
    .filter(([n]) => n > 0)
    .map(([, what]) => what);

  if (broken.length) {
    const what = broken.join(' and ');
    const text = `${what[0].toUpperCase()}${what.slice(1)} failing`;
    return {
      tone: 'bad',
      text: progress.running ? `${text} · still running` : text,
    };
  }
  // Nothing tagged new, but a job still failed: say so rather than "green".
  const failed = ['testfailed', 'busted', 'exception'].some(
    (r) => summary.status?.[r] > 0,
  );
  if (progress.running) {
    return {
      tone: 'running',
      text: `Running · ${progress.done} of ${progress.total}`,
    };
  }
  if (failed) return { tone: 'quiet', text: 'Only failures seen before' };
  return { tone: 'good', text: 'All green' };
};

const PushRow = ({ push, repo, author, refreshKey, index }) => {
  const [summary, setSummary] = useState(() =>
    cachedSummary(repo, push.revision),
  );

  useEffect(() => {
    let live = true;
    queued(() => fetchSummary(repo, push.revision)).then(
      (s) => live && s && setSummary(s),
    );
    return () => {
      live = false;
    };
  }, [repo, push.revision, refreshKey]);

  const { tone, text } = describeSummary(summary);
  const pulsing = usePulse(summary ? `${tone}:${text}` : undefined);

  return (
    <li className="pv-cascade" style={{ '--i': index }}>
      <Link
        className={`pv-row pv-tone-${tone}${pulsing ? ' pv-pulse' : ''}`}
        to={pushUrl({ repo, author, revision: push.revision })}
        onPointerDown={() => {
          rememberPush(repo, push);
          fetchHealth(repo, push.revision);
        }}
        onClick={() => rememberPush(repo, push)}
      >
        <Ring status={summary?.status} loading={!summary} ticks={24} size={38} weight={7} />
        <span className="pv-row-body">
          <span className="pv-row-title">{pushTitle(push)}</span>
          <span className="pv-row-meta">
            <span className="pv-row-status">
              {summary ? text : <span className="pv-skeleton" />}
            </span>
            <span className="pv-row-when">{ago(push.push_timestamp)}</span>
          </span>
        </span>
      </Link>
    </li>
  );
};

// The author, editable where it's shown: a mistyped address is fixed in
// place rather than by starting over.
const AuthorEditor = ({ repo, author, name, editing, setEditing }) => {
  const navigate = useNavigate();
  const [value, setValue] = useState(author);
  const input = useRef(null);

  useEffect(() => {
    if (editing) {
      setValue(author);
      input.current?.focus();
      input.current?.select();
    }
  }, [editing, author]);

  if (!editing) {
    return (
      <button
        type="button"
        className="pv-switch-person"
        onClick={() => setEditing(true)}
        aria-label={`Author ${author}, tap to change`}
      >
        author: {name || author}
      </button>
    );
  }

  const next = value.trim().toLowerCase();
  return (
    <form
      className="pv-author-edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (!next.includes('@')) return;
        setEditing(false);
        navigate(pushUrl({ repo, author: next }));
      }}
    >
      <input
        ref={input}
        className="pv-input pv-input-inline"
        type="email"
        inputMode="email"
        autoComplete="email"
        aria-label="Author email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
      />
      <button type="submit" className="pv-inline-go" disabled={!next.includes('@')}>
        Show
      </button>
      <button
        type="button"
        className="pv-inline-cancel"
        onClick={() => setEditing(false)}
      >
        Cancel
      </button>
      <Link className="pv-inline-recent" to={pushUrl({ repo, author: '' })}>
        Recent
      </Link>
    </form>
  );
};

const PushList = ({ repo, author, theme }) => {
  const [editing, setEditing] = useState(false);
  const [pushes, setPushes] = useState(() => cachedPushes(repo, author));
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const { data, failureStatus } = await fetchPushes(repo, author);
    if (failureStatus) {
      setError("Couldn't reach Treeherder.");
      return;
    }
    setError(null);
    setPushes(data.results);
    rememberPushes(repo, author, data.results);
    setRefreshKey((k) => k + 1);
  }, [repo, author]);

  useEffect(() => {
    setPushes(cachedPushes(repo, author));
    load();
  }, [load, repo, author]);
  usePoll(load, 90 * 1000);

  // Only this author's pushes: just after switching, the list can still hold
  // the last person's for a render.
  const own = pushes?.find((p) => p.author?.toLowerCase() === author);
  const name = own ? authorName(own) : null;
  // Someone with no pushes is usually a typo; don't offer it back.
  useEffect(() => {
    if (own) rememberPerson(author, name);
  }, [own, author, name]);

  return (
    <>
      <Nav
        repo={repo}
        author={author}
        theme={theme}
        full={`/jobs?repo=${repo}&author=${encodeURIComponent(author)}`}
        filter={
          <AuthorEditor
            repo={repo}
            author={author}
            name={name}
            editing={editing}
            setEditing={setEditing}
          />
        }
      />
      <header className="pv-masthead pv-rise">
        <div className="pv-masthead-words">
          <h1 className="pv-title">
            {pushesOf(name)}
          </h1>
          {name && <span className="pv-masthead-email">{author}</span>}
        </div>
        <Kit />
      </header>

      {error && <p className="pv-sub">{error}</p>}

      {pushes && !pushes.length && (
        <div className="pv-empty pv-rise">
          <p className="pv-sub">
            Nothing on {repo} from {author}.
          </p>
          <button
            type="button"
            className="pv-link-button"
            onClick={() => setEditing(true)}
          >
            Wrong address? Change it
          </button>
        </div>
      )}

      {pushes && (
        <ul className="pv-list">
          {pushes.map((push, index) => (
            <PushRow
              key={push.id}
              index={index}
              author={author}
              push={push}
              repo={repo}
              refreshKey={refreshKey}
            />
          ))}
        </ul>
      )}
    </>
  );
};

export default PushList;
