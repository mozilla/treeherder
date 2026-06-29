import {
  buildTestSummary,
  buildFailureSuggestions,
  matchBugSuggestions,
} from '../../../ui/helpers/testSummary';

const lines = [
  {
    action: 'test_result',
    group: 'dom/manifest.ini',
    test: 'dom/tests/test_pass.html',
    status: 'PASS',
  },
  {
    action: 'test_result',
    group: 'dom/manifest.ini',
    test: 'dom/tests/test_fail.html',
    status: 'FAIL',
    expected: 'PASS',
    message: 'assertion failed',
  },
  {
    action: 'test_result',
    group: 'layout/manifest.ini',
    test: 'layout/tests/test_other.html',
    status: 'TIMEOUT',
    expected: 'PASS',
  },
];

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
