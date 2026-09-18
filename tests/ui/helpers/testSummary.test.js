import {
  buildTestSummary,
  buildFailureSuggestions,
  matchBugSuggestions,
  filterGenericFailures,
  prepareBugSuggestions,
  computeSummaryDivergence,
  isNewFailureLine,
  findNewFailureLines,
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
      .find(g => g.name === groupName)
      .tests.find(t => t.name === testName);

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
    expect(suggestions.every(s => s.path_end === 'browser_all.js')).toBe(true);
  });

  test('uses the subtest messages a failing xpcshell test replays after its end', () => {
    // xpcshell buffers a failing test's output and replays it after the
    // test_end, so the informative statuses arrive once the run is closed.
    const summary = buildTestSummary([
      {
        action: 'test_start',
        time: 0,
        group: 'netwerk/test/unit/xpcshell.toml',
        test: 'netwerk/test/unit/test_retry.js',
      },
      {
        action: 'test_end',
        time: 10,
        group: 'netwerk/test/unit/xpcshell.toml',
        test: 'netwerk/test/unit/test_retry.js',
        status: 'FAIL',
        expected: 'PASS',
        message: 'xpcshell return code: 0',
      },
      {
        action: 'group_start',
        name: 'replaying full log for netwerk/test/unit/test_retry.js',
      },
      {
        action: 'test_status',
        time: 8,
        test: 'netwerk/test/unit/test_retry.js',
        subtest: 'test_intentional_failure',
        status: 'FAIL',
        expected: 'PASS',
        message: 'Intentional failure - false == true',
      },
      {
        action: 'test_status',
        time: 9,
        test: 'netwerk/test/unit/test_retry.js',
        subtest: null,
        status: 'FAIL',
        expected: 'PASS',
        message: 'profile uploaded in profile_test_retry.js.json',
      },
      {
        action: 'group_end',
        name: 'replaying full log for netwerk/test/unit/test_retry.js',
      },
    ]);

    const suggestions = buildFailureSuggestions(summary);
    expect(suggestions.map(s => s.search)).toEqual([
      'TEST-UNEXPECTED-FAIL | netwerk/test/unit/test_retry.js | test_intentional_failure - Intentional failure - false == true',
      'TEST-UNEXPECTED-FAIL | netwerk/test/unit/test_retry.js | profile uploaded in profile_test_retry.js.json',
    ]);
    // Each line links to its own status, recorded before the test_end.
    expect(suggestions.map(s => s.logTarget.time)).toEqual([8, 9]);
    // The test stays filed under its manifest, not the replay group.
    const [group] = summary.groups;
    expect(group.name).toBe('netwerk/test/unit/xpcshell.toml');
    expect(group.tests[0].results[0].logTimes).toEqual([8, 9]);
  });

  test('ignores the replayed statuses of a run the harness will retry', () => {
    // A test_end with no `expected` is not a reported failure: the harness
    // reruns the test, and that later run is the authoritative result.
    const summary = buildTestSummary([
      { action: 'test_start', time: 0, group: 'g', test: 'test_retry.js' },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'test_retry.js',
        status: 'FAIL',
        message: 'Test failed or timed out, will retry',
      },
      {
        action: 'test_status',
        time: 8,
        test: 'test_retry.js',
        subtest: 'sub',
        status: 'FAIL',
        expected: 'PASS',
        message: 'replayed noise',
      },
      { action: 'test_start', time: 20, group: 'g', test: 'test_retry.js' },
      {
        action: 'test_end',
        time: 30,
        group: 'g',
        test: 'test_retry.js',
        status: 'PASS',
      },
    ]);

    expect(buildFailureSuggestions(summary)).toEqual([]);
    const [test] = summary.groups[0].tests;
    expect(test.retried).toBe(true);
    expect(test.results[0].messages).toEqual([
      'Test failed or timed out, will retry',
    ]);
  });

  test('fails a passed run on the shutdown leaks mochitest reports after its test_end', () => {
    // mochitest finds shutdown leaks once the browser has exited, so it reports
    // them after the test_end of the test they name, which passed. The first
    // pass leaked too but recorded nothing: the harness retried the test.
    const manifest = 'browser/components/aiwindow/ui/test/browser/browser.toml';
    const testPath =
      'browser/components/aiwindow/ui/test/browser/browser_aiwindow_group_tabs_button_model.js';
    const summary = buildTestSummary([
      { action: 'group_start', name: manifest },
      { action: 'test_start', time: 0, group: manifest, test: testPath },
      {
        action: 'test_end',
        time: 10,
        group: manifest,
        test: testPath,
        status: 'PASS',
        message: 'finished in 10ms',
      },
      { action: 'group_start', name: 'retry' },
      {
        action: 'test_start',
        time: 20,
        group: manifest,
        test: testPath,
      },
      {
        action: 'test_end',
        time: 30,
        group: manifest,
        test: testPath,
        status: 'PASS',
        message: 'finished in 10ms',
      },
      {
        action: 'test_status',
        time: 31,
        group: manifest,
        test: testPath,
        subtest: 'Shutdown',
        status: 'FAIL',
        expected: 'PASS',
        message:
          'leaked window until shutdown [url = chrome://browser/content/browser.xhtml]',
      },
      // The harness synthesizes some of these records without a group.
      {
        action: 'test_status',
        time: 32,
        test: testPath,
        subtest: 'Shutdown',
        status: 'FAIL',
        expected: 'PASS',
        message: 'leaked 1 window(s) until shutdown [url = about:blank]',
      },
      { action: 'group_end', name: 'retry' },
      { action: 'group_end', name: manifest },
    ]);

    const suggestions = buildFailureSuggestions(summary);
    expect(suggestions.map(s => s.search)).toEqual([
      `TEST-UNEXPECTED-FAIL | ${testPath} | Shutdown - leaked window until shutdown [url = chrome://browser/content/browser.xhtml]`,
      `TEST-UNEXPECTED-FAIL | ${testPath} | Shutdown - leaked 1 window(s) until shutdown [url = about:blank]`,
    ]);
    // Each line links to its own status, not the test_end.
    expect(suggestions.map(s => s.logTarget.time)).toEqual([31, 32]);
    expect(summary.realFailCounts).toEqual({ FAIL: 1 });
    // The test stays filed under its manifest, not the retry group.
    expect(summary.groups.map(g => g.name)).toEqual([manifest]);
    const [entry] = summary.groups[0].tests;
    expect(entry.status).toBe('FAIL');
    expect(entry.success).toBe(false);
    expect(entry.retried).toBe(true);
    expect(entry.results[0].status).toBe('PASS');
    expect(entry.results[1].message).not.toContain('finished in');
  });

  test('attributes a shutdown leak to a test that ended several tests earlier', () => {
    // A regular chunk exits the browser once, after its last test: the leak
    // names a test that ended before others, which passed for good.
    const summary = buildTestSummary([
      { action: 'group_start', name: 'g' },
      { action: 'test_start', time: 0, group: 'g', test: 'browser_leaks.js' },
      {
        action: 'test_end',
        time: 10,
        group: 'g',
        test: 'browser_leaks.js',
        status: 'PASS',
        message: 'finished in 10ms',
      },
      { action: 'test_start', time: 20, group: 'g', test: 'browser_clean.js' },
      {
        action: 'test_end',
        time: 30,
        group: 'g',
        test: 'browser_clean.js',
        status: 'PASS',
        message: 'finished in 10ms',
      },
      { action: 'group_end', name: 'g' },
      {
        action: 'test_status',
        time: 40,
        test: 'browser_leaks.js',
        subtest: 'Shutdown',
        status: 'FAIL',
        expected: 'PASS',
        message: 'leaked 1 docShell(s) until shutdown',
      },
    ]);

    expect(buildFailureSuggestions(summary).map(s => s.search)).toEqual([
      'TEST-UNEXPECTED-FAIL | browser_leaks.js | Shutdown - leaked 1 docShell(s) until shutdown',
    ]);
    const byName = Object.fromEntries(
      summary.groups[0].tests.map(t => [t.name, t]),
    );
    expect(byName['browser_leaks.js'].status).toBe('FAIL');
    expect(byName['browser_clean.js'].success).toBe(true);
    expect(summary.counts).toMatchObject({ total: 2, PASS: 1, FAIL: 1 });
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
      s => s.path_end === 'dom/tests/test_fail.html',
    );

    expect(failed.bugs.open_recent).toHaveLength(1);
    expect(failed.valid_open_recent).toBe(true);
    expect(failed.showBugSuggestions).toBe(true);

    const unmatched = failures.find(
      s => s.path_end === 'layout/tests/test_other.html',
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
      s => s.path_end === 'dom/tests/test_fail.html',
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
      s => s.path_end === 'dom/tests/test_fail.html',
    );
    expect(failed.bugs.open_recent.map(b => b.id)).toEqual([1, 2]);
  });

  test('returns decorated suggestions even with no bug suggestions', () => {
    const failures = matchBugSuggestions(buildFailures(), []);
    expect(failures).toHaveLength(2);
    failures.forEach(s => {
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

  describe('new failure fields', () => {
    const noBugs = { open_recent: [], all_others: [] };

    test('copies them from the API line with the same text', () => {
      const failures = matchBugSuggestions(buildFailures(), [
        {
          // Spacing differs from the summary line; the text is the same.
          search:
            'TEST-UNEXPECTED-FAIL |  dom/tests/test_fail.html | assertion failed ',
          path_end: 'dom/tests/test_fail.html',
          failure_new_in_rev: true,
          counter: 0,
          bugs: noBugs,
        },
      ]);
      const failed = failures.find(
        s => s.path_end === 'dom/tests/test_fail.html',
      );

      expect(failed.failure_new_in_rev).toBe(true);
      expect(failed.counter).toBe(0);
    });

    test('does not copy them from another line of the same test', () => {
      const failures = matchBugSuggestions(buildFailures(), [
        {
          search:
            'PROCESS-CRASH | application crashed | dom/tests/test_fail.html',
          path_end: 'dom/tests/test_fail.html',
          failure_new_in_rev: true,
          counter: 0,
          bugs: noBugs,
        },
      ]);
      const failed = failures.find(
        s => s.path_end === 'dom/tests/test_fail.html',
      );

      expect(failed.failure_new_in_rev).toBe(false);
      expect(failed.counter).toBeNull();
    });

    test('copies them onto every line of a multi-message test', () => {
      const summary = buildTestSummary([
        { action: 'test_start', time: 0, group: 'g', test: 'browser_all.js' },
        ...['first failure', 'second failure'].map(message => ({
          action: 'test_status',
          time: 3,
          group: 'g',
          test: 'browser_all.js',
          subtest: null,
          status: 'FAIL',
          expected: 'PASS',
          message,
        })),
        {
          action: 'test_end',
          time: 10,
          group: 'g',
          test: 'browser_all.js',
          status: 'FAIL',
          expected: 'PASS',
        },
      ]);

      const failures = matchBugSuggestions(buildFailureSuggestions(summary), [
        {
          search: 'TEST-UNEXPECTED-FAIL | browser_all.js | second failure',
          path_end: 'browser_all.js',
          failure_new_in_rev: true,
          bugs: noBugs,
        },
      ]);

      // Only the second line is new, though the first one carries the bugs.
      expect(failures.map(s => s.failure_new_in_rev)).toEqual([false, true]);
    });
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
      .find(g => g.name === groupName)
      .tests.filter(t => t.harness);

  test('files each line as its own ERROR entry under the open group', () => {
    const summary = buildTestSummary(summaryLines);
    const entries = harnessEntries(summary, group);

    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.name)).toEqual([
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
    expect(entries.every(e => e.retried === false)).toBe(true);
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
    expect(suggestions.map(s => s.search)).toEqual(leakLines);
    expect(suggestions.map(s => s.path_end)).toEqual([
      'LeakSanitizer leak at Alloc, nsTSubstring, nsTSubstring, Append',
      'LeakSanitizer leak at nsTimer, nsTimer::WithEventTarget, NS_NewTimer, NS_NewTimer',
    ]);
    expect(suggestions.every(s => s.primary)).toBe(true);
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

    expect(suggestions.map(s => s.path_end)).toEqual([
      'dom/tests/test_x.html',
      null,
      'layout/reftests/a.html',
    ]);
  });

  test("attaches the API's bugs to the line with the same path_end", () => {
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

    expect(failures[0].bugs.all_others.map(b => b.id)).toEqual([1979140]);
    expect(failures[0].showBugSuggestions).toBe(true);
    expect(failures[1].bugs.all_others).toHaveLength(0);
    expect(failures[1].showBugSuggestions).toBe(false);
  });
});

describe('UBSan reports (ubsan_error records)', () => {
  const group = 'toolkit/components/ml/tests/browser_models/browser_models.toml';
  const testPath = 'toolkit/components/ml/tests/browser_models/browser_ml_smollm2_chat.js';
  const file = '/builds/worker/checkouts/gecko/third_party/llama.cpp/ggml/src/ggml-c.c';
  const report = {
    action: 'ubsan_error',
    time: 3,
    kind: 'undefined-behavior',
    message: 'applying non-zero offset 96 to null pointer',
    file,
    lineno: 7106,
    column: 33,
    stack: [{ function: 'incr_ptr_aligned', file, line: 7106, column: 33 }],
    scope: testPath,
    test: testPath,
  };
  const displayLine = `UndefinedBehaviorSanitizer | ${testPath} | applying non-zero offset 96 to null pointer at third_party/llama.cpp/ggml/src/ggml-c.c:7106:33`;
  const classicLine = `SUMMARY: UndefinedBehaviorSanitizer: undefined-behavior ${file}:7106:33`;
  const summaryLines = [
    { action: 'group_start', time: 1, name: group },
    { action: 'test_start', time: 2, group, test: testPath },
    report,
    { action: 'test_end', time: 5, group, test: testPath, status: 'PASS' },
    { action: 'group_end', time: 6, name: group },
  ];

  const harnessEntries = (summary, groupName) =>
    summary.groups
      .find(g => g.name === groupName)
      .tests.filter(t => t.harness);

  test("files a report as its own failure under the running test's group", () => {
    const summary = buildTestSummary(summaryLines);
    const entries = harnessEntries(summary, group);

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.name).toBe(testPath);
    expect(entry.pathEnd).toBe(testPath);
    expect(entry.status).toBe(HARNESS_STATUS);
    expect(entry.success).toBe(false);
    expect(entry.retried).toBe(false);
    expect(entry.results).toHaveLength(1);
    expect(entry.results[0].message).toBe(displayLine);
    expect(entry.results[0].classicLine).toBe(classicLine);
    // The test the report interrupted still passed: a report is not a test.
    expect(summary.counts).toMatchObject({ total: 1, PASS: 1, ERROR: 0 });
    expect(summary.realFailCounts).toEqual({ ERROR: 1 });
  });

  test('files a report between tests under the manifest its scope names', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: group },
      { action: 'group_end', time: 2, name: group },
      { ...report, test: undefined, scope: group },
    ]);
    const [entry] = harnessEntries(summary, group);

    expect(entry.results[0].message).toBe(
      'UndefinedBehaviorSanitizer | applying non-zero offset 96 to null pointer at third_party/llama.cpp/ggml/src/ggml-c.c:7106:33',
    );
    expect(entry.pathEnd).toBe(null);
  });

  test('keeps two reports apart and prints only the location the runtime gave', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: 'g' },
      { ...report, file: '/src/a.c', lineno: 12, column: undefined },
      { action: 'ubsan_error', time: 4, kind: 'pointer-overflow', message: 'division by zero', test: 'b.js' },
    ]);
    const entries = harnessEntries(summary, 'g');

    expect(entries).toHaveLength(2);
    expect(entries.every(e => e.retried === false)).toBe(true);
    expect(entries[0].results[0].message).toBe(
      `UndefinedBehaviorSanitizer | ${testPath} | applying non-zero offset 96 to null pointer at /src/a.c:12`,
    );
    expect(entries[0].results[0].classicLine).toBe(
      'SUMMARY: UndefinedBehaviorSanitizer: undefined-behavior /src/a.c:12',
    );
    expect(entries[1].results[0].message).toBe(
      'UndefinedBehaviorSanitizer | b.js | division by zero',
    );
    expect(entries[1].results[0].classicLine).toBe(
      'SUMMARY: UndefinedBehaviorSanitizer: pointer-overflow',
    );
  });

  test('ignores a report with no message', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: 'g' },
      { action: 'ubsan_error', time: 2, kind: 'undefined-behavior', test: testPath },
    ]);

    expect(summary.groups).toEqual([]);
  });

  test('emits the display line as the suggestion, with the classic line alongside', () => {
    const suggestions = buildFailureSuggestions(buildTestSummary(summaryLines));

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].search).toBe(displayLine);
    expect(suggestions[0].path_end).toBe(testPath);
    expect(suggestions[0].classicLine).toBe(classicLine);
    // The log has the classic line, not the display one.
    expect(suggestions[0].logTarget.texts).toEqual([classicLine]);
  });

  test('leaves other suggestions without a classic line', () => {
    const [suggestion] = buildFailureSuggestions(buildTestSummary(lines));

    expect(suggestion).not.toHaveProperty('classicLine');
  });

  test('matches the classic SUMMARY line for newness and divergence', () => {
    const failures = buildFailureSuggestions(buildTestSummary(summaryLines));
    const classic = [
      {
        search: classicLine,
        path_end: null,
        failure_new_in_rev: true,
        counter: 3,
        bugs: { open_recent: [], all_others: [] },
      },
    ];

    expect(computeSummaryDivergence(failures, classic).diverged).toBe(false);
    const [matched] = matchBugSuggestions(failures, classic);
    expect(matched.failure_new_in_rev).toBe(true);
    expect(matched.counter).toBe(3);
    expect(isNewFailureLine(matched, 'autoland')).toBe(true);
  });

  test('diverges when the classic summary lacks the report', () => {
    const failures = buildFailureSuggestions(buildTestSummary(summaryLines));

    const divergence = computeSummaryDivergence(failures, []);
    expect(divergence.diverged).toBe(true);
    expect(divergence.onlyInSummary).toEqual([classicLine]);
  });
});

