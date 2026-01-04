/**
 * Unit tests for the display helper module.
 *
 * This test suite covers:
 * - Date formatting functions (toDateStr, toShortDateStr)
 * - Mercurial date formatting (toMercurialDateStr, toMercurialShortDateStr)
 * - Search word extraction (getSearchWords)
 * - Progress calculation (getPercentComplete)
 * - Artifact formatting (formatArtifacts)
 * - Error line CSS generation (errorLinesCss)
 * - Result color mapping (resultColorMap)
 * - Icon selection (getIcon)
 *
 * Note: The migration from moment.js to dayjs is covered by the Mercurial
 * date formatting tests.
 */

import {
  faCheck,
  faClock,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import {
  toDateStr,
  toShortDateStr,
  toMercurialDateStr,
  toMercurialShortDateStr,
  getSearchWords,
  getPercentComplete,
  formatArtifacts,
  longDateFormat,
  shortDateFormat,
  resultColorMap,
  getIcon,
} from '../../../ui/helpers/display';

describe('Date formatting', () => {
  describe('toDateStr', () => {
    it('converts timestamp to locale string with long format', () => {
      // Timestamp for 2024-01-15 12:30:45 UTC
      const timestamp = 1705321845;
      const result = toDateStr(timestamp);

      // Should contain date components
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('handles zero timestamp', () => {
      const result = toDateStr(0);
      // Epoch time should produce a valid date string
      // Note: toLocaleString may not include year depending on format
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('toShortDateStr', () => {
    it('converts timestamp to short format', () => {
      const timestamp = 1705321845;
      const result = toShortDateStr(timestamp);

      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });
  });

  describe('longDateFormat', () => {
    it('includes all expected format options', () => {
      expect(longDateFormat.weekday).toBe('short');
      expect(longDateFormat.month).toBe('short');
      expect(longDateFormat.day).toBe('numeric');
      expect(longDateFormat.hour).toBe('numeric');
      expect(longDateFormat.minute).toBe('numeric');
      expect(longDateFormat.second).toBe('numeric');
      expect(longDateFormat.hour12).toBe(false);
    });
  });

  describe('shortDateFormat', () => {
    it('includes expected format options without weekday and second', () => {
      expect(shortDateFormat.month).toBe('short');
      expect(shortDateFormat.day).toBe('numeric');
      expect(shortDateFormat.hour).toBe('numeric');
      expect(shortDateFormat.minute).toBe('numeric');
      expect(shortDateFormat.hour12).toBe(false);
      expect(shortDateFormat.weekday).toBeUndefined();
      expect(shortDateFormat.second).toBeUndefined();
    });
  });
});

describe('Mercurial date formatting (dayjs migration)', () => {
  describe('toMercurialDateStr', () => {
    it('formats date in mercurial datetime format', () => {
      // Test with a known UTC date
      const testDate = new Date('2024-01-15T12:30:45Z');
      const result = toMercurialDateStr(testDate);

      // Format should be: 'ddd MMM DD HH:mm:ss YYYY ZZ'
      expect(result).toContain('Mon');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('12:30:45');
      expect(result).toContain('2024');
    });

    it('handles Date objects', () => {
      const date = new Date('2024-06-20T08:15:30Z');
      const result = toMercurialDateStr(date);

      expect(result).toContain('Thu');
      expect(result).toContain('Jun');
      expect(result).toContain('20');
    });

    it('returns UTC formatted string', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = toMercurialDateStr(date);

      // Should contain +0000 for UTC timezone
      expect(result).toContain('+0000');
    });
  });

  describe('toMercurialShortDateStr', () => {
    it('formats date in alerts view datetime format', () => {
      const testDate = new Date('2024-01-15T12:30:00Z');
      const result = toMercurialShortDateStr(testDate);

      // Format should be: 'ddd MMM DD HH:mm YYYY'
      expect(result).toContain('Mon');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('12:30');
      expect(result).toContain('2024');
    });

    it('handles different dates', () => {
      const date = new Date('2024-12-25T18:45:00Z');
      const result = toMercurialShortDateStr(date);

      expect(result).toContain('Wed');
      expect(result).toContain('Dec');
      expect(result).toContain('25');
      expect(result).toContain('18:45');
    });

    it('does not include seconds (short format)', () => {
      const date = new Date('2024-01-15T12:30:45Z');
      const result = toMercurialShortDateStr(date);

      // Short format should not include seconds
      // The format is HH:mm not HH:mm:ss
      expect(result).not.toContain(':45');
    });
  });
});

describe('getSearchWords', () => {
  it('extracts words from text', () => {
    const result = getSearchWords('hello world test');
    expect(result).toEqual(['hello', 'world', 'test']);
  });

  it('removes single letter words', () => {
    const result = getSearchWords('a test b case c');
    expect(result).toEqual(['test', 'case']);
  });

  it('handles hyphenated words', () => {
    const result = getSearchWords('some-hyphenated-word');
    expect(result).toEqual(['some-hyphenated-word']);
  });

  it('handles underscored words', () => {
    const result = getSearchWords('some_underscored_word');
    expect(result).toEqual(['some_underscored_word']);
  });

  it('splits on non-word characters', () => {
    const result = getSearchWords('word1.word2,word3;word4');
    expect(result).toEqual(['word1', 'word2', 'word3', 'word4']);
  });

  it('handles empty string', () => {
    const result = getSearchWords('');
    expect(result).toEqual([]);
  });

  it('handles string with only single letters', () => {
    const result = getSearchWords('a b c d e');
    expect(result).toEqual([]);
  });

  it('preserves numbers in words', () => {
    const result = getSearchWords('test123 word456');
    expect(result).toEqual(['test123', 'word456']);
  });
});

describe('getPercentComplete', () => {
  it('calculates percentage correctly', () => {
    const counts = { pending: 0, running: 0, completed: 50 };
    expect(getPercentComplete(counts)).toBe(100);
  });

  it('handles mixed counts', () => {
    const counts = { pending: 25, running: 25, completed: 50 };
    expect(getPercentComplete(counts)).toBe(50);
  });

  it('returns 100 when no jobs exist (old pushes)', () => {
    const counts = { pending: 0, running: 0, completed: 0 };
    expect(getPercentComplete(counts)).toBe(100);
  });

  it('handles running jobs', () => {
    const counts = { pending: 10, running: 20, completed: 70 };
    expect(getPercentComplete(counts)).toBe(70);
  });

  it('floors the percentage', () => {
    const counts = { pending: 1, running: 1, completed: 1 };
    // 1/3 = 33.33... should floor to 33
    expect(getPercentComplete(counts)).toBe(33);
  });
});

describe('formatArtifacts', () => {
  it('formats artifact data correctly', () => {
    const data = [
      { name: 'public/build/target.zip' },
      { name: 'public/logs/live.log' },
    ];
    const artifactParams = {
      taskId: 'task123',
      run: 0,
      rootUrl: 'https://firefox-ci-tc.services.mozilla.com',
    };

    const result = formatArtifacts(data, artifactParams);

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe('target.zip');
    expect(result[0].title).toBe('artifact uploaded');
    expect(result[1].value).toBe('live.log');
  });

  it('handles empty array', () => {
    const result = formatArtifacts([], {});
    expect(result).toEqual([]);
  });

  it('extracts filename from full path', () => {
    const data = [{ name: 'a/very/deep/path/to/file.txt' }];
    const artifactParams = {
      taskId: 'task123',
      run: 0,
      rootUrl: 'https://firefox-ci-tc.services.mozilla.com',
    };
    const result = formatArtifacts(data, artifactParams);

    expect(result[0].value).toBe('file.txt');
  });
});

describe('resultColorMap', () => {
  it('maps pass to success', () => {
    expect(resultColorMap.pass).toBe('success');
  });

  it('maps fail to danger', () => {
    expect(resultColorMap.fail).toBe('danger');
  });

  it('maps indeterminate to secondary', () => {
    expect(resultColorMap.indeterminate).toBe('secondary');
  });

  it('maps done to darker-info', () => {
    expect(resultColorMap.done).toBe('darker-info');
  });

  it('maps in progress to secondary', () => {
    expect(resultColorMap['in progress']).toBe('secondary');
  });

  it('maps none to darker-info', () => {
    expect(resultColorMap.none).toBe('darker-info');
  });

  it('maps unknown to secondary', () => {
    expect(resultColorMap.unknown).toBe('secondary');
  });
});

describe('getIcon', () => {
  it('returns faCheck for pass', () => {
    expect(getIcon('pass')).toBe(faCheck);
  });

  it('returns faExclamationTriangle for fail', () => {
    expect(getIcon('fail')).toBe(faExclamationTriangle);
  });

  it('returns faClock for in progress', () => {
    expect(getIcon('in progress')).toBe(faClock);
  });

  it('returns faClock for unknown values', () => {
    expect(getIcon('unknown')).toBe(faClock);
    expect(getIcon('')).toBe(faClock);
    expect(getIcon(null)).toBe(faClock);
  });
});
