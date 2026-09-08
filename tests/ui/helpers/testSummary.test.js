import {
  buildTestSummary,
  buildFailureSuggestions,
  matchBugSuggestions,
  filterGenericFailures,
  prepareBugSuggestions,
  computeSummaryDivergence,
  NO_GROUP,
  INCOMPLETE_STATUS,
  HARNESS_STATUS,
} from '../../../ui/helpers/testSummary';

const lines = [
  {
    action: 'test_start',
    time: 100,
    group: 'dom/manifest.ini',
    test: 'dom/tests/test_pass.html',
  },
  {
    action: 'test_end',
    time: 150,
    group: 'dom/manifest.ini',
    test: 'dom/tests/test_pass.html',
    status: 'PASS',
  },
  {
    action: 'test_start',
    time: 200,
    group: 'dom/manifest.ini',
    test: 'dom/tests/test_fail.html',
  },
  {
    action: 'test_end',
    time: 260,
    group: 'dom/manifest.ini',
    test: 'dom/tests/test_fail.html',
    status: 'FAIL',
    expected: 'PASS',
    message: 'assertion failed',
  },
  {
    action: 'test_start',
    time: 300,
    group: 'layout/manifest.ini',
    test: 'layout/tests/test_other.html',
  },
  {
    action: 'test_end',
    time: 400,
    group: 'layout/manifest.ini',
    test: 'layout/tests/test_other.html',
    status: 'TIMEOUT',
    expected: 'PASS',
  },
];

describe('buildTestSummary', () => {
  const findTest = (summary, groupName, testName) =>
    summary.groups
      .find((g) => g.name === groupName)
      .tests.find((t) => t.name === testName);

  test('pairs test_start/test_end into a single run with a duration', () => {
    const summary = buildTestSummary(lines);
    const pass = findTest(summary, 'dom/manifest.ini', 'dom/tests/test_pass.html');

    expect(pass.status).toBe('PASS');
    expect(pass.success).toBe(true);
    expect(pass.retried).toBe(false);
    expect(pass.results).toHaveLength(1);
    expect(pass.results[0].duration).toBe(50);
  });

  test('marks a test_end without `expected` as a success', () => {
    const summary = buildTestSummary(lines);
    const fail = findTest(summary, 'dom/manifest.ini', 'dom/tests/test_fail.html');
    expect(fail.success).toBe(false);
    expect(fail.status).toBe('FAIL');
  });

  test('collapses repeated start/end pairs of one test into a retried entry', () => {
    const retried = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 't' },
      { action: 'test_end', time: 10, group: 'g', test: 't', status: 'FAIL', expected: 'PASS' },
      { action: 'test_start', time: 20, group: 'g', test: 't' },
      { action: 'test_end', time: 25, group: 'g', test: 't', status: 'PASS' },
    ]);
    const test = findTest(retried, 'g', 't');
    expect(test.results).toHaveLength(2);
    expect(test.retried).toBe(true);
    // Final status comes from the last run.
    expect(test.status).toBe('PASS');
    expect(test.success).toBe(true);
  });

  test('treats a test_start with no test_end as an unfinished (crashed) run', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'never_ends' },
    ]);
    const test = findTest(summary, 'g', 'never_ends');
    expect(test.status).toBe(INCOMPLETE_STATUS);
    expect(test.success).toBe(false);
    expect(test.results[0].duration).toBe(null);
  });

  test('falls back to the group_start group when a test event omits `group`', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 0, name: 'manifest.toml' },
      { action: 'test_start', time: 1, test: 'orphan' },
      { action: 'test_end', time: 2, test: 'orphan', status: 'PASS' },
    ]);
    expect(findTest(summary, 'manifest.toml', 'orphan')).toBeTruthy();
  });

  test('enriches a failing test_end message with unexpected subtest messages', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'browser_x.js' },
      {
        action: 'test_status',
        time: 5,
        group: 'g',
        test: 'browser_x.js',
        subtest: null,
        status: 'FAIL',
        expected: 'PASS',
        message: 'This test exceeded the timeout threshold.',
      },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'browser_x.js',
        status: 'FAIL',
        expected: 'PASS',
        message: 'finished in 452487ms',
      },
    ]);
    const test = findTest(summary, 'g', 'browser_x.js');
    expect(test.success).toBe(false);
    expect(test.results[0].message).toBe(
      'This test exceeded the timeout threshold.',
    );
  });

  test('ignores passing (expected) subtest statuses', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'browser_y.js' },
      {
        action: 'test_status',
        time: 5,
        group: 'g',
        test: 'browser_y.js',
        subtest: 'checks a thing',
        status: 'PASS',
      },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'browser_y.js',
        status: 'OK',
        message: 'done',
      },
    ]);
    const test = findTest(summary, 'g', 'browser_y.js');
    expect(test.success).toBe(true);
    expect(test.results[0].message).toBe('done');
  });

  test('files a result with no resolvable group under NO_GROUP', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 1, test: 'lonely' },
      { action: 'test_end', time: 2, test: 'lonely', status: 'PASS' },
    ]);
    expect(findTest(summary, NO_GROUP, 'lonely')).toBeTruthy();
  });
});

