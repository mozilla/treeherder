import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import {
  ago,
  fetchHealth,
  fetchPushes,
  fetchSummary,
  progressOf,
  pushTitle,
} from './helpers';
import { queued, usePoll, usePulse } from './hooks';
import Ring from './Ring';
import Kit from './Kit';
import {
  cachedPushes,
  cachedSummary,
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

const PushRow = ({ push, repo, refreshKey, index }) => {
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
        to={`/push?repo=${repo}&revision=${push.revision}`}
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

const PushList = ({ repo, author, onChangeAuthor }) => {
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

  return (
    <>
      <div className="pv-aurora pv-tone-quiet" />
      <header className="pv-masthead pv-rise">
        <div className="pv-masthead-words">
          <span className="pv-nameplate">Treeherder · {repo}</span>
          <h1 className="pv-title">Your pushes</h1>
          <button type="button" className="pv-link-button" onClick={onChangeAuthor}>
            {author}
          </button>
        </div>
        <Kit />
      </header>

      {error && <p className="pv-sub">{error}</p>}

      {pushes && !pushes.length && (
        <p className="pv-sub pv-rise">
          Nothing on {repo} from {author} yet.
        </p>
      )}

      {pushes && (
        <ul className="pv-list">
          {pushes.map((push, index) => (
            <PushRow
              key={push.id}
              index={index}
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
