import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  ago,
  authorName,
  fetchPushes,
  progressOf,
  pushTitle,
  pushUrl,
} from './helpers';
import { queued, usePoll, usePulse } from './hooks';
import Ring from './Ring';
import { LIST, MINI_RING, PICKER, POLL_MS } from './constants';
import { loadPushJobs } from './jobs';
import Kit from './Kit';
import Nav from './Nav';
import {
  cachedPushes,
  cachedSummary,
  rememberPerson,
  rememberPush,
  rememberPushes,
} from './cache';

export const describeSummary = (summary) => {
  if (!summary) return { tone: 'quiet', text: '' };
  const progress = progressOf(summary.status);
  if (summary.failed) {
    const parts = [LIST.failed(summary.failed)];
    if (summary.fresh) parts.push(LIST.newCount(summary.fresh));
    if (!summary.open) parts.push(LIST.allClassified);
    const text = parts.join(' · ');
    return {
      tone: summary.open ? 'bad' : 'quiet',
      text: progress.running ? LIST.stillRunning(text) : text,
    };
  }
  if (progress.running) {
    return {
      tone: 'running',
      text: LIST.running(progress.done, progress.total),
    };
  }
  return { tone: 'good', text: LIST.green };
};

const PushRow = ({ push, repo, author, refreshKey, index }) => {
  const [summary, setSummary] = useState(() =>
    cachedSummary(repo, push.revision),
  );

  useEffect(() => {
    // A finished push's counts don't change, so it's only fetched once.
    if (cachedSummary(repo, push.revision)?.finished) return undefined;
    let live = true;
    queued(() => loadPushJobs(repo, push.id, push.revision)).then(
      (jobs) => live && jobs && setSummary(cachedSummary(repo, push.revision)),
    );
    return () => {
      live = false;
    };
  }, [repo, push.id, push.revision, refreshKey]);

  const { tone, text } = describeSummary(summary);
  const pulsing = usePulse(summary ? `${tone}:${text}` : undefined);

  return (
    <li className="sv-cascade" style={{ '--i': index }}>
      <Link
        className={`sv-row sv-tone-${tone}${pulsing ? ' sv-pulse' : ''}`}
        to={pushUrl({ repo, author, revision: push.revision })}
        onPointerDown={() => {
          rememberPush(repo, push);
          loadPushJobs(repo, push.id, push.revision);
        }}
        onClick={() => rememberPush(repo, push)}
      >
        <Ring
          status={summary?.status}
          loading={!summary}
          ticks={MINI_RING.ticks}
          size={MINI_RING.size}
          weight={MINI_RING.weight}
        />
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
    let response;
    try {
      response = await fetchPushes(repo, author);
    } catch {
      setError(LIST.unreachable);
      return;
    }
    const { data, failureStatus } = response;
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
  usePoll(load, POLL_MS.list);

  // Just after switching person, the list can still hold the last one's pushes.
  const own = pushes?.find((p) => p.author?.toLowerCase() === author);
  const name = own ? authorName(own) : null;
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