describe('buildFailureSuggestions', () => {
  test('emits one failure line per unexpected subtest message', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'browser_all.js' },
      {
        action: 'test_status',
        time: 3,
        group: 'g',
        test: 'browser_all.js',
        subtest: null,
        status: 'FAIL',
        expected: 'PASS',
        message: 'there should be no unreferenced files - Got 1, expected +0',
      },
      {
        action: 'test_status',
        time: 4,
        group: 'g',
        test: 'browser_all.js',
        subtest: null,
        status: 'FAIL',
        expected: 'PASS',
        message: 'file only referenced from unreferenced files',
      },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'browser_all.js',
        status: 'FAIL',
        expected: 'PASS',
        message: 'finished',
      },
    ]);

    const suggestions = buildFailureSuggestions(summary);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].search).toBe(
      'TEST-UNEXPECTED-FAIL | browser_all.js | there should be no unreferenced files - Got 1, expected +0',
    );
    expect(suggestions[1].search).toBe(
      'TEST-UNEXPECTED-FAIL | browser_all.js | file only referenced from unreferenced files',
    );
    // Both lines point at the same test path for bug matching / path filtering.
    expect(suggestions.every((s) => s.path_end === 'browser_all.js')).toBe(true);
  });

  test('emits a single line for a failure with one message', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'browser_one.js' },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'browser_one.js',
        status: 'FAIL',
        expected: 'PASS',
        message: 'boom',
      },
    ]);

    const suggestions = buildFailureSuggestions(summary);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].search).toBe(
      'TEST-UNEXPECTED-FAIL | browser_one.js | boom',
    );
  });
});

describe('matchBugSuggestions', () => {
  const buildFailures = () =>
    buildFailureSuggestions(buildTestSummary(lines));

  test('attaches bugs whose path_end matches a failing test', () => {
    const bugSuggestions = [
      {
        path_end: 'dom/tests/test_fail.html',
        bugs: {
          open_recent: [{ id: 123, internal_id: 1, summary: 'bug A' }],
          all_others: [],
        },
      },
    ];

    const failures = matchBugSuggestions(buildFailures(), bugSuggestions);
    const failed = failures.find(
      (s) => s.path_end === 'dom/tests/test_fail.html',
    );

    expect(failed.bugs.open_recent).toHaveLength(1);
    expect(failed.valid_open_recent).toBe(true);
    expect(failed.showBugSuggestions).toBe(true);

    const unmatched = failures.find(
      (s) => s.path_end === 'layout/tests/test_other.html',
    );
    expect(unmatched.bugs.open_recent).toHaveLength(0);
    expect(unmatched.showBugSuggestions).toBe(false);
  });

  test('matches when the API only stores the path tail', () => {
    const bugSuggestions = [
      {
        path_end: 'test_fail.html',
        bugs: { open_recent: [{ id: 9, internal_id: 9 }], all_others: [] },
      },
    ];

    const failures = matchBugSuggestions(buildFailures(), bugSuggestions);
    const failed = failures.find(
      (s) => s.path_end === 'dom/tests/test_fail.html',
    );
    expect(failed.bugs.open_recent).toHaveLength(1);
  });

  test('merges and de-dupes bugs from multiple error lines of one test', () => {
    const bugSuggestions = [
      {
        path_end: 'dom/tests/test_fail.html',
        bugs: { open_recent: [{ id: 1, internal_id: 1 }], all_others: [] },
      },
      {
        path_end: 'dom/tests/test_fail.html',
        bugs: {
          open_recent: [
            { id: 1, internal_id: 1 },
            { id: 2, internal_id: 2 },
          ],
          all_others: [],
        },
      },
    ];

    const failures = matchBugSuggestions(buildFailures(), bugSuggestions);
    const failed = failures.find(
      (s) => s.path_end === 'dom/tests/test_fail.html',
    );
    expect(failed.bugs.open_recent.map((b) => b.id)).toEqual([1, 2]);
  });

  test('returns decorated suggestions even with no bug suggestions', () => {
    const failures = matchBugSuggestions(buildFailures(), []);
    expect(failures).toHaveLength(2);
    failures.forEach((s) => {
      expect(s.showBugSuggestions).toBe(false);
      expect(s.valid_open_recent).toBe(false);
    });
  });

  test('attaches bugs only to the first line of a multi-message test', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'browser_all.js' },
      {
        action: 'test_status',
        time: 3,
        group: 'g',
        test: 'browser_all.js',
        subtest: null,
        status: 'FAIL',
        expected: 'PASS',
        message: 'first failure',
      },
      {
        action: 'test_status',
        time: 4,
        group: 'g',
        test: 'browser_all.js',
        subtest: null,
        status: 'FAIL',
        expected: 'PASS',
        message: 'second failure',
      },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'browser_all.js',
        status: 'FAIL',
        expected: 'PASS',
        message: 'finished',
      },
    ]);
    const bugSuggestions = [
      {
        path_end: 'browser_all.js',
        bugs: { open_recent: [{ id: 7, internal_id: 7 }], all_others: [] },
      },
    ];

    const failures = matchBugSuggestions(
      buildFailureSuggestions(summary),
      bugSuggestions,
    );
    expect(failures).toHaveLength(2);
    expect(failures[0].bugs.open_recent).toHaveLength(1);
    expect(failures[0].showBugSuggestions).toBe(true);
    expect(failures[1].bugs.open_recent).toHaveLength(0);
    expect(failures[1].showBugSuggestions).toBe(false);
  });
});

