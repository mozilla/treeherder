import {
  failedJobsOf,
  pushVerdict,
  sortFailures,
} from '../../../ui/simple-view/verdict';

describe('failedJobsOf', () => {
  test('keeps finished tier 1 and 2 failures only', () => {
    const jobs = [
      { id: 1, tier: 1, state: 'completed', result: 'testfailed' },
      { id: 2, tier: 2, state: 'completed', result: 'busted' },
      { id: 3, tier: 3, state: 'completed', result: 'testfailed' },
      { id: 4, tier: 1, state: 'running', result: 'unknown' },
      { id: 5, tier: 1, state: 'completed', result: 'success' },
    ];
    expect(failedJobsOf(jobs).map((j) => j.id)).toEqual([1, 2]);
    expect(failedJobsOf(null)).toEqual([]);
  });
});

describe('pushVerdict', () => {
  const progress = { running: 0, done: 3, total: 3 };
  const green = [{ id: 1, tier: 1, state: 'completed', result: 'success' }];
  const red = [{ id: 1, tier: 1, state: 'completed', result: 'testfailed' }];

  test("doesn't wait for Push Health when nothing failed", () => {
    const sorted = sortFailures(null, green);
    expect(pushVerdict({ jobs: green, progress, sorted }).headline).toBe(
      'All green.',
    );
  });

  test('counts failed jobs while they wait for Push Health', () => {
    const sorted = sortFailures(null, red);
    expect(pushVerdict({ jobs: red, progress, sorted })).toEqual({
      tone: 'quiet',
      headline: 'One job failed.',
      sub: 'Checking these against the parent and known intermittents…',
    });
  });

  test('waits for the job list and progress', () => {
    expect(pushVerdict({ progress, sorted: {} })).toBeNull();
    expect(pushVerdict({ jobs: red, sorted: {} })).toBeNull();
  });
});
