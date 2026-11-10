/**
 * Unit tests for the perfherder helpers module.
 *
 * This test suite covers:
 * - Utility functions: formatNumber, abbreviatedNumber, displayNumber
 * - Statistical functions: calcPercentOf, calcAverage, getStdDev, getTTest
 * - getCounterMap: Performance comparison data generation
 * - Various helper functions
 * - Test picker signature helpers: search text, query matching, loading
 */
import fetchMock from 'fetch-mock';

import {
  formatNumber,
  abbreviatedNumber,
  displayNumber,
  calcPercentOf,
  calcAverage,
  getStdDev,
  getTTest,
  getCounterMap,
  getStatus,
  containsText,
  getFrameworkName,
  reduceDictToKeys,
  buildSearchText,
  matchesQuery,
  loadRepositorySignatures,
  loadSubtestSignatures,
} from '../../../ui/perfherder/perf-helpers/helpers';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import { summaryStatusMap } from '../../../ui/perfherder/perf-helpers/constants';

describe('Number Formatting', () => {
  describe('formatNumber', () => {
    it('formats numbers with up to 2 decimal places', () => {
      expect(formatNumber(1234.5678)).toBe('1,234.57');
    });

    it('formats whole numbers', () => {
      expect(formatNumber(1000)).toBe('1,000');
    });

    it('handles small numbers', () => {
      expect(formatNumber(0.123456)).toBe('0.12');
    });

    it('handles zero', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('abbreviatedNumber', () => {
    it('returns original number for small values', () => {
      expect(abbreviatedNumber(1234)).toBe(1234);
      expect(abbreviatedNumber(99999)).toBe(99999);
    });

    it('abbreviates large numbers', () => {
      expect(abbreviatedNumber(1000000)).toBe('1.0m');
      expect(abbreviatedNumber(123456)).toBe('123.5k');
    });

    it('handles numbers at boundary', () => {
      expect(abbreviatedNumber(100000)).toBe('100.0k');
    });
  });

  describe('displayNumber', () => {
    it('formats valid numbers to 2 decimal places', () => {
      expect(displayNumber(Math.PI)).toBe('3.14');
    });

    it('returns N/A for NaN', () => {
      expect(displayNumber(NaN)).toBe('N/A');
    });

    it('handles zero', () => {
      expect(displayNumber(0)).toBe('0.00');
    });

    it('handles string numbers', () => {
      expect(displayNumber('42.123')).toBe('42.12');
    });
  });
});

describe('Statistical Functions', () => {
  describe('calcPercentOf', () => {
    it('calculates percentage correctly', () => {
      expect(calcPercentOf(25, 100)).toBe(25);
    });

    it('handles zero denominator', () => {
      expect(calcPercentOf(25, 0)).toBe(0);
    });

    it('handles fractional percentages', () => {
      expect(calcPercentOf(1, 3)).toBeCloseTo(33.333, 2);
    });
  });

  describe('calcAverage', () => {
    it('calculates average correctly', () => {
      expect(calcAverage([1, 2, 3, 4, 5])).toBe(3);
    });

    it('handles single value', () => {
      expect(calcAverage([42])).toBe(42);
    });

    it('handles empty array', () => {
      expect(calcAverage([])).toBe(0);
    });

    it('handles floating point values', () => {
      expect(calcAverage([1.5, 2.5, 3.5])).toBe(2.5);
    });
  });

  describe('getStdDev', () => {
    it('calculates standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const avg = calcAverage(values);
      const stddev = getStdDev(values, avg);

      expect(stddev).toBeCloseTo(2.138, 2);
    });

    it('returns undefined for single value', () => {
      expect(getStdDev([42], 42)).toBeUndefined();
    });

    it('calculates without provided average', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stddev = getStdDev(values);

      expect(typeof stddev).toBe('number');
    });

    it('returns 0 for identical values', () => {
      const values = [5, 5, 5, 5];
      const stddev = getStdDev(values);

      expect(stddev).toBe(0);
    });
  });

  describe('getTTest', () => {
    it('returns 0 for empty arrays', () => {
      expect(getTTest([], [1, 2, 3], 0.15)).toBe(0);
      expect(getTTest([1, 2, 3], [], 0.15)).toBe(0);
    });

    it('calculates t-test for two sets', () => {
      const control = [1, 2, 3, 4, 5];
      const test = [6, 7, 8, 9, 10];

      const tValue = getTTest(control, test, 0.15);

      expect(tValue).toBeGreaterThan(0);
    });

    it('returns negative t-value when test is lower', () => {
      const control = [6, 7, 8, 9, 10];
      const test = [1, 2, 3, 4, 5];

      const tValue = getTTest(control, test, 0.15);

      expect(tValue).toBeLessThan(0);
    });

    it('handles single value in control set', () => {
      const control = [5];
      const test = [1, 2, 3, 4, 5];

      const tValue = getTTest(control, test, 0.15);

      expect(typeof tValue).toBe('number');
    });

    it('handles single value in test set', () => {
      const control = [1, 2, 3, 4, 5];
      const test = [10];

      const tValue = getTTest(control, test, 0.15);

      expect(typeof tValue).toBe('number');
    });
  });
});

describe('getCounterMap', () => {
  it('returns isEmpty true when no data', () => {
    const result = getCounterMap('test', null, null);

    expect(result.isEmpty).toBe(true);
  });

  it('calculates metrics for original data only', () => {
    const originalData = {
      values: [1, 2, 3, 4, 5],
      repository_name: 'autoland',
      job_ids: [123],
    };

    const result = getCounterMap('test', originalData, null);

    expect(result.isEmpty).toBe(false);
    expect(result.originalValue).toBe(3);
    expect(result.originalRuns).toEqual([1, 2, 3, 4, 5]);
    expect(result.newRuns).toEqual([]);
  });

  it('calculates comparison metrics for both datasets', () => {
    const originalData = {
      values: [1, 2, 3],
      repository_name: 'autoland',
      job_ids: [123],
      framework_id: 1,
      lower_is_better: true,
    };
    const newData = {
      values: [4, 5, 6],
      repository_name: 'autoland',
      job_ids: [456],
    };

    const result = getCounterMap('test', originalData, newData);

    expect(result.isEmpty).toBe(false);
    expect(result.delta).toBe(3); // 5 - 2
    expect(result.frameworkId).toBe(1);
    expect(result.newIsBetter).toBe(false); // higher is worse when lower_is_better
  });

  it('sets confidence text based on t-value', () => {
    const originalData = {
      values: [1, 2, 3, 4, 5],
      repository_name: 'autoland',
      job_ids: [123],
      framework_id: 1,
      lower_is_better: true,
    };
    const newData = {
      values: [10, 11, 12, 13, 14],
      repository_name: 'autoland',
      job_ids: [456],
    };

    const result = getCounterMap('test', originalData, newData);

    // With such different values, confidence should be high
    expect(['low', 'med', 'high']).toContain(result.confidenceText);
    expect(result.confidenceTextLong).toContain('t-test');
  });
});

describe('getStatus', () => {
  it('returns status name for status number', () => {
    const result = getStatus(summaryStatusMap.investigating);

    expect(result).toBe('investigating');
  });

  it('handles untriaged status', () => {
    const result = getStatus(summaryStatusMap.untriaged);

    expect(result).toBe('untriaged');
  });
});

describe('containsText', () => {
  it('finds text in string', () => {
    expect(containsText('hello world test', 'world')).toBe(true);
  });

  it('handles multiple words', () => {
    expect(containsText('hello world test', 'hello test')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(containsText('Hello World', 'hello')).toBe(true);
  });

  it('returns false when not found', () => {
    expect(containsText('hello world', 'xyz')).toBe(false);
  });

  it('handles word order flexibility', () => {
    expect(containsText('quick brown fox', 'fox quick')).toBe(true);
  });
});

describe('getFrameworkName', () => {
  const frameworks = [
    { id: 1, name: 'talos' },
    { id: 2, name: 'build_metrics' },
    { id: 4, name: 'awsy' },
  ];

  it('returns framework name by id', () => {
    expect(getFrameworkName(frameworks, 1)).toBe('talos');
  });

  it('returns unknown message for missing framework', () => {
    expect(getFrameworkName(frameworks, 99)).toBe('unknown framework');
  });

  it('handles different framework ids', () => {
    expect(getFrameworkName(frameworks, 4)).toBe('awsy');
  });
});

describe('reduceDictToKeys', () => {
  it('reduces dict to specified keys', () => {
    const dict = { a: 1, b: 2, c: 3 };
    const result = reduceDictToKeys(dict, ['a', 'c']);

    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('returns empty object for empty keys', () => {
    const dict = { a: 1, b: 2 };
    const result = reduceDictToKeys(dict, []);

    expect(result).toEqual({});
  });

  it('returns false for null dict', () => {
    expect(reduceDictToKeys(null, ['a'])).toBe(false);
  });

  it('ignores keys not in dict', () => {
    const dict = { a: 1, b: 2 };
    const result = reduceDictToKeys(dict, ['a', 'z']);

    expect(result).toEqual({ a: 1 });
  });
});

describe('Test picker signature helpers', () => {
  const frameworks = [
    { id: 1, name: 'talos' },
    { id: 13, name: 'browsertime' },
  ];
  const signature = {
    id: 1,
    suite: 'speedometer3',
    machine_platform: 'android-hw-a55',
    framework_id: 13,
    application: 'fenix',
    signature_hash: 'abc123',
    has_subtests: true,
  };
  // each test uses its own repository, since the loader caches per repository
  const signaturesUrl = (repo) =>
    `begin:${getProjectUrl('/performance/signatures/', repo)}`;
  // the API urls are relative in tests, so give URL a base to parse them
  const params = (url) =>
    Object.fromEntries(new URL(url, 'http://localhost').searchParams);

  beforeEach(() => {
    fetchMock.mock(getApiUrl('/optioncollectionhash/'), []);
  });

  afterEach(() => {
    fetchMock.reset();
  });

  describe('buildSearchText', () => {
    it('joins repository, platform, name, application, suite and framework in lower case', () => {
      const series = {
        projectName: 'mozilla-central',
        platform: 'Android-HW-A55',
        name: 'Speedometer3 opt',
        application: 'fenix',
        suite: 'speedometer3',
        frameworkId: 13,
      };

      expect(buildSearchText(series, frameworks)).toBe(
        'mozilla-central android-hw-a55 speedometer3 opt fenix speedometer3 browsertime',
      );
    });

    it('skips missing values', () => {
      const series = {
        projectName: 'autoland',
        platform: 'linux64',
        name: 'tp5o opt',
        application: null,
        suite: 'tp5o',
        frameworkId: 1,
      };

      expect(buildSearchText(series, frameworks)).toBe(
        'autoland linux64 tp5o opt tp5o talos',
      );
    });
  });

  describe('matchesQuery', () => {
    const text = 'mozilla-central windows11-64 speedometer3 opt fenix';

    it('matches every word in any order, case insensitively', () => {
      expect(matchesQuery(text, 'Fenix  speedometer3')).toBe(true);
      expect(matchesQuery(text, 'speedometer3 chrome')).toBe(false);
    });

    it('matches everything for an empty or blank query', () => {
      expect(matchesQuery(text, '')).toBe(true);
      expect(matchesQuery(text, '   ')).toBe(true);
    });

    it('treats regex characters literally', () => {
      expect(matchesQuery('a (b) c++', '(b) c++')).toBe(true);
      expect(matchesQuery('abc', '.*')).toBe(false);
    });
  });

  describe('loadRepositorySignatures', () => {
    it('returns series with search text, without subtests by default', async () => {
      fetchMock.mock(signaturesUrl('load-repo'), { 1: signature });

      const result = await loadRepositorySignatures(
        'load-repo',
        86400,
        frameworks,
      );

      expect(result.failureStatus).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 1,
        projectName: 'load-repo',
        platform: 'android-hw-a55',
        application: 'fenix',
        searchText: expect.stringContaining('load-repo android-hw-a55'),
      });
      expect(params(fetchMock.lastUrl(signaturesUrl('load-repo')))).toEqual({
        interval: '86400',
        subtests: '0',
      });
    });

    it('fetches each repository and interval only once', async () => {
      fetchMock.mock(signaturesUrl('cached-repo'), { 1: signature });

      const first = await loadRepositorySignatures('cached-repo', 86400, frameworks);
      const second = await loadRepositorySignatures('cached-repo', 86400, frameworks);
      await loadRepositorySignatures('cached-repo', 604800, frameworks);

      expect(second).toBe(first);
      expect(fetchMock.calls(signaturesUrl('cached-repo'))).toHaveLength(2);
    });

    it('loads and caches the list with subtests separately', async () => {
      fetchMock.mock(signaturesUrl('subtests-repo'), { 1: signature });

      await loadRepositorySignatures('subtests-repo', 86400, frameworks);
      await loadRepositorySignatures('subtests-repo', 86400, frameworks, {
        subtests: true,
      });
      await loadRepositorySignatures('subtests-repo', 86400, frameworks, {
        subtests: true,
      });

      const calls = fetchMock.calls(signaturesUrl('subtests-repo'));
      expect(calls.map(([url]) => params(url).subtests)).toEqual(['0', '1']);
    });

    it('returns an HTTP error response and retries it next time', async () => {
      fetchMock.mock(
        signaturesUrl('http-error-repo'),
        { status: 500, body: { detail: 'server error' } },
        { repeat: 1 },
      );
      fetchMock.mock(signaturesUrl('http-error-repo'), { 1: signature }, {
        overwriteRoutes: false,
      });

      const failure = await loadRepositorySignatures(
        'http-error-repo',
        86400,
        frameworks,
      );
      expect(failure.failureStatus).toBe(500);

      const retry = await loadRepositorySignatures(
        'http-error-repo',
        86400,
        frameworks,
      );
      expect(retry.failureStatus).toBeNull();
      expect(retry.data).toHaveLength(1);
      expect(fetchMock.calls(signaturesUrl('http-error-repo'))).toHaveLength(2);
    });

    it('turns a network failure into an error result that is retried next time', async () => {
      fetchMock.mock(signaturesUrl('offline-repo'), {
        throws: new TypeError('Failed to fetch'),
      });

      const failure = await loadRepositorySignatures(
        'offline-repo',
        86400,
        frameworks,
      );
      expect(failure).toEqual({
        data: 'failed to load tests (Failed to fetch)',
        failureStatus: true,
      });

      fetchMock.reset();
      fetchMock.mock(getApiUrl('/optioncollectionhash/'), []);
      fetchMock.mock(signaturesUrl('offline-repo'), { 1: signature });

      const retry = await loadRepositorySignatures(
        'offline-repo',
        86400,
        frameworks,
      );
      expect(retry.failureStatus).toBeNull();
      expect(retry.data).toHaveLength(1);
    });

    it('describes rejections that are not Error objects', async () => {
      fetchMock.mock(signaturesUrl('odd-failure-repo'), { throws: 'offline' });

      const failure = await loadRepositorySignatures(
        'odd-failure-repo',
        86400,
        frameworks,
      );

      expect(failure).toEqual({
        data: 'failed to load tests (offline)',
        failureStatus: true,
      });
    });
  });

  describe('loadSubtestSignatures', () => {
    const parent = {
      projectName: 'subtest-parent-repo',
      signature: 'abc123',
    };

    it("requests the parent's subtests for the interval", async () => {
      fetchMock.mock(signaturesUrl('subtest-parent-repo'), {
        2: {
          ...signature,
          id: 2,
          test: 'TodoMVC-React',
          has_subtests: false,
          parent_signature: 'abc123',
        },
      });

      const { data, failureStatus } = await loadSubtestSignatures(
        parent,
        2592000,
      );

      expect(failureStatus).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 2,
        name: expect.stringContaining('speedometer3 TodoMVC-React'),
        parentSignature: 'abc123',
      });
      expect(
        params(fetchMock.lastUrl(signaturesUrl('subtest-parent-repo'))),
      ).toEqual({ interval: '2592000', parent_signature: 'abc123' });
    });

    it('turns a network failure into an error result', async () => {
      fetchMock.mock(signaturesUrl('subtest-parent-repo'), {
        throws: new TypeError('Failed to fetch'),
      });

      await expect(loadSubtestSignatures(parent, 86400)).resolves.toEqual({
        data: 'failed to load tests (Failed to fetch)',
        failureStatus: true,
      });
    });
  });
});
