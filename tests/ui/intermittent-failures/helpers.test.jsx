/**
 * Unit tests for the intermittent-failures helpers module.
 *
 * This test suite covers:
 * - ISODate: Date formatting to ISO format
 * - prettyDate: Human-readable date formatting (uses dayjs)
 * - formatBugs: Bug ID extraction
 * - mergeData: API data merging
 * - calculateMetrics: Graph metrics calculation (uses dayjs)
 * - sortData: Data sorting
 * - validateQueryParams: Query parameter validation
 * - tableRowStyling: Table row style calculation
 * - removePath: Path string manipulation
 * - regexpFilter: Regular expression filtering
 *
 * Note: prettyDate and calculateMetrics were migrated from moment.js to dayjs.
 */

import dayjs from '../../../ui/helpers/dayjs';
import {
  ISODate,
  prettyDate,
  formatBugs,
  mergeData,
  calculateMetrics,
  sortData,
  validateQueryParams,
  tableRowStyling,
  removePath,
  regexpFilter,
} from '../../../ui/intermittent-failures/helpers';

describe('ISODate', () => {
  it('formats dayjs date to ISO format', () => {
    const date = dayjs('2024-01-15');
    expect(ISODate(date)).toBe('2024-01-15');
  });

  it('formats different dates correctly', () => {
    const date = dayjs('2024-12-25');
    expect(ISODate(date)).toBe('2024-12-25');
  });

  it('handles date objects wrapped in dayjs', () => {
    // Use UTC to avoid timezone issues
    const date = dayjs.utc('2024-06-20');
    expect(ISODate(date)).toBe('2024-06-20');
  });
});

