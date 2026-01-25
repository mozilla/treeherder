/**
 * Unit tests for the revision helper module.
 *
 * This test suite covers:
 * - parseAuthor: Parses author strings into name and email
 * - isSHAorCommit: Checks if a string is a SHA or commit URL
 * - getRevisionTitle: Extracts clean title from revision comments
 * - thTitleSuffixLimit: Title length limit constant
 */

import {
  parseAuthor,
  isSHAorCommit,
  getRevisionTitle,
  thTitleSuffixLimit,
} from '../../../ui/helpers/revision';

describe('parseAuthor', () => {
  it('parses author with name and email in angle brackets', () => {
    const result = parseAuthor('John Doe <john@example.com>');

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
  });

  it('capitalizes first letter of each word in name', () => {
    const result = parseAuthor('john doe <john@example.com>');

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
  });

  it('handles author with only name (no email)', () => {
    const result = parseAuthor('John Doe');

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('');
  });

  it('handles author with empty angle brackets', () => {
    const result = parseAuthor('John Doe <>');

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('');
  });

  it('handles single word name', () => {
    const result = parseAuthor('admin <admin@example.com>');

    expect(result.name).toBe('Admin');
    expect(result.email).toBe('admin@example.com');
  });

  it('preserves capitalization in middle of words', () => {
    const result = parseAuthor('mcDonald <test@example.com>');

    // First letter capitalized, rest preserved
    expect(result.name).toBe('McDonald');
  });

  it('handles multiple angle brackets', () => {
    const result = parseAuthor('John <john@example.com> extra');

    expect(result.name).toBe('John');
    expect(result.email).toBe('john@example.com');
  });

  it('trims whitespace from name', () => {
    const result = parseAuthor('  John Doe   <john@example.com>');

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('john@example.com');
  });
});

describe('isSHAorCommit', () => {
  it('returns true for 12-character hex SHA', () => {
    expect(isSHAorCommit('abcdef123456')).toBe(true);
  });

  it('returns true for 40-character hex SHA', () => {
    expect(isSHAorCommit('abcdef1234567890abcdef1234567890abcdef12')).toBe(
      true,
    );
  });

  it('returns true for any SHA between 12 and 40 characters', () => {
    expect(isSHAorCommit('abcdef12345678')).toBe(true); // 14 chars
    expect(isSHAorCommit('abcdef1234567890abcdef')).toBe(true); // 22 chars
  });

  it('returns false for SHA shorter than 12 characters', () => {
    expect(isSHAorCommit('abcdef12345')).toBe(false); // 11 chars
    expect(isSHAorCommit('abc')).toBe(false);
  });

  it('returns false for SHA longer than 40 characters', () => {
    expect(isSHAorCommit('abcdef1234567890abcdef1234567890abcdef123')).toBe(
      false,
    ); // 41 chars
  });

  it('returns false for non-hex characters', () => {
    expect(isSHAorCommit('ghijkl123456')).toBe(false); // g-l are not hex
    expect(isSHAorCommit('ABCDEF123456')).toBe(false); // uppercase not matched
  });

  it('returns true for hg.mozilla.org URL', () => {
    expect(
      isSHAorCommit('https://hg.mozilla.org/mozilla-central/rev/abcdef123456'),
    ).toBe(true);
  });

  it('returns true for any string containing hg.mozilla.org', () => {
    expect(isSHAorCommit('check out hg.mozilla.org for more')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isSHAorCommit('')).toBe(false);
  });

  it('returns false for regular text', () => {
    expect(isSHAorCommit('hello world')).toBe(false);
    expect(isSHAorCommit('Bug 12345')).toBe(false);
  });
});

describe('getRevisionTitle', () => {
  it('extracts title from single revision', () => {
    const revisions = [{ comments: 'Fix bug 12345 - Add feature' }];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345 - Add feature');
  });

  it('uses first line only from multiline comments', () => {
    const revisions = [
      {
        comments: 'First line title\nSecond line description\nThird line',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('First line title');
  });

  it('strips try: syntax from title', () => {
    const revisions = [
      {
        comments: 'Fix bug 12345 try: -b o -p linux -u mochitest',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345');
  });

  it('strips r= reviewer syntax from title', () => {
    const revisions = [
      {
        comments: 'Fix bug 12345 r=reviewer',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345');
  });

  it('strips sr= super reviewer syntax from title', () => {
    const revisions = [
      {
        comments: 'Fix bug 12345 sr=superreviewer',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345');
  });

  it('strips f= feedback syntax from title', () => {
    const revisions = [
      {
        comments: 'Fix bug 12345 f=feedback',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345');
  });

  it('strips a= approval syntax from title', () => {
    const revisions = [
      {
        comments: 'Fix bug 12345 a=approval',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345');
  });

  it('strips imported patch prefix', () => {
    const revisions = [
      {
        comments: 'imported patch some-patch-name',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('some-patch-name');
  });

  it('strips [mq]: prefix', () => {
    const revisions = [
      {
        comments: '[mq]: some-queue-item',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('some-queue-item');
  });

  it('strips trailing punctuation and whitespace', () => {
    const revisions = [
      {
        comments: 'Fix bug 12345; , - . ',
      },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Fix bug 12345');
  });

  it('truncates title longer than limit', () => {
    const longTitle = 'A'.repeat(100);
    const revisions = [{ comments: longTitle }];
    const result = getRevisionTitle(revisions);

    expect(result).toHaveLength(thTitleSuffixLimit);
    expect(result).toBe(`${'A'.repeat(thTitleSuffixLimit - 3)}...`);
  });

  it('skips revisions with empty comments and uses next', () => {
    const revisions = [
      { comments: '' },
      { comments: '   ' },
      { comments: 'Valid title' },
    ];
    const result = getRevisionTitle(revisions);

    expect(result).toBe('Valid title');
  });

  it('returns empty string for revisions with only whitespace comments', () => {
    const revisions = [{ comments: '' }, { comments: '   ' }];
    const result = getRevisionTitle(revisions);

    // The function processes the last revision and returns trimmed result
    expect(result).toBe('');
  });

  it('handles revision with only try: syntax (returns empty string)', () => {
    const revisions = [{ comments: 'try: -b o -p linux' }];
    const result = getRevisionTitle(revisions);

    // After stripping try: and trailing punctuation/whitespace, returns empty
    expect(result).toBe('');
  });

  it('handles empty revisions array', () => {
    const result = getRevisionTitle([]);

    expect(result).toBeUndefined();
  });
});

describe('thTitleSuffixLimit constant', () => {
  it('is defined as 70', () => {
    expect(thTitleSuffixLimit).toBe(70);
  });
});
