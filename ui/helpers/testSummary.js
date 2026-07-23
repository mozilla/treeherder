import { getSearchWords } from './display';
import { thBugSuggestionLimit } from './constants';

// Parses the contents of a `*_testsummary.jsonl` artifact into a structured
// object for the job-view Summary tab.
//
// Each line of the artifact is a JSON object describing a mozlog structured-log
// event. A test run is no longer a single `test_result` line — it is a
// `test_start` / `test_end` pair:
//
//   {"action": "test_start", "time": <ms>, "group": "<manifest>",
//    "test": "<path>"}
//
//   {"action": "test_end", "time": <ms>, "group": "<manifest>",
//    "test": "<path>", "status": "PASS", "message": "...",
//    "expected": "<status>"}   // `expected` present only when unexpected
//
//   {"action": "crash", "group": "<manifest>", "test": "<path>",
//    "signature": "<crash signature>", ...}
//
// The `end` event is not guaranteed: a test that crashes or hangs gets a
// `test_start` with no matching `test_end`. We pair the two events to recover
// each run's duration, and treat an unpaired `test_start` as a run that never
// finished (status CRASH).
//
// A single test can appear more than once (e.g. when it is retried), and a few
// results carry no `group`. We regroup the lines first by test (collapsing the
// repeated runs of the same test into one entry), then by group.

export const NO_GROUP = '(no group)';

// Status given to a test that emitted a `test_start` but never a matching
// `test_end` — the harness died mid-run, which almost always means a crash.
export const INCOMPLETE_STATUS = 'CRASH';

// Status buckets we report counts for. Anything unexpected falls back to its
// raw status string so nothing is silently dropped.
export const TEST_STATUSES = [
  'PASS',
  'FAIL',
  'SKIP',
  'TIMEOUT',
  'ERROR',
  'CRASH',
];

const safeParse = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

const parseLines = (content) => {
  if (Array.isArray(content)) {
    // Already an array of parsed objects or raw line strings.
    return content
      .map((line) => (typeof line === 'string' ? safeParse(line) : line))
      .filter(Boolean);
  }

  if (typeof content !== 'string') {
    return [];
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeParse)
    .filter(Boolean);
};

const emptyCounts = () => {
  const counts = { total: 0 };
  TEST_STATUSES.forEach((status) => {
    counts[status] = 0;
  });
  return counts;
};

const tallyStatus = (counts, status) => {
  counts.total += 1;
  if (status in counts) {
    counts[status] += 1;
  } else {
    counts[status] = (counts[status] || 0) + 1;
  }
};

const durationOf = (start, end) =>
  Number.isFinite(start) && Number.isFinite(end) ? end - start : null;

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

/**
 * Build the Summary tab data from a `*_testsummary.jsonl` artifact.
 *
 * @param {string|Array} content Raw artifact text, or an array of raw lines /
 *   already-parsed event objects.
 * @returns {{
 *   groups: Array<{
 *     name: string,
 *     counts: Object,
 *     tests: Array<{
 *       name: string,
 *       status: string,
 *       success: boolean,
 *       retried: boolean,
 *       results: Array<{ status: string, success: boolean, message: ?string, start: ?number, end: ?number, duration: ?number }>,
 *     }>,
 *   }>,
 *   counts: Object,
 * }}
 */