describe('harness failures (ERROR/CRITICAL log lines)', () => {
  const group = 'netwerk/test/browser/browser.toml';
  const leakLines = [
    `TEST-UNEXPECTED-FAIL | LeakSanitizer leak at Alloc, nsTSubstring, nsTSubstring, Append | ${group}`,
    `TEST-UNEXPECTED-FAIL | LeakSanitizer leak at nsTimer, nsTimer::WithEventTarget, NS_NewTimer, NS_NewTimer | ${group}`,
  ];
  const summaryLines = [
    { action: 'suite_start', time: 0, name: 'mochitest-browser' },
    { action: 'group_start', time: 1, name: group },
    { action: 'test_start', time: 2, group, test: 'netwerk/test/browser/browser_test_offline_tab.js' },
    {
      action: 'test_end',
      time: 5,
      group,
      test: 'netwerk/test/browser/browser_test_offline_tab.js',
      status: 'PASS',
      message: 'finished in 3ms',
    },
    { action: 'log', time: 6, level: 'ERROR', message: leakLines[0] },
    { action: 'log', time: 7, level: 'ERROR', message: leakLines[1] },
    { action: 'group_end', time: 8, name: group },
    { action: 'suite_end', time: 9 },
  ];

  const harnessEntries = (summary, groupName) =>
    summary.groups
      .find((g) => g.name === groupName)
      .tests.filter((t) => t.harness);

  test('files each line as its own ERROR entry under the open group', () => {
    const summary = buildTestSummary(summaryLines);
    const entries = harnessEntries(summary, group);

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name)).toEqual([
      'LeakSanitizer leak at Alloc, nsTSubstring, nsTSubstring, Append',
      'LeakSanitizer leak at nsTimer, nsTimer::WithEventTarget, NS_NewTimer, NS_NewTimer',
    ]);
    entries.forEach((entry, index) => {
      expect(entry.status).toBe(HARNESS_STATUS);
      expect(entry.success).toBe(false);
      expect(entry.retried).toBe(false);
      expect(entry.results).toHaveLength(1);
      expect(entry.results[0].message).toBe(leakLines[index]);
    });
    // The passing test in the same group is untouched, and the harness
    // lines count as failures without inflating the test tallies.
    expect(summary.groups[0].tests).toHaveLength(3);
    expect(summary.counts).toMatchObject({ total: 1, PASS: 1, ERROR: 0 });
    expect(summary.groups[0].counts).toMatchObject({ total: 1, ERROR: 0 });
    expect(summary.realFailCounts).toEqual({ ERROR: 2 });
  });

  test('does not collapse identical lines into one retried entry', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 0, name: 'g' },
      { action: 'log', time: 1, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | leakcheck | 1288 bytes leaked (nsFoo)' },
      { action: 'log', time: 2, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | leakcheck | 1288 bytes leaked (nsFoo)' },
    ]);
    const entries = harnessEntries(summary, 'g');
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.retried === false)).toBe(true);
  });

  test('ignores log lines that are not failures', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 0, name: 'g' },
      { action: 'log', time: 1, level: 'INFO', message: 'TEST-INFO | noise' },
      { action: 'log', time: 2, level: 'WARNING', message: 'careful' },
      { action: 'log', time: 3, level: 'ERROR' },
      { action: 'log', time: 4, level: 'CRITICAL', message: 'TEST-UNEXPECTED-FAIL | leakcheck | 12 bytes leaked (nsBar)' },
    ]);
    const entries = harnessEntries(summary, 'g');
    expect(entries).toHaveLength(1);
    expect(entries[0].results[0].message).toBe(
      'TEST-UNEXPECTED-FAIL | leakcheck | 12 bytes leaked (nsBar)',
    );
  });

  test('files a line under the manifest it names, or NO_GROUP when it names none', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 0, name: 'a/browser.toml' },
      { action: 'group_end', time: 1, name: 'a/browser.toml' },
      { action: 'log', time: 2, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | LeakSanitizer leak at X | a/browser.toml' },
      { action: 'log', time: 3, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | Shutdown | Main app process exited abnormally' },
    ]);
    expect(harnessEntries(summary, 'a/browser.toml')).toHaveLength(1);
    expect(harnessEntries(summary, NO_GROUP)).toHaveLength(1);
  });

  test('names the entry after the message when the line has no path token', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 0, name: 'g' },
      { action: 'log', time: 1, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | leakcheck | 1288 bytes leaked (nsFoo)' },
      { action: 'log', time: 2, level: 'ERROR', message: 'Automation Error: mozprocess timed out' },
    ]);
    const [leak, timeout] = harnessEntries(summary, 'g');
    expect(leak.name).toBe('TEST-UNEXPECTED-FAIL | leakcheck | 1288 bytes leaked (nsFoo)');
    expect(leak.pathEnd).toBe(null);
    expect(timeout.name).toBe('Automation Error: mozprocess timed out');
    expect(timeout.pathEnd).toBe(null);
  });

  test('emits the raw line as the suggestion, with the backend path_end', () => {
    const suggestions = buildFailureSuggestions(buildTestSummary(summaryLines));

    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.search)).toEqual(leakLines);
    expect(suggestions.map((s) => s.path_end)).toEqual([
      'LeakSanitizer leak at Alloc, nsTSubstring, nsTSubstring, Append',
      'LeakSanitizer leak at nsTimer, nsTimer::WithEventTarget, NS_NewTimer, NS_NewTimer',
    ]);
    expect(suggestions.every((s) => s.primary)).toBe(true);
  });

  test('derives path_end the way the backend does for crash and leakcheck lines', () => {
    const suggestions = buildFailureSuggestions(
      buildTestSummary([
        { action: 'group_start', time: 0, name: 'g' },
        { action: 'log', time: 1, level: 'ERROR', message: 'PROCESS-CRASH | application crashed [@ mozalloc_abort] | dom/tests/test_x.html' },
        { action: 'log', time: 2, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | leakcheck | 1288 bytes leaked (nsFoo)' },
        { action: 'log', time: 3, level: 'ERROR', message: 'TEST-UNEXPECTED-FAIL | layout\\reftests\\a.html == layout\\reftests\\a-ref.html | image comparison' },
      ]),
    );

    expect(suggestions.map((s) => s.path_end)).toEqual([
      'dom/tests/test_x.html',
      null,
      'layout/reftests/a.html',
    ]);
  });

  test('attaches the bugs the API keys on the same path_end', () => {
    const bugSuggestions = [
      {
        search: leakLines[0],
        path_end: 'LeakSanitizer leak at Alloc, nsTSubstring, nsTSubstring, Append',
        bugs: { open_recent: [], all_others: [{ id: 1979140, internal_id: 42 }] },
      },
    ];
    const failures = matchBugSuggestions(
      buildFailureSuggestions(buildTestSummary(summaryLines)),
      bugSuggestions,
    );

    expect(failures[0].bugs.all_others.map((b) => b.id)).toEqual([1979140]);
    expect(failures[0].showBugSuggestions).toBe(true);
    expect(failures[1].bugs.all_others).toHaveLength(0);
    expect(failures[1].showBugSuggestions).toBe(false);
  });
});

