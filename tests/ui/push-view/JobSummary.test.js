import { groupFailureLines } from '../../../ui/push-view/JobSummary';

const bug = (id, summary) => ({ id, summary, resolution: '' });
const path = 'browser/components/contextualidentity/test/browser/browser_newtabButton.js';

test('one card per test, filler dropped, new first, harness noise apart', () => {
  const lines = [
    { line_number: 1, path_end: 'leak.js', search: 'TEST-UNEXPECTED-FAIL | leak.js | leaked', counter: 293, failure_new_in_rev: false, bugs: { open_recent: [bug(1, 'Intermittent leak.js | tracking')], all_others: [] } },
    { line_number: 2, path_end: path, search: `TEST-UNEXPECTED-FAIL | ${path} | test left the mouse button pressed`, counter: 0, failure_new_in_rev: true, bugs: { open_recent: [bug(2, 'a')], all_others: [] } },
    { line_number: 3, path_end: path, search: `TEST-UNEXPECTED-FAIL | ${path} | profile uploaded in profile_x.json`, counter: 1, failure_new_in_rev: false, bugs: { open_recent: [bug(2, 'a')], all_others: [] } },
    { line_number: 4, path_end: path, search: `TEST-UNEXPECTED-FAIL | ${path} | finished in 3431ms`, counter: 0, failure_new_in_rev: true, bugs: { open_recent: [], all_others: [] } },
    { line_number: 5, path_end: '', search: '[taskcluster:error] <nil>', counter: 6168, failure_new_in_rev: false, bugs: { open_recent: Array.from({ length: 60 }, (_, i) => bug(100 + i, 'x')), all_others: [] } },
  ];
  const { groups, other } = groupFailureLines(lines);
  expect(groups.map((g) => g.path)).toEqual([path, 'leak.js']);
  expect(groups[0].messages).toEqual(['test left the mouse button pressed']);
  expect(groups[0].isNew).toBe(true);
  expect(groups[0].bugs).toHaveLength(1);
  expect(groups[1].isNew).toBe(false);
  expect(other).toHaveLength(1);
});

test('a leak check is its own entry, not hidden with harness noise', () => {
  const { groups, other } = groupFailureLines([
    { line_number: 1, path_end: '', search: 'TEST-UNEXPECTED-FAIL | leakcheck | default 920 bytes leaked (CondVar, Mutex)', counter: 12, failure_new_in_rev: false, bugs: { open_recent: [], all_others: [] } },
    { line_number: 2, path_end: '', search: '[taskcluster:error] <nil>', counter: 6168, failure_new_in_rev: false, bugs: { open_recent: [], all_others: [] } },
  ]);
  expect(groups.map((g) => g.path)).toEqual(['leakcheck']);
  expect(groups[0].messages).toEqual(['default 920 bytes leaked (CondVar, Mutex)']);
  expect(other).toHaveLength(1);
});
