import FilterModel from '../../../../../ui/models/filter';
import {
  getFieldValueSuggestions,
  getPushSuggestions,
  isValidDate,
  isValidDateRange,
  getDateDaysAgo,
  loadPresets,
  savePreset,
  deletePreset,
  buildPresetParams,
  getPresetQueryString,
  getActiveFilterCount,
  hasSeenCoachMark,
  markCoachMarkSeen,
} from '../../../../../ui/job-view/headerbars/filter-panel/helpers';
import {
  FILTER_PRESETS_STORAGE_KEY,
  COACH_MARK_STORAGE_KEY,
  TYPEAHEAD_MAX_SUGGESTIONS,
} from '../../../../../ui/job-view/headerbars/filter-panel/constants';

const jobMap = {
  1: { platform: 'linux1804-64', job_type_name: 'test-a', job_group_name: 'Mochitest' },
  2: { platform: 'windows11-64', job_type_name: 'test-b', job_group_name: 'Mochitest' },
  3: { platform: 'linux1804-64', job_type_name: 'test-a', job_group_name: 'Xpcshell' },
};

const makeFilterModel = (search) =>
  new FilterModel(jest.fn(), { search, pathname: '/jobs' });

afterEach(() => localStorage.clear());

describe('getFieldValueSuggestions', () => {
  it('returns sorted distinct values for a mapped field', () => {
    expect(getFieldValueSuggestions(jobMap, 'platform')).toEqual([
      'linux1804-64',
      'windows11-64',
    ]);
  });

  it('returns empty array for unmapped fields', () => {
    expect(getFieldValueSuggestions(jobMap, 'test_paths')).toEqual([]);
  });

  it('caps the number of suggestions', () => {
    const bigMap = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [i, { platform: `plat-${String(i).padStart(2, '0')}` }]),
    );
    expect(getFieldValueSuggestions(bigMap, 'platform')).toHaveLength(
      TYPEAHEAD_MAX_SUGGESTIONS,
    );
  });
});

describe('getPushSuggestions', () => {
  it('returns distinct sorted authors and short revision hashes in push order', () => {
    const pushes = [
      { author: 'zed@mozilla.com', revision: 'abcdef1234567890abcd' },
      { author: 'amy@mozilla.com', revision: '123456abcdef7890abcd' },
      { author: 'zed@mozilla.com', revision: 'abcdef1234567890abcd' },
      { author: '', revision: null },
    ];
    const { authors, revisions } = getPushSuggestions(pushes);

    expect(authors).toEqual(['amy@mozilla.com', 'zed@mozilla.com']);
    expect(revisions).toEqual(['abcdef123456', '123456abcdef']);
  });
});

describe('date helpers', () => {
  it('validates dates', () => {
    expect(isValidDate('2026-08-01')).toBe(true);
    expect(isValidDate('')).toBe(true);
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('validates ranges', () => {
    expect(isValidDateRange('2026-08-01', '2026-08-15')).toBe(true);
    expect(isValidDateRange('2026-08-15', '2026-08-01')).toBe(false);
    expect(isValidDateRange('', '2026-08-01')).toBe(true);
    expect(isValidDateRange('2026-08-01', '')).toBe(true);
  });

  it('formats a date N days ago as YYYY-MM-DD', () => {
    expect(getDateDaysAgo(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('presets', () => {
  it('round-trips presets through localStorage', () => {
    savePreset('mine', { platform: ['linux'] });
    expect(loadPresets()).toEqual([{ name: 'mine', params: { platform: ['linux'] } }]);
  });

  it('overwrites a preset with the same name', () => {
    savePreset('mine', { platform: ['linux'] });
    savePreset('mine', { platform: ['osx'] });
    expect(loadPresets()).toEqual([{ name: 'mine', params: { platform: ['osx'] } }]);
  });

  it('deletes presets', () => {
    savePreset('a', {});
    savePreset('b', {});
    expect(deletePreset('a').map((p) => p.name)).toEqual(['b']);
  });

  it('returns [] for corrupt storage', () => {
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, '{not json');
    expect(loadPresets()).toEqual([]);
  });

  it('buildPresetParams keeps filter params, drops repo and defaults', () => {
    const fm = makeFilterModel('?repo=autoland&platform=linux&resultStatus=testfailed&selectedTaskRun=abc.1');
    const params = buildPresetParams(fm);
    expect(params.platform).toEqual(['linux']);
    expect(params.resultStatus).toEqual(['testfailed']);
    expect(params.repo).toBeUndefined();
    expect(params.selectedTaskRun).toBeUndefined();
  });

  it('getPresetQueryString prepends repo and joins arrays', () => {
    const qs = getPresetQueryString({ platform: ['linux', 'osx'] }, 'autoland');
    expect(qs).toBe('repo=autoland&platform=linux%2Cosx');
  });
});

describe('getActiveFilterCount', () => {
  it('is 0 with default filters', () => {
    expect(getActiveFilterCount(makeFilterModel('?repo=autoland'))).toBe(0);
  });

  it('counts non-default filters but not searchStr', () => {
    const fm = makeFilterModel(
      '?repo=autoland&platform=linux&startdate=2026-08-01&searchStr=foo&resultStatus=testfailed',
    );
    // platform + startdate + resultStatus (non-default) = 3; searchStr excluded
    expect(getActiveFilterCount(fm)).toBe(3);
  });
});

describe('coach mark', () => {
  it('is unseen initially, seen after marking', () => {
    expect(hasSeenCoachMark()).toBe(false);
    markCoachMarkSeen();
    expect(hasSeenCoachMark()).toBe(true);
    expect(localStorage.getItem(COACH_MARK_STORAGE_KEY)).toBeTruthy();
  });
});