describe('classic failure summary helpers', () => {
  const line = (search, pathEnd = null, extra = {}) => ({
    search,
    path_end: pathEnd,
    bugs: { open_recent: [], all_others: [] },
    ...extra,
  });

  const genericLine = (path) =>
    line(`TEST-UNEXPECTED-FAIL | ${path} | finished in 12ms`, path);

  describe('filterGenericFailures', () => {
    test('drops generic lines when a specific error exists for the path', () => {
      const specific = line(
        'TEST-UNEXPECTED-FAIL | path/a.js | assertion failed',
        'path/a.js',
      );
      const filtered = filterGenericFailures([specific, genericLine('path/a.js')]);

      expect(filtered).toEqual([specific]);
    });

    test('keeps a generic line when it is the only error for its path', () => {
      const other = line(
        'TEST-UNEXPECTED-FAIL | path/b.js | assertion failed',
        'path/b.js',
      );
      const filtered = filterGenericFailures([other, genericLine('path/a.js')]);

      expect(filtered).toHaveLength(2);
    });

    test('drops taskcluster exit-status lines', () => {
      const specific = line(
        'TEST-UNEXPECTED-FAIL | path/a.js | assertion failed',
        'path/a.js',
      );
      const filtered = filterGenericFailures([
        specific,
        line('[taskcluster:error] exit status 1'),
      ]);

      expect(filtered).toEqual([specific]);
    });

    test('marks only the first occurrence of each path to show bugs', () => {
      const first = line(
        'TEST-UNEXPECTED-FAIL | path/a.js | first error',
        'path/a.js',
      );
      const second = line(
        'TEST-UNEXPECTED-FAIL | path/a.js | second error',
        'path/a.js',
      );
      const pathless = line('some harness error');

      filterGenericFailures([first, second, pathless]);

      expect(first.showBugSuggestions).toBe(true);
      expect(second.showBugSuggestions).toBe(false);
      expect(pathless.showBugSuggestions).toBe(true);
    });
  });

  describe('prepareBugSuggestions', () => {
    test('derives the bug-validity flags', () => {
      const bug = { id: 1, internal_id: 1, occurrences: 1, resolution: '' };
      const withBugs = line(
        'TEST-UNEXPECTED-FAIL | path/a.js | assertion failed',
        'path/a.js',
        { bugs: { open_recent: [bug], all_others: [] } },
      );

      const [prepared] = prepareBugSuggestions([withBugs]);

      expect(prepared.valid_open_recent).toBe(true);
      expect(prepared.valid_all_others).toBe(false);
      expect(prepared.bugs.too_many_open_recent).toBe(false);
    });

    test('filters generic lines and handles a non-array input', () => {
      const specific = line(
        'TEST-UNEXPECTED-FAIL | path/a.js | assertion failed',
        'path/a.js',
      );

      expect(prepareBugSuggestions([specific, genericLine('path/a.js')])).toEqual(
        [specific],
      );
      expect(prepareBugSuggestions(undefined)).toEqual([]);
    });
  });

  describe('computeSummaryDivergence', () => {
    const summarySide = (search, pathEnd = null) => ({
      search,
      path_end: pathEnd,
    });

    test('identical failure lines do not diverge', () => {
      const result = computeSummaryDivergence(
        [summarySide('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js')],
        [line('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js')],
      );

      expect(result.diverged).toBe(false);
      expect(result.onlyInSummary).toEqual([]);
      expect(result.onlyInClassic).toEqual([]);
    });

    test('a line only in the classic summary is reported', () => {
      const result = computeSummaryDivergence(
        [summarySide('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js')],
        [
          line('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js'),
          line('PROCESS-CRASH | app crashed | path/a.js', 'path/a.js'),
        ],
      );

      expect(result.diverged).toBe(true);
      expect(result.onlyInClassic).toEqual([
        'PROCESS-CRASH | app crashed | path/a.js',
      ]);
      expect(result.onlyInSummary).toEqual([]);
    });

    test('a line only in the summary is reported', () => {
      const result = computeSummaryDivergence(
        [
          summarySide('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js'),
          summarySide('TEST-UNEXPECTED-FAIL | path/b.js | boom', 'path/b.js'),
        ],
        [line('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js')],
      );

      expect(result.diverged).toBe(true);
      expect(result.onlyInSummary).toEqual([
        'TEST-UNEXPECTED-FAIL | path/b.js | boom',
      ]);
    });

    test('generic lines are ignored on both sides', () => {
      const result = computeSummaryDivergence(
        [summarySide('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js')],
        [
          line('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js'),
          line('TEST-UNEXPECTED-FAIL | path/a.js | finished in 12ms', 'path/a.js'),
          line('[taskcluster:error] exit status 1'),
        ],
      );

      expect(result.diverged).toBe(false);
    });

    test('whitespace-only differences do not diverge', () => {
      const result = computeSummaryDivergence(
        [summarySide('TEST-UNEXPECTED-FAIL | path/a.js |  oops ', 'path/a.js')],
        [line('TEST-UNEXPECTED-FAIL | path/a.js | oops', 'path/a.js')],
      );

      expect(result.diverged).toBe(false);
    });

    test('null inputs are treated as empty and do not diverge', () => {
      expect(computeSummaryDivergence(null, null).diverged).toBe(false);
      expect(computeSummaryDivergence(undefined, []).diverged).toBe(false);
    });
  });
});

