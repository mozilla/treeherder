import { splitLogIntoLines } from '../../../ui/logviewer/logviewerHelpers';

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
