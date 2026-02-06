/**
 * Unit tests for the perfherder helpers module.
 *
 * This test suite covers:
 * - Utility functions: formatNumber, abbreviatedNumber, displayNumber
 * - Statistical functions: calcPercentOf, calcAverage, getStdDev, getTTest
 * - getCounterMap: Performance comparison data generation
 * - Various helper functions
 */
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
} from '../../../ui/perfherder/perf-helpers/helpers';
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
      expect(displayNumber(3.14159)).toBe('3.14');
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
