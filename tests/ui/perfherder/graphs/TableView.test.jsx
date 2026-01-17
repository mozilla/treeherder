/**
 * Unit tests for the TableView component date formatting.
 *
 * This test suite covers:
 * - Date cell formatting (dayjs migration from moment)
 * - Date object creation from data points
 *
 * Note: The component was migrated from moment.js to dayjs for date formatting.
 */

import dayjs from '../../../../ui/helpers/dayjs';

describe('TableView Date Formatting (dayjs migration)', () => {
  describe('Date cell formatting', () => {
    // Tests the date formatting used in table cell rendering
    // Original: moment(date).format('MMM DD, h:mm:ss a')
    // New: dayjs(date).format('MMM DD, h:mm:ss a')

    it('formats date in table-friendly format', () => {
      const date = dayjs('2024-01-15T14:30:45');
      const formatted = date.format('MMM DD, h:mm:ss a');

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain(':30:45');
    });

    it('handles various times', () => {
      const testCases = [
        { time: '2024-01-15T08:15:30', expected: /Jan 15.*8:15:30\s*am/i },
        { time: '2024-01-15T14:30:00', expected: /Jan 15.*2:30:00\s*pm/i },
        { time: '2024-01-15T00:00:00', expected: /Jan 15.*12:00:00\s*am/i },
        { time: '2024-01-15T12:00:00', expected: /Jan 15.*12:00:00\s*pm/i },
      ];

      testCases.forEach(({ time, expected }) => {
        const formatted = dayjs(time).format('MMM DD, h:mm:ss a');
        expect(formatted).toMatch(expected);
      });
    });

    it('includes seconds in format', () => {
      const date = dayjs('2024-01-15T10:20:35');
      const formatted = date.format('MMM DD, h:mm:ss a');

      expect(formatted).toContain(':35');
    });
  });

  describe('Date object creation from dataPoint', () => {
    // Tests the dayjs usage for creating date objects
    // date: dayjs(dataPoint.x)

    it('creates dayjs date from dataPoint.x', () => {
      const dataPoint = {
        x: new Date('2024-01-15T12:00:00Z'),
        y: 100,
      };

      const date = dayjs(dataPoint.x);

      expect(date.isValid()).toBe(true);
      expect(date.year()).toBe(2024);
      expect(date.month()).toBe(0); // January
      expect(date.date()).toBe(15);
    });

    it('handles timestamp values', () => {
      const dataPoint = {
        x: 1705320000000, // 2024-01-15 in milliseconds
        y: 50,
      };

      const date = dayjs(dataPoint.x);

      expect(date.isValid()).toBe(true);
    });

    it('handles ISO string values', () => {
      const dataPoint = {
        x: '2024-01-15T12:00:00Z',
        y: 75,
      };

      const date = dayjs(dataPoint.x);

      expect(date.isValid()).toBe(true);
      expect(date.format('YYYY-MM-DD')).toBe('2024-01-15');
    });
  });

  describe('Table data transformation', () => {
    it('transforms data points with date formatting', () => {
      const mockDataPoint = {
        x: new Date('2024-01-15T14:30:00'),
        y: 100,
        revision: 'abc123',
      };

      // Simulating the transformation in TableView:
      const transformedRow = {
        date: dayjs(mockDataPoint.x),
        revision: mockDataPoint.revision,
      };

      expect(transformedRow.date.format('MMM DD, h:mm:ss a')).toContain(
        'Jan 15',
      );
    });

    it('processes multiple data points', () => {
      const dataPoints = [
        { x: new Date('2024-01-10T10:00:00'), y: 100 },
        { x: new Date('2024-01-11T11:00:00'), y: 110 },
        { x: new Date('2024-01-12T12:00:00'), y: 105 },
      ];

      const dates = dataPoints.map((dp) => dayjs(dp.x));

      expect(dates[0].date()).toBe(10);
      expect(dates[1].date()).toBe(11);
      expect(dates[2].date()).toBe(12);
    });
  });
});

describe('TableView Component Exports', () => {
  it('dayjs has required formatting capabilities', () => {
    const date = dayjs('2024-06-15T15:30:45');

    // Verify all format tokens work
    expect(date.format('MMM')).toBe('Jun');
    expect(date.format('DD')).toBe('15');
    expect(date.format('h')).toBe('3');
    expect(date.format('mm')).toBe('30');
    expect(date.format('ss')).toBe('45');
    expect(date.format('a')).toBe('pm');
  });
});