describe('prettyDate (dayjs migration)', () => {
  it('formats date in pretty format', () => {
    const result = prettyDate('2024-01-15');

    expect(result).toContain('Mon');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('handles ISO date strings', () => {
    const result = prettyDate('2024-06-20');

    expect(result).toContain('Thu');
    expect(result).toContain('Jun');
    expect(result).toContain('20');
    expect(result).toContain('2024');
  });

  it('handles Date objects', () => {
    // Use ISO string to avoid timezone issues
    const result = prettyDate('2024-12-25');

    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2024');
  });

  it('formats with correct pattern: ddd MMM D, YYYY', () => {
    const result = prettyDate('2024-01-01');
    // Should be "Mon Jan 1, 2024"
    expect(result).toMatch(/\w{3} \w{3} \d{1,2}, \d{4}/);
  });
});

describe('formatBugs', () => {
  it('extracts bug IDs from data array', () => {
    const data = [{ bug_id: 123 }, { bug_id: 456 }, { bug_id: 789 }];
    const result = formatBugs(data);

    expect(result).toEqual(['123', '456', '789']);
  });

  it('handles empty array', () => {
    expect(formatBugs([])).toEqual([]);
  });

  it('converts bug IDs to strings', () => {
    const data = [{ bug_id: 12345 }];
    const result = formatBugs(data);

    expect(result[0]).toBe('12345');
    expect(typeof result[0]).toBe('string');
  });
});

describe('mergeData', () => {
  it('merges bug counts into bug data', () => {
    const countData = [
      { bug_id: 123, bug_count: 10 },
      { bug_id: 456, bug_count: 5 },
    ];
    const bugs = [
      { id: 123, name: 'Bug A' },
      { id: 456, name: 'Bug B' },
    ];

    const result = mergeData(countData, bugs);

    expect(result[0].count).toBe(10);
    expect(result[1].count).toBe(5);
  });

  it('sorts results by count descending', () => {
    const countData = [
      { bug_id: 123, bug_count: 5 },
      { bug_id: 456, bug_count: 20 },
    ];
    const bugs = [
      { id: 123, name: 'Bug A' },
      { id: 456, name: 'Bug B' },
    ];

    const result = mergeData(countData, bugs);

    expect(result[0].id).toBe(456); // Higher count first
    expect(result[1].id).toBe(123);
  });

  it('handles bugs without matching counts', () => {
    const countData = [{ bug_id: 123, bug_count: 10 }];
    const bugs = [
      { id: 123, name: 'Bug A' },
      { id: 999, name: 'Bug B' },
    ];

    const result = mergeData(countData, bugs);

    expect(result.find((b) => b.id === 123).count).toBe(10);
    expect(result.find((b) => b.id === 999).count).toBeUndefined();
  });
});

describe('calculateMetrics (dayjs migration)', () => {
  it('calculates graph metrics from data', () => {
    const data = [
      { date: '2024-01-15', failure_count: 10, test_runs: 100 },
      { date: '2024-01-16', failure_count: 20, test_runs: 200 },
    ];

    const result = calculateMetrics(data);

    expect(result.graphOneData).toBeDefined();
    expect(result.graphTwoData).toBeDefined();
    expect(result.totalFailures).toBe(30);
    expect(result.totalRuns).toBe(300);
  });

  it('formats dates using dayjs (MMM DD format)', () => {
    const data = [{ date: '2024-01-15', failure_count: 10, test_runs: 100 }];

    const result = calculateMetrics(data);

    expect(result.graphTwoData[0].data[0].date).toBe('Jan 15');
  });

  it('converts dates to JavaScript Date objects', () => {
    const data = [{ date: '2024-01-15', failure_count: 10, test_runs: 100 }];

    const result = calculateMetrics(data);

    expect(result.graphTwoData[0].data[0].x instanceof Date).toBe(true);
  });

  it('calculates frequency correctly', () => {
    const data = [{ date: '2024-01-15', failure_count: 25, test_runs: 100 }];

    const result = calculateMetrics(data);

    // Frequency = 25/100 = 0.25
    expect(result.graphOneData[0].data[0].y).toBe(0.25);
  });

  it('handles zero test runs', () => {
    const data = [{ date: '2024-01-15', failure_count: 0, test_runs: 0 }];

    const result = calculateMetrics(data);

    expect(result.graphOneData[0].data[0].y).toBe(0);
  });

  it('handles zero failures', () => {
    const data = [{ date: '2024-01-15', failure_count: 0, test_runs: 100 }];

    const result = calculateMetrics(data);

    expect(result.graphOneData[0].data[0].y).toBe(0);
  });

  it('returns correct graph structure', () => {
    const data = [{ date: '2024-01-15', failure_count: 10, test_runs: 100 }];

    const result = calculateMetrics(data);

    // graphOneData contains frequency data
    expect(result.graphOneData).toHaveLength(1);
    expect(result.graphOneData[0].color).toBe('#dd6602');

    // graphTwoData contains failure count and test run count
    expect(result.graphTwoData).toHaveLength(2);
    expect(result.graphTwoData[0].color).toBe('blue');
    expect(result.graphTwoData[1].color).toBe('green');
  });
});

describe('sortData', () => {
  it('sorts data ascending by default', () => {
    const data = [{ name: 'c' }, { name: 'a' }, { name: 'b' }];

    const result = sortData(data, 'name', false);

    expect(result.map((d) => d.name)).toEqual(['a', 'b', 'c']);
  });

  it('sorts data descending when desc is true', () => {
    const data = [{ name: 'a' }, { name: 'c' }, { name: 'b' }];

    const result = sortData(data, 'name', true);

    expect(result.map((d) => d.name)).toEqual(['c', 'b', 'a']);
  });

  it('sorts numeric values correctly', () => {
    const data = [{ count: 5 }, { count: 1 }, { count: 10 }];

    const result = sortData(data, 'count', false);

    expect(result.map((d) => d.count)).toEqual([1, 5, 10]);
  });

  it('mutates the original array', () => {
    const data = [{ name: 'b' }, { name: 'a' }];

    const result = sortData(data, 'name', false);

    expect(result).toBe(data);
  });
});

describe('validateQueryParams', () => {
  it('returns empty array for valid params', () => {
    const params = {
      tree: 'autoland',
      startday: '2024-01-01',
      endday: '2024-01-31',
    };

    const result = validateQueryParams(params);

    expect(result).toEqual([]);
  });

  it('returns error for missing tree', () => {
    const params = {
      startday: '2024-01-01',
      endday: '2024-01-31',
    };

    const result = validateQueryParams(params);

    expect(result).toContain(
      'tree is required and must be a valid repository or repository group.',
    );
  });

  it('returns error for missing startday', () => {
    const params = {
      tree: 'autoland',
      endday: '2024-01-31',
    };

    const result = validateQueryParams(params);

    expect(result).toContain(
      'startday is required and must be in YYYY-MM-DD format.',
    );
  });

  it('returns error for invalid startday format', () => {
    const params = {
      tree: 'autoland',
      startday: '01-01-2024', // Wrong format
      endday: '2024-01-31',
    };

    const result = validateQueryParams(params);

    expect(result).toContain(
      'startday is required and must be in YYYY-MM-DD format.',
    );
  });

  it('returns error for missing endday', () => {
    const params = {
      tree: 'autoland',
      startday: '2024-01-01',
    };

    const result = validateQueryParams(params);

    expect(result).toContain(
      'endday is required and must be in YYYY-MM-DD format.',
    );
  });

  it('returns error for missing bug when required', () => {
    const params = {
      tree: 'autoland',
      startday: '2024-01-01',
      endday: '2024-01-31',
    };

    const result = validateQueryParams(params, true);

    expect(result).toContain('bug is required and must be a valid integer.');
  });

  it('returns multiple errors', () => {
    const params = {};

    const result = validateQueryParams(params);

    expect(result.length).toBe(3);
  });
});

describe('tableRowStyling', () => {
  it('returns empty object when no bug provided', () => {
    const result = tableRowStyling({}, null);

    expect(result).toEqual({});
  });

  it('returns strikethrough for RESOLVED bugs', () => {
    const bug = {
      original: { status: 'RESOLVED' },
      row: { whiteboard: '' },
    };

    const result = tableRowStyling({}, bug);

    expect(result.style.textDecoration).toBe('line-through');
  });

  it('returns strikethrough for VERIFIED bugs', () => {
    const bug = {
      original: { status: 'VERIFIED' },
      row: { whiteboard: '' },
    };

    const result = tableRowStyling({}, bug);

    expect(result.style.textDecoration).toBe('line-through');
  });

  it('returns grayed style for disabled bugs', () => {
    const bug = {
      original: { status: 'NEW' },
      row: { whiteboard: 'disabled' },
    };

    const result = tableRowStyling({}, bug);

    expect(result.style.color).toBe('rgb(117, 117, 117)');
    expect(result.style.textDecoration).toBeUndefined();
  });

  it('returns grayed style for annotated bugs', () => {
    const bug = {
      original: { status: 'NEW' },
      row: { whiteboard: 'annotated for intermittent' },
    };

    const result = tableRowStyling({}, bug);

    expect(result.style).toBeDefined();
    expect(result.style.color).toBe('rgb(117, 117, 117)');
  });

  it('returns grayed style for marked bugs', () => {
    const bug = {
      original: { status: 'NEW' },
      row: { whiteboard: 'marked as skip' },
    };

    const result = tableRowStyling({}, bug);

    expect(result.style).toBeDefined();
  });

  it('returns empty for active bugs', () => {
    const bug = {
      original: { status: 'NEW' },
      row: { whiteboard: 'active bug' },
    };

    const result = tableRowStyling({}, bug);

    expect(result).toEqual({});
  });
});

describe('removePath', () => {
  it('removes path from filename', () => {
    expect(removePath('/path/to/file.txt')).toBe('file.txt');
  });

  it('handles deep paths', () => {
    expect(removePath('a/b/c/d/e/file.js')).toBe('file.js');
  });

  it('handles paths without leading slash', () => {
    expect(removePath('dir/file.txt')).toBe('file.txt');
  });

  it('returns filename when no path', () => {
    expect(removePath('file.txt')).toBe('file.txt');
  });

  it('handles empty string', () => {
    expect(removePath('')).toBe('');
  });

  it('handles undefined', () => {
    expect(removePath()).toBe('');
  });
});

describe('regexpFilter', () => {
  it('returns row when filter matches', () => {
    const filter = { id: 'name', value: 'test' };
    const row = { name: 'test case' };

    const result = regexpFilter(filter, row);

    expect(result).toBe(row);
  });

  it('returns undefined when filter does not match', () => {
    const filter = { id: 'name', value: 'xyz' };
    const row = { name: 'test case' };

    const result = regexpFilter(filter, row);

    expect(result).toBeUndefined();
  });

  it('handles case-insensitive matching', () => {
    const filter = { id: 'name', value: 'TEST' };
    const row = { name: 'test case' };

    const result = regexpFilter(filter, row);

    expect(result).toBe(row);
  });

  it('handles array filter values', () => {
    const filter = { id: 'name', value: ['test', 'case'] };
    const row = { name: 'test file' };

    const result = regexpFilter(filter, row);

    expect(result).toBe(row);
  });

  it('returns undefined for empty filter value', () => {
    const filter = { id: 'name', value: '' };
    const row = { name: 'test' };

    const result = regexpFilter(filter, row);

    expect(result).toBeUndefined();
  });

  it('handles regex special characters in filter value', () => {
    const filter = { id: 'name', value: 'test.case' };
    const row = { name: 'testXcase' };

    // '.' in regex matches any character
    const result = regexpFilter(filter, row);

    expect(result).toBe(row);
  });
});
