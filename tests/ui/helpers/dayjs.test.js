/**
 * Unit tests for the dayjs helper module.
 *
 * This test suite verifies that the dayjs instance is correctly configured
 * with all required plugins for the application:
 * - utc: For UTC timezone handling
 * - customParseFormat: For parsing custom date formats
 * - isSameOrAfter: For date comparison
 * - relativeTime: For human-readable relative time strings
 */

import dayjs from '../../../ui/helpers/dayjs';

describe('dayjs helper module', () => {
  describe('UTC plugin', () => {
    it('provides utc() method', () => {
      const utcDate = dayjs.utc('2024-01-15T12:30:00Z');
      expect(utcDate.isValid()).toBe(true);
    });

    it('parses UTC dates correctly', () => {
      const utcDate = dayjs.utc('2024-01-15T12:30:00Z');
      expect(utcDate.hour()).toBe(12);
      expect(utcDate.minute()).toBe(30);
    });

    it('formats UTC dates correctly', () => {
      const utcDate = dayjs.utc('2024-06-15T14:30:00Z');
      expect(utcDate.format('YYYY-MM-DD')).toBe('2024-06-15');
      expect(utcDate.format('HH:mm:ss')).toBe('14:30:00');
    });

    it('converts local date to UTC', () => {
      const localDate = dayjs('2024-01-15T12:30:00');
      const utcDate = localDate.utc();
      expect(utcDate.isValid()).toBe(true);
    });
  });

  describe('customParseFormat plugin', () => {
    it('parses custom date format strings', () => {
      const date = dayjs('15/01/2024', 'DD/MM/YYYY');
      expect(date.isValid()).toBe(true);
      expect(date.date()).toBe(15);
      expect(date.month()).toBe(0); // January is 0-indexed
      expect(date.year()).toBe(2024);
    });

    it('parses common date formats', () => {
      // dayjs customParseFormat supports common formats
      const date1 = dayjs('2024-01-15 12:30:45', 'YYYY-MM-DD HH:mm:ss');
      expect(date1.isValid()).toBe(true);
      expect(date1.year()).toBe(2024);

      const date2 = dayjs('15-01-2024', 'DD-MM-YYYY');
      expect(date2.isValid()).toBe(true);
    });

    it('parses ISO date format', () => {
      const date = dayjs('2024-01-15', 'YYYY-MM-DD');
      expect(date.isValid()).toBe(true);
      expect(date.year()).toBe(2024);
      expect(date.month()).toBe(0);
      expect(date.date()).toBe(15);
    });
  });

  describe('isSameOrAfter plugin', () => {
    it('provides isSameOrAfter method', () => {
      const date1 = dayjs('2024-01-15');
      const date2 = dayjs('2024-01-14');
      expect(date1.isSameOrAfter(date2)).toBe(true);
    });

    it('returns true for same dates', () => {
      const date1 = dayjs('2024-01-15');
      const date2 = dayjs('2024-01-15');
      expect(date1.isSameOrAfter(date2)).toBe(true);
    });

    it('returns false when date is before comparison date', () => {
      const date1 = dayjs('2024-01-13');
      const date2 = dayjs('2024-01-15');
      expect(date1.isSameOrAfter(date2)).toBe(false);
    });

    it('works with different units', () => {
      const date1 = dayjs('2024-01-15');
      const date2 = dayjs('2024-01-01');
      expect(date1.isSameOrAfter(date2, 'month')).toBe(true);
      expect(date1.isSameOrAfter(date2, 'year')).toBe(true);
    });
  });

  describe('relativeTime plugin', () => {
    it('provides fromNow method', () => {
      const pastDate = dayjs().subtract(1, 'hour');
      const relativeStr = pastDate.fromNow();
      expect(typeof relativeStr).toBe('string');
      expect(relativeStr).toContain('hour');
    });

    it('provides from method', () => {
      const date1 = dayjs('2024-01-15');
      const date2 = dayjs('2024-01-10');
      const relativeStr = date1.from(date2);
      expect(typeof relativeStr).toBe('string');
    });

    it('provides toNow method', () => {
      const futureDate = dayjs().add(1, 'day');
      const relativeStr = futureDate.toNow();
      expect(typeof relativeStr).toBe('string');
    });

    it('handles minutes ago', () => {
      const pastDate = dayjs().subtract(5, 'minutes');
      const relativeStr = pastDate.fromNow();
      expect(relativeStr).toContain('minute');
    });

    it('handles days ago', () => {
      const pastDate = dayjs().subtract(3, 'days');
      const relativeStr = pastDate.fromNow();
      expect(relativeStr).toContain('day');
    });
  });

  describe('isAfter method (built-in)', () => {
    it('compares dates correctly', () => {
      const date1 = dayjs('2024-01-15');
      const date2 = dayjs('2024-01-14');
      expect(date1.isAfter(date2)).toBe(true);
      expect(date2.isAfter(date1)).toBe(false);
    });

    it('works with dayjs instances', () => {
      const now = dayjs();
      const past = dayjs().subtract(1, 'day');
      expect(now.isAfter(past)).toBe(true);
    });
  });

  describe('format method', () => {
    it('formats dates with various patterns', () => {
      const date = dayjs('2024-06-15T14:30:45');

      expect(date.format('YYYY')).toBe('2024');
      expect(date.format('MM')).toBe('06');
      expect(date.format('DD')).toBe('15');
      expect(date.format('HH:mm')).toBe('14:30');
      expect(date.format('MMM')).toBe('Jun');
      expect(date.format('ddd')).toBe('Sat');
    });

    it('formats ISO date strings', () => {
      const date = dayjs('2024-01-15T12:30:00');
      expect(date.format('YYYY-MM-DD')).toBe('2024-01-15');
    });

    it('handles the mercurial date format', () => {
      const date = dayjs.utc('2024-01-15T12:30:45Z');
      const formatted = date.format('ddd MMM DD HH:mm:ss YYYY ZZ');
      expect(formatted).toContain('Mon');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('12:30:45');
      expect(formatted).toContain('2024');
    });
  });

  describe('subtract and add methods', () => {
    it('subtracts time correctly', () => {
      const date = dayjs('2024-01-15');
      const earlier = date.subtract(5, 'days');
      expect(earlier.format('YYYY-MM-DD')).toBe('2024-01-10');
    });

    it('adds time correctly', () => {
      const date = dayjs('2024-01-15');
      const later = date.add(5, 'days');
      expect(later.format('YYYY-MM-DD')).toBe('2024-01-20');
    });

    it('handles month subtraction', () => {
      const date = dayjs('2024-03-15');
      const earlier = date.subtract(1, 'month');
      expect(earlier.format('YYYY-MM')).toBe('2024-02');
    });

    it('handles seconds subtraction', () => {
      const date = dayjs('2024-01-15T12:30:45');
      const earlier = date.subtract(30, 'seconds');
      expect(earlier.format('HH:mm:ss')).toBe('12:30:15');
    });
  });

  describe('toDate method', () => {
    it('converts dayjs instance to JavaScript Date', () => {
      const dayjsDate = dayjs('2024-01-15T12:30:00');
      const jsDate = dayjsDate.toDate();

      expect(jsDate instanceof Date).toBe(true);
      expect(jsDate.getFullYear()).toBe(2024);
    });
  });

  describe('isValid method', () => {
    it('returns true for valid dates', () => {
      expect(dayjs('2024-01-15').isValid()).toBe(true);
      expect(dayjs(new Date()).isValid()).toBe(true);
    });

    it('returns false for invalid dates', () => {
      expect(dayjs('invalid-date').isValid()).toBe(false);
      expect(dayjs('').isValid()).toBe(false);
    });
  });
});