describe('leak totals (mozleak_total records)', () => {
  const group = 'browser/components/aiwindow/ui/test/browser/browser.toml';
  const total = {
    action: 'mozleak_total',
    time: 3,
    process: 'default',
    bytes: 856,
    threshold: 0,
    objects: [
      'CondVar',
      'MozPromiseRefcountable',
      'Mutex',
      'ThreadEventTarget',
      'ThreadTargetSink',
      'nsThread',
    ],
    scope: group,
    induced_crash: false,
    ignore_missing: false,
  };
  const classicLine =
    'TEST-UNEXPECTED-FAIL | leakcheck | default 856 bytes leaked (CondVar, MozPromiseRefcountable, Mutex, ThreadEventTarget, ThreadTargetSink, ...)';
  const summaryLines = [
    { action: 'group_start', time: 1, name: group },
    { action: 'test_start', time: 2, group, test: 'browser_a.js' },
    { action: 'test_end', time: 4, group, test: 'browser_a.js', status: 'PASS' },
    total,
    { action: 'group_end', time: 6, name: group },
  ];

  const harnessEntries = (summary, groupName) =>
    summary.groups
      .find(g => g.name === groupName)
      .tests.filter(t => t.harness);

  test('files a failing total as the classic line under the manifest it is scoped to', () => {
    const summary = buildTestSummary(summaryLines);
    const entries = harnessEntries(summary, group);

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.name).toBe(classicLine);
    expect(entry.pathEnd).toBe(null);
    expect(entry.status).toBe(HARNESS_STATUS);
    expect(entry.success).toBe(false);
    expect(entry.results[0].message).toBe(classicLine);
    expect(entry.results[0]).not.toHaveProperty('classicLine');
    // The test that ran in that browser still passed: a leak is not a test.
    expect(summary.counts).toMatchObject({ total: 1, PASS: 1, ERROR: 0 });
    expect(summary.realFailCounts).toEqual({ ERROR: 1 });
  });

  test('keeps two totals apart and matches the classic summary', () => {
    const summary = buildTestSummary([...summaryLines, { ...total, time: 7 }]);
    const failures = buildFailureSuggestions(summary);

    expect(failures.map(f => f.search)).toEqual([classicLine, classicLine]);
    expect(failures.every(f => f.path_end === null)).toBe(true);
    const classic = [classicLine, classicLine].map(search => ({
      search,
      path_end: null,
      bugs: { open_recent: [], all_others: [] },
    }));
    expect(computeSummaryDivergence(failures, classic).diverged).toBe(false);
  });

  test('lists the first five objects only, or names a big leaker instead', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: group },
      { ...total, objects: ['A', 'B'] },
      { ...total, objects: ['A', 'B', 'C', 'D', 'E'] },
      { ...total, objects: ['Mutex', 'nsDocShell', 'nsGlobalWindowInner'] },
    ]);

    expect(
      harnessEntries(summary, group).map(e => e.results[0].message),
    ).toEqual([
      'TEST-UNEXPECTED-FAIL | leakcheck | default 856 bytes leaked (A, B)',
      'TEST-UNEXPECTED-FAIL | leakcheck | default 856 bytes leaked (A, B, C, D, E)',
      `TEST-UNEXPECTED-FAIL | leakcheck large nsGlobalWindowInner | ${group}`,
    ]);
  });

  test('reports a process log with no total line unless that is expected', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: group },
      { ...total, process: 'tab', bytes: null, objects: [] },
      { ...total, process: 'gpu', bytes: null, objects: [], ignore_missing: true },
      { ...total, process: 'rdd', bytes: null, objects: [], induced_crash: true },
    ]);

    expect(
      harnessEntries(summary, group).map(e => e.results[0].message),
    ).toEqual([
      'TEST-UNEXPECTED-FAIL | leakcheck | tab missing output line for total leaks!',
    ]);
  });

  test('ignores a total that is not a failure', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: group },
      { ...total, bytes: 0, objects: [] },
      { ...total, process: 'gmplugin', bytes: 1000, threshold: 20000 },
    ]);

    expect(summary.groups).toEqual([]);
  });

  test('files a total whose scope is unknown under the open group', () => {
    const summary = buildTestSummary([
      { action: 'group_start', time: 1, name: 'g' },
      { ...total, scope: 'elsewhere.toml' },
    ]);

    expect(harnessEntries(summary, 'g')).toHaveLength(1);
  });
});