describe('console lines', () => {
  const anchorLine = {
    action: 'console_anchor',
    line: 1,
    message: 'ConsoleLogger online at 20260904 in /builds/worker',
  };

  test('keeps the console_anchor record as the summary anchor', () => {
    const summary = buildTestSummary([anchorLine, ...lines]);

    expect(summary.anchor).toEqual({
      line: 1,
      message: 'ConsoleLogger online at 20260904 in /builds/worker',
    });
    // The anchor is not a test.
    expect(summary.counts.total).toBe(3);
  });

  test('has no anchor when the artifact carries none', () => {
    expect(buildTestSummary(lines).anchor).toBeNull();
  });

  test('links a failing test_end to its own console line', () => {
    const summary = buildTestSummary([
      anchorLine,
      { action: 'test_start', time: 1, test: 'a.html', line: 10 },
      {
        action: 'test_end',
        time: 2,
        test: 'a.html',
        status: 'FAIL',
        expected: 'PASS',
        message: 'boom',
        line: 12,
      },
    ]);
    const [suggestion] = buildFailureSuggestions(summary);

    expect(suggestion.line).toBe(12);
    expect(summary.groups[0].tests[0].results[0].lines).toEqual([12]);
  });

  test('links each unexpected subtest message to its own console line', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 1, test: 'a.html', line: 10 },
      {
        action: 'test_status',
        test: 'a.html',
        subtest: 'first',
        status: 'FAIL',
        expected: 'PASS',
        message: 'one',
        line: 11,
      },
      {
        action: 'test_status',
        test: 'a.html',
        subtest: 'second',
        status: 'FAIL',
        expected: 'PASS',
        message: 'two',
        line: 13,
      },
      {
        action: 'test_end',
        time: 2,
        test: 'a.html',
        status: 'OK',
        expected: 'OK',
        line: 15,
      },
    ]);
    const suggestions = buildFailureSuggestions(summary);

    expect(suggestions.map((s) => s.line)).toEqual([11, 13]);
  });

  test('links crashes, harness lines and unfinished tests', () => {
    const summary = buildTestSummary([
      { action: 'group_start', name: 'dir/manifest.toml', line: null },
      { action: 'test_start', time: 1, test: 'hung.html', line: 20 },
      {
        action: 'crash',
        test: 'crashed.html',
        signature: 'sig',
        line: 25,
      },
      {
        action: 'log',
        level: 'ERROR',
        message: 'TEST-UNEXPECTED-FAIL | leakcheck | tab process: 12 bytes leaked (Foo)',
        line: 30,
      },
    ]);
    const byTest = Object.fromEntries(
      buildFailureSuggestions(summary).map((s) => [s.search, s.line]),
    );

    expect(byTest['TEST-UNEXPECTED-CRASH | crashed.html | sig']).toBe(25);
    expect(
      byTest['TEST-UNEXPECTED-FAIL | leakcheck | tab process: 12 bytes leaked (Foo)'],
    ).toBe(30);
    expect(
      byTest['TEST-UNEXPECTED-CRASH | hung.html | Test started but never finished'],
    ).toBe(20);
  });

  test('leaves the line null when the record printed nothing', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 1, test: 'a.html' },
      {
        action: 'test_end',
        time: 2,
        test: 'a.html',
        status: 'FAIL',
        expected: 'PASS',
        message: 'boom',
        line: null,
      },
    ]);

    expect(buildFailureSuggestions(summary)[0].line).toBeNull();
  });
});