export const buildTestSummary = (content) => {
  const lines = parseLines(content);

  // group name -> Map(test name -> { name, results })
  const groups = new Map();

  const recordEntry = (entry) => {
    const groupName = entry.group || NO_GROUP;
    if (!groups.has(groupName)) {
      groups.set(groupName, new Map());
    }
    const tests = groups.get(groupName);

    if (!tests.has(entry.test)) {
      tests.set(entry.test, { name: entry.test, results: [] });
    }
    tests.get(entry.test).results.push({
      status: entry.status,
      success: entry.success,
      message: entry.message,
      messages: entry.messages || (entry.message ? [entry.message] : []),
      start: entry.start,
      end: entry.end,
      duration: entry.duration,
    });
  };

  // Open `test_start` events awaiting their `test_end`, queued per test name so
  // retries of the same test pair up in order (FIFO).
  const pending = new Map();
  // The group most recently opened by `group_start`, used as a fallback when a
  // test event carries no `group` of its own.
  let currentGroup = null;

  const takePending = (testName) => {
    const queue = pending.get(testName);
    return queue && queue.length ? queue.shift() : null;
  };

  lines.forEach((line) => {
    if (!line) return;

    switch (line.action) {
      case 'group_start':
        currentGroup = line.name || currentGroup;
        return;
      case 'group_end':
        currentGroup = null;
        return;
      case 'test_start': {
        if (!line.test) return;
        const run = {
          group: line.group || currentGroup,
          start: finiteOrNull(line.time),
          // Messages from unexpected `test_status` (subtest) events, which are
          // usually more descriptive than the parent `test_end` message.
          subtestFailures: [],
        };
        if (!pending.has(line.test)) pending.set(line.test, []);
        pending.get(line.test).push(run);
        return;
      }
      case 'test_status': {
        // A subtest result. We only keep the unexpected ones (those carrying an
        // `expected` field) to enrich the parent test's failure message. The
        // pending run's *first* queued start owns the in-progress subtests.
        if (!line.test || !('expected' in line)) return;
        const queue = pending.get(line.test);
        const run = queue && queue.length ? queue[0] : null;
        if (run && line.message) {
          const label = line.subtest ? `${line.subtest} - ` : '';
          run.subtestFailures.push(`${label}${line.message}`);
        }
        return;
      }
      case 'test_end': {
        if (!line.test) return;
        const run = takePending(line.test);
        const start = run ? run.start : null;
        const end = finiteOrNull(line.time);
        const success = !('expected' in line);
        const subtestFailures = run?.subtestFailures || [];
        // For a failing test prefer the (more informative) subtest messages,
        // keeping each one separate so the Summary tab can render one failure
        // line per message; otherwise fall back to the test_end message.
        const messages =
          !success && subtestFailures.length
            ? subtestFailures
            : line.message
              ? [line.message]
              : [];
        const message = messages.length ? messages.join(' | ') : null;
        recordEntry({
          test: line.test,
          group: line.group || run?.group || currentGroup,
          status: line.status,
          success,
          message,
          messages,
          start,
          end,
          duration: durationOf(start, end),
        });
        return;
      }
      case 'crash': {
        const testName = line.test || line.signature || '(unknown test)';
        recordEntry({
          test: testName,
          group: line.group || currentGroup,
          status: 'CRASH',
          success: false,
          message: line.signature || null,
          start: null,
          end: null,
          duration: null,
        });
        return;
      }
      default:
    }
  });

  // Any `test_start` left unpaired never produced a `test_end`: the run did not
  // finish, which we surface as a crash so it is not silently dropped.
  pending.forEach((queue, testName) => {
    queue.forEach((run) => {
      recordEntry({
        test: testName,
        group: run.group,
        status: INCOMPLETE_STATUS,
        success: false,
        message: 'Test started but never finished',
        start: run.start,
        end: null,
        duration: null,
      });
    });
  });

  const overallCounts = emptyCounts();
  // Per-status counts for tests where success=false (unexpected outcomes).
  const overallRealFailCounts = {};

  const groupList = Array.from(groups.entries()).map(([name, tests]) => {
    const groupCounts = emptyCounts();

    const testList = Array.from(tests.values()).map((test) => {
      // The "final" status/success is the last run of the test (handles retries).
      const lastResult = test.results[test.results.length - 1];
      const { status, success } = lastResult;
      tallyStatus(groupCounts, status);
      tallyStatus(overallCounts, status);
      if (!success) {
        overallRealFailCounts[status] =
          (overallRealFailCounts[status] || 0) + 1;
      }
      return {
        ...test,
        status,
        success,
        retried: test.results.length > 1,
      };
    });

    return { name, counts: groupCounts, tests: testList };
  });

  return {
    groups: groupList,
    counts: overallCounts,
    realFailCounts: overallRealFailCounts,
  };
};

/**
 * Build a flat, `bug_suggestions`-API-shaped list of the failing tests in a
 * `buildTestSummary()` result, for use by the Summary tab (which
 * reuses BugFiler/InternalIssueFiler but has no Bugzilla suggestion data).
 *
 * @param {ReturnType<typeof buildTestSummary>|null} summary
 * @returns {Array<{ search: string, path_end: string, search_terms: string[], bugs: { open_recent: [], all_others: [] } }>}
 */
