import {
  buildTestSummary,
  buildFailureSuggestions,
  matchBugSuggestions,
  NO_GROUP,
  INCOMPLETE_STATUS,
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
});
