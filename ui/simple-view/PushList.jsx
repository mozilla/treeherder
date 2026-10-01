import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  ago,
  authorName,
  fetchHealth,
  fetchPushes,
  fetchSummary,
  progressOf,
  pushTitle,
  pushUrl,
} from './helpers';
import { queued, usePoll, usePulse } from './hooks';
import Ring from './Ring';
import { LIST, PICKER } from './strings';
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
    [summary.testFailureCount, LIST.failingKinds.tests],
    [summary.buildFailureCount, LIST.failingKinds.build],
    [summary.lintFailureCount, LIST.failingKinds.lint],
  ]
    .filter(([n]) => n > 0)
    .map(([, what]) => what);

  if (broken.length) {
    const text = LIST.failing(broken);
    return {
      tone: 'bad',
      text: progress.running ? LIST.stillRunning(text) : text,
    };
  }
  // Nothing tagged new, but a job still failed: say so rather than "green".
  const failed = ['testfailed', 'busted', 'exception'].some(
    (r) => summary.status?.[r] > 0,
  );
  if (progress.running) {
    return {
      tone: 'running',
      text: LIST.running(progress.done, progress.total),
    };
  }
  if (failed) return { tone: 'quiet', text: LIST.onlySeenBefore };
  return { tone: 'good', text: LIST.green };
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
    <li className="sv-cascade" style={{ '--i': index }}>
      <Link
        className={`sv-row sv-tone-${tone}${pulsing ? ' sv-pulse' : ''}`}
        to={pushUrl({ repo, author, revision: push.revision })}
        onPointerDown={() => {
          rememberPush(repo, push);
          fetchHealth(repo, push.revision);
        }}
        onClick={() => rememberPush(repo, push)}
      >
        <Ring status={summary?.status} loading={!summary} ticks={24} size={38} weight={7} />
        <span className="sv-row-body">
          <span className="sv-row-title">{pushTitle(push)}</span>
          <span className="sv-row-meta">
            <span className="sv-row-status">
              {summary ? text : <span className="sv-skeleton" />}
            </span>
            <span className="sv-row-when">{ago(push.push_timestamp)}</span>
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
        className="sv-switch-person"
        onClick={() => setEditing(true)}
        aria-label={LIST.authorLabel(author)}
      >
        {LIST.author(name || author)}
      </button>
    );
  }

  const next = value.trim().toLowerCase();
  return (
    <form
      className="sv-author-edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (!next.includes('@')) return;
        setEditing(false);
        navigate(pushUrl({ repo, author: next }));
      }}
    >
      <input
        ref={input}
        className="sv-input sv-input-inline"
        type="email"
        inputMode="email"
        autoComplete="email"
        aria-label={PICKER.emailLabel}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
      />
      <button type="submit" className="sv-inline-go" disabled={!next.includes('@')}>
        {LIST.editShow}
      </button>
      <button
        type="button"
        className="sv-inline-cancel"
        onClick={() => setEditing(false)}
      >
        {LIST.editCancel}
      </button>
      <Link className="sv-inline-recent" to={pushUrl({ repo, author: '' })}>
        {LIST.editRecent}
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
      setError(LIST.unreachable);
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
      <header className="sv-masthead sv-rise">
        <div className="sv-masthead-words">
          <h1 className="sv-title">
            {LIST.title(name)}
          </h1>
          {name && <span className="sv-masthead-email">{author}</span>}
        </div>
        <Kit />
      </header>

      {error && <p className="sv-sub">{error}</p>}

      {pushes && !pushes.length && (
        <div className="sv-empty sv-rise">
          <p className="sv-sub">
            {LIST.empty(repo, author)}
          </p>
          <button
            type="button"
            className="sv-link-button"
            onClick={() => setEditing(true)}
          >
            {LIST.wrongAddress}
          </button>
        </div>
      )}

      {pushes && (
        <ul className="sv-list">
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