export const buildFailureSuggestions = (summary) => {
  if (!summary) return [];

  const suggestions = [];
  summary.groups.forEach((group) => {
    group.tests.forEach((test) => {
      if (test.success) return;
      const lastResult = test.results[test.results.length - 1];
      // A single failing test can emit several unexpected messages (e.g. one
      // subtest failure per line). Render each as its own failure line, mirroring
      // FailureSummaryTab, instead of collapsing them into one joined line.
      const messages = lastResult.messages?.length
        ? lastResult.messages
        : [lastResult.message].filter(Boolean);
      if (!messages.length) messages.push(null);
      messages.forEach((message, index) => {
        const search = `TEST-UNEXPECTED-${test.status} | ${test.name}${
          message ? ` | ${message}` : ''
        }`;
        suggestions.push({
          search,
          path_end: test.name,
          search_terms: getSearchWords(search),
          // Bug suggestions match on test path, so every line of a test would
          // otherwise get the same bugs. Only the first line carries them.
          primary: index === 0,
          bugs: { open_recent: [], all_others: [] },
        });
      });
    });
  });
  return suggestions;
};

// Normalize a test path so the testsummary test name and the bug_suggestions
// `path_end` (which the backend trims/cleans) can be compared. We keep only the
// trailing slash-free form so a full manifest path matches its `path_end`.
const normalizePath = (path) =>
  (path || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

// True when a bug_suggestion's path matches a failing test's path. The backend
// may store either the full path or only its tail in `path_end`, so we accept
// an exact match or one being the suffix of the other.
const pathsMatch = (testPath, bugPath) => {
  if (!testPath || !bugPath) return false;
  const a = normalizePath(testPath);
  const b = normalizePath(bugPath);
  if (!a || !b) return false;
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
};

const bugKey = (bug) => bug.id ?? bug.internal_id;

const mergeBugs = (target, incoming) => {
  const seen = new Set(target.map(bugKey));
  incoming.forEach((bug) => {
    const key = bugKey(bug);
    if (!seen.has(key)) {
      seen.add(key);
      target.push(bug);
    }
  });
};

// Mirror the validity flags FailureSummaryTab derives from the bug_suggestions
// API, so SummaryItem can reuse the same display logic.
const decorateBugs = (suggestion) => {
  const { bugs } = suggestion;
  bugs.too_many_open_recent = bugs.open_recent.length > thBugSuggestionLimit;
  bugs.too_many_all_others = bugs.all_others.length > thBugSuggestionLimit;
  suggestion.valid_open_recent =
    bugs.open_recent.length > 0 && !bugs.too_many_open_recent;
  suggestion.valid_all_others =
    bugs.all_others.length > 0 &&
    !bugs.too_many_all_others &&
    !bugs.too_many_open_recent;
  suggestion.showBugSuggestions =
    suggestion.valid_open_recent || suggestion.valid_all_others;
};

/**
 * Enrich the testsummary-derived failure suggestions with the Bugzilla bug
 * suggestions returned by the `/bug_suggestions/` API, matching on test path.
 *
 * The testsummary artifact gives us the canonical list of failing tests, but
 * carries no Bugzilla data; the API gives us bugs keyed by log error line. We
 * match the two by test path (`path_end`) and attach every matching bug to the
 * corresponding failing test, merging when several error lines map to one test.
 *
 * @param {ReturnType<typeof buildFailureSuggestions>} failureSuggestions
 * @param {Array<{ path_end: ?string, bugs: { open_recent: [], all_others: [] } }>} bugSuggestions
 * @returns {typeof failureSuggestions} the same suggestions, bugs attached.
 */
export const matchBugSuggestions = (failureSuggestions, bugSuggestions) => {
  if (!failureSuggestions || !failureSuggestions.length) return failureSuggestions;
  if (!bugSuggestions || !bugSuggestions.length) {
    failureSuggestions.forEach(decorateBugs);
    return failureSuggestions;
  }

  failureSuggestions.forEach((suggestion) => {
    // Non-primary lines share a test path with the primary one; attaching bugs
    // to them too would duplicate the suggestions under every message line.
    if (suggestion.primary === false) {
      decorateBugs(suggestion);
      return;
    }
    const matches = bugSuggestions.filter((bugSuggestion) =>
      pathsMatch(suggestion.path_end, bugSuggestion.path_end),
    );
    matches.forEach((match) => {
      mergeBugs(suggestion.bugs.open_recent, match.bugs?.open_recent || []);
      mergeBugs(suggestion.bugs.all_others, match.bugs?.all_others || []);
    });
    decorateBugs(suggestion);
  });

  return failureSuggestions;
};

export default buildTestSummary;
