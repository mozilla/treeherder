import { getSearchWords } from './display';

// Parses the contents of a `*_testsummary.jsonl` artifact into a structured
// object for the job-view Summary tab.
//
// Each line of the artifact is a JSON object describing an event. The events we
// care about are:
//
//   {"action": "test_result", "group": "<manifest>", "test": "<path>",
//    "status": "PASS", "start": <ms>, "end": <ms>, "message": "..."}
//
//   {"action": "crash", "group": "<manifest>", "test": "<path>",
//    "signature": "<crash signature>", ...}
//
// A single test can appear more than once (e.g. when it is retried), and a few
// results carry no `group`. We regroup the lines first by test (collapsing the
// repeated runs of the same test into one entry), then by group.

export const NO_GROUP = '(no group)';

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

const durationOf = ({ start, end }) =>
  Number.isFinite(start) && Number.isFinite(end) ? end - start : null;

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

  lines.forEach((line) => {
    if (!line) return;

    let entry;
    if (line.action === 'test_result' && line.test) {
      entry = {
        test: line.test,
        group: line.group,
        status: line.status,
        success: !('expected' in line),
        message: line.message || null,
        start: Number.isFinite(line.start) ? line.start : null,
        end: Number.isFinite(line.end) ? line.end : null,
        duration: durationOf(line),
      };
    } else if (line.action === 'crash') {
      const testName = line.test || line.signature || '(unknown test)';
      entry = {
        test: testName,
        group: line.group,
        status: 'CRASH',
        success: false,
        message: line.signature || null,
        start: null,
        end: null,
        duration: null,
      };
    } else {
      return;
    }

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
      start: entry.start,
      end: entry.end,
      duration: entry.duration,
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
      const search = `TEST-UNEXPECTED-${test.status} | ${test.name}${
        lastResult.message ? ` | ${lastResult.message}` : ''
      }`;
      suggestions.push({
        search,
        path_end: test.name,
        search_terms: getSearchWords(search),
        bugs: { open_recent: [], all_others: [] },
      });
    });
  });
  return suggestions;
};

export default buildTestSummary;
