import {
  resolveLogLine,
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

describe('resolveLogLine', () => {
  const at = (stamp) => Date.parse(stamp);
  const log = [
    '[taskcluster 2026-09-04T14:08:00.000Z] Task ID: abc',
    '[fetches 2026-09-04T14:08:10.000Z] downloading',
    '[task 2026-09-04T14:08:33.047+00:00] 14:08:33     INFO - ConsoleLogger online',
    '[task 2026-09-04T14:08:40.000+00:00] 14:08:40     INFO - TEST-START | a.html',
    '[taskcluster 2026-09-04T14:08:45.000Z] [taskcluster-proxy] Successfully refreshed credentials',
    '[task 2026-09-04T14:08:50.000+00:00] 14:08:50  WARNING - TEST-UNEXPECTED-FAIL | a.html | boom',
    '[task 2026-09-04T14:08:51.000+00:00] 14:08:51     INFO - TEST-START | b.html',
    '[task 2026-09-04T14:09:40.000+00:00] 14:09:40     INFO - TEST-START | a.html',
    '[task 2026-09-04T14:09:50.000+00:00] 14:09:50  WARNING - TEST-UNEXPECTED-FAIL | a.html | boom',
    '[task 2026-09-04T14:09:51.000+00:00] 14:09:51     INFO - SUITE-END | took 80s',
  ];

  test('finds the line holding every text, whatever the worker injected', () => {
    expect(resolveLogLine(log, ['b.html', 'TEST-START'], null)).toBe(7);
  });

  test('tells repeated runs apart by the time run-task stamped', () => {
    const texts = ['a.html', 'boom'];
    expect(resolveLogLine(log, texts, at('2026-09-04T14:08:49.900Z'))).toBe(6);
    expect(resolveLogLine(log, texts, at('2026-09-04T14:09:49.900Z'))).toBe(9);
  });

  test('picks the line printed after the record, however late', () => {
    // xpcshell replays a failing test's statuses when the test ends: a failure
    // early in the second run is closer in time to the first run's line.
    const time = at('2026-09-04T14:08:52.000Z');
    expect(resolveLogLine(log, ['a.html', 'boom'], time)).toBe(9);
  });

  test('tells apart runs repeated within a second, as test-verify does', () => {
    const runs = [0, 450, 900, 1350].map(
      (offset) =>
        `[task ${new Date(at('2026-09-04T14:10:00.000Z') + offset + 1).toISOString()}] 14:10:00     INFO - TEST-START | tv.js`,
    );
    [0, 450, 900, 1350].forEach((offset, run) => {
      const time = at('2026-09-04T14:10:00.000Z') + offset;
      expect(resolveLogLine(runs, ['tv.js', 'TEST-START'], time)).toBe(run + 1);
    });
  });

  test('accepts a line stamped a timer tick before its record', () => {
    // Windows: the harness and run-task read the clock at different resolutions.
    const time = at('2026-09-04T14:09:50.015Z');
    expect(resolveLogLine(log, ['a.html', 'boom'], time)).toBe(9);
  });

  test('picks the last match when every one was stamped before the record', () => {
    const time = at('2026-09-04T15:00:00.000Z');
    expect(resolveLogLine(log, ['a.html', 'boom'], time)).toBe(9);
  });

  test('returns the first match without a time', () => {
    expect(resolveLogLine(log, ['a.html', 'boom'], null)).toBe(6);
    expect(resolveLogLine(log, ['a.html', 'boom'])).toBe(6);
  });

  test('returns the first match in a log without [task] stamps', () => {
    const bare = log.map((line) => line.replace(/^\[task [^\]]+\] /, ''));
    expect(
      resolveLogLine(bare, ['a.html', 'boom'], at('2026-09-04T14:09:49.900Z')),
    ).toBe(6);
  });

  test('still matches a line another process glued a fragment onto', () => {
    const glued = [...log];
    glued[8] =
      '[task 2026-09-04T14:09:50.000+00:00] pulse: no newline14:09:50  WARNING - TEST-UNEXPECTED-FAIL | a.html | boom';
    expect(
      resolveLogLine(glued, ['a.html', 'boom'], at('2026-09-04T14:09:49.900Z')),
    ).toBe(9);
  });

  test('falls back to the first text, the test path, from that time on', () => {
    const texts = ['a.html', 'Test started but never finished'];
    expect(resolveLogLine(log, texts, at('2026-09-04T14:09:40.000Z'))).toBe(8);
  });

  test('returns null when nothing matches', () => {
    expect(resolveLogLine(log, ['not in the log'], null)).toBeNull();
    expect(resolveLogLine(log, [], null)).toBeNull();
    expect(resolveLogLine([], ['a.html'], null)).toBeNull();
    expect(resolveLogLine(null, ['a.html'], null)).toBeNull();
  });
});
