import { describeSummary } from '../../../ui/simple-view/PushList';
import {
  failedJobsOf,
  sortFailures,
  summarizeJobs,
  verdict,
} from '../../../ui/simple-view/verdict';

const job = (over) => ({
  id: Math.random(),
  tier: 1,
  state: 'completed',
  result: 'success',
  classification: 1,
  ...over,
});
const fresh = job({ result: 'testfailed', classification: 6 });
const open = job({ result: 'busted', classification: 1 });
const intermittent = job({ result: 'testfailed', classification: 4 });
const done = { running: 0, done: 3, total: 3 };

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

describe('sortFailures', () => {
  test('splits open failures, new ones among them, and classified ones', () => {
    const sorted = sortFailures([job(), fresh, open, intermittent]);
    expect(sorted.open).toEqual([fresh, open]);
    expect(sorted.fresh).toEqual([fresh]);
    expect(sorted.classified).toEqual([intermittent]);
  });
});

describe('verdict', () => {
  test('counts failed jobs and says which are new or classified', () => {
    expect(verdict({ jobs: [job(), fresh, open, intermittent], progress: done })).toEqual({
      tone: 'bad',
      headline: 'Three jobs failed.',
      sub: "One has an error Treeherder hasn't seen before. One is already classified.",
    });
  });

  test('is quiet when every failure is classified', () => {
    const said = verdict({ jobs: [job(), intermittent], progress: done });
    expect(said.tone).toBe('quiet');
    expect(said.sub).toBe('All of them are already classified.');
  });

  test('says all green, or still running, when nothing failed', () => {
    expect(verdict({ jobs: [job()], progress: done }).headline).toBe('All green.');
    const running = { running: 1, done: 1, total: 2 };
    expect(verdict({ jobs: [job()], progress: running })).toEqual({
      tone: 'running',
      headline: 'Still running.',
      sub: '1 of 2 jobs done so far. Nothing has failed.',
    });
  });

  test('waits for the job list', () => {
    expect(verdict({ progress: done })).toBeNull();
  });
});

describe('list rows', () => {
  test('a row counts the same jobs the push screen does', () => {
    const summary = summarizeJobs([job(), fresh, open, intermittent]);
    expect(summary).toMatchObject({ failed: 3, open: 2, fresh: 1, finished: true });
    expect(describeSummary(summary)).toEqual({ tone: 'bad', text: '3 failed · 1 new' });
  });

  test('a row with only classified failures is quiet', () => {
    expect(describeSummary(summarizeJobs([intermittent]))).toEqual({
      tone: 'quiet',
      text: '1 failed · all classified',
    });
  });

  test('a running push stays unfinished so the list fetches it again', () => {
    expect(summarizeJobs([job({ state: 'running' })]).finished).toBe(false);
  });
});