describe('classic failure summary helpers', () => {
  const line = (search, pathEnd = null, extra = {}) => ({
    search,
    path_end: pathEnd,
    bugs: { open_recent: [], all_others: [] },
    ...extra,
  });

  const genericLine = path =>
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

  describe('isNewFailureLine', () => {
    const line = overrides => ({
      search: 'TEST-UNEXPECTED-FAIL | test_fail.html | boom',
      ...overrides,
    });

    test('flags a line marked new in the revision', () => {
      expect(isNewFailureLine(line({ failure_new_in_rev: true }), 'autoland')).toBe(
        true,
      );
    });

    test('flags a never-seen line on try only', () => {
      expect(isNewFailureLine(line({ counter: 0 }), 'try')).toBe(true);
      expect(isNewFailureLine(line({ counter: 0 }), 'autoland')).toBe(false);
    });

    test('ignores a line that is not a three-part failure', () => {
      expect(
        isNewFailureLine(
          { search: '[taskcluster:error] exit status 1', failure_new_in_rev: true },
          'try',
        ),
      ).toBe(false);
    });

    test('ignores a known line', () => {
      expect(isNewFailureLine(line({ counter: 12 }), 'try')).toBe(false);
    });
  });

  describe('findNewFailureLines', () => {
    const line = overrides => ({
      search: 'TEST-UNEXPECTED-FAIL | test_fail.html | boom',
      ...overrides,
    });

    test('counts every new line and points at the first one', () => {
      expect(
        findNewFailureLines(
          [
            line({ counter: 3 }),
            line({ failure_new_in_rev: true }),
            line({ counter: 0 }),
          ],
          'try',
        ),
      ).toEqual({ count: 2, firstIndex: 1 });
    });

    test('finds nothing in a list with no new line', () => {
      expect(findNewFailureLines([line({ counter: 3 })], 'try')).toEqual({
        count: 0,
        firstIndex: -1,
      });
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

describe('log targets', () => {
  test('ignores the console_anchor record of older artifacts', () => {
    const anchorLine = {
      action: 'console_anchor',
      line: 1,
      message: 'ConsoleLogger online at 20260904 in /builds/worker',
    };
    const summary = buildTestSummary([anchorLine, ...lines]);

    expect(summary.counts.total).toBe(3);
    expect(summary).not.toHaveProperty('anchor');
  });

  test('targets a failing test_end by its test, message and time', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 1, test: 'a.html' },
      {
        action: 'test_end',
        time: 2,
        test: 'a.html',
        status: 'FAIL',
        expected: 'PASS',
        message: 'boom',
      },
    ]);
    const [suggestion] = buildFailureSuggestions(summary);

    expect(suggestion.logTarget).toEqual({ texts: ['a.html', 'boom'], time: 2 });
    expect(summary.groups[0].tests[0].results[0].logTimes).toEqual([2]);
  });

  test('targets each unexpected subtest message by its own time', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 1, test: 'a.html' },
      {
        action: 'test_status',
        time: 3,
        test: 'a.html',
        subtest: 'first',
        status: 'FAIL',
        expected: 'PASS',
        message: 'one',
      },
      {
        action: 'test_status',
        time: 5,
        test: 'a.html',
        subtest: 'second',
        status: 'FAIL',
        expected: 'PASS',
        message: 'two',
      },
      {
        action: 'test_end',
        time: 9,
        test: 'a.html',
        status: 'OK',
        expected: 'OK',
      },
    ]);
    const suggestions = buildFailureSuggestions(summary);

    expect(suggestions.map(s => s.logTarget)).toEqual([
      { texts: ['a.html', 'first - one'], time: 3 },
      { texts: ['a.html', 'second - two'], time: 5 },
    ]);
  });

  test('targets crashes, harness lines and unfinished tests', () => {
    const leak =
      'TEST-UNEXPECTED-FAIL | leakcheck | tab process: 12 bytes leaked (Foo)';
    const summary = buildTestSummary([
      { action: 'group_start', name: 'dir/manifest.toml' },
      { action: 'test_start', time: 1, test: 'hung.html' },
      { action: 'crash', time: 4, test: 'crashed.html', signature: 'sig' },
      { action: 'log', time: 6, level: 'ERROR', message: leak },
    ]);
    const byTest = Object.fromEntries(
      buildFailureSuggestions(summary).map(s => [s.search, s.logTarget]),
    );

    expect(byTest['TEST-UNEXPECTED-CRASH | crashed.html | sig']).toEqual({
      texts: ['crashed.html', 'sig'],
      time: 4,
    });
    // A harness line is searched for as it is: it names no test.
    expect(byTest[leak]).toEqual({ texts: [leak], time: 6 });
    // The message is ours, not the log's: the test path alone finds the test.
    expect(
      byTest['TEST-UNEXPECTED-CRASH | hung.html | Test started but never finished'],
    ).toEqual({
      texts: ['hung.html', 'Test started but never finished'],
      time: 1,
    });
  });

  test('searches for the first log line of a message only, capped', () => {
    const summary = buildTestSummary([
      { action: 'test_start', time: 1, test: 'a.html' },
      {
        action: 'test_end',
        time: 2,
        test: 'a.html',
        status: 'FAIL',
        expected: 'PASS',
        message: `${'x'.repeat(300)}\nsecond line`,
      },
      { action: 'test_start', time: 3, test: 'b.html' },
      {
        action: 'test_end',
        time: 4,
        test: 'b.html',
        status: 'FAIL',
        expected: 'PASS',
        message: 'first\u2028second',
      },
    ]);
    const [long, split] = buildFailureSuggestions(summary);

    expect(long.logTarget.texts).toEqual(['a.html', 'x'.repeat(200)]);
    expect(split.logTarget.texts).toEqual(['b.html', 'first']);
  });

  test('leaves the time null when the record has none', () => {
    const summary = buildTestSummary([
      { action: 'test_start', test: 'a.html' },
      {
        action: 'test_end',
        test: 'a.html',
        status: 'FAIL',
        expected: 'PASS',
        message: 'boom',
      },
    ]);

    expect(buildFailureSuggestions(summary)[0].logTarget.time).toBeNull();
  });
});
