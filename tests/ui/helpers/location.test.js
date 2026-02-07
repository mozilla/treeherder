import { getAllUrlParams, updateRepoParams } from '../../../ui/helpers/location';

describe('getAllUrlParams', () => {
  it('parses search string with leading question mark', () => {
    const location = { search: '?repo=autoland&revision=abc123' };
    const params = getAllUrlParams(location);

    expect(params.get('repo')).toBe('autoland');
    expect(params.get('revision')).toBe('abc123');
  });

  it('parses search string without leading question mark', () => {
    const location = { search: 'repo=try&selectedJob=12345' };
    const params = getAllUrlParams(location);

    expect(params.get('repo')).toBe('try');
    expect(params.get('selectedJob')).toBe('12345');
  });

  it('handles empty search string', () => {
    const location = { search: '' };
    const params = getAllUrlParams(location);

    expect(params.toString()).toBe('');
  });

  it('handles search string with only question mark', () => {
    const location = { search: '?' };
    const params = getAllUrlParams(location);

    expect(params.toString()).toBe('');
  });

  it('handles multiple values for same parameter', () => {
    const location = { search: '?resultStatus=success&resultStatus=testfailed' };
    const params = getAllUrlParams(location);

    expect(params.getAll('resultStatus')).toEqual(['success', 'testfailed']);
  });

  it('handles encoded characters', () => {
    const location = { search: '?author=test%40example.com' };
    const params = getAllUrlParams(location);

    expect(params.get('author')).toBe('test@example.com');
  });
});

describe('updateRepoParams', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete window.location;
    window.location = {
      search: '?repo=autoland&revision=abc123&selectedJob=456',
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('returns params without leading question mark for React Router v6', () => {
    const result = updateRepoParams('try');

    // React Router v6 Link's to={{ search: ... }} adds the ? automatically
    expect(result.startsWith('?')).toBe(false);
  });

  it('updates repo parameter to new value', () => {
    const result = updateRepoParams('mozilla-central');

    expect(result).toContain('repo=mozilla-central');
  });

  it('removes revision parameter when changing repo', () => {
    const result = updateRepoParams('try');

    expect(result).not.toContain('revision=');
  });

  it('removes author parameter when changing repo', () => {
    window.location.search = '?repo=autoland&author=test@example.com';
    const result = updateRepoParams('try');

    expect(result).not.toContain('author=');
  });

  it('preserves other parameters when changing repo', () => {
    window.location.search = '?repo=autoland&resultStatus=success&tier=1';
    const result = updateRepoParams('try');

    expect(result).toContain('resultStatus=success');
    expect(result).toContain('tier=1');
    expect(result).toContain('repo=try');
  });
});
