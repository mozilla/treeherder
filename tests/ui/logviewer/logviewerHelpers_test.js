import {
  resolveConsoleLine,
  splitLogIntoLines,
} from '../../../ui/logviewer/logviewerHelpers';

describe('splitLogIntoLines', () => {
  test('splits on LF (\\n)', () => {
    expect(splitLogIntoLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  test('splits on bare CR (\\r) the same way the backend parser does', () => {
    // The backend records error line_numbers via Python bytes.splitlines(),
    // which breaks on bare carriage returns. A plain split('\n') would NOT,
    // leaving "a\rb" as a single line and shifting every later line number.
    expect(splitLogIntoLines('a\rb\rc')).toEqual(['a', 'b', 'c']);
  });

  test('treats CRLF (\\r\\n) as a single break with no empty line or trailing CR', () => {
    expect(splitLogIntoLines('a\r\nb\r\nc')).toEqual(['a', 'b', 'c']);
  });

  test('keeps the same line count across mixed CR / CRLF / LF endings', () => {
    expect(splitLogIntoLines('a\nb\rc\r\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  test('a bare CR before an error line shifts subsequent line indexes (regression)', () => {
    // Reproduces the highlight-offset bug: the failure line sits after a bare CR.
    // With split('\n') the failure would land at index 1; the backend counts the
    // CR as a line break, so the matching display index must be 2.
    const log = 'header\rprogress\nTEST-UNEXPECTED-FAIL\ntrailer';
    const lines = splitLogIntoLines(log);
    expect(lines).toEqual([
      'header',
      'progress',
      'TEST-UNEXPECTED-FAIL',
      'trailer',
    ]);
    expect(lines[2]).toBe('TEST-UNEXPECTED-FAIL');
  });
});

describe('resolveConsoleLine', () => {
  const anchor = 'ConsoleLogger online at 20260904 14:08:33Z in /builds/worker';
  const log = [
    '[taskcluster 2026-09-04T14:08:00.000Z] Task ID: abc',
    '[fetches 2026-09-04T14:08:10.000Z] downloading',
    `[task 2026-09-04T14:08:33.047+00:00] 14:08:33     INFO - ${anchor}`,
    '[task 2026-09-04T14:08:33.048+00:00] 14:08:33     INFO - Using env: {}',
    '[task 2026-09-04T14:08:40.000+00:00] 14:08:40     INFO - TEST-START | a.html',
    '[taskcluster 2026-09-04T14:08:45.000Z] [taskcluster-proxy] Successfully refreshed credentials',
    '[task 2026-09-04T14:08:50.000+00:00] 14:08:50  WARNING - TEST-UNEXPECTED-FAIL | a.html | boom',
    '[task 2026-09-04T14:08:51.000+00:00] 14:08:51     INFO - SUITE-END | took 10s',
  ];

  test('maps the anchor line to itself', () => {
    expect(resolveConsoleLine(log, anchor, 1, 1)).toBe(3);
  });

  test('offsets by the preamble before the anchor', () => {
    expect(resolveConsoleLine(log, anchor, 1, 3)).toBe(5);
  });

  test('skips lines the worker injected after the anchor', () => {
    // The proxy refresh at log line 6 was never counted by mozharness.
    expect(resolveConsoleLine(log, anchor, 1, 4)).toBe(7);
    expect(resolveConsoleLine(log, anchor, 1, 5)).toBe(8);
  });

  test('honours an anchor that is not mozharness line 1', () => {
    expect(resolveConsoleLine(log, anchor, 2, 4)).toBe(5);
  });

  test('handles logs without the [task] prefix (generic-worker)', () => {
    const bare = log.map((line) => line.replace(/^\[task [^\]]+\] /, ''));
    expect(resolveConsoleLine(bare, anchor, 1, 4)).toBe(7);
  });

  test('returns null when the anchor is missing or the line is out of range', () => {
    expect(resolveConsoleLine(log, 'not in the log', 1, 2)).toBeNull();
    expect(resolveConsoleLine(log, anchor, 1, 99)).toBeNull();
    expect(resolveConsoleLine(log, anchor, 1, 0)).toBeNull();
    expect(resolveConsoleLine(log, anchor, 5, 2)).toBeNull();
    expect(resolveConsoleLine([], anchor, 1, 1)).toBeNull();
  });
});
